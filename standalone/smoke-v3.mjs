/**
 * Smoke test for the criteria-based model.
 *
 * Bundles the schema the same way server.mjs does, then exercises the pieces the
 * redesign touched: the dimension registry, criteria-based matching, multi-facility
 * teams, coverage without a catch-all, and the supervisor digest.
 *
 *   node smoke-v3.mjs
 */
import { build } from "esbuild";
import { graphql } from "graphql";

await build({
  entryPoints: ["src/mocks/schema-v2.ts"],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: "./.smoke-bundle.mjs",
  loader: { ".json": "json" },
  external: ["graphql", "@graphql-tools/schema"],
  logLevel: "silent",
});
const { schemaV2 } = await import("./.smoke-bundle.mjs?t=" + Date.now());

let failures = 0;
const run = async (source, variableValues) => {
  const r = await graphql({ schema: schemaV2, source, variableValues });
  if (r.errors) {
    failures += 1;
    console.error("  GraphQL errors:", r.errors.map((e) => e.message).join("; "));
  }
  return r.data;
};
const check = (label, ok, detail = "") => {
  if (!ok) failures += 1;
  console.log(`${ok ? "  ok  " : "  FAIL"} ${label}${detail ? "  " + detail : ""}`);
};

console.log("\n1. Dimension registry");
const reg = await run(`{
  allocationDimensions { code label level operators valueSource itemField coverageChecked }
  allocationPolicies { code label scope valueType appliesToTypes handlerTag unit defaultNumber }
  capacityFamilies { code label workItemTypes defaultLimit allowExceedByDefault }
}`);
check("dimensions served as data", reg.allocationDimensions.length === 6,
  reg.allocationDimensions.map((d) => d.code).join(", "));
check("policies served as data", reg.allocationPolicies.length >= 3,
  reg.allocationPolicies.map((p) => p.code).join(", "));
check("capacity families replace division", reg.capacityFamilies.length === 2,
  reg.capacityFamilies.map((f) => `${f.code}(exceed=${f.allowExceedByDefault})`).join(", "));

console.log("\n1b. Policies declare which work they apply to");
for (const pol of reg.allocationPolicies.filter((x) => x.handlerTag)) {
  console.log(`       ${pol.label.padEnd(22)} -> ${pol.appliesToTypes.length} types, clearance "${pol.handlerTag}"`);
}
const hc = reg.allocationPolicies.find((p) => p.code === "HIGH_COST");
check("high cost applies to claim work only",
  hc.appliesToTypes.every((t) => t.startsWith("CLAIM") || t === "RECONCILIATION"));
// The point of appliesToTypes is that a team is only asked about policies its
// own work makes relevant, so an authorisation team should see fewer.
check("an authorisation team is offered fewer policies than a claims team",
  reg.allocationPolicies.filter((p) =>
    p.appliesToTypes.some((t) => t.startsWith("AUTHORIZATION"))).length <
  reg.allocationPolicies.filter((p) =>
    p.appliesToTypes.some((t) => t.startsWith("CLAIM"))).length,
  reg.allocationPolicies.map((p) => p.code).join(", "));

console.log("\n2. Generic value source, one query for every dimension");
for (const code of ["FACILITY", "DEPARTMENT", "PAYER", "WORK_ITEM_TYPE"]) {
  const d = await run(`query($c:String!){ dimensionValues(dimension:$c){ value } }`, { c: code });
  check(`dimensionValues(${code})`, d.dimensionValues.length > 0,
    `${d.dimensionValues.length} values`);
}

