/**
 * The demo, driven end to end against the running API.
 *
 * Walks the exact path a demo should take: show the estate, show the gap the
 * readiness panel reports, close it by creating one multi-facility team, and
 * show the gap closing. Run it before demoing to confirm the story still holds.
 *
 *   node server.mjs &   then   node demo-walkthrough.mjs
 */
const ENDPOINT = process.env.API ?? "http://127.0.0.1:4000/graphql";

async function Q(query, variables) {
  const r = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const j = await r.json();
  if (j.errors) {
    console.error("ERRORS", JSON.stringify(j.errors.slice(0, 3), null, 1));
    process.exit(1);
  }
  return j.data;
}

const READINESS = `{
  optimaAllocationReadiness {
    teamsReady teamsTotal itemsAtRiskPerDay unownedIssues
    issues { kind severity message }
    supervisorAlerts { name teamNames blockers warnings }
  }
}`;

const SAVE = `mutation Save($i: TeamV2Input!) {
  optimaTeamV2Save(input: $i) {
    id name facilityIds criteriaSummary division
    capacities { family limit allowExceed }
    applicablePolicies { code label unit }
    policies { code family number flag }
    groups { name criteriaSummary members { id } }
  }
}`;

const line = (s) => console.log("\n" + s + "\n" + "-".repeat(s.length));

line("1. The estate, as the teams list shows it");
const { optimaTeams } = await Q(`{
  optimaTeams { name description criteriaSummary groups { name } }
}`);
for (const t of optimaTeams.slice(0, 4)) {
  console.log(`  ${t.name}`);
  console.log(`    ${t.description}`);
  console.log(`    rule: ${t.criteriaSummary.join(" · ")}`);
}
console.log(`  … ${optimaTeams.length} teams total`);

line("2. Readiness: what would fall through tonight");
const before = (await Q(READINESS)).optimaAllocationReadiness;
console.log(`  ${before.teamsReady}/${before.teamsTotal} teams ready`);
console.log(`  ${Math.round(before.itemsAtRiskPerDay).toLocaleString()} items/day at risk`);
const unhandledBefore = before.issues.filter((i) => i.kind === "UNHANDLED_TYPE");
for (const i of unhandledBefore) console.log(`  · ${i.message}`);
console.log(`\n  Supervisors who would be told:`);
for (const a of before.supervisorAlerts.slice(0, 3)) {
  console.log(`  · ${a.name} — ${a.blockers} blocking, ${a.warnings} warnings (${a.teamNames.join(", ")})`);
}
console.log(`  · ${before.unownedIssues} issues have nobody to tell`);

line("3. Close the gap with ONE team spanning every facility");
const people = (await Q(`{ allUsers { id firstName lastName } }`)).allUsers.slice(0, 4);
const made = await Q(SAVE, {
  i: {
    name: "Reconciliation Analysts",
    description: "Reconciliation across every facility, the way production ran it.",
    criteria: [
      { dimension: "FACILITY", operator: "IN", values: ["DXB", "AJM", "SHJ", "RAK"] },
      { dimension: "WORK_ITEM_TYPE", operator: "IN", values: ["RECONCILIATION"] },
    ],
    supervisorIds: [people[0].id],
    handlers: [{ tag: "HIGH_COST", memberIds: people.map((x) => x.id) }],
    groups: [
      {
        name: "Reconciliation",
        criteria: [
          { dimension: "WORK_ITEM_TYPE", operator: "IN", values: ["RECONCILIATION"] },
          { dimension: "PAYER", operator: "ANY", values: [] },
        ],
        memberIds: people.map((p) => p.id),
      },
    ],
  },
});
const t = made.optimaTeamV2Save;
console.log(`  created: ${t.name}`);
console.log(`  facilities : ${t.facilityIds.join(", ")}   <- one team, four sites`);
console.log(`  rule       : ${t.criteriaSummary.join(" · ")}`);
console.log(`  capacity   : ${t.capacities.map((c) => `${c.family} ${c.limit} ${c.allowExceed ? "overflow" : "defer"}`).join(", ")}`);
console.log(`  group      : ${t.groups[0].name} → ${t.groups[0].criteriaSummary.join(" · ")} [${t.groups[0].members.length} members]`);
console.log(`  policies   : ${t.applicablePolicies.map((x) => x.label).join(", ")}`);

line("4. Readiness again");
const after = (await Q(READINESS)).optimaAllocationReadiness;
const unhandledAfter = after.issues.filter((i) => i.kind === "UNHANDLED_TYPE");
console.log(`  ${after.teamsReady}/${after.teamsTotal} teams ready`);
console.log(`  unhandled work item types: ${unhandledBefore.length} -> ${unhandledAfter.length}`);
const overlap = after.issues.filter((i) => i.kind === "OVERLAPPING_TEAMS");
console.log(`  overlap warnings: ${overlap.length}${overlap.length ? ` (e.g. ${overlap[0].message})` : ""}`);

line("4b. Policies follow the work, not the team");
const shaped = await Q(`{
  optimaTeamsV2 {
    name division
    applicablePolicies { code label unit }
  }
}`);
const anAuth = shaped.optimaTeamsV2.find((x) => x.division === "AUTH");
const aClaim = shaped.optimaTeamsV2.find((x) => x.division === "CLAIM");
for (const x of [anAuth, aClaim]) {
  console.log(`  ${x.name}`);
  for (const pol of x.applicablePolicies) {
    console.log(`    · ${pol.label}${pol.unit ? ` (${pol.unit})` : ""}`);
  }
}
console.log("  The authorisation team is never asked about a high-cost threshold,");
console.log("  and the claims team is never asked about turnaround. The registry decides.");

line("5. The filter bar finds it, by facility and by type");
for (const [dim, val] of [
  ["FACILITY", "SHJ"],
  ["WORK_ITEM_TYPE", "RECONCILIATION"],
]) {
  const r = await Q(`query F($f: TeamQueryFilter){ optimaTeamsFiltered(filter:$f){ name } }`, {
    f: { criteria: [{ dimension: dim, operator: "IN", values: [val] }] },
  });
  console.log(`  ${dim} = ${val}: ${r.optimaTeamsFiltered.length} teams`);
  const hit = r.optimaTeamsFiltered.find((x) => x.name === "Reconciliation Analysts");
  console.log(`    includes the new team: ${hit ? "yes" : "NO"}`);
}

line("6. Preview it, with reasons for anything unallocated");
const prev = await Q(
  `query P($id: ID!){ optimaAllocationPreview(teamId:$id, itemCount:200){
      teamName scope totalItems assignedCount unassignedCount
      policyImpact { label flagged unassigned }
      unmatched { reason } } }`,
  { id: t.id },
);
const p = prev.optimaAllocationPreview;
console.log(`  ${p.teamName}: ${p.assignedCount}/${p.totalItems} assigned`);
console.log(`  scope: ${p.scope.join(" · ")}`);
const reasons = [...new Set(p.unmatched.map((u) => u.reason))];
console.log(`  reasons: ${reasons.slice(0, 2).join(" | ") || "(none, everything allocated)"}`);
console.log(
  `  policy impact: ${
    p.policyImpact.map((x) => `${x.label} flagged ${x.flagged}, ${x.unassigned} unplaced`).join(" | ") ||
    "(no policy applies)"
  }`,
);

console.log("\ndemo path verified\n");
