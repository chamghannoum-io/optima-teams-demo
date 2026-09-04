/**
 * Replays the captured production run against the v2 model.
 *
 * The fixtures in docs/prod-run-fixtures.json are the real tool responses from a
 * live v1 run (541 work items, 8 teams). Serving those to the v2 workflow shows
 * exactly what the new model would have done with the same day's work — which is
 * the comparison that matters, and needs no gateway access.
 *
 *   node replay.mjs            dry run
 *   node replay.mjs --commit   also calls T-0005
 */
import fs from "node:fs";

const D = "../docs/";
const wf = JSON.parse(fs.readFileSync(D + "RCM Auto-Assignment v2.json", "utf8"));
const fx = JSON.parse(fs.readFileSync(D + "prod-run-fixtures.json", "utf8"));
const v2Teams = JSON.parse(fs.readFileSync(D + "prod-teams-v2.json", "utf8"));
const codeOf = (n) => wf.nodes.find((x) => x.name === n).parameters.jsCode;
const DRY = !process.argv.includes("--commit");

/* n8n runtime shim — runs the workflow's own Code nodes */
const store = {};
function run(name, input) {
  const $input = { all: () => input };
  const $ = (n) => ({ first: () => store[n]?.[0], all: () => store[n] ?? [], item: store[n]?.[0] });
  const pad = (n) => String(n).padStart(2, "0");
  const d = new Date();
  const $today = {
    format: () => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    plus: () => ({ format: () => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate() + 1)}` }),
  };
  const out = new Function("$input", "$", "$today", codeOf(name))($input, $, $today);
  const arr = Array.isArray(out) ? out : [out];
  store[name] = arr;
  return arr;
}

console.log(`=== REPLAY of the captured production run — ${DRY ? "DRY" : "COMMIT"} ===\n`);

store["Webhook"] = [{
  json: {
    headers: { "x-correlation-id": "replay-prod", "x-organization-api-key": "«redacted»" },
    body: { fromDate: "2026-09-02", toDate: "2026-09-03", branchIds: [],
            workItemTypes: ["AUTHORIZATION_SUBMISSION", "AUTHORIZATION_RESUBMISSION"],
            dryRun: DRY },
  },
}];
run("extractInfo", store["Webhook"]);

// T-0001 — the real unassigned queue
store["Step 0 - Unassigned Items"] = [{ json: { data: { assignmentUnassignedEntities: fx.assignmentUnassignedEntities } } }];
const rawItems = fx.assignmentUnassignedEntities.reduce((n, e) => n + (e.workItems?.length ?? 0), 0);
console.log(`T-0001  ${rawItems} work items across ${fx.assignmentUnassignedEntities.length} entities (real)`);

run("Rank Items", store["Step 0 - Unassigned Items"]);
const ranked = store["Rank Items"][0].json;
console.log(`Rank    ${ranked.items.length} ranked · top ${ranked.items[0]?.rank} · lowest ${ranked.items.at(-1)?.rank}`);

// T-0002 — the real teams, converted to v2 shape
store["Step 1 - Get Teams"] = [{ json: { data: { optimaTeams: v2Teams } } }];
console.log(`T-0002  ${v2Teams.length} teams, ${v2Teams.reduce((n, t) => n + t.groups.length, 0)} groups (real, v2 shape)`);

run("Match Groups", store["Rank Items"]);
const m = store["Match Groups"][0].json;
console.log(`Match   ${m.assignments.length} matched · ${m.unmatched.length} unmatched · ${m.userIds.length} members`);

// T-0003 / T-004 — real counts and capacities, filtered to the members in play
const inPlay = new Set(m.userIds.map(String));
const counts = fx.usersWorkTypeAssignedCounts.filter((c) => inPlay.has(String(c.userId)));
const caps = fx.effectiveAssignmentSettings.filter((c) => inPlay.has(String(c.userId)));
store["Step 2 - Assigned Counts"] = [{ json: { data: { usersWorkTypeAssignedCounts: counts } } }];
// Real settings only cover some users; fall back to the real team default for the rest.
const known = new Set(caps.map((c) => String(c.userId)));
const filled = [...caps, ...[...inPlay].filter((u) => !known.has(u))
  .map((u) => ({ userId: u, teamId: null, maxClaim: 0, maxAuth: 200, source: "TEAM_DEFAULT" }))];
store["Step 3 - Capacities"] = [{ json: { data: { effectiveAssignmentSettings: filled } } }];
console.log(`T-0003  ${counts.length} count rows (real)`);
console.log(`T-004   ${caps.length} real capacities + ${filled.length - caps.length} defaulted (maxAuth 200)`);

const batches = run("Distribute", store["Step 3 - Capacities"]);
const live = batches.filter((b) => !b.json.skipped);
console.log(`Distr.  ${live.length} assignee batches`);

store["Step 4 - Assign"] = DRY ? [] : live.map((b) => ({
  json: { data: { assignWorkItems: { success: true, totalCount: b.json.workItemIds.length,
    message: `Assigned ${b.json.workItemIds.length} to ${b.json.assigneeId}` } } },
}));
console.log(`T-0005  ${DRY ? "skipped (dry run)" : store["Step 4 - Assign"].length + " calls"}`);

run("Summarise", batches);
const s = store["Summarise"][0].json;
console.log("\n─── v2 RESULT ON THE REAL DAY ───────────────────");
console.log(JSON.stringify(s.totals, null, 1));
console.log("\nby group:");
for (const g of s.byGroup.sort((a, b) => b.matched - a.matched)) {
  console.log(`  ${String(g.matched).padStart(4)}  ${g.group}`);
}
console.log("\ntop assignees:");
for (const a of s.byAssignee.sort((x, y) => y.count - x.count).slice(0, 6)) {
  console.log(`  ${String(a.count).padStart(4)}  user ${a.assigneeId}  (${a.workItemType.replace("AUTHORIZATION_", "AUTH ")})`);
}
if (m.unmatched.length) {
  const by = {};
  for (const u of m.unmatched) by[u.reason] = (by[u.reason] ?? 0) + 1;
  console.log("\nunmatched:");
  for (const [r, n] of Object.entries(by)) console.log(`  ${String(n).padStart(4)}  ${r}`);
  const depts = {};
  for (const u of m.unmatched) if (u.department) depts[u.department] = (depts[u.department] ?? 0) + 1;
  const top = Object.entries(depts).sort((a, b) => b[1] - a[1]).slice(0, 6);
  if (top.length) {
    console.log("  worst departments:");
    for (const [d, n] of top) console.log(`     ${String(n).padStart(4)}  ${d}`);
  }
}
