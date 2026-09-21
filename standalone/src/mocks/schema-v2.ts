/**
 * Local executable schema for the v2 team model, over the real production estate.
 *
 * Seed is `teams-v2-real.json`, the 16 live v1 teams run through the v1→v2 migration,
 * giving 10 teams / 16 groups / 75 memberships / 69 distinct people, with real names.
 * Volumes are the observed figures from workitem_profile.xlsx, so projections and
 * advice match what production would show.
 *
 * Mirrors RcmTeamV2ServiceImpl, RcmTeamCoverageService and RcmTeamDistributionAdvisor.
 */
import { makeExecutableSchema } from "@graphql-tools/schema";
import { queueDashboardTypeDefs, queueDashboardResolvers } from "./queue-dashboard.js";
import seed from "./teams-v2-real.json";
import peopleSeed from "./people.json";
import volumes from "./volumes.json";
import {
  CAPACITY_FAMILIES,
  DIMENSIONS,
  POLICIES,
  type Criterion,
  admittedValues,
  criteriaAccept,
  criterionFor,
  describeCriteria,
  dimensionByCode,
  familyOfWorkItemType,
  mergeCriteria,
  normKey,
  policiesFor,
  policyByCode,
  policyFlags,
  prettyValue,
  rejectingCriterion,
  specificityOf,
  widensBeyond,
} from "./allocation-model.js";

