/**
 * Member unavailability, end to end through the schema.
 *
 * v1 had this and v2 dropped it. It reads as three broken queries, but the
 * real defect was allocation: an unavailable member stayed in the pool and
 * kept being handed work while they were away. These rows are mostly about
 * that, not about the query shape.
 *
 *   node availability.test.mjs
 */
import { build } from "esbuild";
import { graphql } from "graphql";
import fs from "node:fs";

const outfile = "./.availability-bundle.mjs";
await build({
  entryPoints: ["src/mocks/schema-v2.ts"],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile,
  loader: { ".json": "json" },
  external: ["graphql", "@graphql-tools/schema"],
  logLevel: "silent",
});
const { schemaV2 } = await import(`${outfile}?t=${Date.now()}`);

const run = async (source, variableValues) => {
  const r = await graphql({ schema: schemaV2, source, variableValues });
  return r;
};

let pass = 0;
let fail = 0;
const check = (name, actual, expected) => {
  if (JSON.stringify(actual) === JSON.stringify(expected)) pass += 1;
  else {
    fail += 1;
    console.log(`  FAIL  ${name}\n        expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
};
const ok = (name, cond, detail = "") => {
  if (cond) pass += 1;
  else {
    fail += 1;
    console.log(`  FAIL  ${name}${detail ? `  ${detail}` : ""}`);
  }
};

const iso = (offsetDays) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
};

/* Pick a team with a group that has more than one member, so removing one
   still leaves the group able to take work. */
const seed = await run(`{
  optimaTeamsV2 { id name groups { id name members { id firstName lastName } } }
}`);
if (seed.errors) {
  console.log("seed failed:", seed.errors.map((e) => e.message).join(" | "));
  process.exit(1);
}
const team = seed.data.optimaTeamsV2.find((t) =>
  t.groups.some((g) => g.members.length >= 2),
);
const group = team.groups.find((g) => g.members.length >= 2);
const victim = group.members[0];

console.log(`using ${team.name} / ${group.name}, ${group.members.length} members`);

/* ── baseline ──────────────────────────────────────────────────────────── */
console.log("\nbaseline");

const before = await run(
  `query ($id: ID!) { optimaTeamV2(id: $id) {
     members { id unavailableToday }
     members2: members(availableOnly: true) { id }
   } }`,
  { id: team.id },
);
ok("nobody is unavailable to start", before.data.optimaTeamV2.members.every((m) => !m.unavailableToday));
check(
  "availableOnly returns everyone",
  before.data.optimaTeamV2.members2.length,
  before.data.optimaTeamV2.members.length,
);

const preview = (id) =>
  run(`query ($id: ID!) { optimaAllocationPreview(teamId: $id, itemCount: 300) {
         byAssignee { userId name assigned }
       } }`, { id });

const basePreview = await preview(team.id);
const baseAssignees = basePreview.data.optimaAllocationPreview.byAssignee;
ok("the victim receives work before any window", baseAssignees.some((a) => String(a.userId) === String(victim.id)),
   `victim ${victim.id} not in baseline pool`);

/* ── setting a window ──────────────────────────────────────────────────── */
console.log("\nsetting a window");

const SET = `mutation ($input: OptimaTeamUserUnavailabilityInput!) {
  optimaTeamUserUnavailabilitySet(input: $input) {
    id userId startDate endDate reason cancelled activeToday
  }
}`;

const set = await run(SET, {
  input: {
    teamId: team.id,
    userId: victim.id,
    startDate: iso(-1),
    endDate: iso(3),
    reason: "Annual leave",
    action: "REDISTRIBUTE",
  },
});
ok("the window is created", !set.errors, set.errors?.map((e) => e.message).join(" | "));
check("it is active today", set.data?.optimaTeamUserUnavailabilitySet?.activeToday, true);
check("it is not cancelled", set.data?.optimaTeamUserUnavailabilitySet?.cancelled, false);
const windowId = set.data?.optimaTeamUserUnavailabilitySet?.id;

/* ── the part that matters ─────────────────────────────────────────────── */
console.log("\nallocation excludes them");

const after = await run(
  `query ($id: ID!) { optimaTeamV2(id: $id) {
     members { id unavailableToday }
     members2: members(availableOnly: true) { id }
   } }`,
  { id: team.id },
);
check(
  "the member reads unavailable today",
  after.data.optimaTeamV2.members.find((m) => m.id === victim.id)?.unavailableToday,
  true,
);
check(
  "availableOnly drops exactly one",
  after.data.optimaTeamV2.members2.length,
  before.data.optimaTeamV2.members2.length - 1,
);
ok(
  "availableOnly drops the right one",
  !after.data.optimaTeamV2.members2.some((m) => m.id === victim.id),
);

const afterPreview = await preview(team.id);
const afterAssignees = afterPreview.data.optimaAllocationPreview.byAssignee;
ok(
  "THE FIX: an unavailable member is given no work",
  !afterAssignees.some((a) => String(a.userId) === String(victim.id)),
  `victim ${victim.id} still in the pool`,
);
ok(
  "their colleagues still get work",
  afterAssignees.length > 0,
);

/* ── validation, following v1 ──────────────────────────────────────────── */
console.log("\nvalidation");

const overlap = await run(SET, {
  input: { teamId: team.id, userId: victim.id, startDate: iso(0), endDate: iso(1), action: "REDISTRIBUTE" },
});
ok("an overlapping window is rejected", !!overlap.errors,
   "overlap was accepted, so 'is this person away' becomes ambiguous");

const inverted = await run(SET, {
  input: { teamId: team.id, userId: group.members[1].id, startDate: iso(5), endDate: iso(2), action: "REDISTRIBUTE" },
});
ok("an inverted range is rejected", !!inverted.errors);

const stranger = await run(SET, {
  input: { teamId: team.id, userId: "999999", startDate: iso(1), endDate: iso(2), action: "REDISTRIBUTE" },
});
ok("a non-member is rejected", !!stranger.errors);

/* ── cancelling ────────────────────────────────────────────────────────── */
console.log("\ncancelling");

const cancelled = await run(
  `mutation ($id: ID!) { optimaTeamUserUnavailabilityCancel(id: $id) { id cancelled activeToday } }`,
  { id: windowId },
);
check("the window is cancelled", cancelled.data?.optimaTeamUserUnavailabilityCancel?.cancelled, true);
check("and no longer active", cancelled.data?.optimaTeamUserUnavailabilityCancel?.activeToday, false);

const restored = await run(
  `query ($id: ID!) { optimaTeamV2(id: $id) { members(availableOnly: true) { id } } }`,
  { id: team.id },
);
check(
  "the member is available again",
  restored.data.optimaTeamV2.members.length,
  before.data.optimaTeamV2.members2.length,
);

const restoredPreview = await preview(team.id);
ok(
  "and receives work again",
  restoredPreview.data.optimaAllocationPreview.byAssignee.some(
    (a) => String(a.userId) === String(victim.id),
  ),
);

/* ── a cancelled window is kept, not deleted ───────────────────────────── */
const history = await run(
  `query ($id: ID!) { optimaTeamV2(id: $id) { members { id unavailabilities { id cancelled } } } }`,
  { id: team.id },
);
const kept = history.data.optimaTeamV2.members
  .find((m) => m.id === victim.id)
  ?.unavailabilities.some((u) => u.id === windowId && u.cancelled);
ok("the cancelled window is kept for audit, not deleted", !!kept);

fs.rmSync(outfile, { force: true });
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
