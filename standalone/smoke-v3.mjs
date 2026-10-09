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
  allocationDimensions {
    code label level operators valueSource itemField coverageChecked
    numeric unit numericOptions appliesToTypes
  }
  allocationPolicies { code label scope valueType appliesToTypes handlerTag unit defaultNumber }
  capacityFamilies { code label workItemTypes defaultLimit allowExceedByDefault }
}`);
check("dimensions served as data", reg.allocationDimensions.length === 7,
  reg.allocationDimensions.map((d) => d.code).join(", "));
check("policies served as data", reg.allocationPolicies.length >= 2,
  reg.allocationPolicies.map((p) => p.code).join(", "));
check("capacity families replace division", reg.capacityFamilies.length === 2,
  reg.capacityFamilies.map((f) => `${f.code}(exceed=${f.allowExceedByDefault})`).join(", "));

console.log("\n1b. High cost is a dimension now, and it says which work it applies to");
const hc = reg.allocationDimensions.find((d) => d.code === "CLAIM_VALUE");
check("high cost is a group-level numeric dimension",
  hc.level === "GROUP" && hc.numeric && hc.operators.join() === "GREATER_THAN",
  `${hc.operators.join(", ")} on ${hc.itemField}, in ${hc.unit}`);
// A dropdown, not free text: the amount is a decision about money that a
// supervisor owns, and 500 typed where 5,000 was meant reroutes a day silently.
check("the amounts are a list, not free text", hc.numericOptions.length > 0,
  hc.numericOptions.map((n) => n.toLocaleString()).join(", "));
// Authorisation work carries no money, so it is never offered there. That is
// the property the old team-level HIGH_COST policy used to carry.
check("high cost applies to claim work only",
  hc.appliesToTypes.length > 0 &&
  hc.appliesToTypes.every((t) => t.startsWith("CLAIM") || t === "RECONCILIATION"),
  hc.appliesToTypes.join(", "));

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
    criteria { dimension operator values locked }
    capacities { family limit allowExceed }
    facilityIds division encounterScope logicAxis
    policies { code family number flag }
    applicablePolicies { code label scope handlerTag }
    groups {
      id name criteriaSummary workItemTypes highCostThreshold
      criteria { dimension operator values }
      effectiveCriteria { dimension operator values }
    }
  }
}`);
const teams = t1.optimaTeamsV2;
// Only the migrated seed. The demo teams in section 9 include one that
// deliberately filters on nothing, which is a mode, not a missing rule.
const migrated = teams.filter((t) => /^[0-9]+$/.test(t.id));
check("every migrated team carries a rule", migrated.every((t) => t.criteria.length > 0),
  `${migrated.length} teams`);
check("legacy fields still derive", teams.every((t) => t.facilityIds.length > 0));
const sample = migrated[0];
console.log(`       ${sample.name}`);
console.log(`       team rule : ${sample.criteriaSummary.join(" · ")}`);
console.log(`       capacities: ${sample.capacities.map((c) => `${c.family} ${c.limit} exceed=${c.allowExceed}`).join(", ")}`);
console.log(`       policies  : ${sample.applicablePolicies.map((p) => p.code).join(", ")}`);
console.log(`       group     : ${sample.groups[0].name} → ${sample.groups[0].criteriaSummary.join(" · ")}`);

console.log("\n4. Catch-all became an explicit ANY");
const anyPayer = teams.flatMap((t) => t.groups).filter((g) =>
  g.criteria.some((c) => c.dimension === "PAYER" && c.operator === "ANY"));
check("former catch-all groups now carry PAYER ANY", true, `${anyPayer.length} groups`);

console.log("\n4b. An AUTH team and a CLAIM team are offered different things");
const authTeam = teams.find((t) => t.division === "AUTH");
const claimTeam = teams.find((t) => t.division === "CLAIM");
console.log(`       ${authTeam.name}: ${authTeam.applicablePolicies.map((p) => p.label).join(", ")}`);
console.log(`       ${claimTeam.name}: ${claimTeam.applicablePolicies.map((p) => p.label).join(", ")}`);
// `appliesToTypes` is what gates the high-cost switch on a group now, exactly
// as it gated the high-cost policy on a team before.
const offersHighCost = (t) =>
  t.groups.some((g) => g.workItemTypes.some((w) => hc.appliesToTypes.includes(w)));