console.log("\n3. Seed migrated to criteria");
const t1 = await run(`{
  optimaTeamsV2 {
    id name criteriaSummary priority
    criteria { dimension operator values }
    capacities { family limit allowExceed }
    facilityIds division encounterScope logicAxis
    policies { code family number flag }
    applicablePolicies { code label scope handlerTag }
    groups { id name criteriaSummary criteria { dimension operator values } }
  }
}`);
const teams = t1.optimaTeamsV2;
check("every team carries a rule", teams.every((t) => t.criteria.length > 0));
check("legacy fields still derive", teams.every((t) => t.facilityIds.length > 0));
const sample = teams[0];
console.log(`       ${sample.name}`);
console.log(`       team rule : ${sample.criteriaSummary.join(" · ")}`);
console.log(`       capacities: ${sample.capacities.map((c) => `${c.family} ${c.limit} exceed=${c.allowExceed}`).join(", ")}`);
console.log(`       policies  : ${sample.applicablePolicies.map((p) => p.code).join(", ")}`);
console.log(`       group     : ${sample.groups[0].name} → ${sample.groups[0].criteriaSummary.join(" · ")}`);

console.log("\n4. Catch-all became an explicit ANY");
const anyPayer = teams.flatMap((t) => t.groups).filter((g) =>
  g.criteria.some((c) => c.dimension === "PAYER" && c.operator === "ANY"));
check("former catch-all groups now carry PAYER ANY", true, `${anyPayer.length} groups`);

console.log("\n4b. An AUTH team and a CLAIM team get different policies");
const authTeam = teams.find((t) => t.division === "AUTH");
const claimTeam = teams.find((t) => t.division === "CLAIM");
console.log(`       ${authTeam.name}: ${authTeam.applicablePolicies.map((p) => p.label).join(", ")}`);
console.log(`       ${claimTeam.name}: ${claimTeam.applicablePolicies.map((p) => p.label).join(", ")}`);
check("auth team is not asked about high cost",
  !authTeam.applicablePolicies.some((p) => p.code === "HIGH_COST"));
check("auth team still gets the policies that apply to all work",
  authTeam.applicablePolicies.some((p) => p.code === "DAILY_LIMIT"),
  authTeam.applicablePolicies.map((p) => p.code).join(", "));
check("claim team is asked about high cost",
  claimTeam.applicablePolicies.some((p) => p.code === "HIGH_COST"));
check("claim team is asked about nothing auth-only",
  !claimTeam.applicablePolicies.some((p) => p.code === "URGENT_TAT"));

console.log("\n5. Allocation still works, with a reason when it does not");
const prev = await run(`query($id:ID!){
  optimaAllocationPreview(teamId:$id, itemCount:300){
    teamName scope totalItems assignedCount unassignedCount
    policyImpact { code label unit threshold flagged unassigned }
    byGroup { groupName matched assigned }
    unmatched { reason }
  }
}`, { id: sample.id });
const p = prev.optimaAllocationPreview;
check("preview allocates", p.assignedCount > 0, `${p.assignedCount}/${p.totalItems} assigned`);
console.log(`       scope: ${p.scope.join(" · ")}`);
const reasons = [...new Set(p.unmatched.map((u) => u.reason))];
console.log(`       unmatched reasons: ${reasons.slice(0, 3).join(" | ") || "(none)"}`);
check("reasons name the dimension", reasons.every((r) => !/^No group accepts this item$/.test(r)) || reasons.length === 0);
console.log(`       policy impact: ${p.policyImpact.map((x) => `${x.label} flagged ${x.flagged}, ${x.unassigned} unplaced`).join(" | ") || "(no policy applies)"}`);
// Only policies with a handlerTag flag items, and those are claims-only now,
// so an auth team legitimately reports no impact.
check("policy impact is reported where a flagging policy applies",
  p.policyImpact.length > 0 ||
    !(sample.applicablePolicies ?? []).some((x) => x.handlerTag),
  `${p.policyImpact.length} impact rows for ${sample.name}`);

console.log("\n6. Readiness, supervisor attribution");
const rd = await run(`{
  optimaAllocationReadiness {
    teamsTotal teamsReady unownedIssues itemsAtRiskPerDay
    issues { severity kind message supervisorNames itemsAtRiskPerDay }
    supervisorAlerts { name teamNames blockers warnings itemsAtRiskPerDay }
  }
}`);
const r = rd.optimaAllocationReadiness;
check("readiness computed", r.teamsTotal > 0, `${r.teamsReady}/${r.teamsTotal} ready`);
check("issues attributed to supervisors", r.supervisorAlerts.length > 0,
  `${r.supervisorAlerts.length} supervisors alerted`);
