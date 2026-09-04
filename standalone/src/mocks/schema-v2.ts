/**
 * Local executable schema for the v2 team model, over the real production estate.
 *
 * Seed is `teams-v2-real.json` — the 16 live v1 teams run through the v1→v2 migration,
 * giving 10 teams / 16 groups / 75 memberships / 69 distinct people, with real names.
 * Volumes are the observed figures from workitem_profile.xlsx, so projections and
 * advice match what production would show.
 *
 * Mirrors RcmTeamV2ServiceImpl, RcmTeamCoverageService and RcmTeamDistributionAdvisor.
 */
import { makeExecutableSchema } from "@graphql-tools/schema";
import seed from "./teams-v2-real.json";
import peopleSeed from "./people.json";
import volumes from "./volumes.json";

const typeDefs = /* GraphQL */ `
  enum RcmTeamDivision { AUTH CLAIM }
  enum RcmTeamEncounterScope { OP IP BOTH }
  enum RcmTeamLogicAxis { DEPARTMENT PAYER }
  enum RcmTeamAdviceSeverity { BLOCKER WARNING INFO }

  enum RcmWorkItemType {
    RECONCILIATION
    CLAIM_SUBMISSION
    CLAIM_RESUBMISSION
    CLAIM_VALIDATION
    AUTHORIZATION_SUBMISSION
    AUTHORIZATION_RESUBMISSION
  }

  type User {
    id: ID!
    firstName: String
    lastName: String
    email: String
    isActive: Boolean
  }

  type RcmTeamCapacity {
    memberCount: Int!
    totalCapacity: Int!
    assigned: Int!
    remaining: Int!
    duplicateMemberships: Int!
  }

  type RcmTeamGroup {
    id: ID!
    rcmTeamId: ID!
    name: String!
    active: Boolean!
    workItemTypes: [RcmWorkItemType!]!
    encounterScope: RcmTeamEncounterScope!
    departments: [String!]!
    payers: [ID!]!
    payerCatchAll: Boolean!
    claimStatuses: [String!]!
    rotationOrder: Int
    specificity: Int!
    members: [User!]!
    capacity: RcmTeamCapacity!
  }

  type RcmTeamCoverageReport {
    uncoveredDepartments: [String!]!
    overlappingDepartments: [String!]!
    uncoveredPayers: [ID!]!
    emptyGroupIds: [ID!]!
    complete: Boolean!
  }

  type RcmTeamGroupProjection {
    groupId: ID!
    groupName: String!
    meanPerDay: Float!
    peakPerDay: Float!
    capacity: Int!
    memberCount: Int!
    overflowsAtPeak: Boolean!
  }

  type RcmTeamAdviceFinding {
    severity: RcmTeamAdviceSeverity!
    groupId: ID
    message: String!
  }

  type RcmTeamDistributionAdvice {
    projections: [RcmTeamGroupProjection!]!
    findings: [RcmTeamAdviceFinding!]!
    hasBlockers: Boolean!
    healthy: Boolean!
  }

  type RcmTeamSuggestion {
    groupId: ID!
    groupName: String!
    departments: [String!]!
    namedPayers: [ID!]!
    catchAll: Boolean!
    projectedPerDay: Float!
  }

  type RcmTeamV2 {
    id: ID!
    name: String!
    nameAr: String
    description: String
    tag: String
    createdDate: String
    rotationFrequency: String
    nextRotationDate: String
    branchIds: [ID!]
    branches: [Branch!]
    usersDetails: [User!]
    active: Boolean!
    facilityId: String!
    division: RcmTeamDivision!
    encounterScope: RcmTeamEncounterScope!
    logicAxis: RcmTeamLogicAxis!
    rotationEnabled: Boolean!
    groups: [RcmTeamGroup!]!
    members: [User!]!
    capacity: RcmTeamCapacity!
    coverage: RcmTeamCoverageReport!
  }

  input RcmTeamGroupInput {
    name: String
    active: Boolean
    workItemTypes: [RcmWorkItemType!]
    encounterScope: RcmTeamEncounterScope
    departments: [String!]
    payers: [ID!]
    payerCatchAll: Boolean
    claimStatuses: [String!]
    memberIds: [ID!]
  }

  """Extra fields the real Teams page selects."""
  type Branch { id: ID!, name: String, nameAr: String, healthLicense: String }
  type BranchEdge { node: Branch! }
  type BranchConnection { edges: [BranchEdge!]! }
  type CodeConcept { code: String!, display: String }
  type CodeEdge { node: CodeConcept! }
  type CodeConnection { edges: [CodeEdge!]! }
  type UserEdge { node: User! }
  type UserConnection { edges: [UserEdge!]! }
  input BranchFilterInput { vendors: [ID!] }
  input CodeSystemConceptSearchFilter { codeSystemCode: String, display: String }
  input UserFilterInput { search: String }
  input OptimaTeamFilterInput {
    ids: [ID], name: String, active: Boolean, tag: String
    branchIds: [ID!], vendorId: ID
  }
  input OptimaTeamInput {
    name: String, nameAr: String, description: String, active: Boolean
    rotationEnabled: Boolean, rotationFrequency: String
    users: [ID!], branchIds: [ID!]
  }

  """One work item as the engine sees it, after ranking and matching."""
  type PreviewItem {
    id: ID!
    workItemType: String!
    department: String
    payer: String
    claimStatus: String
    encounterType: String
    priority: String
    ageDays: Float!
    rank: Float!
    groupId: ID
    groupName: String
    assigneeId: ID
    assigneeName: String
    reason: String
  }

  type PreviewAssignee {
    userId: ID!
    name: String!
    groupName: String!
    assigned: Int!
    capacity: Int!
    remaining: Int!
  }

  type PreviewGroup {
    groupId: ID!
    groupName: String!
    matched: Int!
    assigned: Int!
    capacity: Int!
  }

  """What the allocation engine would do with today's unassigned work."""
  type AllocationPreview {
    teamId: ID!
    teamName: String!
    totalItems: Int!
    assignedCount: Int!
    unassignedCount: Int!
    byGroup: [PreviewGroup!]!
    byAssignee: [PreviewAssignee!]!
    items: [PreviewItem!]!
    unmatched: [PreviewItem!]!
  }

  """Per-user or per-team assignment limits."""
  type AssignmentSetting {
    id: ID!
    maxAuth: Int!
    maxClaim: Int!
    targetId: ID
    type: String
  }
  input AssignmentSettingInput { maxAuth: Int, maxClaim: Int }

  """Resolved limits merging user overrides with team defaults."""
  type EffectiveAssignmentSetting {
    userId: ID!
    teamId: ID
    maxClaim: Int!
    maxAuth: Int!
    source: String
  }

  """Counts already assigned per user, per work item type."""
  type UserWorkTypeAssignedCount {
    userId: ID!
    assigned: Int!
    workItemType: String!
  }

  """A facility's unassigned queue, as the allocation engine reads it."""
  type UnassignedWorkItem {
    id: ID!
    priority: String
    encounterType: String
    department: String
    claimStatus: String
    startDate: String
    net: Float
    insurancePayer: String
  }
  type UnassignedEntity {
    branchId: ID
    facilityId: String
    workItemType: String!
    workItems: [UnassignedWorkItem!]!
  }
  input UnassignedEntitiesInput {
    fromDate: String
    toDate: String
    branchIds: [ID!]
    workItemTypes: [String!]
  }
  input AssignWorkItemsInput {
    assigneeId: ID!
    workItemIds: [ID!]!
    workItemType: String
  }
  type AssignWorkItemsResult {
    success: Boolean!
    message: String
    totalCount: Int
  }

  input TeamGroupSaveInput {
    id: ID
    name: String!
    active: Boolean
    workItemTypes: [String!]
    encounterScope: String
    departments: [String!]
    payers: [ID!]
    payerCatchAll: Boolean
    claimStatuses: [String!]
    memberIds: [ID!]
  }
  input TeamV2Input {
    name: String!
    description: String
    facilityId: String
    division: String
    encounterScope: String
    logicAxis: String
    active: Boolean
    maxAuth: Int
    maxClaim: Int
    groups: [TeamGroupSaveInput!]
  }

  """Observed arrival volume for one criterion, from the work-item profile."""
  type CriterionVolume {
    name: String!
    perDay: Float!
    sharePct: Float!
  }

  """Why a suggested split looks the way it does."""
  type DistributionRationale {
    facilityId: String!
    axis: String!
    totalPerDay: Float!
    criteriaCount: Int!
    burstFactor: Float!
    "Heaviest first — the reason an even count would not be an even workload."
    top: [CriterionVolume!]!
    "How lopsided the busiest is against the lightest."
    concentrationRatio: Float!
    "Criteria under one item a day."
    tailCount: Int!
    tailSharePct: Float!
    "What a naive equal-count split would produce, per group."
    naiveSpread: [Float!]!
    "What the volume-packed split produces, per group."
    balancedSpread: [Float!]!
  }

  type Query {
    """Why the recommended split is what it is."""
    optimaDistributionRationale(teamId: ID!, groupCount: Int!): DistributionRationale

    """Options the team wizard needs."""
    facilityOptions: [String!]!
    departmentOptionsFor(teamId: ID): [String!]!
    payerOptionsFor(teamId: ID): [ID!]!

    assignmentSettingByTeam(teamId: ID!): AssignmentSetting
    effectiveAssignmentSettings(teamId: ID, userIds: [ID!]!): [EffectiveAssignmentSetting!]!
    usersWorkTypeAssignedCounts(
      userIds: [ID!]!, workItemTypes: [String!], fromDate: String, toDate: String
    ): [UserWorkTypeAssignedCount!]!

    """Dry-run the allocation engine for a team, without assigning anything."""
    optimaAllocationPreview(teamId: ID!, itemCount: Int): AllocationPreview

    """v1-shaped operations the real Teams page calls, served from the v2 model."""
    optimaTeams(filter: OptimaTeamFilterInput): [RcmTeamV2!]
    optimaTeam(id: ID!): RcmTeamV2
    branches(first: Int, filter: BranchFilterInput): BranchConnection
    codeSystemConcepts(first: Int, filter: CodeSystemConceptSearchFilter): CodeConnection
    users(filter: UserFilterInput): UserConnection

    optimaTeamsV2: [RcmTeamV2!]!
    optimaTeamV2(id: ID!): RcmTeamV2
    optimaTeamV2DistributionAdvice(id: ID!): RcmTeamDistributionAdvice!
    optimaTeamV2Suggest(id: ID!): [RcmTeamSuggestion!]!
    facilityDepartments(teamId: ID!): [String!]!
    facilityPayers(teamId: ID!): [ID!]!
    allUsers: [User!]!
  }

  type Mutation {
    """Create or update a v2 team with its groups in one call."""
    optimaTeamV2Save(id: ID, input: TeamV2Input!): RcmTeamV2

    assignmentSettingTeamSave(teamId: ID!, input: AssignmentSettingInput!): AssignmentSetting
    assignmentUnassignedEntities(input: UnassignedEntitiesInput!): [UnassignedEntity!]!
    assignWorkItems(input: AssignWorkItemsInput!): AssignWorkItemsResult!

    optimaTeamUpdate(id: ID!, input: OptimaTeamInput!): RcmTeamV2
    optimaTeamCreate(input: OptimaTeamInput!): RcmTeamV2
    optimaTeamUserAdd(id: ID!, userIds: [ID!]!): RcmTeamV2
    optimaTeamUserRemove(id: ID!, userIds: [ID!]!): RcmTeamV2

    optimaTeamV2GroupUpdate(groupId: ID!, input: RcmTeamGroupInput!): RcmTeamGroup
    optimaTeamV2GroupCreate(teamId: ID!, input: RcmTeamGroupInput!): RcmTeamGroup
    optimaTeamV2GroupDelete(groupId: ID!): Boolean
    optimaTeamV2ApplySuggestion(id: ID!): RcmTeamV2
  }
`;