const typeDefs = /* GraphQL */ `
  enum RcmTeamDivision { AUTH CLAIM }
  enum RcmTeamEncounterScope { OP IP BOTH }
  enum RcmTeamLogicAxis { DEPARTMENT PAYER }
  enum RcmTeamAdviceSeverity { BLOCKER WARNING INFO }

  enum CriterionOperator { IN NOT_IN ANY }
  enum CriterionLevel { TEAM GROUP BOTH }

  """
  A routing axis. These are registry rows, not schema fields, so a client who
  splits work some other way needs a row here and a value source, nothing more.
  """
  type AllocationDimension {
    code: String!
    label: String!
    """Teams prefilter, groups refine. BOTH may be constrained at either level."""
    level: CriterionLevel!
    operators: [CriterionOperator!]!
    """Which dimensionValues() source backs this dimension's picker."""
    valueSource: String!
    """Field on a work item this dimension tests."""
    itemField: String!
    coverageChecked: Boolean!
    """EXACT, or NORMALISED for sources that spell the same thing many ways."""
    matchMode: String!
    """
    Synonyms, normalised alias to normalised canonical. Normalisation handles
    punctuation and case; a misspelling can only be bridged by data.
    """
    aliases: [DimensionAlias!]!
    """How to render a value: a business code as-is, or one of our enums as prose."""
    valueStyle: String!
    sortOrder: Int!
    """Estate-wide pickable values, so a filter bar needs one round trip."""
    values: [DimensionValue!]!
  }

  """One accepted synonym for a dimension value."""
  type DimensionAlias {
    from: String!
    to: String!
  }

  """One clause of a routing rule: dimension, operator, values."""
  type Criterion {
    dimension: String!
    operator: CriterionOperator!
    values: [String!]!
    """Resolved display labels, so chips do not show raw payer codes."""
    labels: [String!]!
  }
  input CriterionInput {
    dimension: String!
    operator: CriterionOperator!
    values: [String!]
  }

  """A pickable value for one dimension."""
  type DimensionValue {
    value: String!
    label: String!
    """Observed items per day, so an admin can see what a choice is worth."""
    perDay: Float
  }

  """
  Relay shape so every dimension is backed by a real paginated, searchable list,
  the same contract ApiAutocomplete drives everywhere else in Optima.

  PageInfo carries the backward fields too, because the ported dashboard's
  paginated queries select them, as Relay's spec has them.
  """
  type PageInfo {
    hasNextPage: Boolean!
    hasPreviousPage: Boolean
    endCursor: String
    startCursor: String
  }
  type DimensionOptionNode { id: ID!, name: String!, perDay: Float }
  type DimensionOptionEdge { node: DimensionOptionNode!, cursor: String! }
  type DimensionOptionConnection {
    edges: [DimensionOptionEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }
  input DimensionOptionFilter {
    """Which registry dimension to list. This is what makes one source serve all."""
    dimension: String!
    teamId: ID
    name_Icontains: String
  }

  """
  What replaces division: work item types sharing a daily cap and overflow rule.
  """
  type CapacityFamily {
    code: String!
    label: String!
    workItemTypes: [String!]!
    defaultLimit: Int!
    allowExceedByDefault: Boolean!
  }
  """
  A rule about what happens to work once a group has claimed it. Registry rows,
  declaring which work they apply to, so a team is only asked about the policies
  its own work makes relevant.
  """
  type AllocationPolicy {
    code: String!
    label: String!
    description: String!
    valueType: String!
    scope: String!
    appliesToTypes: [String!]!
    defaultNumber: Float
    defaultFlag: Boolean
    unit: String
    """Members need this tag to receive work the policy flags."""
    handlerTag: String
    itemField: String
    sortOrder: Int!
  }

  """One policy's setting on one team, per family where the policy is per-family."""
  type PolicySetting {
    code: String!
    family: String
    number: Float
    flag: Boolean
  }
  input PolicySettingInput {
    code: String!
    family: String
    number: Float
    flag: Boolean
  }

  type TeamCapacityRule {
    family: String!
    label: String!
    limit: Int!
    allowExceed: Boolean!
  }
  input PolicyHandlerInput {
    tag: String!
    memberIds: [ID!]!
  }
  input TeamCapacityRuleInput {
    family: String!
    limit: Int
    allowExceed: Boolean
  }

  """
  Scalars the ported RCM dashboard contract uses. Long is an int in JS and
  Instant is an ISO string over the wire, so both are plain passthroughs; they
  exist so the upstream queries parse unchanged.
  """
  scalar Long
  scalar Instant

  """Upstream's name for the same set. Aliased so the ported page's queries
  need no edit, while the v2 model keeps its own spelling."""
  enum WorkItemType {
    RECONCILIATION
    CLAIM_SUBMISSION
    CLAIM_RESUBMISSION
    CLAIM_VALIDATION
    AUTHORIZATION_SUBMISSION
    AUTHORIZATION_RESUBMISSION
  }

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
    appRole: String
    isActive: Boolean
    """Sits in every group of the team and receives work from all of them."""
    isSupervisor: Boolean
    """
    Policy handler tags this member carries. A policy that flags an item routes
    it only to members holding that policy's tag.
    """
    handlerTags: [String!]!
    "Derived from handlerTags. Kept so v1-shaped callers keep working."
    handlesHighCost: Boolean
    """
    Windows in which this person is not available for work.

    v1 had these and v2 dropped them, which is not only a broken query: an
    unavailable member stayed in the allocation pool and kept being given work
    while they were away. Availability is a property of the person, not of a
    group, which is why it lives here and not on membership.
    """
    unavailabilities: [OptimaTeamUserUnavailability!]!
    """True when a window covers today. What the allocation pool filters on."""
    unavailableToday: Boolean!
    "The v1 contract wrapped a member; here a member is the user, so this is id."
    userId: ID!
    "Likewise: v1 nested the user inside the member, so this returns self."
    user: User!
    """Per-member cap, used when the team is not on uniform capacity."""
    capacityOverride: Int
  }

  """One window in which a member is unavailable. Shape follows v1 exactly."""
  type OptimaTeamUserUnavailability {
    id: ID!
    rcmTeamId: ID
    userId: ID
    startDate: String
    endDate: String
    reason: String
    cancelled: Boolean
    """Whether the window covers today."""
    activeToday: Boolean
    createdBy: String
    createdDate: String
  }

  """
  UNASSIGN pushes the person's active work back to the unassigned bucket.
  REDISTRIBUTE records the window only, and a supervisor reassigns by hand.
  """
  enum OptimaTeamUnavailabilityAction {
    UNASSIGN
    REDISTRIBUTE
  }

  input OptimaTeamUserUnavailabilityInput {
    teamId: ID!
    userId: ID!
    startDate: String!
    endDate: String!
    reason: String
    action: OptimaTeamUnavailabilityAction!
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
    """This group's own rule. It may only narrow its team's, never widen it."""
    criteria: [Criterion!]!
    """Team rule plus this group's, which is what the matcher actually runs."""
    effectiveCriteria: [Criterion!]!
    criteriaSummary: [String!]!
    rotationOrder: Int
    specificity: Int!
    members(availableOnly: Boolean): [User!]!
    capacity: RcmTeamCapacity!

    "Derived from criteria. Kept so v1-shaped callers keep working."
    workItemTypes: [RcmWorkItemType!]!
    encounterScope: RcmTeamEncounterScope!
    departments: [String!]!
    payers: [ID!]!
    payerCatchAll: Boolean!
    claimStatuses: [String!]!
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
    rotationEnabled: Boolean!
    groups: [RcmTeamGroup!]!
    members(availableOnly: Boolean): [User!]!
    capacity: RcmTeamCapacity!
    coverage: RcmTeamCoverageReport!

    """The team's routing rule. Prefilters work before its groups refine it."""
    criteria: [Criterion!]!
    """Chip text for the rule, in registry order."""
    criteriaSummary: [String!]!
    """Every policy setting on this team. The source of truth for capacity too."""
    policies: [PolicySetting!]!
    """The policies this team's work makes relevant, with its current settings."""
    applicablePolicies: [AllocationPolicy!]!
    """Derived view of the daily-limit and overflow policies, per family."""
    capacities: [TeamCapacityRule!]!
    """Breaks ties when two teams' rules are equally specific. Higher wins."""
    priority: Int!

    """One cap for everyone, or per-member overrides."""
    uniformCapacity: Boolean!

    "Derived from criteria and policies. Kept so v1-shaped callers keep working."
    highCostThreshold: Float
    facilityId: String
    facilityIds: [String!]!
    division: RcmTeamDivision
    encounterScope: RcmTeamEncounterScope
    logicAxis: RcmTeamLogicAxis
    allowExceedCapacity: Boolean!
    maxAuth: Int!
    maxClaim: Int!
  }

  input RcmTeamGroupInput {
    name: String
    active: Boolean
    criteria: [CriterionInput!]
    memberIds: [ID!]
  }

  """Extra fields the real Teams page selects."""
  type Branch { id: ID!, name: String, nameAr: String, healthLicense: String }
  type BranchEdge { node: Branch! }
  type BranchConnection { edges: [BranchEdge!]! }
  type CodeConcept { code: String!, display: String }
  type CodeEdge { node: CodeConcept! }
  type CodeConnection { edges: [CodeEdge!]! }
  type UserEdge { node: User!, cursor: String }
  type UserConnection { edges: [UserEdge!]!, pageInfo: PageInfo, totalCount: Int }
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
    net: Float
    workItemType: String!
    department: String
    payer: String
    claimStatus: String
    encounterType: String
    priority: String
    ageDays: Float!
    rank: Float!
    """Codes of the policies that flagged this item."""
    flaggedBy: [String!]!
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
    """What this preview covers, stated as the team's own rule."""
    scope: [String!]!
    """What each policy did to this run. Empty when no policy applies."""
    policyImpact: [PolicyImpact!]!
    totalItems: Int!
    assignedCount: Int!
    unassignedCount: Int!
    byGroup: [PreviewGroup!]!
    byAssignee: [PreviewAssignee!]!
    items: [PreviewItem!]!
    unmatched: [PreviewItem!]!
  }

  """What one policy flagged in a preview run, and what it cost."""
  type PolicyImpact {
    code: String!
    label: String!
    unit: String
    threshold: Float!
    flagged: Int!
    unassigned: Int!
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
    criteria: [CriterionInput!]
    memberIds: [ID!]
  }
  input TeamV2Input {
    name: String!
    description: String
    active: Boolean
    criteria: [CriterionInput!]
    policies: [PolicySettingInput!]
    priority: Int
    uniformCapacity: Boolean
    supervisorIds: [ID!]
    """Member ids per policy handler tag, e.g. {tag: "URGENT", memberIds: [...]}"""
    handlers: [PolicyHandlerInput!]
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
    "Heaviest first, the reason an even count would not be an even workload."
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

  """One thing that would stop work being allocated."""
  type ReadinessIssue {
    severity: String!
    teamId: ID
    teamName: String
    facilityId: String
    """What is wrong, in a sentence a supervisor can act on."""
    message: String!
    kind: String!
    """Who owns fixing this. Empty when no team has a supervisor to tell."""
    supervisorIds: [ID!]!
    supervisorNames: [String!]!
    """Estimated items per day that fall through while this stands."""
    itemsAtRiskPerDay: Float!
  }

  """
  What one supervisor would be told. Nothing is allocated silently, so every
  gap on a team reaches the person responsible for that team.
  """
  type SupervisorAlert {
    userId: ID!
    name: String!
    teamNames: [String!]!
    blockers: Int!
    warnings: Int!
    itemsAtRiskPerDay: Float!
  }

  """
  The estate in totals. People and capacity are de-duplicated across teams:
  someone in two teams is one person with one daily capacity, not two.
  """
  type AllocationEstate {
    teams: Int!
    activeTeams: Int!
    groups: Int!
    people: Int!
    capacityPerDay: Int!
    """Memberships minus distinct people, i.e. how much sharing is going on."""
    sharedMemberships: Int!
  }

  """
  One execution of the allocation workflow.

  Optima already persists every run to assignment_auto_assign_request_response_log
  (requestPayload, responsePayload, isFailed, indexed on created_date and
  is_failed) and exposes none of it. So the numbers a supervisor needs at 9am
  are already in the database and unreachable. This type is the shape that
  table should be read through: upstream parses responsePayload into it, here
  it is served from the same summary the workflow emits.
  """
  type AllocationRun {
    id: ID!
    startedAt: String!
    finishedAt: String
    """A dry run previews without calling T-0005. The Review step uses this."""
    dryRun: Boolean!
    failed: Boolean!
    """Null for the nightly trigger, a user for a manual run."""
    triggeredBy: String
    totals: AllocationRunTotals!
    byGroup: [AllocationRunGroup!]!
    """Why work fell through, by the dimension that rejected it."""
    unmatchedByDimension: [AllocationRunReason!]!
    """Groups that accepted work they had no capacity for."""
    overflow: [AllocationRunOverflow!]!
  }

  type AllocationRunTotals {
    ranked: Int!
    matched: Int!
    assigned: Int!
    unmatched: Int!
    overflow: Int!
    """Items the winning group could not take, placed by a broader group."""
    fallback: Int!
    assignees: Int!
  }

  type AllocationRunGroup {
    groupId: ID!
    groupName: String!
    teamName: String!
    matched: Int!
    assigned: Int!
  }

  type AllocationRunReason {
    """Registry dimension code, or null when nothing accepted at all."""
    dimension: String
    label: String!
    count: Int!
    """The values that had nowhere to go, worst first."""
    topValues: [AllocationRunValue!]!
  }

  """One dimension value and how much work it cost."""
  type AllocationRunValue {
    value: String!
    count: Int!
  }

  type AllocationRunOverflow {
    groupName: String!
    count: Int!
    reason: String!
  }

  """Whether the whole estate can actually allocate the work that arrives."""
  type AllocationReadiness {
    teamsTotal: Int!
    teamsReady: Int!
    issues: [ReadinessIssue!]!
    """Facility + work item type combinations no active team handles."""
    unhandled: [String!]!
    """Per-supervisor digest of everything above. Point 4 of the feedback."""
    supervisorAlerts: [SupervisorAlert!]!
    """Issues nobody owns, because the team has no supervisor set."""
    unownedIssues: Int!
    itemsAtRiskPerDay: Float!
  }

  """What deleting a team would leave behind."""
  type TeamDeletionResult {
    deletedId: ID!
    deletedName: String!
    """Readiness recomputed after the removal, so the caller can show the cost."""
    readiness: AllocationReadiness!
    """Teams at the same facility that now carry the work alone."""
    affectedTeams: [RcmTeamV2!]!
  }

  """
  Filter the team list by the same dimensions teams are routed on, so the filter
  bar is generated from the registry rather than hand-written per client.
  """
  input TeamQueryFilter {
    name: String
    active: Boolean
    """Match teams whose rule admits these values. One entry per dimension."""
    criteria: [CriterionInput!]
  }

  type Query {
    """The routing axes this tenant is configured with."""
    allocationDimensions: [AllocationDimension!]!
    """The policies this tenant is configured with."""
    allocationPolicies: [AllocationPolicy!]!
    """The work item families capacity is declared against."""
    capacityFamilies: [CapacityFamily!]!
    """
    Pickable values for any dimension, from one endpoint, so the criteria
    builder needs no per-dimension wiring.
    """
    dimensionValues(dimension: String!, teamId: ID): [DimensionValue!]!

    """Paginated, searchable values for any dimension. Backs ApiAutocomplete."""
    dimensionOptions(
      first: Int
      after: String
      filter: DimensionOptionFilter!
    ): DimensionOptionConnection!

    """Staff picker, relay-shaped like the rest."""
    rcmUsers(first: Int, after: String, filter: UserFilterInput): UserConnection

    """Estate totals, de-duplicated across teams."""
    optimaAllocationEstate: AllocationEstate!
    """Estate-wide readiness: what would fall through today."""
    optimaAllocationReadiness: AllocationReadiness!
    """
    Allocation run history, newest first. Backed upstream by
    assignment_auto_assign_request_response_log.
    """
    optimaAllocationRuns(first: Int, failedOnly: Boolean): [AllocationRun!]!
    """The most recent run, or null if allocation has never run."""
    optimaLatestAllocationRun: AllocationRun
    """Teams matching a supervisor-style filter."""
    optimaTeamsFiltered(filter: TeamQueryFilter): [RcmTeamV2!]!
    """Dry run of a deletion: what it would break, without deleting."""
    optimaTeamDeletionImpact(id: ID!): TeamDeletionResult!

    """Why the recommended split is what it is."""
    optimaDistributionRationale(teamId: ID!, groupCount: Int!): DistributionRationale

    """Options the team wizard needs."""
    facilityOptions: [String!]!
    departmentOptionsFor(teamId: ID): [String!]!
    payerOptionsFor(teamId: ID): [ID!]!

    assignmentSettingByTeam(teamId: ID!): AssignmentSetting
    effectiveAssignmentSettings(teamId: ID, userIds: [Long!]!): [EffectiveAssignmentSetting!]!
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

    """Deactivate or remove a team. Reports what the removal leaves uncovered."""
    optimaTeamV2Delete(id: ID!): TeamDeletionResult!

    assignmentSettingTeamSave(teamId: ID!, input: AssignmentSettingInput!): AssignmentSetting
    assignmentUnassignedEntities(input: UnassignedEntitiesInput!): [UnassignedEntity!]!
    assignWorkItems(input: AssignWorkItemsInput!): AssignWorkItemsResult!

    optimaTeamUpdate(id: ID!, input: OptimaTeamInput!): RcmTeamV2
    optimaTeamCreate(input: OptimaTeamInput!): RcmTeamV2
    optimaTeamUserAdd(id: ID!, userIds: [ID!]!): RcmTeamV2
    optimaTeamUserRemove(id: ID!, userIds: [ID!]!): RcmTeamV2
    """Mark a member unavailable for a date range. Rejects overlaps, as v1 does."""
    optimaTeamUserUnavailabilitySet(
      input: OptimaTeamUserUnavailabilityInput!
    ): OptimaTeamUserUnavailability
    """Cancel a window. Kept, not deleted, so the history stays auditable."""
    optimaTeamUserUnavailabilityCancel(id: ID!): OptimaTeamUserUnavailability

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
  criteria: Criterion[];
  rotationOrder: number;
  members: User[];
};
type PolicySetting = { code: string; family?: string | null; number?: number | null; flag?: boolean | null };
type Team = {
  id: string;
  name: string;
  active: boolean;
  criteria: Criterion[];
  policies: PolicySetting[];
  priority: number;
  /** Keys into the volume data, one per facility the rule admits. */
  siteKeys: string[];
  rotationEnabled: boolean;
  groups: Group[];
};

const IN = (dimension: string, values: string[]): Criterion => ({
  dimension,
  operator: "IN",
  values,
});

/**
 * The seed is the v1-shaped estate: facilityId, division, encounterScope, a
 * logicAxis, and groups holding parallel arrays. Fold all of it into criteria
 * once, on load, so nothing downstream knows those columns ever existed.
 */
function migrateSeedTeam(raw: any): Team {
  const teamCriteria: Criterion[] = [IN("FACILITY", [raw.facilityId])];
  if (raw.encounterScope && raw.encounterScope !== "BOTH") {
    teamCriteria.push(IN("ENCOUNTER_TYPE", [raw.encounterScope]));
  }
  // The team prefilters on the union of what its groups actually handle.
  const allTypes = [
    ...new Set((raw.groups ?? []).flatMap((g: any) => g.workItemTypes ?? [])),
  ] as string[];
  if (allTypes.length) teamCriteria.push(IN("WORK_ITEM_TYPE", allTypes));

  const groups: Group[] = (raw.groups ?? []).map((g: any, i: number) => {
    const criteria: Criterion[] = [];
    if (g.workItemTypes?.length) criteria.push(IN("WORK_ITEM_TYPE", g.workItemTypes));
    if (g.encounterScope && g.encounterScope !== raw.encounterScope) {
      if (g.encounterScope !== "BOTH") criteria.push(IN("ENCOUNTER_TYPE", [g.encounterScope]));
    }
    if (g.departments?.length) criteria.push(IN("DEPARTMENT", g.departments));
    // The catch-all toggle becomes an explicit ANY, which is all it ever meant.
    if (g.payerCatchAll) criteria.push({ dimension: "PAYER", operator: "ANY", values: [] });
    else if (g.payers?.length) criteria.push(IN("PAYER", g.payers));
    if (g.claimStatuses?.length) criteria.push(IN("CLAIM_STATUS", g.claimStatuses));
    return {
      id: String(g.id),
      rcmTeamId: String(raw.id),
      name: g.name,
      active: g.active ?? true,
      criteria,
      rotationOrder: g.rotationOrder ?? i,
      members: g.members ?? [],
    };
  });

  // Policy settings for every family the team's work touches, plus the team-wide
  // policies that work makes relevant.
  const families = [
    ...new Set(allTypes.map((w) => familyOfWorkItemType(w)?.code).filter(Boolean)),
  ] as string[];
  const policies: PolicySetting[] = [];
  for (const code of families.length ? families : ["CLAIM"]) {
    const f = CAPACITY_FAMILIES.find((x) => x.code === code)!;
    policies.push({ code: "DAILY_LIMIT", family: code, number: f.defaultLimit });
    policies.push({ code: "ALLOW_EXCEED", family: code, flag: f.allowExceedByDefault });
  }
  for (const p of policiesFor(allTypes)) {
    if (p.scope !== "TEAM") continue;
    policies.push(
      p.valueType === "NUMBER"
        ? { code: p.code, number: p.defaultValue as number }
        : { code: p.code, flag: p.defaultValue as boolean },
    );
  }

  return {
    ...raw,
    id: String(raw.id),
    criteria: teamCriteria,
    policies,
    priority: 0,
    siteKeys: [raw.siteKey].filter(Boolean),
    groups,
  };
}

const teams: Team[] = (JSON.parse(JSON.stringify(seed)) as any[]).map(migrateSeedTeam);

/** facility code to volume key, learned from the seed. */
const SITE_KEY = new Map<string, string>();
for (const raw of seed as any[]) {
  if (raw.facilityId && raw.siteKey) SITE_KEY.set(raw.facilityId, raw.siteKey);
}

const allUsers: User[] = peopleSeed as User[];

let nextGroupId = Math.max(0, ...teams.flatMap((t) => t.groups.map((g) => +g.id))) + 1;

/** Observed daily volume, per facility, falling back to the global mix. */
const V: any = volumes;
const ALL_FACILITIES = [...SITE_KEY.keys()].sort();
const WORK_ITEM_TYPES = CAPACITY_FAMILIES.flatMap((f) => f.workItemTypes);
const ENCOUNTER_TYPES = ["OP", "IP"];
const CLAIM_STATUSES = ["OPEN", "CHECKED", "VALIDATED"];

/**
 * A team may now serve several facilities, so volumes are summed across the
 * ones its rule admits rather than read from one siteKey.
 */
const sumVolumes = (keys: string[], bucket: "departments" | "payers") => {
  const out: Record<string, number> = {};
  const sources = keys.length
    ? keys.map((k) => V.bySite[bucket][k] ?? V.global[bucket])
    : [V.global[bucket]];
  for (const src of sources) {
    for (const [k, v] of Object.entries(src as Record<string, number>)) {
      out[k] = (out[k] ?? 0) + v;
    }
  }
  return out;
};

/** Facilities a team's rule admits, resolved through the FACILITY criterion. */
const facilitiesOf = (t: Team): string[] =>
  admittedValues(t.criteria, "FACILITY", ALL_FACILITIES);
const siteKeysOf = (t: Team): string[] =>
  facilitiesOf(t)
    .map((f) => SITE_KEY.get(f))
    .filter(Boolean) as string[];

const deptVolumes = (t: Team): Record<string, number> =>
  sumVolumes(siteKeysOf(t), "departments");
const payerVolumes = (t: Team): Record<string, number> =>
  sumVolumes(siteKeysOf(t), "payers");
const burstOf = (t: Team): number => {
  const keys = siteKeysOf(t);
  const vals = keys.map((k) => V.bySite.burst[k] ?? V.global.burst);
  return Math.max(1, ...(vals.length ? vals : [V.global.burst]));
};

/** The universe of values for a dimension, in this team's context. */
function universeOf(code: string, t?: Team): string[] {
  switch (code) {
    case "FACILITY":
      return ALL_FACILITIES;
    case "WORK_ITEM_TYPE":
      return WORK_ITEM_TYPES;
    case "ENCOUNTER_TYPE":
      return ENCOUNTER_TYPES;
    case "CLAIM_STATUS":
      return CLAIM_STATUSES;
    case "DEPARTMENT":
      // "(unresolved)" is a real coverage gap but not something to pick from a list.
      return Object.keys(t ? deptVolumes(t) : V.global.departments)
        .filter((d) => d !== "(unresolved)")
        .sort();
    case "PAYER":
      return Object.keys(t ? payerVolumes(t) : V.global.payers).sort();
    default:
      return [];
  }
}

/** Observed per-day volume for one value, used to price a coverage gap. */
function volumeOf(t: Team, code: string, value: string): number {
  if (code === "DEPARTMENT") return deptVolumes(t)[value] ?? 0;
  if (code === "PAYER") return payerVolumes(t)[value] ?? 0;
  return 0;
}

const NAMED_PAYER_THRESHOLD = 10;
/** Stands in for effectiveAssignmentSettings; ~150/day matches observed coder throughput. */
const USER_CAPACITY = 150;

for (const t of teams as any[]) {
  t.uniformCapacity ??= true;
}

/**
 * Puts a member in every active group of their team. A supervisor oversees the
 * whole team, so they are allocated from all of it, not one slice.
 */
function syncSupervisor(t: any, m: any): void {
  for (const g of t.groups) {
    if (!g.active || g.members.some((x: any) => x.id === m.id)) continue;
    g.members.push(m);
  }
}

// Demo seed for the round-2 member flags. The longest-serving member of each
// team supervises it; roughly a third of the roster is cleared for high-cost
// work, so resubmission teams always have somewhere to route it.
for (const t of teams as any[]) {
  const roster: any[] = [];
  const seen = new Set<string>();
  for (const g of t.groups) {
    for (const m of g.members) {
      if (seen.has(m.id)) continue;
      seen.add(m.id);
      roster.push(m);
    }
  }
  if (!roster.length) continue;

  const supervisor = roster[0];
  supervisor.isSupervisor = true;
  syncSupervisor(t, supervisor);

  // Seed a handler roster for every policy this team's work makes relevant, so
  // the demo estate has both high-cost clearance on claims teams and urgency
  // clearance on authorisation teams, from the same mechanism.
  const tags = policiesFor(typesHandled(t)).map((p) => p.handlerTag).filter(Boolean) as string[];
  roster.forEach((m, i) => {
    m.handlerTags ??= [];
    if (i % 3 === 0 || m.isSupervisor) {
      for (const tag of tags) if (!m.handlerTags.includes(tag)) m.handlerTags.push(tag);
    }
  });
}

const findTeam = (id: string) => teams.find((t) => String(t.id) === String(id));
const findGroup = (id: string) =>
  teams.flatMap((t) => t.groups).find((g) => String(g.id) === String(id));
const teamOfGroup = (id: string) =>
  teams.find((t) => t.groups.some((g) => String(g.id) === String(id)));

/** Narrowness of a group's effective rule. Generic over whatever dimensions exist. */
function specificity(g: Group): number {
  const t = teamOfGroup(g.id);
  return specificityOf(mergeCriteria(t?.criteria, g.criteria));
}

/** One policy setting on a team, by code and optional family. */
const settingOf = (t: Team | undefined, code: string, family?: string) =>
  (t?.policies ?? []).find((p) => p.code === code && (family ? p.family === family : !p.family));

/** The team's cap for a work item family, from the DAILY_LIMIT policy. */
function limitFor(t: Team | undefined, family: string | undefined): number {
  const n = settingOf(t, "DAILY_LIMIT", family)?.number;
  if (typeof n === "number") return n;
  return CAPACITY_FAMILIES.find((f) => f.code === family)?.defaultLimit ?? USER_CAPACITY;
}

/** Whether this team keeps allocating past the cap, from the ALLOW_EXCEED policy. */
function allowsExceed(t: Team | undefined, family: string | undefined): boolean {
  const f = settingOf(t, "ALLOW_EXCEED", family)?.flag;
  if (typeof f === "boolean") return f;
  return CAPACITY_FAMILIES.find((x) => x.code === family)?.allowExceedByDefault ?? false;
}

/** Derived capacity view, so callers that think in families still work. */
function capacitiesOf(t: Team) {
  const families = [
    ...new Set(typesHandled(t).map((w) => familyOfWorkItemType(w)?.code).filter(Boolean)),
  ] as string[];
  return families.map((family) => ({
    family,
    label: CAPACITY_FAMILIES.find((f) => f.code === family)?.label ?? family,
    limit: limitFor(t, family),
    allowExceed: allowsExceed(t, family),
  }));
}

/**
 * Policies that flag this item, with the members allowed to take it. This is
 * the generalisation of the high-cost rule: a policy names a handler tag, and
 * an item it flags may only go to members carrying that tag.
 */
function flaggingPolicies(t: Team, item: any) {
  return POLICIES.filter((p) => {
    if (!p.handlerTag) return false;
    const setting = settingOf(t, p.code);
    const value = p.valueType === "NUMBER" ? setting?.number : setting?.flag;
    return policyFlags(p, value ?? undefined, item);
  });
}

const hasTag = (m: any, tag: string) => (m.handlerTags ?? []).includes(tag);

/**
 * A member's daily cap. With several families on one team the headline figure is
 * the largest, since a member draws from whichever queue has work; the per-item
 * check in the preview still uses that item's own family.
 */
function capOf(t: Team | undefined, m: any): number {
  const team: any = t;
  if (team && team.uniformCapacity === false && typeof m.capacityOverride === "number") {
    return m.capacityOverride;
  }
  const limits = (t?.policies ?? [])
    .filter((p) => p.code === "DAILY_LIMIT" && typeof p.number === "number")
    .map((p) => p.number as number);
  if (!limits.length) return USER_CAPACITY;
  return Math.max(...limits);
}

function groupCapacity(g: Group) {
  const t = teams.find((x) => x.groups.some((y) => y.id === g.id));
  const seen = new Map<string, any>();
  for (const m of g.members) seen.set(m.id, m);
  const memberCount = seen.size;
  const totalCapacity = [...seen.values()].reduce((n, m) => n + capOf(t, m), 0);
  return { memberCount, totalCapacity, assigned: 0, remaining: totalCapacity, duplicateMemberships: 0 };
}

function teamCapacity(t: Team) {
  const all = t.groups.flatMap((g) => g.members);
  const distinct = new Map<string, any>();
  for (const m of all) distinct.set(m.id, m);
  const total = [...distinct.values()].reduce((n, m) => n + capOf(t, m), 0);
  return {
    memberCount: distinct.size,
    totalCapacity: total,
    assigned: 0,
    remaining: total,
    duplicateMemberships: all.length - distinct.size,
  };
}

/** Dimensions the volume data can price. */
const VOLUME_DIMENSIONS = ["DEPARTMENT", "PAYER"];

const volumesFor = (t: Team, code: string): Record<string, number> =>
  code === "PAYER" ? payerVolumes(t) : deptVolumes(t);

/**
 * Which volume-bearing dimension this team's groups actually split on. This is
 * what `logicAxis` used to declare; it is now simply observed from the rules,
 * so a team that splits by payer is one whose groups name payers.
 */
function volumeDimensionOf(t: Team): string {
  const counts = VOLUME_DIMENSIONS.map((code) => ({
    code,
    n: t.groups.filter((g) => g.active && criterionFor(g.criteria, code)).length,
  })).sort((a, b) => b.n - a.n);
  return counts[0].n ? counts[0].code : "DEPARTMENT";
}

/**
 * Daily volume each active group wins, settled by the same narrowest-wins rule
 * the matcher uses, so a projection cannot disagree with an actual run. Equal
 * specificity splits the value evenly, which is what the old catch-all did.
 */
function meansByGroup(t: Team): Map<string, number> {
  const code = volumeDimensionOf(t);
  const field = dimensionByCode(code)?.itemField ?? "department";
  const vols = volumesFor(t, code);
  const out = new Map<string, number>(t.groups.map((g) => [g.id, 0]));
  const active = t.groups.filter((g) => g.active);

  for (const [value, perDay] of Object.entries(vols)) {
    const probe: Record<string, unknown> = { [field]: value };
    const accepting = active
      .map((g) => ({
        g,
        spec: specificityOf(mergeCriteria(t.criteria, g.criteria)),
        ok: criteriaAccept(
          mergeCriteria(t.criteria, g.criteria).filter((c) => c.dimension === code),
          probe,
        ),
      }))
      .filter((x) => x.ok);
    if (!accepting.length) continue;
    const top = Math.max(...accepting.map((x) => x.spec));
    const winners = accepting.filter((x) => x.spec === top);
    for (const w of winners) out.set(w.g.id, (out.get(w.g.id) ?? 0) + perDay / winners.length);
  }
  return out;
}

const meanFor = (t: Team, g: Group): number => meansByGroup(t).get(g.id) ?? 0;

/**
 * Values of a dimension seen at this team's facilities that no active group
 * admits. Generic, so it reports uncovered departments and uncovered payers
 * through one code path, and will report whatever a client adds next.
 *
 * Scoped by work item type when given: a team handling two types needs the full
 * value set for each one independently, which is how a "submission covers every
 * department, resubmission covers three" gap gets caught.
 */
function uncoveredValues(t: Team, code: string, workItemType?: string): string[] {
  const dim = dimensionByCode(code);
  if (!dim) return [];
  const universe = universeOf(code, t);
  const active = t.groups.filter((g) => g.active);
  return universe.filter((value) => {
    const probe: Record<string, unknown> = { [dim.itemField]: value };
    if (workItemType) probe.workItemType = workItemType;
    return !active.some((g) => {
      const eff = mergeCriteria(t.criteria, g.criteria);
      const relevant = eff.filter(
        (c) => c.dimension === code || (workItemType && c.dimension === "WORK_ITEM_TYPE"),
      );
      return criteriaAccept(relevant, probe);
    });
  });
}

/** Work item types this team's active groups handle. Hoisted: the seed uses it. */
function typesHandled(t: Team): string[] {
  const active = t.groups.filter((g) => g.active);
  if (!active.length) return [];
  return [
    ...new Set(
      active.flatMap((g) =>
        admittedValues(mergeCriteria(t.criteria, g.criteria), "WORK_ITEM_TYPE", WORK_ITEM_TYPES),
      ),
    ),
  ];
}

function advice(t: Team) {
  const active = t.groups.filter((g) => g.active);
  const burst = burstOf(t);
  const means = meansByGroup(t);
  const projections = active.map((g) => {
    const mean = means.get(g.id) ?? 0;
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
        message: `Group '${p.groupName}' is projected ${p.meanPerDay.toFixed(0)} items/day but has no members, that work cannot be assigned to anyone.`,
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
        message: `Group '${p.groupName}' fits on an average day (${p.meanPerDay.toFixed(0)} against capacity ${p.capacity}) but is projected ${p.peakPerDay.toFixed(0)} at peak, busy days will overflow.`,
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
  // With the catch-all toggle gone, a value no group admits is simply a gap, and
  // saying so is the whole replacement for it.
  for (const code of VOLUME_DIMENSIONS) {
    const gaps = uncoveredValues(t, code);
    if (!gaps.length) continue;
    const perDay = gaps.reduce((a, v) => a + volumeOf(t, code, v), 0);
    if (perDay <= 0) continue;
    findings.push({
      severity: perDay >= 1 ? "BLOCKER" : "WARNING",
      groupId: null,
      message: `${gaps.length} ${dimensionByCode(code)?.label.toLowerCase() ?? code} values seen here are admitted by no group, about ${perDay.toFixed(0)} items/day that would not be allocated.`,
    });
  }
  return {
    projections,
    findings,
    hasBlockers: findings.some((f) => f.severity === "BLOCKER"),
    healthy: findings.length === 0,
  };
}

/**
 * Volume-packed: heaviest value into the lightest group. Works on whichever
 * volume dimension the team's groups already split on, so the same code
 * suggests a department split and a payer split.
 */
function suggest(t: Team) {
  const active = t.groups.filter((g) => g.active);
  if (!active.length) return [];
  const code = volumeDimensionOf(t);
  const byDept = code === "DEPARTMENT";
  const vols = volumesFor(t, code);
  const picked = new Map<string, string[]>(active.map((g) => [g.id, []]));
  const load = new Map<string, number>(active.map((g) => [g.id, 0]));

  // Below the threshold a payer is long-tail: naming each one clutters the rule
  // for no routing benefit, so the tail is spread instead.
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
    dimension: code,
    values: picked.get(g.id)!,
    departments: byDept ? picked.get(g.id)! : [],
    namedPayers: byDept ? [] : picked.get(g.id)!,
    catchAll: false,
    projectedPerDay:
      Math.round(((load.get(g.id) ?? 0) + (byDept ? 0 : tail / active.length)) * 10) / 10,
  }));
}

/**
 * Coverage over every dimension the registry marks coverage-checked, rather
 * than a department branch and a payer branch. The legacy field names are kept
 * so existing callers read the same report.
 */
function coverage(t: Team) {
  const active = t.groups.filter((g) => g.active);
  const empty = active.filter((g) => !g.members.length).map((g) => g.id);

  const gapsFor = (code: string) =>
    DIMENSIONS.some((d) => d.code === code && d.coverageChecked) ? uncoveredValues(t, code) : [];

  const uncoveredDepartments = gapsFor("DEPARTMENT");
  const uncoveredPayers = gapsFor("PAYER");

  // Two groups admitting the same department is legal, but worth surfacing,
  // since narrowest-wins then decides something the admin may not have meant.
  const counts: Record<string, number> = {};
  for (const g of active) {
    for (const d of admittedValues(
      mergeCriteria(t.criteria, g.criteria),
      "DEPARTMENT",
      universeOf("DEPARTMENT", t),
    )) {
      counts[d] = (counts[d] ?? 0) + 1;
    }
  }

  return {
    uncoveredDepartments,
    overlappingDepartments: Object.entries(counts)
      .filter(([, c]) => c > 1)
      .map(([d]) => d),
    uncoveredPayers,
    emptyGroupIds: empty,
    complete:
      uncoveredDepartments.length === 0 && uncoveredPayers.length === 0 && empty.length === 0,
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
  // Generate on whichever axis the team splits on, so the preview exercises the
  // rules the admin actually wrote.
  const code = volumeDimensionOf(t);
  const byDept = code === "DEPARTMENT";
  const vols = volumesFor(t, code);
  const entries = Object.entries(vols);
  const total = entries.reduce((a, [, v]) => a + v, 0) || 1;
  const types = typesHandled(t);
  const facilities = facilitiesOf(t);
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
  const encs = admittedValues(t.criteria, "ENCOUNTER_TYPE", ENCOUNTER_TYPES);

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
    // Claim work carries a net value; authorisation work does not. That is
    // exactly why one policy can apply to claims and another to authorisations.
    const net = familyOfWorkItemType(workItemType)?.code === "CLAIM"
      ? Math.round(rand() * 8000)
      : null;
    items.push({
      id: `${t.id}-${i + 1}`,
      workItemType,
      facilityId: facilities[Math.floor(rand() * facilities.length)] ?? null,
      department: byDept ? key : null,
      payer: byDept ? null : key,
      claimStatus,
      encounterType: encs[Math.floor(rand() * encs.length)] ?? null,
      priority,
      ageDays,
      rank,
      net,
    });
  }
  // Highest rank first, age dominates quickly, which is the anti-starvation rule.
  return items.sort((a, b) => b.rank - a.rank);
}

/**
 * The whole matcher, for every dimension a client will ever configure: a group
 * accepts an item when its effective rule admits it, and the narrowest accepting
 * group wins. The v2 version of this hardcoded work item type, encounter scope,
 * a logicAxis branch and claim status; none of that is named here.
 */
function matchGroup(t: Team, item: any) {
  const candidates = t.groups
    .filter((g) => g.active)
    .map((g) => ({ g, eff: mergeCriteria(t.criteria, g.criteria) }))
    .filter(({ eff }) => criteriaAccept(eff, item));
  if (!candidates.length) return null;
  candidates.sort((a, b) => specificityOf(b.eff) - specificityOf(a.eff));
  return candidates[0].g;
}

/**
 * Why an item matched nothing, named down to the clause that rejected it. Only
 * possible because criteria are data: "no group accepts this" was all v2 could
 * say, and it is the first question a supervisor asks.
 */
function rejectionDetail(t: Team, item: any): { reason: string; dimension: string | null; value: string | null } {
  const active = t.groups.filter((g) => g.active);
  if (!active.length) {
    return { reason: "Team has no active groups", dimension: null, value: null };
  }
  if (!criteriaAccept(t.criteria, item)) {
    const c = rejectingCriterion(t.criteria, item);
    const dim = dimensionByCode(c?.dimension ?? "");
    const label = dim?.label ?? c?.dimension ?? "";
    return {
      reason: `Outside the team's rule on ${label.toLowerCase()}`,
      dimension: c?.dimension ?? null,
      value: dim ? String(item[dim.itemField] ?? "(none)") : null,
    };
  }
  const blamed = new Map<string, number>();
  for (const g of active) {
    const c = rejectingCriterion(mergeCriteria(t.criteria, g.criteria), item);
    if (!c) continue;
    blamed.set(c.dimension, (blamed.get(c.dimension) ?? 0) + 1);
  }
  const worst = [...blamed.entries()].sort((a, b) => b[1] - a[1])[0];
  if (!worst) return { reason: "No group accepts this item", dimension: null, value: null };
  const dim = dimensionByCode(worst[0]);
  const value = item[dim?.itemField ?? ""] ?? "(none)";
  // Name the work item type as well: the same department is often covered for
  // one type and not another, and "no group admits Physiotherapy" reads as a
  // contradiction when a group plainly lists it.
  const wit = item.workItemType
    ? ` for ${String(item.workItemType).replace(/_/g, " ").toLowerCase()}`
    : "";
  return {
    reason: `No group admits ${dim?.label.toLowerCase() ?? worst[0]} "${value}"${wit}`,
    dimension: worst[0],
    value: String(value),
  };
}