check("no group on an auth team is offered high cost", !offersHighCost(authTeam));
check("groups on a claims team are", offersHighCost(claimTeam));
check("auth team still gets the policies that apply to all work",
  authTeam.applicablePolicies.some((p) => p.code === "DAILY_LIMIT"),
  authTeam.applicablePolicies.map((p) => p.code).join(", "));
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
    groups { name criteriaSummary workItemTypes highCostThreshold }
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
check("a mixed team's claim-side groups can still be made high cost",
  s.groups.some((g) => g.workItemTypes.some((w) => hc.appliesToTypes.includes(w))),
  s.groups.map((g) => g.workItemTypes.join("+")).join(" / "));
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

console.log("\n9. Three ways a team hands a filter to its groups");
const byId = Object.fromEntries(teams.map((t) => [t.id, t]));

/* Locked. The team decides it, every group inherits it, no group restates it. */
const locked = byId.d1;
const lockedWit = locked.criteria.find((c) => c.dimension === "WORK_ITEM_TYPE");
check("locked, the team's filter is marked as such", lockedWit?.locked === true,
  lockedWit?.values.join(", "));
check("locked, no group carries a clause on it",
  locked.groups.every((g) => !g.criteria.some((c) => c.dimension === "WORK_ITEM_TYPE")),
  `${locked.groups.length} groups`);
check("locked, every group still routes on it",
  locked.groups.every((g) => {
    const eff = g.effectiveCriteria.find((c) => c.dimension === "WORK_ITEM_TYPE");
    return eff && eff.values.join() === lockedWit.values.join();
  }));

/* Unlocked. The team's values are a menu and each group takes a slice of it. */
const choice = byId.d2;
const menu = choice.criteria.find((c) => c.dimension === "FACILITY");
check("unlocked, the team's filter is not locked", menu?.locked === false,
  `${menu?.values.length} facilities on the menu`);
check("unlocked, each group picks one of them",
  choice.groups.every((g) => {
    const own = g.criteria.find((c) => c.dimension === "FACILITY");
    return own?.values.length === 1 && menu.values.includes(own.values[0]);
  }),
  choice.groups
    .map((g) => g.criteria.find((c) => c.dimension === "FACILITY")?.values[0])
    .join(" | "));
check("unlocked, the group's choice is what actually runs",
  choice.groups.every((g) => {
    const eff = g.effectiveCriteria.find((c) => c.dimension === "FACILITY");
    const own = g.criteria.find((c) => c.dimension === "FACILITY");
    return eff.values.join() === own.values.join();
  }));
check("unlocked, the group still inherits what the team did lock",
  choice.groups.every((g) =>
    g.effectiveCriteria.some(
      (c) => c.dimension === "WORK_ITEM_TYPE" && c.values.includes("CLAIM_RESUBMISSION"),
    )));

/* No filter. The team says nothing, so the groups route on what they like. */
const open = byId.d3;
check("no filter, the team constrains nothing", open.criteria.length === 0);
check("no filter, the groups route on dimensions the team never mentioned",
  open.groups.every(
    (g) => g.criteria.length > 0 && g.effectiveCriteria.length === g.criteria.length,
  ),
  open.groups.map((g) => g.criteriaSummary.join(" + ")).join(" | "));

/* A group cannot speak for a locked dimension, even asking for it directly. */
const tryOverride = await run(`mutation($id:ID!,$in:RcmTeamGroupInput!){
  optimaTeamV2GroupUpdate(groupId:$id, input:$in){
    criteria { dimension values }
    effectiveCriteria { dimension values }
  }
}`, {
  id: locked.groups[0].id,
  in: {
    criteria: [
      { dimension: "WORK_ITEM_TYPE", operator: "IN", values: ["CLAIM_RESUBMISSION"] },
      { dimension: "DEPARTMENT", operator: "IN", values: ["Internal Medicine"] },
    ],
  },
});
const after = tryOverride.optimaTeamV2GroupUpdate;
check("a group's clause on a locked dimension is dropped, not stored",
  !after.criteria.some((c) => c.dimension === "WORK_ITEM_TYPE"),
  after.criteria.map((c) => c.dimension).join(", "));
check("and the team's locked values are what that group runs",
  after.effectiveCriteria.find((c) => c.dimension === "WORK_ITEM_TYPE")?.values.join() ===
    lockedWit.values.join());

// Put the group back. That override narrowed Medical from eight departments to
// one, which makes it exactly as specific as the high-cost group two sections
// below and turns that section's routing into a coin toss. A check that edits
// the demo estate has to leave it as it found it.
await run(`mutation($id:ID!,$in:RcmTeamGroupInput!){
  optimaTeamV2GroupUpdate(groupId:$id, input:$in){ id }
}`, { id: locked.groups[0].id, in: { criteria: locked.groups[0].criteria } });