type User = {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  isActive?: boolean | null;
};
type Group = {
  id: string;
  rcmTeamId?: string;
  name: string;
  active: boolean;
  workItemTypes: string[];
  encounterScope: string;
  departments: string[];
  payers: string[];
  payerCatchAll: boolean;
  claimStatuses: string[];
  rotationOrder: number;
  members: User[];
};
type Team = {
  id: string;
  name: string;
  active: boolean;
  facilityId: string;
  /** Key into the volume data. Real code resolves this via branches.healthLicense. */
  siteKey: string;
  division: string;
  encounterScope: string;
  logicAxis: string;
  rotationEnabled: boolean;
  groups: Group[];
};

const teams: Team[] = JSON.parse(JSON.stringify(seed));
teams.forEach((t) => t.groups.forEach((g) => (g.rcmTeamId = t.id)));

const allUsers: User[] = peopleSeed as User[];

let nextGroupId = Math.max(0, ...teams.flatMap((t) => t.groups.map((g) => +g.id))) + 1;

/** Observed daily volume, per facility, falling back to the global mix. */
const V: any = volumes;
const deptVolumes = (facility: string): Record<string, number> =>
  V.bySite.departments[facility] ?? V.global.departments;
const payerVolumes = (facility: string): Record<string, number> =>
  V.bySite.payers[facility] ?? V.global.payers;
