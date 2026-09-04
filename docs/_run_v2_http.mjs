/**
 * Runs the v2 workflow against the LOCAL server over HTTP.
 *
 * Unlike `_run_v2_workflow.mjs`, which fed the Code nodes from in-process
 * stand-ins, this calls `POST /api/tool/{code}` exactly as n8n would — same URL
 * shape, same request bodies, real network round-trips. The Code node JS is still
 * lifted verbatim from the workflow JSON.
 *
 *   node _run_v2_http.mjs            dry run
 *   node _run_v2_http.mjs --commit   also fires T-0005
 */
import fs from "node:fs";

const BASE = process.env.OPTIMA_BASE ?? "http://localhost:4000";
const wf = JSON.parse(fs.readFileSync("RCM Auto-Assignment v2.json", "utf8"));
const codeOf = (name) => wf.nodes.find((n) => n.name === name).parameters.jsCode;
const DRY_RUN = !process.argv.includes("--commit");

async function tool(code, body) {
  const res = await fetch(`${BASE}/api/tool/${code}`, {
    method: "POST",
    headers: { "content-type": "application/json", "X-API-Key": "local-demo" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (json.errors) throw new Error(`${code}: ${json.errors[0].message}`);
  return json;
}

/* n8n runtime shim — same as the in-process runner */
const store = {};
function run(nodeName, inputItems) {
  const $input = { all: () => inputItems };
  const $ = (n) => ({ first: () => store[n]?.[0], all: () => store[n] ?? [], item: store[n]?.[0] });
  const pad = (n) => String(n).padStart(2, "0");
  const d = new Date();
  const $today = {
    format: () => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    plus: () => ({ format: () => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate() + 1)}` }),
  };
  const out = new Function("$input", "$", "$today", codeOf(nodeName))($input, $, $today);
  const arr = Array.isArray(out) ? out : [out];
  store[nodeName] = arr;
  return arr;
}

console.log(`=== v2 workflow over HTTP (${BASE}) — ${DRY_RUN ? "DRY RUN" : "COMMIT"} ===\n`);

store["Webhook"] = [{
  json: {
    headers: { "x-correlation-id": "http-run-001", "x-organization-api-key": "local-demo" },
    body: {
      fromDate: new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10),
      toDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
      branchIds: [], workItemTypes: [], dryRun: DRY_RUN,
    },
  },
}];

run("extractInfo", store["Webhook"]);
const ctx = store["extractInfo"][0].json;
console.log("extractInfo         ", ctx.payload.fromDate, "->", ctx.payload.toDate);

// T-0001
const t1 = await tool("T-0001", { input: ctx.payload });
store["Step 0 - Unassigned Items"] = [{ json: t1 }];
const rawCount = t1.data.assignmentUnassignedEntities.reduce((n, e) => n + e.workItems.length, 0);
console.log("T-0001 unassigned   ", rawCount, "items");

run("Rank Items", store["Step 0 - Unassigned Items"]);
const ranked = store["Rank Items"][0].json;
console.log("Rank Items          ", ranked.items.length, "ranked · top", ranked.items[0]?.rank);

// T-0002
const t2 = await tool("T-0002", { filter: { branchIds: ranked.branchIds, active: true } });
store["Step 1 - Get Teams"] = [{ json: t2 }];
console.log("T-0002 teams        ", t2.data.optimaTeams.length, "teams,",
            t2.data.optimaTeams.reduce((n, t) => n + t.groups.length, 0), "groups");

run("Match Groups", store["Rank Items"]);
const m = store["Match Groups"][0].json;
console.log("Match Groups        ", m.assignments.length, "matched ·", m.unmatched.length, "unmatched");

// T-0003 / T-004
const t3 = await tool("T-0003", {
  userIds: m.userIds, workItemTypes: m.workItemTypes,
  fromDate: ctx.payload.fromDate, toDate: ctx.payload.toDate,
});
store["Step 2 - Assigned Counts"] = [{ json: t3 }];
const t4 = await tool("T-004", { teamId: m.teamId, userIds: m.userIds });
store["Step 3 - Capacities"] = [{ json: t4 }];
console.log("T-0003/T-004        ", m.userIds.length, "users");

const batches = run("Distribute", store["Step 3 - Capacities"]);
const live = batches.filter((b) => !b.json.skipped);
console.log("Distribute          ", live.length, "assignee batches");

// T-0005
if (!DRY_RUN) {
  const results = [];
  for (const b of live) {
    results.push({ json: await tool("T-0005", {
      input: { assigneeId: b.json.assigneeId, workItemIds: b.json.workItemIds,
               workItemType: b.json.workItemType },
    }) });
  }
  store["Step 4 - Assign"] = results;
  console.log("T-0005 assign       ", results.length, "calls committed");
} else {
  store["Step 4 - Assign"] = [];
  console.log("T-0005 assign        skipped (dry run)");
}

run("Summarise", batches);
const s = store["Summarise"][0].json;

console.log("\n─── SUMMARY ─────────────────────────────────────");
console.log(JSON.stringify(s.totals, null, 1));
console.log("\nby group:");
for (const g of s.byGroup.sort((a, b) => b.matched - a.matched).slice(0, 8)) {
  console.log(`  ${String(g.matched).padStart(4)}  ${g.group}`);
}
if (!DRY_RUN) {
  const ok = s.apiResults.filter((r) => r?.success).length;
  console.log(`\nassign results: ${ok}/${s.apiResults.length} succeeded`);
  console.log("  e.g.", JSON.stringify(s.apiResults[0]));
}