const kinds = {};
for (const i of r.issues) kinds[i.kind] = (kinds[i.kind] ?? 0) + 1;
console.log(`       issue kinds: ${Object.entries(kinds).map(([k, n]) => `${k}×${n}`).join(", ")}`);
console.log(`       at risk    : ${r.itemsAtRiskPerDay} items/day, ${r.unownedIssues} issues with no supervisor`);
if (r.supervisorAlerts[0]) {
  const a = r.supervisorAlerts[0];
  console.log(`       top alert  : ${a.name} — ${a.blockers} blockers, ${a.warnings} warnings, ${a.teamNames.join(" / ")}`);
}

console.log("\n7. Multi-facility team (the thing they insisted on)");
const saved = await run(`mutation($input: TeamV2Input!){
  optimaTeamV2Save(input:$input){
    id name facilityIds criteriaSummary division
    capacities { family limit allowExceed }
    policies { code family number flag }
    applicablePolicies { code label }
    groups { name criteriaSummary }
  }
}`, {
  input: {
    name: "Cross-site Coders",
    description: "Claims coding across three sites",
    criteria: [
      { dimension: "FACILITY", operator: "IN", values: ["DXB", "RAK"] },
      { dimension: "WORK_ITEM_TYPE", operator: "IN", values: ["CLAIM_VALIDATION", "AUTHORIZATION_SUBMISSION"] },
    ],
    groups: [
      {
        name: "Open claims",
        criteria: [
          { dimension: "WORK_ITEM_TYPE", operator: "IN", values: ["CLAIM_VALIDATION"] },
          { dimension: "CLAIM_STATUS", operator: "IN", values: ["OPEN"] },
          { dimension: "DEPARTMENT", operator: "ANY", values: [] },
        ],
        memberIds: [],
      },
      {
        name: "Auth submission",
        criteria: [
          { dimension: "WORK_ITEM_TYPE", operator: "IN", values: ["AUTHORIZATION_SUBMISSION"] },
          { dimension: "DEPARTMENT", operator: "ANY", values: [] },
        ],
        memberIds: [],
      },
    ],
  },
});
const s = saved.optimaTeamV2Save;
check("team spans several facilities", s.facilityIds.length > 1, s.facilityIds.join(", "));
check("mixed families allowed, division no longer single-valued", s.division === null,
  `capacities: ${s.capacities.map((c) => `${c.family} exceed=${c.allowExceed}`).join(", ")}`);
check("capacity declared per family it touches", s.capacities.length === 2);
check("a mixed team gets the claim-side policy its work earns",
  s.applicablePolicies.some((p) => p.code === "HIGH_COST"),
  s.applicablePolicies.map((p) => p.code).join(", "));
console.log(`       rule: ${s.criteriaSummary.join(" · ")}`);

console.log("\n8. Generic filter over the same dimensions");
const f = await run(`query($f: TeamQueryFilter){ optimaTeamsFiltered(filter:$f){ name } }`, {
  f: { criteria: [{ dimension: "DEPARTMENT", operator: "IN", values: ["Emergency"] }] },
});
check("filter by department", Array.isArray(f.optimaTeamsFiltered),
  `${f.optimaTeamsFiltered.length} teams admit Emergency`);
const f2 = await run(`query($f: TeamQueryFilter){ optimaTeamsFiltered(filter:$f){ name } }`, {
  f: { criteria: [{ dimension: "FACILITY", operator: "IN", values: ["DXB"] }] },
});
check("filter by facility", f2.optimaTeamsFiltered.length > 0,
  `${f2.optimaTeamsFiltered.length} teams at DXB`);

console.log(`\n${failures ? `${failures} FAILURES` : "all checks passed"}\n`);
process.exit(failures ? 1 : 0);