const burstOf = (facility: string): number =>
  Math.max(1, V.bySite.burst[facility] ?? V.global.burst);

const NAMED_PAYER_THRESHOLD = 10;
/** Stands in for effectiveAssignmentSettings; ~150/day matches observed coder throughput. */
const USER_CAPACITY = 150;

const findTeam = (id: string) => teams.find((t) => String(t.id) === String(id));
const findGroup = (id: string) =>
  teams.flatMap((t) => t.groups).find((g) => String(g.id) === String(id));
const teamOfGroup = (id: string) =>
  teams.find((t) => t.groups.some((g) => String(g.id) === String(id)));

/** Narrowness, matching RcmTeamGroup.specificity(). Catch-all scores 0 on payers. */
function specificity(g: Group): number {
  const n = (size: number) => (size === 0 ? 0 : Math.floor(100 / size));
  return (
    n(g.workItemTypes.length) +
    n(g.departments.length) +
    (g.payerCatchAll ? 0 : n(g.payers.length)) +
    n(g.claimStatuses.length) +
    (g.encounterScope !== "BOTH" ? 100 : 0)
  );
}

function groupCapacity(g: Group) {
  const memberCount = new Set(g.members.map((m) => m.id)).size;
  const totalCapacity = memberCount * USER_CAPACITY;
  return { memberCount, totalCapacity, assigned: 0, remaining: totalCapacity, duplicateMemberships: 0 };
}

function teamCapacity(t: Team) {
  const all = t.groups.flatMap((g) => g.members.map((m) => m.id));
  const distinct = new Set(all);
  return {
    memberCount: distinct.size,
    totalCapacity: distinct.size * USER_CAPACITY,
    assigned: 0,
    remaining: distinct.size * USER_CAPACITY,
    duplicateMemberships: all.length - distinct.size,
  };
}

function meanFor(t: Team, g: Group): number {
  if (t.logicAxis === "DEPARTMENT") {
    const v = deptVolumes(t.siteKey);
    return g.departments.reduce((a, d) => a + (v[d] ?? 0), 0);
  }
  const v = payerVolumes(t.siteKey);
  const named = g.payers.reduce((a, p) => a + (v[p] ?? 0), 0);
  const catchAlls = t.groups.filter((x) => x.active && x.payerCatchAll).length;
  const tail = Object.values(v)
    .filter((x) => x < NAMED_PAYER_THRESHOLD)
    .reduce((a, b) => a + b, 0);
  return named + (g.payerCatchAll && catchAlls ? tail / catchAlls : 0);
}

