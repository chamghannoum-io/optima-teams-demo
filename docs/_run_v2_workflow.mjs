/**
 * Executes the v2 workflow's Code nodes end to end against real v2 team data,
 * standing in for the five gateway tools. This is the same JS n8n would run —
 * lifted straight out of the workflow JSON, not a reimplementation — so a green
 * run here means the node logic is sound before it ever reaches n8n.
 */
import fs from "node:fs";

const wf = JSON.parse(fs.readFileSync("RCM Auto-Assignment v2.json", "utf8"));
const teams = JSON.parse(fs.readFileSync("../standalone/src/mocks/teams-v2-real.json", "utf8"));
const volumes = JSON.parse(fs.readFileSync("../standalone/src/mocks/volumes.json", "utf8"));

const codeOf = (name) => wf.nodes.find((n) => n.name === name).parameters.jsCode;

/* ── stand-ins for the five gateway tools ───────────────────────────────── */

function rng(seed) {
  let x = seed || 1;
  return () => ((x = (x * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
}

/** T-0001 assignmentUnassignedEntities */
function toolUnassigned(perTeam = 40) {
  return teams.map((t) => {
    const rand = rng(Number(t.id) * 7919);
    const byDept = t.logicAxis === "DEPARTMENT";
    const vols = byDept
      ? volumes.bySite.departments[t.siteKey]
      : volumes.bySite.payers[t.siteKey];
    const entries = Object.entries(vols || {});
    const total = entries.reduce((a, [, v]) => a + v, 0) || 1;
    const types = [...new Set(t.groups.flatMap((g) => g.workItemTypes))];
    const statuses = [...new Set(t.groups.flatMap((g) => g.claimStatuses))];
    const encs = t.encounterScope === "BOTH" ? ["OP", "IP"] : [t.encounterScope];

    const workItems = [];
    for (let i = 0; i < perTeam; i++) {
      let r = rand() * total;
      let key = entries[0]?.[0] ?? "";
      for (const [k, v] of entries) { r -= v; if (r <= 0) { key = k; break; } }
      const age = Math.round(rand() * 9);
      workItems.push({
        id: `${t.id}-${i + 1}`,
        priority: ["HIGH", "MEDIUM", "LOW"][Math.floor(rand() * 3)],
        encounterType: encs[Math.floor(rand() * encs.length)],
        department: byDept ? key : null,
        insurancePayer: byDept ? null : key,
        claimStatus: statuses.length ? statuses[Math.floor(rand() * statuses.length)] : null,
        startDate: new Date(Date.now() - age * 86400000).toISOString(),
        net: byDept ? null : Math.round(rand() * 4000),
      });
    }
    return {
      branchId: t.id,
      facilityId: t.facilityId,
      workItemType: types[0] ?? "CLAIM_VALIDATION",
      workItems,
    };
  });
}

/** T-0002 optimaTeams — v2 shape, groups included */
function toolTeams() {
  return teams.map((t) => ({
    id: t.id, name: t.name, active: t.active,
    logicAxis: t.logicAxis, division: t.division, encounterScope: t.encounterScope,
    branchId: t.id,
    branches: [{ id: t.id, healthLicense: t.facilityId }],
    groups: t.groups.map((g) => ({
      id: g.id, name: g.name, active: g.active,
      workItemTypes: g.workItemTypes, encounterScope: g.encounterScope,
      departments: g.departments, payers: g.payers, payerCatchAll: g.payerCatchAll,
      claimStatuses: g.claimStatuses,
      members: g.members.map((m) => ({ id: m.id })),
    })),
  }));
}

/** T-0003 usersWorkTypeAssignedCounts */
function toolCounts(userIds, workItemTypes) {
  return userIds.flatMap((u, i) =>
    (workItemTypes.length ? workItemTypes : ["CLAIM_VALIDATION"]).map((wt) => ({
      userId: u, workItemType: wt, assigned: (i * 7) % 23,
    }))
  );
}

/** T-004 effectiveAssignmentSettings */
const toolCaps = (userIds) =>
  userIds.map((u) => ({ userId: u, teamId: null, maxAuth: 150, maxClaim: 150, source: "TEAM" }));

/** T-0005 assignWorkItems */
const toolAssign = (input) => ({
  success: true,
  message: `Assigned ${input.workItemIds.length} to ${input.assigneeId}`,
  totalCount: input.workItemIds.length,
});

/* ── n8n runtime shim ───────────────────────────────────────────────────── */

const store = {};
function run(nodeName, inputItems) {
  const js = codeOf(nodeName);
  const $input = { all: () => inputItems };
  const $ = (n) => ({
    first: () => store[n]?.[0],
    all: () => store[n] ?? [],
    item: store[n]?.[0],
  });
  const pad = (n) => String(n).padStart(2, "0");
  const d = new Date();
  const $today = {
    format: () => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    plus: () => ({ format: () => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate() + 1)}` }),
  };
  const fn = new Function("$input", "$", "$today", `${js}`);
  const out = fn($input, $, $today);
  const arr = Array.isArray(out) ? out : [out];
  store[nodeName] = arr;
  return arr;
}

/* ── the run ────────────────────────────────────────────────────────────── */

const DRY_RUN = process.argv.includes("--commit") ? false : true;

store["Webhook"] = [{
  json: {
    headers: { "x-correlation-id": "demo-run-001", "x-organization-api-key": "«key»" },
    body: {
      fromDate: new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10),
      toDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
      branchIds: [], workItemTypes: [], dryRun: DRY_RUN,
    },
  },
}];

console.log(`=== RCM Auto-Assignment v2 — ${DRY_RUN ? "DRY RUN" : "COMMIT"} ===\n`);

run("extractInfo", store["Webhook"]);
console.log("extractInfo        window", store["extractInfo"][0].json.payload.fromDate,
            "->", store["extractInfo"][0].json.payload.toDate);

const unassigned = toolUnassigned(40);
store["Step 0 - Unassigned Items"] = [{ json: { data: { assignmentUnassignedEntities: unassigned } } }];
console.log("T-0001 unassigned  ", unassigned.reduce((n, e) => n + e.workItems.length, 0), "items across",
            unassigned.length, "facilities");

run("Rank Items", store["Step 0 - Unassigned Items"]);
const ranked = store["Rank Items"][0].json;
console.log("Rank Items         ", ranked.items.length, "ranked · top rank",
            ranked.items[0]?.rank, "· lowest", ranked.items[ranked.items.length - 1]?.rank);

store["Step 1 - Get Teams"] = [{ json: { data: { optimaTeams: toolTeams() } } }];
console.log("T-0002 teams       ", toolTeams().length, "teams,",
            toolTeams().reduce((n, t) => n + t.groups.length, 0), "groups");

run("Match Groups", store["Rank Items"]);
const m = store["Match Groups"][0].json;
console.log("Match Groups       ", m.assignments.length, "matched ·", m.unmatched.length,
            "unmatched ·", m.userIds.length, "members involved");

store["Step 2 - Assigned Counts"] = [{ json: { data: { usersWorkTypeAssignedCounts: toolCounts(m.userIds, m.workItemTypes) } } }];
store["Step 3 - Capacities"] = [{ json: { data: { effectiveAssignmentSettings: toolCaps(m.userIds) } } }];
console.log("T-0003/T-004       ", m.userIds.length, "users' counts + capacities");

const batches = run("Distribute", store["Step 3 - Capacities"]);
console.log("Distribute         ", batches.filter(b => !b.json.skipped).length, "assignee batches");

if (!DRY_RUN) {
  store["Step 4 - Assign"] = batches
    .filter((b) => !b.json.skipped)
    .map((b) => ({ json: { data: { assignWorkItems: toolAssign(b.json) } } }));
  console.log("T-0005 assign      ", store["Step 4 - Assign"].length, "calls");
} else {
  store["Step 4 - Assign"] = [];
  console.log("T-0005 assign       skipped (dry run)");
}

run("Summarise", batches);
const s = store["Summarise"][0].json;

console.log("\n─── SUMMARY ─────────────────────────────────────────");
console.log(JSON.stringify(s.totals, null, 1));
console.log("\nby group:");
for (const g of s.byGroup.sort((a, b) => b.matched - a.matched).slice(0, 10)) {
  console.log(`  ${String(g.matched).padStart(4)}  ${g.group}  (${g.team})`);
}
console.log("\ntop assignees:");
for (const a of s.byAssignee.sort((x, y) => y.count - x.count).slice(0, 6)) {
  console.log(`  ${String(a.count).padStart(4)}  ${a.assigneeId}  ${a.group}`);
}
if (s.unmatchedSample.length) {
  console.log("\nunmatched reasons:");
  const by = {};
  for (const u of m.unmatched) by[u.reason] = (by[u.reason] ?? 0) + 1;
  for (const [r, n] of Object.entries(by)) console.log(`  ${String(n).padStart(4)}  ${r}`);
}
console.log("\napiResults:", JSON.stringify(s.apiResults).slice(0, 160));