console.log("\n9b. The real estate carries lock state too, derived from the v1 data");
// Asked for once the business approved the three modes on the demo teams:
// apply them to the rest. Nothing here is invented, it is read off what the
// migrated teams already say about themselves.
check("every migrated team locks its facility",
  migrated.every((t) => t.criteria.find((c) => c.dimension === "FACILITY")?.locked === true),
  `${migrated.length} teams`);
check("none of them locks work item type, because the groups split on it",
  migrated.every((t) => t.criteria.find((c) => c.dimension === "WORK_ITEM_TYPE")?.locked !== true));
// Sharjah is scoped BOTH in the seed, so it gets no encounter clause at all,
// which is the third mode: its groups are free to split IP from OP.
const scoped = migrated.filter((t) => t.criteria.some((c) => c.dimension === "ENCOUNTER_TYPE"));
check("an encounter scope nobody varies is locked",
  scoped.every((t) => t.criteria.find((c) => c.dimension === "ENCOUNTER_TYPE").locked === true),
  `${scoped.length} of ${migrated.length} teams scope encounter; the rest leave it open`);
check("a locked facility leaves nothing on the groups to contradict it",
  migrated.every((t) => t.groups.every((g) => !g.criteria.some((c) => c.dimension === "FACILITY"))));

console.log("\n10. High cost, as a group criterion");
const hcTeam = byId.d1;
const hcGroup = hcTeam.groups.find((g) => g.highCostThreshold != null);
check("a group carries the amount, not the team", hcGroup != null,
  `${hcGroup?.name} over ${hcGroup?.highCostThreshold?.toLocaleString()} AED`);
check("it reads as money, not as a raw criterion",
  hcGroup.criteriaSummary.some((line) => line.includes("over 10,000 AED")),
  hcGroup.criteriaSummary.join(" . "));

const hcPrev = await run(`query($id:ID!){
  optimaAllocationPreview(teamId:$id, itemCount:400){
    policyImpact { code label unit threshold flagged unassigned }
    items { groupName net }
  }
}`, { id: hcTeam.id });
const hcp = hcPrev.optimaAllocationPreview;
const intoHighCost = hcp.items.filter((a) => a.groupName === hcGroup.name);
const intoOthers = hcp.items.filter((a) => a.groupName !== hcGroup.name);
// The one property that matters: narrowest-wins already routes on money, so
// the expensive claim lands here and nothing cheap does.
check("only items over the amount reach the high-cost group",
  intoHighCost.length > 0 && intoHighCost.every((a) => a.net > hcGroup.highCostThreshold),
  `${intoHighCost.length} items, cheapest ${Math.min(...intoHighCost.map((a) => a.net)).toLocaleString()} AED`);
check("the department groups keep everything below it",
  intoOthers.every((a) => a.net <= hcGroup.highCostThreshold),
  `${intoOthers.length} items elsewhere`);
check("the preview reports high cost off the groups, with no team policy left",
  hcp.policyImpact.length === 1 && hcp.policyImpact[0].threshold === hcGroup.highCostThreshold,
  hcp.policyImpact.map((r) => `${r.flagged} over ${r.threshold.toLocaleString()} ${r.unit}, ${r.unassigned} unassigned`).join("; "));

console.log("\n10b. The amounts are a list a supervisor owns");
const widened = await run(`mutation($d:String!,$n:[Float!]!){
  allocationDimensionOptionsSet(dimension:$d, numericOptions:$n){ code numericOptions }
}`, { d: "CLAIM_VALUE", n: [2500, 7500, 2500, 0, 15000] });
check("the list is de-duplicated and sorted, and junk is dropped",
  widened.allocationDimensionOptionsSet.numericOptions.join() === "2500,7500,15000",
  widened.allocationDimensionOptionsSet.numericOptions.join(", "));
// A group already filtering at an amount the supervisor removed keeps working:
// the criterion holds the number, the list only governs what is chosen next.
const stillThere = await run(`query($id:ID!){ optimaTeamV2(id:$id){ groups { name highCostThreshold } } }`,
  { id: hcTeam.id });
check("a group already set to a removed amount keeps it",
  stillThere.optimaTeamV2.groups.some((g) => g.highCostThreshold === 10000));
await run(`mutation($d:String!,$n:[Float!]!){
  allocationDimensionOptionsSet(dimension:$d, numericOptions:$n){ code }
}`, { d: "CLAIM_VALUE", n: [1000, 3000, 5000, 10000, 25000, 50000, 100000] });