function advice(t: Team) {
  const active = t.groups.filter((g) => g.active);
  const burst = burstOf(t.siteKey);
  const projections = active.map((g) => {
    const mean = meanFor(t, g);
    const cap = groupCapacity(g);
    return {
      groupId: g.id,
      groupName: g.name,
      meanPerDay: Math.round(mean * 10) / 10,
      peakPerDay: Math.round(mean * burst * 10) / 10,
      capacity: cap.totalCapacity,
      memberCount: cap.memberCount,
      overflowsAtPeak: cap.totalCapacity > 0 && mean * burst > cap.totalCapacity,
    };
  });

  const findings: any[] = [];
  for (const p of projections) {
    if (p.meanPerDay > 0 && p.memberCount === 0)
      findings.push({
        severity: "BLOCKER",
        groupId: p.groupId,
        message: `Group '${p.groupName}' is projected ${p.meanPerDay.toFixed(0)} items/day but has no members — that work cannot be assigned to anyone.`,
      });
    else if (p.capacity > 0 && p.meanPerDay > p.capacity)
      findings.push({
        severity: "BLOCKER",
        groupId: p.groupId,
        message: `Group '${p.groupName}' is projected ${p.meanPerDay.toFixed(0)} items/day against capacity ${p.capacity}. This overflows every day, not just at peak.`,
      });
    else if (p.overflowsAtPeak)
      findings.push({
        severity: "WARNING",
        groupId: p.groupId,
        message: `Group '${p.groupName}' fits on an average day (${p.meanPerDay.toFixed(0)} against capacity ${p.capacity}) but is projected ${p.peakPerDay.toFixed(0)} at peak — busy days will overflow.`,
      });
  }
  const loads = projections.filter((p) => p.meanPerDay > 0).map((p) => p.meanPerDay);
  if (loads.length > 1) {
    const mx = Math.max(...loads);
    const mn = Math.min(...loads);
    if (mn > 0 && mx / mn >= 2)
      findings.push({
        severity: "WARNING",
        groupId: null,
        message: `Load is uneven: the busiest group is projected ${mx.toFixed(0)} items/day and the quietest ${mn.toFixed(0)} (${(mx / mn).toFixed(1)}×). Rebalancing would even out the queues.`,
      });
  }
  if (t.logicAxis === "PAYER" && !active.some((g) => g.payerCatchAll)) {
    const named = new Set(active.flatMap((g) => g.payers));
    const unnamed = Object.keys(payerVolumes(t.siteKey)).filter((p) => !named.has(p)).length;
    if (unnamed > 0)
      findings.push({
        severity: "BLOCKER",
        groupId: null,
        message: `${unnamed} payers seen at this facility are not named by any group, and no group is a catch-all — their work will not be allocated.`,
      });
  }
  return {
    projections,
    findings,
    hasBlockers: findings.some((f) => f.severity === "BLOCKER"),
    healthy: findings.length === 0,
  };
}

/** Volume-packed: heaviest item into the lightest group. */
function suggest(t: Team) {
  const active = t.groups.filter((g) => g.active);
  if (!active.length) return [];
  const byDept = t.logicAxis === "DEPARTMENT";
  const vols = byDept ? deptVolumes(t.siteKey) : payerVolumes(t.siteKey);
  const picked = new Map<string, string[]>(active.map((g) => [g.id, []]));
  const load = new Map<string, number>(active.map((g) => [g.id, 0]));

  const candidates = Object.entries(vols)
    .filter(([, v]) => (byDept ? true : v >= NAMED_PAYER_THRESHOLD))
    .sort((a, b) => b[1] - a[1]);

  for (const [k, v] of candidates) {
    let target = active[0].id;
    for (const g of active) if ((load.get(g.id) ?? 0) < (load.get(target) ?? 0)) target = g.id;
    picked.get(target)!.push(k);
    load.set(target, (load.get(target) ?? 0) + v);
  }
  const tail = byDept
    ? 0
    : Object.values(vols)
        .filter((v) => v < NAMED_PAYER_THRESHOLD)
        .reduce((a, b) => a + b, 0);

  return active.map((g) => ({
    groupId: g.id,
    groupName: g.name,
    departments: byDept ? picked.get(g.id)! : [],
    namedPayers: byDept ? [] : picked.get(g.id)!,
    catchAll: !byDept,
    projectedPerDay:
      Math.round(((load.get(g.id) ?? 0) + (byDept ? 0 : tail / active.length)) * 10) / 10,
  }));
}

function coverage(t: Team) {
  const active = t.groups.filter((g) => g.active);
  const empty = active.filter((g) => !g.members.length).map((g) => g.id);
  if (t.logicAxis === "DEPARTMENT") {
    const covered = new Set(active.flatMap((g) => g.departments));
    const counts: Record<string, number> = {};
    active.flatMap((g) => g.departments).forEach((d) => (counts[d] = (counts[d] ?? 0) + 1));
    const uncovered = Object.keys(deptVolumes(t.siteKey)).filter((d) => !covered.has(d));
    return {
      uncoveredDepartments: uncovered,
      overlappingDepartments: Object.entries(counts).filter(([, c]) => c > 1).map(([d]) => d),
      uncoveredPayers: [],
      emptyGroupIds: empty,
      complete: uncovered.length === 0 && empty.length === 0,
    };
  }
  const anyCatchAll = active.some((g) => g.payerCatchAll);
  const named = new Set(active.flatMap((g) => g.payers));
  const uncovered = anyCatchAll
    ? []
    : Object.keys(payerVolumes(t.siteKey)).filter((p) => !named.has(p));
  return {
    uncoveredDepartments: [],
    overlappingDepartments: [],
    uncoveredPayers: uncovered,
    emptyGroupIds: empty,
    complete: uncovered.length === 0 && empty.length === 0,
  };
}