/** The sentence alone, for callers that only render it. */
const rejectionReason = (t: Team, item: any): string => rejectionDetail(t, item).reason;

function allocationPreview(t: Team, count: number) {
  const items = buildItems(t, count);
  // Per-member remaining capacity, keyed by group.
  const cap = new Map<string, { userId: string; name: string; groupName: string; assigned: number; capacity: number }>();
  for (const g of t.groups) {
    // Anyone away today never enters the map, so they cannot be drawn and
    // their capacity is not counted as available. This is the correctness half
    // of restoring unavailability: v1 filtered the pool, v2 dropped the
    // concept entirely and kept handing work to people on leave.
    for (const m of available(g.members as any[])) {
      const k = `${g.id}:${m.id}`;
      cap.set(k, {
        userId: m.id,
        name: [m.firstName, m.lastName].filter(Boolean).join(" ") || "-",
        groupName: g.name,
        assigned: 0,
        capacity: capOf(t, m),
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
      unmatched.push({ ...item, ...rejectionDetail(t, item) });
      continue;
    }
    matched.set(g.id, (matched.get(g.id) ?? 0) + 1);
    // Least-loaded member of that group with capacity left.
    const family = familyOfWorkItemType(item.workItemType)?.code;
    const exceed = allowsExceed(t, family);
    // Every policy that flags this item narrows who may take it. Nothing here
    // knows what "high cost" is; it asks the registry which policies bit.
    const flagged = flaggingPolicies(t, item);
    const eligible = flagged.reduce(
      (members: any[], p) => members.filter((m: any) => hasTag(m, p.handlerTag!)),
      available(g.members as any[]),
    );
    const pool = eligible
      .map((m) => cap.get(`${g.id}:${m.id}`)!)
      // Overflow is a property of the item's family, not of the whole team.
      .filter((c) => c && (exceed || c.assigned < c.capacity))
      .sort((a, b) => a.assigned - b.assigned);
    if (!pool.length) {
      unmatched.push({
        ...item,
        groupId: g.id,
        groupName: g.name,
        flaggedBy: flagged.map((p) => p.code),
        reason: !g.members.length
          ? "Group has no members"
          : !available(g.members as any[]).length
          ? "Every member of the group is unavailable"
          : eligible.length === 0 && flagged.length
            ? `No member cleared for ${flagged.map((p) => p.label.toLowerCase()).join(" and ")}`
            : "Group at capacity",
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
      flaggedBy: flagged.map((p) => p.code),
      assigneeId: who.userId,
      assigneeName: who.name,
      reason: null,
    });
  }

  // Per-policy counts, so the preview reports whatever policies are in play
  // rather than a hardcoded high-cost pair.
  const relevant = policiesFor(typesHandled(t)).filter((p) => p.handlerTag);
  const policyImpact = relevant.map((p) => {
    const setting = settingOf(t, p.code);
    const flaggedCount = items.filter((i: any) =>
      policyFlags(p, (p.valueType === "NUMBER" ? setting?.number : setting?.flag) ?? undefined, i),
    ).length;
    const lost = unmatched.filter((i: any) => (i.flaggedBy ?? []).includes(p.code)).length;
    return {
      code: p.code,
      label: p.label,
      unit: p.unit ?? null,
      threshold: setting?.number ?? (p.defaultValue as number),
      flagged: flaggedCount,
      unassigned: lost,
    };
  });
  return {
    teamId: t.id,
    teamName: t.name,
    // Round-2 asked the preview to state its scope explicitly. That scope is now
    // whatever the team's rule says, rather than a fixed facility/division line.
    scope: describeCriteria(t.criteria),
    policyImpact,
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

/* ───────────────────────── allocation run history ────────────────────────
 * What the nightly workflow did, per run.
 *
 * Upstream this is a read over assignment_auto_assign_request_response_log,
 * whose responsePayload already holds the workflow's summary. Nothing reads
 * that table today, so the numbers a supervisor needs at 9am are in the
 * database and unreachable. Here the same summary is produced by running the
 * preview engine across every team, so the shape is exercised against real
 * behaviour rather than mocked.
 * ------------------------------------------------------------------------ */

const RUN_COUNT = 14;
const DAY_MS = 86_400_000;

/** One estate-wide run. Deterministic in `day`, so the history is stable. */
function simulateRun(day: number) {
  const started = new Date(Date.now() - day * DAY_MS);
  started.setHours(0, 12, 0, 0);

  const totals = { ranked: 0, matched: 0, assigned: 0, unmatched: 0, overflow: 0, fallback: 0 };
  const byGroup = new Map<string, any>();
  const reasons = new Map<string, { count: number; values: Map<string, number> }>();
  const overflow = new Map<string, { count: number; reason: string }>();
  const assignees = new Set<string>();

  for (const t of teams) {
    if (!t.active) continue;
    // Volume drifts a little day to day, the way arrivals actually do.
    const scale = 0.85 + ((day * 37) % 31) / 100;
    const preview = allocationPreview(t, Math.round(300 * scale));

    const bump = (name: string, field: "matched" | "assigned") => {
      const key = `${t.id}:${name}`;
      if (!byGroup.has(key)) {
        byGroup.set(key, { groupId: key, groupName: name, teamName: t.name, matched: 0, assigned: 0 });
      }
      byGroup.get(key)[field] += 1;
    };

    for (const row of preview.items ?? []) {
      totals.ranked += 1;
      totals.matched += 1;
      totals.assigned += 1;
      bump(row.groupName, "matched");
      bump(row.groupName, "assigned");
      if (row.assigneeId) assignees.add(String(row.assigneeId));
    }

    for (const u of preview.unmatched ?? []) {
      totals.ranked += 1;
      // Two different failures share this array. An item a group accepted but
      // had no room for is overflow, and a capacity problem; an item nothing
      // accepted is unmatched, and a configuration problem. Counting them
      // together is what makes a coverage gap look like a staffing gap.
      if (u.groupName) {
        totals.overflow += 1;
        totals.matched += 1;
        bump(u.groupName, "matched");
        const o = overflow.get(u.groupName) ?? { count: 0, reason: u.reason ?? "Group at capacity" };
        o.count += 1;
        overflow.set(u.groupName, o);
        continue;
      }
      totals.unmatched += 1;
      const key = u.dimension ?? "NONE";
      if (!reasons.has(key)) reasons.set(key, { count: 0, values: new Map() });
      const r = reasons.get(key)!;
      r.count += 1;
      const v = String(u.value ?? "(none)");
      r.values.set(v, (r.values.get(v) ?? 0) + 1);
    }
  }

  return {
    id: `run-${started.toISOString().slice(0, 10)}`,
    startedAt: started.toISOString(),
    finishedAt: new Date(started.getTime() + 41_000).toISOString(),
    dryRun: false,
    // One failure in the window, so the failed filter and the UI's error state
    // are exercised by the seed rather than only in theory.
    failed: day === 4,
    triggeredBy: day === 1 ? "Supervisor (manual)" : null,
    totals: { ...totals, assignees: assignees.size },
    byGroup: [...byGroup.values()].sort((a, b) => b.matched - a.matched),
    unmatchedByDimension: [...reasons.entries()]
      .map(([dimension, r]) => ({
        dimension: dimension === "NONE" ? null : dimension,
        label:
          dimension === "NONE"
            ? "Nothing accepted the item"
            : (dimensionByCode(dimension)?.label ?? dimension),
        count: r.count,
        topValues: [...r.values.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 6)
          .map(([value, count]) => ({ value, count })),
      }))
      .sort((a, b) => b.count - a.count),
    overflow: [...overflow.entries()]
      .map(([groupName, o]) => ({ groupName, count: o.count, reason: o.reason }))
      .sort((a, b) => b.count - a.count),
  };
}

let runCache: any[] | null = null;
/** Cheap memo: a run walks every team, and the dashboard asks on every render. */
const allRuns = () => (runCache ??= Array.from({ length: RUN_COUNT }, (_, d) => simulateRun(d + 1)));

/* ────────────────────────── member availability ──────────────────────────
 * v1 had unavailability windows and v2 dropped them. That reads as a broken
 * query, but the real cost is allocation: an unavailable member stayed in the
 * pool and kept being handed work while they were away.
 *
 * Availability is a property of the person, not of a group membership. The
 * team id is recorded for provenance and permissions only, which also matches
 * v1, where UNASSIGN explicitly acts across every team because assignments
 * carry no team dimension.
 * ------------------------------------------------------------------------ */

interface Unavailability {
  id: string;
  rcmTeamId: string;
  userId: string;
  startDate: string;
  endDate: string;
  reason: string | null;
  cancelled: boolean;
  /** UNASSIGN or REDISTRIBUTE. Recorded so the UI can show what was chosen. */
  action: string;
  createdBy: string;
  createdDate: string;
}

const unavailabilities: Unavailability[] = [];
let unavailabilitySeq = 1;

const today = () => new Date().toISOString().slice(0, 10);

/** Inclusive on both ends, which is how a supervisor reads "away 1st to 5th". */
const coversDay = (u: Unavailability, d: string) =>
  !u.cancelled && u.startDate <= d && u.endDate >= d;

const windowsFor = (userId: string) =>
  unavailabilities.filter((u) => String(u.userId) === String(userId));

/** The one question allocation asks. */
const isUnavailable = (userId: string, on = today()) =>
  windowsFor(userId).some((u) => coversDay(u, on));

/** Drop anyone away today. Used everywhere a pool is built. */
const available = <T extends { id: string }>(members: T[]): T[] =>
  members.filter((m) => !isUnavailable(m.id));

/** Per-team assignment settings; defaults match observed coder throughput. */
const teamSettings = new Map<string, { maxAuth: number; maxClaim: number }>();
const settingsFor = (teamId: string) =>
  teamSettings.get(String(teamId)) ?? { maxAuth: USER_CAPACITY, maxClaim: USER_CAPACITY };

const nameOf = (m: any): string =>
  [m.firstName, m.lastName].filter(Boolean).join(" ") || String(m.id);

/** Distinct members of a team flagged as supervising it. */
function supervisorsOf(t: any): any[] {
  const seen = new Map<string, any>();
  for (const g of t.groups ?? []) {
    for (const m of g.members ?? []) if (m.isSupervisor) seen.set(String(m.id), m);
  }
  return [...seen.values()];
}

/** The (facility, work item type, encounter) space a team's rule admits. */
function admittedSpace(t: any): Set<string> {
  const out = new Set<string>();
  for (const f of admittedValues(t.criteria, "FACILITY", ALL_FACILITIES)) {
    for (const w of admittedValues(t.criteria, "WORK_ITEM_TYPE", WORK_ITEM_TYPES)) {
      for (const e of admittedValues(t.criteria, "ENCOUNTER_TYPE", ENCOUNTER_TYPES)) {
        out.add(`${f}|${w}|${e}`);
      }
    }
  }
  return out;
}

/**
 * Readiness over an arbitrary set of teams. Taking the list as an argument lets
 * the deletion preview ask what readiness would be once a team is gone.
 *
 * Every check here is written against criteria rather than against named fields,
 * so a dimension a client adds later is covered without touching this function.
 * Nothing blocks a save; the feedback was that the admin owns the decision and
 * the system's job is to make the consequence impossible to miss.
 */
function readinessOf(input: any[]): any {
  const list = input.filter((t) => t.active);
  const issues: any[] = [];
  const unhandled: string[] = [];
  const label = (w: string) =>
    w.replace("AUTHORIZATION_", "auth ").replace("CLAIM_", "claim ").toLowerCase();

  /** Every issue carries who is expected to act on it. */
  const add = (issue: any, t?: any) => {
    const sups = t ? supervisorsOf(t) : [];
    issues.push({
      teamId: t?.id ?? null,
      teamName: t?.name ?? null,
      facilityId: t ? (facilitiesOf(t)[0] ?? null) : null,
      itemsAtRiskPerDay: 0,
      supervisorIds: sups.map((m) => String(m.id)),
      supervisorNames: sups.map(nameOf),
      ...issue,
    });
  };

  // A facility somebody runs, carrying a work item type no active group admits.
  // Only families the facility actually runs are checked: a site doing pure
  // authorisation work should not be told it has no reconciliation group.
  for (const facilityId of ALL_FACILITIES) {
    const here = list.filter((t) => facilitiesOf(t).includes(facilityId));
    if (!here.length) continue;
    const familiesRun = new Set(
      here.flatMap((t) => typesHandled(t).map((w) => familyOfWorkItemType(w)?.code)),
    );
    for (const wit of WORK_ITEM_TYPES) {
      if (!familiesRun.has(familyOfWorkItemType(wit)?.code)) continue;
      const probe = { facilityId, workItemType: wit };
      const covered = here.some((t) =>
        t.groups.some(
          (g: any) =>
            g.active &&
            criteriaAccept(
              mergeCriteria(t.criteria, g.criteria).filter(
                (c) => c.dimension === "FACILITY" || c.dimension === "WORK_ITEM_TYPE",
              ),
              probe,
            ),
        ),
      );
      if (covered) continue;
      unhandled.push(`${facilityId} · ${wit}`);
      add({
        severity: "WARNING",
        kind: "UNHANDLED_TYPE",
        facilityId,
        message: `${facilityId} has teams but no active group handles ${label(wit)}.`,
      });
    }
  }

  const ready = new Set(list.map((t) => t.id));

  for (const t of list) {
    const active = t.groups.filter((g: any) => g.active);

    if (!active.length) {
      ready.delete(t.id);
      add(
        {
          severity: "BLOCKER",
          kind: "NO_GROUPS",
          message: `${t.name} has no active groups, it cannot receive any work.`,
        },
        t,
      );
      continue;
    }

    for (const g of active) {
      if (g.members.length) continue;
      ready.delete(t.id);
      add(
        {
          severity: "BLOCKER",
          kind: "EMPTY_GROUP",
          message: `${t.name}, group "${g.name}" has no members, so work matched there has nowhere to go.`,
        },
        t,
      );
    }

    // A group may only narrow its team's rule. Widening it means work the team
    // was never meant to hold, which is the one structural rule left to enforce.
    for (const g of active) {
      const broken = widensBeyond(t.criteria, g.criteria);
      if (!broken.length) continue;
      ready.delete(t.id);
      add(
        {
          severity: "BLOCKER",
          kind: "GROUP_WIDENS_TEAM",
          message: `${t.name}, group "${g.name}" allows ${broken
            .map((d) => dimensionByCode(d)?.label.toLowerCase() ?? d)
            .join(" and ")} its team does not, so it can never match.`,
        },
        t,
      );
    }

    // Coverage, per dimension the registry checks, per work item type. Naming
    // every gap is what replaces the catch-all toggle.
    for (const dim of DIMENSIONS.filter((d) => d.coverageChecked)) {
      if (dim.code === "WORK_ITEM_TYPE") continue; // handled estate-wide above
      const handled = typesHandled(t);
      for (const wt of handled) {
        const missing = uncoveredValues(t, dim.code, wt);
        if (!missing.length) continue;
        // The volume table counts items, not items per work item type, so split
        // it across the types this team handles rather than charging each one
        // the full figure and inflating the estate total.
        const perDay =
          missing.reduce((a, v) => a + volumeOf(t, dim.code, v), 0) / Math.max(1, handled.length);
        const universe = universeOf(dim.code, t).length;
        ready.delete(t.id);
        add(
          {
            severity: perDay >= 1 ? "WARNING" : "INFO",
            kind: `UNCOVERED_${dim.code}`,
            itemsAtRiskPerDay: Math.round(perDay * 10) / 10,
            message: `${t.name}, ${missing.length} of ${universe} ${dim.label.toLowerCase()} values have no group for ${label(
              wt,
            )}${perDay >= 1 ? `, about ${perDay.toFixed(0)} items/day` : ""}.`,
          },
          t,
        );
      }
    }

    // Any policy that routes by handler tag needs somebody carrying that tag.
    // Written against the registry, so a policy added later is checked too.
    for (const pol of policiesFor(typesHandled(t))) {
      if (!pol.handlerTag) continue;
      const covered = active.some((g: any) =>
        g.members.some((m: any) => (m.handlerTags ?? []).includes(pol.handlerTag)),
      );
      if (covered) continue;
      const setting = (t.policies ?? []).find((x: any) => x.code === pol.code && !x.family);
      const threshold = setting?.number ?? pol.defaultValue;
      add(
        {
          severity: "WARNING",
          kind: `NO_HANDLER_${pol.code}`,
          message: `${t.name} has nobody cleared for ${pol.label.toLowerCase()} work (over ${Number(
            threshold,
          ).toLocaleString()}${pol.unit ? ` ${pol.unit}` : ""}), so those items will not be assigned.`,
        },
        t,
      );
    }

    // Without a supervisor there is nobody to warn, which defeats the point.
    if (!supervisorsOf(t).length) {
      add(
        {
          severity: "WARNING",
          kind: "NO_SUPERVISOR",
          message: `${t.name} has no supervisor, so nobody is told when its work goes unallocated.`,
        },
        t,
      );
    }
  }

  // Two teams whose rules both admit the same work. Legal, and sometimes meant,
  // but with facilities now multi-select it is easy to do by accident, and the
  // narrower rule silently wins.
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i];
      const b = list[j];
      const sa = admittedSpace(a);
      const shared = [...admittedSpace(b)].filter((k) => sa.has(k));
      if (!shared.length) continue;
      const winner = specificityOf(a.criteria) >= specificityOf(b.criteria) ? a : b;
      const sample = shared[0].split("|");
      add(
        {
          severity: "INFO",
          kind: "OVERLAPPING_TEAMS",
          teamId: a.id,
          teamName: a.name,
          facilityId: sample[0],
          message: `${a.name} and ${b.name} both take ${label(sample[1])} at ${sample[0]} (${
            sample[2]
          }). The narrower rule wins, currently ${winner.name}.`,
        },
        a,
      );
    }
  }

  const rank: Record<string, number> = { BLOCKER: 0, WARNING: 1, INFO: 2 };
  issues.sort((a, b) => rank[a.severity] - rank[b.severity]);

  // Point 4: roll every issue up to the people who have to act on it.
  const byUser = new Map<string, any>();
  for (const is of issues) {
    is.supervisorIds.forEach((uid: string, idx: number) => {
      const cur = byUser.get(uid) ?? {
        userId: uid,
        name: is.supervisorNames[idx],
        teamNames: new Set<string>(),
        blockers: 0,
        warnings: 0,
        itemsAtRiskPerDay: 0,
      };
      if (is.teamName) cur.teamNames.add(is.teamName);
      if (is.severity === "BLOCKER") cur.blockers += 1;
      if (is.severity === "WARNING") cur.warnings += 1;
      cur.itemsAtRiskPerDay += is.itemsAtRiskPerDay ?? 0;
      byUser.set(uid, cur);
    });
  }
  const supervisorAlerts = [...byUser.values()]
    .map((a) => ({
      ...a,
      teamNames: [...a.teamNames],
      itemsAtRiskPerDay: Math.round(a.itemsAtRiskPerDay * 10) / 10,
    }))
    .sort((a, b) => b.blockers - a.blockers || b.itemsAtRiskPerDay - a.itemsAtRiskPerDay);

  return {
    teamsTotal: list.length,
    teamsReady: ready.size,
    issues,
    unhandled: [...new Set(unhandled)],
    supervisorAlerts,
    unownedIssues: issues.filter(
      (i) => i.severity !== "INFO" && !i.supervisorIds.length,
    ).length,
    itemsAtRiskPerDay:
      Math.round(issues.reduce((a, i) => a + (i.itemsAtRiskPerDay ?? 0), 0) * 10) / 10,
  };
}


/**
 * What removing a team would cost: readiness recomputed without it, plus the
 * teams left holding that facility's work. Shared by the dry run and the
 * deletion itself, so the warning and the outcome cannot drift apart.
 */
function deletionResult(t: any, without: any[]): any {
  // "Affected" is now whoever's rule overlaps the one being removed, which is
  // the honest answer once a team can span several facilities.
  const gone = admittedSpace(t);
  return {
    deletedId: t.id,
    deletedName: t.name,
    readiness: readinessOf(without),
    affectedTeams: without.filter(
      (x) => x.active && [...admittedSpace(x)].some((k) => gone.has(k)),
    ),
  };
}

const resolvers = {
  User: {
    handlerTags: (u: any) => u.handlerTags ?? [],
    handlesHighCost: (u: any) => (u.handlerTags ?? []).includes("HIGH_COST"),
    unavailabilities: (u: any) => windowsFor(u.id),
    unavailableToday: (u: any) => isUnavailable(u.id),
    // v1 wrapped a member around the user. Here a member is the user, so the
    // wrapper's two fields resolve to the id and to self.
    userId: (u: any) => u.id,
    user: (u: any) => u,
  },

  OptimaTeamUserUnavailability: {
    activeToday: (u: Unavailability) => coversDay(u, today()),
  },

  AllocationPolicy: {
    defaultNumber: (p: any) => (p.valueType === "NUMBER" ? p.defaultValue : null),
    defaultFlag: (p: any) => (p.valueType === "FLAG" ? p.defaultValue : null),
  },

  AllocationDimension: {
    values: (d: any) =>
      universeOf(d.code).map((value) => ({
        value,
        label: prettyValue(value, d),
        perDay: null,
      })),
  },

  Query: {
    /** The registry. Served as data so the UI has no per-dimension wiring. */
    /**
     * The ported RCM Supervisor Dashboard, backed by the allocation model, so
     * it shows the teams configured on the Teams page rather than a second
     * unrelated dataset.
     */
    ...queueDashboardResolvers({
      teams,
      rosterOf: (t: any) => {
        const seen = new Set<string>();
        return t.groups.flatMap((g: any) =>
          g.members.filter((m: any) => !seen.has(m.id) && seen.add(m.id)),
        );
      },
      capOf: (t: any, m: any) => capOf(t, m),
      isUnavailable,
      facilitiesOf,
      volumeOf: (t: any) => [...meansByGroup(t).values()].reduce((a, b) => a + b, 0),
    }),

    allocationDimensions: () =>
      [...DIMENSIONS]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((d) => ({
          ...d,
          // The registry holds a map because that is what the matcher indexes
          // into; GraphQL wants rows.
          aliases: Object.entries(d.aliases ?? {}).map(([from, to]) => ({ from, to })),
        })),
    allocationPolicies: () => [...POLICIES].sort((a, b) => a.sortOrder - b.sortOrder),
    capacityFamilies: () => CAPACITY_FAMILIES,

    /**
     * Paginated, searchable values for any dimension, in the relay shape
     * ApiAutocomplete expects. One resolver serves every dimension, so adding a
     * registry row gives it a real Optima picker with no new endpoint.
     */
    dimensionOptions: (_: unknown, { first, after, filter }: any) => {
      const t = filter?.teamId ? findTeam(filter.teamId) : undefined;
      const dim = dimensionByCode(filter.dimension);
      const priced = filter.dimension === "DEPARTMENT" || filter.dimension === "PAYER";
      const q = String(filter?.name_Icontains ?? "").toLowerCase();

      let rows = universeOf(filter.dimension, t).map((value) => ({
        id: value,
        name: prettyValue(value, dim),
        perDay: priced && t ? Math.round(volumeOf(t, filter.dimension, value) * 10) / 10 : null,
      }));
      if (q) rows = rows.filter((r) => r.name.toLowerCase().includes(q));

      const start = after ? rows.findIndex((r) => r.id === after) + 1 : 0;
      const size = first ?? 20;
      const page = rows.slice(start, start + size);
      return {
        edges: page.map((node) => ({ node, cursor: node.id })),
        pageInfo: {
          hasNextPage: start + size < rows.length,
          endCursor: page.length ? page[page.length - 1].id : null,
        },
        totalCount: rows.length,
      };
    },

    rcmUsers: (_: unknown, { first, after, filter }: any) => {
      const q = String(filter?.search ?? "").toLowerCase();
      let rows = allUsers;
      if (q) {
        rows = rows.filter((u) =>
          [u.firstName, u.lastName, u.email]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(q),
        );
      }
      const start = after ? rows.findIndex((r) => String(r.id) === after) + 1 : 0;
      const size = first ?? 20;
      const page = rows.slice(start, start + size);
      return {
        edges: page.map((node) => ({ node, cursor: String(node.id) })),
        pageInfo: {
          hasNextPage: start + size < rows.length,
          endCursor: page.length ? String(page[page.length - 1].id) : null,
        },
        totalCount: rows.length,
      };
    },

    /** Pickable values for any dimension, priced by observed volume where known. */
    dimensionValues: (_: unknown, { dimension, teamId }: any) => {
      const t = teamId ? findTeam(teamId) : undefined;
      const values = universeOf(dimension, t);
      const priced = t && (dimension === "DEPARTMENT" || dimension === "PAYER");
      const dim = dimensionByCode(dimension);
      return values.map((value) => ({
        value,
        label: prettyValue(value, dim),
        perDay: priced ? Math.round(volumeOf(t!, dimension, value) * 10) / 10 : null,
      }));
    },

    /**
     * Estate-wide readiness. Answers one question: would anything arriving today
     * fail to be allocated? It warns; it never blocks.
     */
    /**
     * Estate totals. Capacity is summed over DISTINCT people, because a member
     * of two teams still only works one day: summing team capacities overstates
     * the estate by every shared membership.
     */
    optimaAllocationEstate: () => {
      const active = teams.filter((t) => t.active);
      const seen = new Map<string, { team: Team; member: any }>();
      let memberships = 0;
      for (const t of active) {
        for (const g of t.groups) {
          if (!g.active) continue;
          for (const m of g.members) {
            memberships += 1;
            if (!seen.has(String(m.id))) seen.set(String(m.id), { team: t, member: m });
          }
        }
      }
      const capacityPerDay = [...seen.values()].reduce((n, x) => n + capOf(x.team, x.member), 0);
      return {
        teams: teams.length,
        activeTeams: active.length,
        groups: active.reduce((n, t) => n + t.groups.filter((g) => g.active).length, 0),
        people: seen.size,
        capacityPerDay,
        sharedMemberships: memberships - seen.size,
      };
    },

    optimaAllocationReadiness: () => readinessOf(teams),
    optimaAllocationRuns: (_: unknown, { first, failedOnly }: any) => {
      const rows = failedOnly ? allRuns().filter((r) => r.failed) : allRuns();
      return rows.slice(0, first ?? RUN_COUNT);
    },
    optimaLatestAllocationRun: () => allRuns()[0] ?? null,

    /** The team list, narrowed the way a supervisor thinks about it. */
    optimaTeamDeletionImpact: (_: unknown, { id }: any) => {
      const t = findTeam(id);
      if (!t) throw new Error(`No team ${id}`);
      return deletionResult(t, teams.filter((x) => String(x.id) !== String(id)));
    },

    /**
     * One filter for every dimension. A team matches when some active group's
     * effective rule admits each filter value, which is the same predicate the
     * matcher uses, so filtering and routing cannot disagree.
     */
    optimaTeamsFiltered: (_: unknown, { filter }: any) => {
      let out = teams as any[];
      if (!filter) return out;
      if (filter.name?.trim()) {
        const q = filter.name.trim().toLowerCase();
        out = out.filter((t) => t.name.toLowerCase().includes(q));
      }
      if (typeof filter.active === "boolean") out = out.filter((t) => t.active === filter.active);

      for (const c of filter.criteria ?? []) {
        const dim = dimensionByCode(c.dimension);
        if (!dim || !(c.values ?? []).length) continue;
        out = out.filter((t) =>
          (c.values as string[]).some((value) => {
            const probe: Record<string, unknown> = { [dim.itemField]: value };
            return t.groups.some(
              (g: any) =>
                g.active &&
                criteriaAccept(
                  mergeCriteria(t.criteria, g.criteria).filter(
                    (x: Criterion) => x.dimension === c.dimension,
                  ),
                  probe,
                ),
            );
          }),
        );
      }
      return out;
    },

    /**
     * Explains a suggested split: the observed volume behind it, and what a naive
     * equal-count split would have produced instead.
     */
    optimaDistributionRationale: (_: unknown, { teamId, groupCount }: any) => {
      const t = findTeam(teamId);
      if (!t) return null;
      const code = volumeDimensionOf(t);
      const vols: Record<string, number> = volumesFor(t, code);
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
        facilityId: facilitiesOf(t).join(", "),
        axis: code,
        totalPerDay: round(total),
        criteriaCount: entries.length,
        burstFactor: burstOf(t),
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

    /* Thin wrappers over dimensionValues, kept for v1-shaped callers. */
    facilityOptions: () => universeOf("FACILITY"),
    departmentOptionsFor: (_: unknown, { teamId }: any) =>
      universeOf("DEPARTMENT", teamId ? findTeam(teamId) : undefined),
    payerOptionsFor: (_: unknown, { teamId }: any) =>
      universeOf("PAYER", teamId ? findTeam(teamId) : undefined),

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
      edges: ALL_FACILITIES.map((f) => ({
        node: { id: f, name: f, nameAr: null, healthLicense: f },
      })),
    }),
    codeSystemConcepts: (_: unknown, { filter }: any) => {
      const all = new Set<string>(universeOf("DEPARTMENT"));
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
      return t ? universeOf("DEPARTMENT", t) : [];
    },
    facilityPayers: (_: unknown, { teamId }: any) => {
      const t = findTeam(teamId);
      return t ? universeOf("PAYER", t) : [];
    },
    allUsers: () => allUsers,
  },

  /** Values on a criterion are ids; labels are what a chip should show. */
  Criterion: {
    labels: (c: Criterion) => {
      if (c.operator === "ANY") return [];
      return c.values;
    },
  },

  RcmTeamV2: {
    capacity: teamCapacity,
    usersDetails: (t: Team) => {
      const seen = new Set<string>();
      return t.groups.flatMap((g) => g.members.filter((m) => !seen.has(m.id) && seen.add(m.id)));
    },
    coverage,
    members: (t: Team, { availableOnly }: any) => {
      const seen = new Set<string>();
      const all = t.groups.flatMap((g) =>
        g.members.filter((m) => !seen.has(m.id) && seen.add(m.id)),
      );
      return availableOnly ? available(all) : all;
    },
    criteriaSummary: (t: Team) => describeCriteria(t.criteria),
    policies: (t: Team) => t.policies ?? [],
    applicablePolicies: (t: Team) => policiesFor(typesHandled(t)),
    capacities: capacitiesOf,

    /* Derived legacy fields. Nothing in the model stores these any more; they are
     * computed from the rule so v1-shaped callers keep reading what they expect. */
    facilityIds: (t: Team) => facilitiesOf(t),
    facilityId: (t: Team) => facilitiesOf(t)[0] ?? null,
    division: (t: Team) => {
      const fams = [
        ...new Set(typesHandled(t).map((w) => familyOfWorkItemType(w)?.code)),
      ].filter(Boolean);
      // A team spanning both families has no single division; that is now legal.
      return fams.length === 1 ? fams[0] : null;
    },
    encounterScope: (t: Team) => {
      const enc = admittedValues(t.criteria, "ENCOUNTER_TYPE", ENCOUNTER_TYPES);
      return enc.length === 1 ? enc[0] : "BOTH";
    },
    logicAxis: (t: Team) => volumeDimensionOf(t),
    allowExceedCapacity: (t: Team) => capacitiesOf(t).some((c) => c.allowExceed),
    highCostThreshold: (t: Team) => settingOf(t, "HIGH_COST")?.number ?? null,
    maxAuth: (t: Team) => limitFor(t, "AUTH"),
    maxClaim: (t: Team) => limitFor(t, "CLAIM"),
  },

  RcmTeamGroup: {
    specificity,
    members: (g: Group, { availableOnly }: any) =>
      availableOnly ? available(g.members as any[]) : g.members,
    capacity: groupCapacity,
    effectiveCriteria: (g: Group) => mergeCriteria(teamOfGroup(g.id)?.criteria, g.criteria),
    criteriaSummary: (g: Group) => describeCriteria(g.criteria),

    /* Derived legacy fields, read off the group's effective rule. */
    workItemTypes: (g: Group) =>
      admittedValues(
        mergeCriteria(teamOfGroup(g.id)?.criteria, g.criteria),
        "WORK_ITEM_TYPE",
        WORK_ITEM_TYPES,
      ),
    encounterScope: (g: Group) => {
      const enc = admittedValues(
        mergeCriteria(teamOfGroup(g.id)?.criteria, g.criteria),
        "ENCOUNTER_TYPE",
        ENCOUNTER_TYPES,
      );
      return enc.length === 1 ? enc[0] : "BOTH";
    },
    departments: (g: Group) => criterionFor(g.criteria, "DEPARTMENT")?.values ?? [],
    payers: (g: Group) => criterionFor(g.criteria, "PAYER")?.values ?? [],
    // The catch-all toggle is gone from the model; it was only ever "admit every
    // payer", which is what operator ANY says. Derived so the running v2
    // workflow keeps reading the field it expects.
    payerCatchAll: (g: Group) => criterionFor(g.criteria, "PAYER")?.operator === "ANY",
    claimStatuses: (g: Group) => criterionFor(g.criteria, "CLAIM_STATUS")?.values ?? [],
  },

  Mutation: {
    optimaTeamV2Delete: (_: unknown, { id }: any) => {
      const t = findTeam(id);
      if (!t) throw new Error(`No team ${id}`);
      const i = teams.findIndex((x) => String(x.id) === String(id));
      teams.splice(i, 1);
      // Readiness is already computed against the post-removal list.
      return deletionResult(t, teams);
    },

    optimaTeamV2Save: (_: unknown, { id, input }: any) => {
      const existing = id ? findTeam(id) : null;
      const target: any = existing ?? {
        id: String(Math.max(0, ...teams.map((x) => +x.id)) + 1),
        createdDate: new Date().toISOString(),
        criteria: [],
        capacities: [],
        priority: 0,
        rotationEnabled: false,
        groups: [],
      };

      const criteria: Criterion[] = (input.criteria ?? target.criteria ?? []).map((c: any) => ({
        dimension: c.dimension,
        operator: c.operator,
        values: c.values ?? [],
      }));

      Object.assign(target, {
        name: input.name,
        description: input.description ?? null,
        active: input.active ?? true,
        criteria,
        priority: input.priority ?? target.priority ?? 0,
        uniformCapacity: input.uniformCapacity ?? target.uniformCapacity ?? true,
      });
      target.siteKeys = siteKeysOf(target);
      // Branches are derived from the facility criterion now that it is a list.
      target.branches = facilitiesOf(target).map((f) => ({
        id: f,
        name: f,
        nameAr: null,
        healthLicense: f,
      }));
      target.branchIds = facilitiesOf(target);

      if (input.groups) {
        let gid = Math.max(0, ...teams.flatMap((t) => t.groups.map((g) => +g.id || 0))) + 1;
        target.groups = input.groups.map((g: any, i: number) => ({
          id: g.id ?? String(gid++),
          rcmTeamId: target.id,
          name: g.name,
          active: g.active ?? true,
          criteria: (g.criteria ?? []).map((c: any) => ({
            dimension: c.dimension,
            operator: c.operator,
            values: c.values ?? [],
          })),
          rotationOrder: i,
          members: (g.memberIds ?? [])
            .map((uid: string) => allUsers.find((u) => u.id === uid))
            .filter(Boolean),
        }));
      }

      /*
       * Policy settings, reconciled against what this team's work makes relevant.
       * A team that gains claim work gains a high-cost setting; one that loses
       * authorisation work loses its urgency setting. The admin is never asked
       * about a policy that cannot apply, and never left without one that can.
       */
      {
        const types = typesHandled(target);
        const families = [
          ...new Set(types.map((w) => familyOfWorkItemType(w)?.code).filter(Boolean)),
        ] as string[];
        const given = new Map<string, any>(
          (input.policies ?? []).map((p: any) => [`${p.code}|${p.family ?? ""}`, p]),
        );
        const kept = new Map<string, any>(
          (target.policies ?? []).map((p: any) => [`${p.code}|${p.family ?? ""}`, p]),
        );
        const next: any[] = [];
        for (const pol of policiesFor(types)) {
          const slots = pol.scope === "FAMILY" ? families : [""];
          for (const family of slots) {
            const from = given.get(`${pol.code}|${family}`) ?? kept.get(`${pol.code}|${family}`);
            const famDefaults = CAPACITY_FAMILIES.find((f) => f.code === family);
            const fallbackNumber =
              pol.code === "DAILY_LIMIT" ? (famDefaults?.defaultLimit ?? pol.defaultValue) : pol.defaultValue;
            const fallbackFlag =
              pol.code === "ALLOW_EXCEED"
                ? (famDefaults?.allowExceedByDefault ?? pol.defaultValue)
                : pol.defaultValue;
            next.push(
              pol.valueType === "NUMBER"
                ? {
                    code: pol.code,
                    family: family || null,
                    number: from?.number ?? Number(fallbackNumber),
                  }
                : {
                    code: pol.code,
                    family: family || null,
                    flag: from?.flag ?? Boolean(fallbackFlag),
                  },
            );
          }
        }
        target.policies = next;
      }

      // Supervisors sit in every active group; policy handlers are tagged in place.
      if (input.supervisorIds || input.handlers) {
        const sup = new Set((input.supervisorIds ?? []).map(String));
        const byTag = new Map<string, Set<string>>(
          (input.handlers ?? []).map((h: any) => [h.tag, new Set(h.memberIds.map(String))]),
        );
        const roster = new Map<string, any>();
        for (const gr of target.groups) for (const m of gr.members) roster.set(m.id, m);
        for (const m of roster.values()) {
          if (input.supervisorIds) m.isSupervisor = sup.has(String(m.id));
          if (input.handlers) {
            const tags = new Set<string>(m.handlerTags ?? []);
            for (const [tag, ids] of byTag) {
              if (ids.has(String(m.id))) tags.add(tag);
              else tags.delete(tag);
            }
            m.handlerTags = [...tags];
          }
        }
        for (const m of roster.values()) if (m.isSupervisor) syncSupervisor(target, m);
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
            facilityId: facilitiesOf(t)[0] ?? null,
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
        criteria: [],
        capacities: [],
        priority: 0,
        siteKeys: [],
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

    /**
     * Mark a member unavailable. Validation follows v1 exactly, because the
     * rules are not arbitrary: an inverted range is a typo, a non-member is
     * the wrong team picked, and overlapping windows make "is this person
     * away" ambiguous for the allocator.
     */
    optimaTeamUserUnavailabilitySet: (_: unknown, { input }: any) => {
      const t = findTeam(input.teamId);
      if (!t) throw new Error("Team not found");
      if (input.endDate < input.startDate) {
        throw new Error("endDate cannot be before startDate");
      }
      const roster = new Set(t.groups.flatMap((g) => g.members.map((m) => String(m.id))));
      if (!roster.has(String(input.userId))) {
        throw new Error("User is not a member of the team");
      }
      const overlaps = unavailabilities.some(
        (u) =>
          !u.cancelled &&
          String(u.userId) === String(input.userId) &&
          u.startDate <= input.endDate &&
          u.endDate >= input.startDate,
      );
      if (overlaps) {
        throw new Error("User already has an unavailability window overlapping these dates");
      }

      const row: Unavailability = {
        id: String(unavailabilitySeq++),
        rcmTeamId: String(input.teamId),
        userId: String(input.userId),
        startDate: input.startDate,
        endDate: input.endDate,
        reason: input.reason ?? null,
        cancelled: false,
        action: input.action,
        createdBy: "Manager Provider",
        createdDate: new Date().toISOString(),
      };
      unavailabilities.push(row);

      // The action is recorded, not executed. Upstream UNASSIGN calls
      // assignmentService.unassignAllActiveForCoder, which pushes the person's
      // active work back to the unassigned bucket across every team, since an
      // assignment records no team. Standalone simulates allocation per run
      // rather than persisting assignments, so there is nothing here to
      // unassign, and pretending otherwise would make the demo claim an effect
      // it does not have. Either way the person leaves tonight's pool, which
      // is the part that changes what gets allocated.
      return row;
    },

    optimaTeamUserUnavailabilityCancel: (_: unknown, { id }: any) => {
      const row = unavailabilities.find((u) => u.id === String(id));
      if (!row) throw new Error("Unavailability not found");
      // Cancelled, never deleted, so the window stays auditable.
      row.cancelled = true;
      return row;
    },

    optimaTeamV2GroupUpdate: (_: unknown, { groupId, input }: any) => {
      const g = findGroup(groupId);
      if (!g) return null;
      if (input.name != null) g.name = input.name;
      if (input.active != null) g.active = input.active;
      if (input.criteria)
        g.criteria = input.criteria.map((c: any) => ({
          dimension: c.dimension,
          operator: c.operator,
          values: c.values ?? [],
        }));
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
        criteria: (input.criteria ?? []).map((c: any) => ({
          dimension: c.dimension,
          operator: c.operator,
          values: c.values ?? [],
        })),
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
      // Rewrite each group's criterion on whichever dimension the split used.
      for (const s of suggest(t)) {
        const g = findGroup(s.groupId);
        if (!g) continue;
        const rest = g.criteria.filter((c) => c.dimension !== s.dimension);
        g.criteria = [...rest, { dimension: s.dimension, operator: "IN", values: s.values }];
      }
      return t;
    },
  },
};

export const schemaV2 = makeExecutableSchema({
  typeDefs: [typeDefs, queueDashboardTypeDefs],
  resolvers,
});