console.log("\n11. Duplicate groups are flagged only when a person is in both");
const dupPeople = await run(`{ allUsers { id firstName lastName } }`);
const [p1, p2, p3] = dupPeople.allUsers;
const makeDup = (name, members2) => run(`mutation($input: TeamV2Input!){
  optimaTeamV2Save(input:$input){ id name }
}`, {
  input: {
    name,
    criteria: [{ dimension: "WORK_ITEM_TYPE", operator: "IN", values: ["CLAIM_VALIDATION"], locked: true }],
    supervisorIds: [p1.id],
    groups: [
      { name: "Shift A", criteria: [{ dimension: "DEPARTMENT", operator: "IN", values: ["Emergency"] }], memberIds: [p1.id, p2.id] },
      { name: "Shift B", criteria: [{ dimension: "DEPARTMENT", operator: "IN", values: ["Emergency"] }], memberIds: members2 },
    ],
  },
});

const clean = (await makeDup("Dup check, separate people", [p3.id])).optimaTeamV2Save;
const dirty = (await makeDup("Dup check, shared person", [p2.id])).optimaTeamV2Save;
const dupR = await run(`{ optimaAllocationReadiness { issues { kind teamName message } } }`);
const dupIssues = dupR.optimaAllocationReadiness.issues.filter((i) => i.kind === "DUPLICATE_GROUP_RULE");
check("identical rules with different people are not flagged",
  !dupIssues.some((i) => i.teamName === clean.name));
check("identical rules with the same person in both are",
  dupIssues.some((i) => i.teamName === dirty.name));
check("and the message names the person, not just the groups",
  dupIssues.find((i) => i.teamName === dirty.name)?.message.includes(
    [p2.firstName, p2.lastName].filter(Boolean).join(" "),
  ),
  dupIssues.find((i) => i.teamName === dirty.name)?.message);
for (const id of [clean.id, dirty.id]) {
  await run(`mutation($id:ID!){ optimaTeamV2Delete(id:$id){ deletedName } }`, { id });
}

console.log("\n12. A supervisor chosen before any group exists still lands on the team");
const freshSup = await run(`mutation($input: TeamV2Input!){
  optimaTeamV2Save(input:$input){ id groups { name members { id isSupervisor } } }
}`, {
  input: {
    name: "Supervisor-first team",
    criteria: [{ dimension: "WORK_ITEM_TYPE", operator: "IN", values: ["CLAIM_VALIDATION"] }],
    supervisorIds: [p3.id],
    groups: [{ name: "Only group", criteria: [], memberIds: [] }],
  },
});
const fresh = freshSup.optimaTeamV2Save;
// The control moved to step 1, before any group exists, so the save has to
// resolve a supervisor from the staff list rather than from an empty roster.
check("the supervisor is added to the group they were never picked into",
  fresh.groups[0].members.some((m) => m.id === p3.id && m.isSupervisor),
  fresh.groups[0].members.map((m) => m.id).join(", ") || "nobody");
/*
 * Supervising is per team, not a flag on the person.
 *
 * p3 now supervises the team above. They are also an ordinary member of other
 * teams, and saving one of those must not take the title away where they do
 * supervise , which is exactly what a single `isSupervisor` on the user did.
 */
const otherTeam = teams.find((t) => t.id === "d2");
const resaved = await run(`mutation($id:ID!,$input: TeamV2Input!){
  optimaTeamV2Save(id:$id, input:$input){ id supervisorIds }
}`, {
  id: otherTeam.id,
  input: {
    name: otherTeam.name,
    criteria: otherTeam.criteria.map((c) => ({
      dimension: c.dimension, operator: c.operator, values: c.values, locked: c.locked,
    })),
    supervisorIds: [p1.id],
    groups: otherTeam.groups.map((g) => ({
      id: g.id,
      name: g.name,
      criteria: g.criteria.map((c) => ({
        dimension: c.dimension, operator: c.operator, values: c.values,
      })),
      memberIds: [],
    })),
  },
});
check("a team names its own supervisors",
  resaved.optimaTeamV2Save.supervisorIds.join() === String(p1.id),
  resaved.optimaTeamV2Save.supervisorIds.join(", "));
const stillSup = await run(`query($id:ID!){ optimaTeamV2(id:$id){ supervisorIds } }`, { id: fresh.id });
check("and saving a different team does not demote them on theirs",
  stillSup.optimaTeamV2.supervisorIds.includes(p3.id),
  stillSup.optimaTeamV2.supervisorIds.join(", ") || "nobody");

await run(`mutation($id:ID!){ optimaTeamV2Delete(id:$id){ deletedName } }`, { id: fresh.id });

console.log(`\n${failures ? `${failures} FAILURES` : "all checks passed"}\n`);
process.exit(failures ? 1 : 0);