/* ─────────────────────── allocation preview engine ───────────────────────
 * Mirrors the production pipeline: generate a day's arrivals from the observed
 * volume mix, rank each item, match it to the narrowest accepting group, then
 * distribute within the group by remaining capacity. Ranking is unchanged from
 * v1: priority/value + ageDays x 0.7.
 * ------------------------------------------------------------------------ */

const PRIORITY_SCORE: Record<string, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };

/** Deterministic PRNG so a preview is stable across refreshes. */
function rng(seed: number) {
  let x = seed || 1;
  return () => ((x = (x * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
}

function buildItems(t: Team, count: number) {
  const rand = rng(Number(t.id) * 7919);
  const byDept = t.logicAxis === "DEPARTMENT";
  const vols = byDept ? deptVolumes(t.siteKey) : payerVolumes(t.siteKey);
  const entries = Object.entries(vols);
  const total = entries.reduce((a, [, v]) => a + v, 0) || 1;
  const types = [...new Set(t.groups.flatMap((g) => g.workItemTypes))];
  /**
   * Claim status is a property of the item's stage, not a free variable: a claim
   * being submitted is VALIDATED by definition, one awaiting coding is OPEN or
   * CHECKED. Pairing them at random invents items that cannot exist, which then
   * show up as false "no group accepts this" in the preview.
   */
  const statusFor = (wt: string, r: number): string | null => {
    if (wt === "CLAIM_VALIDATION") return r < 0.5 ? "OPEN" : "CHECKED";
    if (wt === "CLAIM_SUBMISSION") return "VALIDATED";
    return null; // resubmission / reconciliation carry no pre-claim status
  };
  const encs = t.encounterScope === "BOTH" ? ["OP", "IP"] : [t.encounterScope];

  const items: any[] = [];
  for (let i = 0; i < count; i++) {
    // Pick a department/payer weighted by its real share of volume.
    let r = rand() * total;
    let key = entries[0]?.[0] ?? "";
    for (const [k, v] of entries) {
      r -= v;
      if (r <= 0) { key = k; break; }
    }
    const ageDays = Math.round(rand() * 9 * 10) / 10;
    const priority = ["HIGH", "MEDIUM", "LOW"][Math.floor(rand() * 3)];
    const workItemType = types.length ? types[Math.floor(rand() * types.length)] : "CLAIM_VALIDATION";
    const claimStatus = statusFor(workItemType, rand());
    const rank = Math.round((PRIORITY_SCORE[priority] + ageDays * 0.7) * 100) / 100;
    items.push({
      id: `${t.id}-${i + 1}`,
      workItemType,
      department: byDept ? key : null,
      payer: byDept ? null : key,
      claimStatus,
      encounterType: encs[Math.floor(rand() * encs.length)],
      priority,
      ageDays,
      rank,
    });
  }
  // Highest rank first — age dominates quickly, which is the anti-starvation rule.
  return items.sort((a, b) => b.rank - a.rank);
}

/** Narrowest matching group wins; remaining capacity breaks ties. */
function matchGroup(t: Team, item: any) {
  const candidates = t.groups.filter((g) => {
    if (!g.active) return false;
    if (!g.workItemTypes.includes(item.workItemType)) return false;
    if (item.encounterType && g.encounterScope !== "BOTH" && g.encounterScope !== item.encounterType)
      return false;
    if (t.logicAxis === "DEPARTMENT") {
      if (!item.department || !g.departments.includes(item.department)) return false;
    } else {
      const named = item.payer && g.payers.includes(item.payer);
      if (!named && !g.payerCatchAll) return false;
    }
    if (g.claimStatuses.length && item.claimStatus && !g.claimStatuses.includes(item.claimStatus))
      return false;
    return true;
  });
  if (!candidates.length) return null;
  return candidates.sort((a, b) => specificity(b) - specificity(a))[0];
}

function allocationPreview(t: Team, count: number) {
  const items = buildItems(t, count);
  // Per-member remaining capacity, keyed by group.
  const cap = new Map<string, { userId: string; name: string; groupName: string; assigned: number; capacity: number }>();
  for (const g of t.groups) {
    for (const m of g.members) {
      const k = `${g.id}:${m.id}`;
      cap.set(k, {
        userId: m.id,
        name: [m.firstName, m.lastName].filter(Boolean).join(" ") || "—",
        groupName: g.name,
        assigned: 0,
        capacity: USER_CAPACITY,
      });
    }
  }

  const matched = new Map<string, number>();
  const assignedPer = new Map<string, number>();
  const out: any[] = [];
  const unmatched: any[] = [];

  for (const item of items) {
    const g = matchGroup(t, item);
    if (!g) {
      unmatched.push({ ...item, reason: "No group accepts this item" });
      continue;
    }
    matched.set(g.id, (matched.get(g.id) ?? 0) + 1);
    // Least-loaded member of that group with capacity left.
    const pool = g.members
      .map((m) => cap.get(`${g.id}:${m.id}`)!)
      .filter((c) => c && c.assigned < c.capacity)
      .sort((a, b) => a.assigned - b.assigned);
    if (!pool.length) {
      unmatched.push({
        ...item,
        groupId: g.id,
        groupName: g.name,
        reason: g.members.length ? "Group at capacity" : "Group has no members",
      });
      continue;
    }
    const who = pool[0];
    who.assigned += 1;
    assignedPer.set(g.id, (assignedPer.get(g.id) ?? 0) + 1);
    out.push({
      ...item,
      groupId: g.id,
      groupName: g.name,
      assigneeId: who.userId,
      assigneeName: who.name,
      reason: null,
    });
  }

  return {
    teamId: t.id,
    teamName: t.name,
    totalItems: items.length,
    assignedCount: out.length,
    unassignedCount: unmatched.length,
    byGroup: t.groups.map((g) => ({
      groupId: g.id,
      groupName: g.name,
      matched: matched.get(g.id) ?? 0,
      assigned: assignedPer.get(g.id) ?? 0,
      capacity: new Set(g.members.map((m) => m.id)).size * USER_CAPACITY,
    })),
    byAssignee: [...cap.values()]
      .filter((c) => c.assigned > 0)
      .sort((a, b) => b.assigned - a.assigned)
      .map((c) => ({ ...c, remaining: c.capacity - c.assigned })),
    items: out,
    unmatched,
  };
}

/** Per-team assignment settings; defaults match observed coder throughput. */
const teamSettings = new Map<string, { maxAuth: number; maxClaim: number }>();
const settingsFor = (teamId: string) =>
  teamSettings.get(String(teamId)) ?? { maxAuth: USER_CAPACITY, maxClaim: USER_CAPACITY };

const resolvers = {
  Query: {
    /**
     * Explains a suggested split: the observed volume behind it, and what a naive
     * equal-count split would have produced instead.
     */
    optimaDistributionRationale: (_: unknown, { teamId, groupCount }: any) => {
      const t = findTeam(teamId);
      if (!t) return null;
      const byDept = t.logicAxis === "DEPARTMENT";
      const vols: Record<string, number> = byDept ? deptVolumes(t.siteKey) : payerVolumes(t.siteKey);
      const entries = Object.entries(vols).sort((a, b) => b[1] - a[1]);
      const total = entries.reduce((a, [, v]) => a + v, 0) || 1;
      const n = Math.max(1, groupCount || 1);

      // Volume-packed: heaviest item into the lightest bucket.
      const packed = Array.from({ length: n }, () => 0);
      for (const [, v] of entries) {
        let i = 0;
        for (let k = 1; k < n; k++) if (packed[k] < packed[i]) i = k;
        packed[i] += v;
      }
      // Naive: equal COUNT of criteria per bucket, regardless of their volume.
      const naive = Array.from({ length: n }, () => 0);
      entries.forEach(([, v], idx) => { naive[idx % n] += v; });

      const round = (x: number) => Math.round(x * 10) / 10;
      const tail = entries.filter(([, v]) => v < 1);
      return {
        facilityId: t.facilityId,
        axis: t.logicAxis,
        totalPerDay: round(total),
        criteriaCount: entries.length,
        burstFactor: burstOf(t.siteKey),
        top: entries.slice(0, 6).map(([name, v]) => ({
          name, perDay: round(v), sharePct: round((v / total) * 100),
        })),
        concentrationRatio: (() => {
          if (!entries.length) return 0;
          const mid = entries[Math.floor(entries.length / 2)][1] || 0.1;
          return round(entries[0][1] / mid);
        })(),
        tailCount: tail.length,
        tailSharePct: round((tail.reduce((a, [, v]) => a + v, 0) / total) * 100),
        naiveSpread: naive.map(round),
        balancedSpread: packed.map(round),
      };
    },

    facilityOptions: () => [...new Set(teams.map((t) => t.facilityId))].sort(),
    /** Every department seen at this team's facility, or across all when creating. */
    departmentOptionsFor: (_: unknown, { teamId }: any) => {
      const t = teamId ? findTeam(teamId) : null;
      const src = t ? deptVolumes(t.siteKey) : V.global.departments;
      return Object.keys(src).sort();
    },
    payerOptionsFor: (_: unknown, { teamId }: any) => {
      const t = teamId ? findTeam(teamId) : null;
      const src = t ? payerVolumes(t.siteKey) : V.global.payers;
      return Object.keys(src).sort();
    },

    assignmentSettingByTeam: (_: unknown, { teamId }: any) => {
      const st = settingsFor(teamId);
      return { id: `set-${teamId}`, ...st, targetId: teamId, type: "TEAM" };
    },
    effectiveAssignmentSettings: (_: unknown, { teamId, userIds }: any) => {
      const st = settingsFor(teamId ?? "");
      return (userIds ?? []).map((u: string) => ({
        userId: u, teamId: teamId ?? null,
        maxAuth: st.maxAuth, maxClaim: st.maxClaim, source: "TEAM",
      }));
    },
    usersWorkTypeAssignedCounts: (_: unknown, { userIds, workItemTypes }: any) => {
      // Deterministic pseudo-load so the preview has a believable starting point.
      const types = workItemTypes?.length ? workItemTypes : ["CLAIM_VALIDATION"];
      return (userIds ?? []).flatMap((u: string, i: number) =>
        types.map((wt: string) => ({ userId: u, workItemType: wt, assigned: (i * 7) % 23 }))
      );
    },

    optimaAllocationPreview: (_: unknown, { teamId, itemCount }: any) => {
      const t = findTeam(teamId);
      return t ? allocationPreview(t, itemCount ?? 300) : null;
    },

    /* v1-shaped operations, served from the v2 model so the real page runs unmodified */
    optimaTeams: (_: unknown, { filter }: any) => {
      // branchIds / vendorId come from the signed-in user upstream; in the demo
      // every team belongs to the one tenant, so those are deliberately ignored.
      let out = teams;
      if (filter?.name?.trim()) {
        const q = filter.name.trim().toLowerCase();
        out = out.filter((t) => t.name.toLowerCase().includes(q));
      }
      if (typeof filter?.active === "boolean") out = out.filter((t) => t.active === filter.active);
      return out;
    },
    optimaTeam: (_: unknown, { id }: any) => findTeam(id) ?? null,
    branches: () => ({
      edges: teams.map((t) => ({ node: { id: t.id, name: t.facilityId, nameAr: null } })),
    }),
    codeSystemConcepts: (_: unknown, { filter }: any) => {
      const all = new Set<string>();
      teams.forEach((t) => t.groups.forEach((g) => g.departments.forEach((d) => all.add(d))));
      const q = (filter?.display ?? "").toLowerCase();
      return {
        edges: [...all]
          .filter((d) => d.toLowerCase().includes(q))
          .map((d) => ({ node: { code: d, display: d } })),
      };
    },
    users: () => ({ edges: allUsers.map((u) => ({ node: u })) }),

    optimaTeamsV2: () => teams,
    optimaTeamV2: (_: unknown, { id }: any) => findTeam(id) ?? null,
    optimaTeamV2DistributionAdvice: (_: unknown, { id }: any) => {
      const t = findTeam(id);
      return t ? advice(t) : { projections: [], findings: [], hasBlockers: false, healthy: true };
    },
    optimaTeamV2Suggest: (_: unknown, { id }: any) => {
      const t = findTeam(id);
      return t ? suggest(t) : [];
    },
    facilityDepartments: (_: unknown, { teamId }: any) => {
      const t = findTeam(teamId);
      return t ? Object.keys(deptVolumes(t.siteKey)).sort() : [];
    },
    facilityPayers: (_: unknown, { teamId }: any) => {
      const t = findTeam(teamId);
      return t ? Object.keys(payerVolumes(t.siteKey)).sort() : [];
    },
    allUsers: () => allUsers,
  },

  RcmTeamV2: {
    capacity: teamCapacity,
    usersDetails: (t: Team) => {
      const seen = new Set<string>();
      return t.groups.flatMap((g) => g.members.filter((m) => !seen.has(m.id) && seen.add(m.id)));
    },
    coverage,
    members: (t: Team) => {
      const seen = new Set<string>();
      return t.groups.flatMap((g) => g.members.filter((m) => !seen.has(m.id) && seen.add(m.id)));
    },
  },

  RcmTeamGroup: { specificity, capacity: groupCapacity },

  Mutation: {
    optimaTeamV2Save: (_: unknown, { id, input }: any) => {
      const existing = id ? findTeam(id) : null;
      const target: any = existing ?? {
        id: String(Math.max(0, ...teams.map((x) => +x.id)) + 1),
        siteKey: teams[0]?.siteKey,
        createdDate: new Date().toISOString(),
        branchIds: [],
        branches: [],
        rotationEnabled: false,
        groups: [],
      };
      Object.assign(target, {
        name: input.name,
        description: input.description ?? null,
        facilityId: input.facilityId ?? target.facilityId,
        division: input.division ?? target.division,
        encounterScope: input.encounterScope ?? target.encounterScope,
        logicAxis: input.logicAxis ?? target.logicAxis,
        active: input.active ?? true,
      });
      // Keep the volume key aligned with the chosen facility.
      const match = teams.find((x) => x.facilityId === target.facilityId && x.siteKey);
      if (match) target.siteKey = match.siteKey;
      target.branches = [
        { id: target.id, name: target.facilityId, nameAr: null, healthLicense: target.facilityId },
      ];
      if (input.maxAuth != null || input.maxClaim != null) {
        teamSettings.set(String(target.id), {
          maxAuth: input.maxAuth ?? USER_CAPACITY,
          maxClaim: input.maxClaim ?? USER_CAPACITY,
        });
      }
      if (input.groups) {
        let gid = Math.max(0, ...teams.flatMap((t) => t.groups.map((g) => +g.id || 0))) + 1;
        target.groups = input.groups.map((g: any, i: number) => ({
          id: g.id ?? String(gid++),
          rcmTeamId: target.id,
          name: g.name,
          active: g.active ?? true,
          workItemTypes: g.workItemTypes ?? [],
          encounterScope: g.encounterScope ?? target.encounterScope,
          departments: g.departments ?? [],
          payers: g.payers ?? [],
          payerCatchAll: g.payerCatchAll ?? false,
          claimStatuses: g.claimStatuses ?? [],
          rotationOrder: i,
          members: (g.memberIds ?? [])
            .map((uid: string) => allUsers.find((u) => u.id === uid))
            .filter(Boolean),
        }));
      }
      if (!existing) teams.unshift(target);
      return target;
    },

    assignmentSettingTeamSave: (_: unknown, { teamId, input }: any) => {
      const cur = settingsFor(teamId);
      const next = { maxAuth: input.maxAuth ?? cur.maxAuth, maxClaim: input.maxClaim ?? cur.maxClaim };
      teamSettings.set(String(teamId), next);
      return { id: `set-${teamId}`, ...next, targetId: teamId, type: "TEAM" };
    },
    /** The queue the engine reads; here it is generated from observed volumes. */
    assignmentUnassignedEntities: (_: unknown, { input }: any) => {
      const wanted = new Set((input?.branchIds ?? []).map(String));
      return teams
        .filter((t) => !wanted.size || wanted.has(String(t.id)))
        .map((t) => {
          const items = buildItems(t, 60);
          return {
            branchId: t.id,
            facilityId: t.facilityId,
            workItemType: items[0]?.workItemType ?? "CLAIM_VALIDATION",
            workItems: items.map((i) => ({
              id: i.id, priority: i.priority, encounterType: i.encounterType,
              department: i.department, claimStatus: i.claimStatus,
              startDate: new Date(Date.now() - i.ageDays * 86400000).toISOString(),
              net: null, insurancePayer: i.payer,
            })),
          };
        });
    },
    assignWorkItems: (_: unknown, { input }: any) => ({
      success: true,
      message: `Assigned ${input.workItemIds.length} items to ${input.assigneeId}`,
      totalCount: input.workItemIds.length,
    }),

    optimaTeamUpdate: (_: unknown, { id, input }: any) => {
      const t = findTeam(id);
      if (!t) return null;
      if (input.name != null) t.name = input.name;
      if (input.nameAr != null) (t as any).nameAr = input.nameAr;
      if (input.description != null) (t as any).description = input.description;
      if (input.active != null) t.active = input.active;
      if (input.rotationEnabled != null) t.rotationEnabled = input.rotationEnabled;
      if (input.rotationFrequency != null) (t as any).rotationFrequency = input.rotationFrequency;
      return t;
    },
    optimaTeamCreate: (_: unknown, { input }: any) => {
      const t: any = {
        id: String(Math.max(0, ...teams.map((x) => +x.id)) + 1),
        name: input.name ?? "New team",
        nameAr: input.nameAr ?? null,
        description: input.description ?? null,
        active: input.active ?? true,
        facilityId: "DXB",
        siteKey: teams[0].siteKey,
        division: "AUTH",
        encounterScope: "OP",
        logicAxis: "DEPARTMENT",
        createdDate: new Date().toISOString(),
        rotationEnabled: input.rotationEnabled ?? false,
        rotationFrequency: input.rotationFrequency ?? null,
        branchIds: input.branchIds ?? [],
        branches: [],
        groups: [],
      };
      teams.unshift(t);
      return t;
    },
    optimaTeamUserAdd: (_: unknown, { id, userIds }: any) => {
      const t = findTeam(id);
      if (!t || !t.groups.length) return t ?? null;
      const g = t.groups[0];
      for (const uid of userIds) {
        const u = allUsers.find((x) => x.id === uid);
        if (u && !g.members.some((m) => m.id === uid)) g.members.push(u);
      }
      return t;
    },
    optimaTeamUserRemove: (_: unknown, { id, userIds }: any) => {
      const t = findTeam(id);
      if (!t) return null;
      const drop = new Set(userIds.map(String));
      t.groups.forEach((g) => (g.members = g.members.filter((m) => !drop.has(String(m.id)))));
      return t;
    },

    optimaTeamV2GroupUpdate: (_: unknown, { groupId, input }: any) => {
      const g = findGroup(groupId);
      if (!g) return null;
      if (input.name != null) g.name = input.name;
      if (input.active != null) g.active = input.active;
      if (input.workItemTypes) g.workItemTypes = input.workItemTypes;
      if (input.encounterScope) g.encounterScope = input.encounterScope;
      if (input.departments) g.departments = input.departments;
      if (input.payers) g.payers = input.payers;
      if (input.payerCatchAll != null) g.payerCatchAll = input.payerCatchAll;
      if (input.claimStatuses) g.claimStatuses = input.claimStatuses;
      if (input.memberIds)
        g.members = input.memberIds
          .map((id: string) => allUsers.find((u) => u.id === id))
          .filter(Boolean) as User[];
      return g;
    },
    optimaTeamV2GroupCreate: (_: unknown, { teamId, input }: any) => {
      const t = findTeam(teamId);
      if (!t) return null;
      const g: Group = {
        id: String(nextGroupId++),
        rcmTeamId: t.id,
        name: input.name ?? "New group",
        active: input.active ?? true,
        workItemTypes: input.workItemTypes ?? [],
        encounterScope: input.encounterScope ?? t.encounterScope,
        departments: input.departments ?? [],
        payers: input.payers ?? [],
        payerCatchAll: input.payerCatchAll ?? false,
        claimStatuses: input.claimStatuses ?? [],
        rotationOrder: t.groups.length,
        members: (input.memberIds ?? [])
          .map((id: string) => allUsers.find((u) => u.id === id))
          .filter(Boolean) as User[],
      };
      t.groups.push(g);
      return g;
    },
    optimaTeamV2GroupDelete: (_: unknown, { groupId }: any) => {
      const t = teamOfGroup(groupId);
      if (!t) return false;
      t.groups = t.groups.filter((g) => String(g.id) !== String(groupId));
      return true;
    },
    optimaTeamV2ApplySuggestion: (_: unknown, { id }: any) => {
      const t = findTeam(id);
      if (!t) return null;
      for (const s of suggest(t)) {
        const g = findGroup(s.groupId);
        if (!g) continue;
        if (t.logicAxis === "DEPARTMENT") g.departments = s.departments;
        else {
          g.payers = s.namedPayers;
          g.payerCatchAll = s.catchAll;
        }
      }
      return t;
    },
  },
};

export const schemaV2 = makeExecutableSchema({ typeDefs, resolvers });
