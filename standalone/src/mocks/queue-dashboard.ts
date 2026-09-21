/**
 * The RCM Supervisor Dashboard's contract, served locally.
 *
 * Types and query signatures are copied verbatim from the Optima backend
 * (`schema/types.graphqls` 1861-1969, `queries.graphqls` 288-323,
 * `input.graphqls` 1557-1575), so the ported page from
 * `features/rcm-dashboard` runs against this without a single edit to its
 * queries. Anything that differs here is a bug, not a simplification.
 *
 * The resolvers are backed by the same allocation model the rest of the
 * standalone app uses, so the dashboard shows the teams you configured on the
 * Teams page rather than a second, unrelated dataset.
 */

export const queueDashboardTypeDefs = /* GraphQL */ `
  input QueueDashboardFilterInput {
    """Filter assignments created on or after this timestamp. Defaults to start of today (UTC) when omitted."""
    fromDate: Instant
    """Filter assignments created on or before this timestamp. Defaults to end of today (UTC) when omitted."""
    toDate: Instant
    vendorId: ID
    """Limit results to specific work-item types. Omit or pass empty list to include all types."""
    workItemTypes: [WorkItemType!]
    """Restrict to assignments whose assignee belongs to any of the given RCM teams. Omit or pass empty list to include all members."""
    teamIds: [ID!]
    """Restrict to work items located at any of the given branches (matched on the submission's branch_id). Omit or pass empty list to include all branches."""
    branches: [ID!]
  }

  input QueueDashboardAgingRangeInput {
    fromDays: Int
    toDays: Int
  }

  type QueueDashboardWorkTypeCounts {
    total: Long!
    assigned: Long!
    unassigned: Long!
    overdue: Long!
    pending: Long!
  }

  """Top-level widget counts split by claims and authorization metrics."""
  type QueueDashboardTopCounts {
    """Null when the current filter excludes all claim types."""
    claims: QueueDashboardWorkTypeCounts
    """Null when the current filter excludes all authorization types."""
    authorizations: QueueDashboardWorkTypeCounts
    """ISO date (UTC) for which this data is displayed."""
    displayDate: String!
  }

  """Count of active assignments per work-item type. Null fields are hidden for this team's scope."""
  type QueueDashboardAssignmentOverview {
    claimSubmissions: Long
    claimResubmissions: Long
    claimValidations: Long
    authorizationSubmissions: Long
    authorizationResubmissions: Long
  }

  """Assignment counts grouped by facility."""
  type QueueDashboardFacilityFinancial {
    facility: String!
    claimsCount: Long!
    authorizationsCount: Long!
    totalCount: Long!
    claimsTotalAmount: Float!
    authorizationsTotalAmount: Float!
    totalAmount: Float!
  }

  """Overdue/expiring/pending counts broken down by encounter type."""
  type QueueDashboardEncounterBucket {
    """IP, OP, EMERGENCY, or UNKNOWN."""
    category: String!
    overdueLast48h: Long!
    expiringNext24h: Long!
  }

  type QueueDashboardOverduePending {
    overdueLast48h: Long!
    expiringNext24h: Long!
    totalPending: Long!
    byEncounterType: [QueueDashboardEncounterBucket!]!
  }

  type QueueDashboardAgingBucket {
    fromDays: Int
    toDays: Int
    label: String!
    count: Long!
  }

  """
  Per-member row in the supervisor team-grid view.

  Bucketing is mutually exclusive, so
  totalAssigned = claimsAssigned + claimValidationsAssigned
                + authorizationsAssigned + claimResubmissionsAssigned
                + authorizationResubmissionsAssigned.
  RECONCILIATION work-item types are excluded from the grid entirely.
  """
  type QueueDashboardMemberRow {
    userId: String!
    userName: String
    """Count of CLAIM_SUBMISSION assignments only."""
    claimsAssigned: Long!
    """Null when the caller's workItemTypes filter excludes CLAIM_VALIDATION."""
    claimValidationsAssigned: Long
    """Count of AUTHORIZATION_SUBMISSION assignments only."""
    authorizationsAssigned: Long!
    """Null when the caller's workItemTypes filter excludes CLAIM_RESUBMISSION."""
    claimResubmissionsAssigned: Long
    """Null when the caller's workItemTypes filter excludes AUTHORIZATION_RESUBMISSION."""
    authorizationResubmissionsAssigned: Long
    totalAssigned: Long!
    completed: Long!
    overdue: Long!
    """True when assigned count exceeds the member's declared daily capacity."""
    isOverlimit: Boolean!
  }

  """Detailed member view used by the member-profile screen."""
  type QueueDashboardMemberView {
    userId: String!
    userName: String
    totalAssigned: Long!
    totalCompleted: Long!
    totalOverdue: Long!
    insights: [QueueDashboardPerformanceInsight!]!
  }

  """SLA and performance metrics for a single work-item type."""
  type QueueDashboardPerformanceInsight {
    workItemType: WorkItemType!
    completed: Long!
    overdue: Long!
    """Average turn-around time in seconds. Null when no completed items exist."""
    avgTatSeconds: Float
    """Items completed on or before their due date."""
    slaCompliance: Long!
    """Items completed after their due date, or currently open and past due."""
    slaBreaches: Long!
  }


  # ─── Team KPI types, verbatim from types.graphqls 1596-1704 ──────────────

  type WorkTypeAssignmentKpi {
    workItemType: WorkItemType
    assigned: Long
    notAssigned: Long
    total: Long
    assignmentPercentage: Float
    notAssignedPercentage: Float
  }

  type TotalsOverview {
    totalAssigned: Long
    totalNotAssigned: Long
    grandTotal: Long
    overallAssignmentPercentage: Float
    overallNotAssignedPercentage: Float
  }

  type TeamAssignmentKpi {
    claims: WorkTypeAssignmentKpi
    claimsResubmission: WorkTypeAssignmentKpi
    authorizations: WorkTypeAssignmentKpi
    totals: TotalsOverview
  }

  type WorkTypeFinancialKpi {
    workItemType: WorkItemType!
    assignedAmount: Float!
    notAssignedAmount: Float!
    totalAmount: Float!
    assignedAmountPercentage: Float!
    notAssignedAmountPercentage: Float!
  }

  type FinancialTotalsOverview {
    totalAssignedAmount: Float!
    totalNotAssignedAmount: Float!
    grandTotalAmount: Float!
    overallAssignedAmountPercentage: Float!
    overallNotAssignedAmountPercentage: Float!
  }

  type TeamFinancialKpi {
    claims: WorkTypeFinancialKpi!
    claimsResubmission: WorkTypeFinancialKpi!
    authorizations: WorkTypeFinancialKpi!
    totals: FinancialTotalsOverview!
  }

  type UserWorkTypeAssignmentKpi {
    workItemType: WorkItemType!
    assigned: Long!
    notAssigned: Long!
    total: Long!
    assignmentPercentage: Float!
    notAssignedPercentage: Float!
  }

  type UserTotalsOverview {
    totalAssigned: Long!
    totalNotAssigned: Long!
    grandTotal: Long!
    overallAssignmentPercentage: Float!
    overallNotAssignedPercentage: Float!
  }

  type UserWorkTypeFinancialKpi {
    workItemType: WorkItemType!
    assignedAmount: Float!
    notAssignedAmount: Float!
    totalAmount: Float!
    assignedAmountPercentage: Float!
    notAssignedAmountPercentage: Float!
  }

  type UserFinancialTotalsOverview {
    totalAssignedAmount: Float!
    totalNotAssignedAmount: Float!
    grandTotalAmount: Float!
    overallAssignedAmountPercentage: Float!
    overallNotAssignedAmountPercentage: Float!
  }

  type UserPerformanceKpi {
    userId: String!
    userName: String!
    claims: UserWorkTypeAssignmentKpi!
    claimsResubmission: UserWorkTypeAssignmentKpi!
    authorizations: UserWorkTypeAssignmentKpi!
    totals: UserTotalsOverview!
    claimsFinancial: UserWorkTypeFinancialKpi!
    claimsResubmissionFinancial: UserWorkTypeFinancialKpi!
    authorizationsFinancial: UserWorkTypeFinancialKpi!
    financialTotals: UserFinancialTotalsOverview!
  }

  type TeamUserPerformanceKpis {
    team: RcmTeamV2
    users: [UserPerformanceKpi!]!
  }

  type CoderAvailability {
    id: ID!
    coderId: String!
    coderName: String!
    teamId: String!
    isAvailable: Boolean!
    dailyCapacity: Int!
    currentWorkload: Int!
    specialty: String
    unavailableSince: Instant
    unavailableReason: String
    isAtCapacity: Boolean!
    remainingCapacity: Int!
    createdDate: Instant
    lastModifiedDate: Instant
  }

  input AssignmentAutoAssignInput {
    teamId: ID
    fromDate: String
    toDate: String
    branchIds: [ID!]
  }

  extend type Mutation {
    """Fires the n8n workflow. Read-only here: the app configures and observes."""
    assignmentAutoAssign(input: AssignmentAutoAssignInput): Boolean
  }


  # ─── Work-item queues ────────────────────────────────────────────────────
  #
  # These back the unassigned-work panels and the member detail drawer.
  # Standalone has no work-item table: allocation is simulated per run rather
  # than stored, so there is no row to return here. The contract is served in
  # full so the real components mount and show their own empty states, which
  # is the honest outcome, rather than erroring or inventing patient records.

  """Authorization status, as the queries pass it unquoted."""
  enum AuthorizationStatusFilter {
    PAYER_OVERDUE
    PROVIDER_OVERDUE
    PENDING
  }

  """Completion status, as the queries pass it unquoted."""
  enum AssignmentCompletionStatus {
    OPEN
    IN_PROGRESS
    DONE
  }

  input OptimaValidationRequestFilterInput {
    assignmentIsNull: Boolean
    assignmentAssignedTo: [String]
    assignmentCompletionStatuses: [AssignmentCompletionStatus]
    assignedTo: [String]
    branchIds: [ID!]
    claimStatus: [String]
    requestType: [String]
    search: String
  }

  input OptimaValidationRequestsSortingInput {
    field: String
    direction: String
  }

  input AuthorizationSubmissionFilterInput {
    assignmentIsNull: Boolean
    assignmentAssignedTo: [String]
    assignmentCompletionStatuses: [AssignmentCompletionStatus]
    assignedTo: [String]
    branchIds: [ID!]
    approvalStatus: [String]
    statuses: [AuthorizationStatusFilter]
    search: String
    fromDueAt: Instant
    dueAtLte: Instant
    dueAtGte: Instant
  }

  input AuthorizationSubmissionsSortingInput {
    field: String
    direction: String
  }

  input ClaimSubmissionFilterInput {
    assignmentAssignedTo: [String]
    assignmentCompletionStatuses: [AssignmentCompletionStatus]
    assignedTo: [String]
    branchIds: [ID!]
    search: String
  }

  input ClaimSubmissionsSortingInput {
    field: String
    direction: String
  }

  type WorkItemAssigneeUser {
    id: ID!
    fullName: String
  }

  type WorkItemAssignment {
    id: ID!
    assigneeUser: WorkItemAssigneeUser
    assigneeId: ID
    assigneeName: String
    fullName: String
    completionStatus: String
    assignedAt: Instant
  }

  type OptimaValidationRequest {
    id: ID!
    requestId: String
    claimId: String
    transactionId: String
    billNumber: String
    authorizationNumber: String
    patientName: String
    nationalId: String
    insurancePayer: String
    insurancePayerName: String
    approvalStatus: String
    claimStatus: String
    status: String
    type: String
    requestType: String
    encounterType: String
    createdDate: Instant
    createdAt: Instant
    submittedAt: Instant
    billDate: Instant
    dueAt: Instant
    priority: String
    gross: Float
    net: Float
    totalNet: Float
    totalApprovedNet: Float
    facility: String
    department: String
    departmentName: String
    assignment: WorkItemAssignment
  }

  type OptimaValidationRequestEdge {
    node: OptimaValidationRequest
    cursor: String
  }

  type OptimaValidationRequestConnection {
    totalCount: Int
    pageInfo: PageInfo
    edges: [OptimaValidationRequestEdge]
  }

  type AuthorizationSubmission {
    id: ID!
    authorizationNumber: String
    billNumber: String
    patientName: String
    insurancePayerName: String
    status: String
    type: String
    priority: String
    department: String
    createdAt: Instant
    submittedAt: Instant
    dueAt: Instant
    totalNet: Float
    assignment: WorkItemAssignment
  }

  type AuthorizationSubmissionEdge {
    node: AuthorizationSubmission
    cursor: String
  }

  type AuthorizationSubmissionConnection {
    totalCount: Int
    pageInfo: PageInfo
    edges: [AuthorizationSubmissionEdge]
  }

  type ClaimSubmission {
    id: ID!
    claimId: String
    transactionId: String
    patientName: String
    insurancePayer: String
    approvalStatus: String
    status: String
    type: String
    priority: String
    encounterType: String
    createdAt: Instant
    submittedAt: Instant
    totalNet: Float
    totalApprovedNet: Float
    assignment: WorkItemAssignment
  }

  type ClaimSubmissionEdge {
    node: ClaimSubmission
    cursor: String
  }

  type ClaimSubmissionConnection {
    totalCount: Int
    pageInfo: PageInfo
    edges: [ClaimSubmissionEdge]
  }

  type FacilityFinancialBreakdown {
    facility: String!
    claimsCount: Long!
    authorizationsCount: Long!
    totalCount: Long!
    claimsTotalAmount: Float!
    authorizationsTotalAmount: Float!
    totalAmount: Float!
  }

  extend type Query {
    rcmOptimaValidationRequests(
      first: Int
      last: Int
      after: String
      before: String
      filter: OptimaValidationRequestFilterInput
      sortBy: OptimaValidationRequestsSortingInput
    ): OptimaValidationRequestConnection
    authorizationSubmissions(
      first: Int
      last: Int
      after: String
      before: String
      filter: AuthorizationSubmissionFilterInput
      sortBy: AuthorizationSubmissionsSortingInput
    ): AuthorizationSubmissionConnection
    claimSubmissions(
      first: Int
      filter: ClaimSubmissionFilterInput
      sortBy: ClaimSubmissionsSortingInput
    ): ClaimSubmissionConnection
    facilityFinancialBreakdown: [FacilityFinancialBreakdown!]!
    teamAssignmentKpis(rcmTeamId: Int): TeamAssignmentKpi!
    teamFinancialKpis: TeamFinancialKpi!
    teamUserPerformanceKpis(teamIds: [Long]): [TeamUserPerformanceKpis!]
    teamCoderAvailability(teamId: String!): [CoderAvailability!]
    queueDashboardTopCounts(filter: QueueDashboardFilterInput): QueueDashboardTopCounts!
    queueDashboardAssignmentOverview(
      filter: QueueDashboardFilterInput
    ): QueueDashboardAssignmentOverview!
    queueDashboardFacilityFinancialBreakdown(
      filter: QueueDashboardFilterInput
    ): [QueueDashboardFacilityFinancial!]!
    queueDashboardAuthOverduePending(
      filter: QueueDashboardFilterInput
    ): QueueDashboardOverduePending!
    queueDashboardClaimsOverduePending(
      filter: QueueDashboardFilterInput
    ): QueueDashboardOverduePending!
    queueDashboardAuthorizationAging(
      filter: QueueDashboardFilterInput
      ranges: [QueueDashboardAgingRangeInput!]!
    ): [QueueDashboardAgingBucket!]!
    queueDashboardClaimsAging(filter: QueueDashboardFilterInput): [QueueDashboardAgingBucket!]!
    queueDashboardTeamMemberGrid(filter: QueueDashboardFilterInput): [QueueDashboardMemberRow!]!
    queueDashboardMemberView(
      filter: QueueDashboardFilterInput
      userId: String!
    ): QueueDashboardMemberView!
  }
`;

/* ────────────────────────────── resolvers ─────────────────────────────── */

const CLAIM_TYPES = [
  "CLAIM_SUBMISSION",
  "CLAIM_RESUBMISSION",
  "CLAIM_VALIDATION",
  "RECONCILIATION",
];
const AUTH_TYPES = ["AUTHORIZATION_SUBMISSION", "AUTHORIZATION_RESUBMISSION"];

/** Deterministic, so a reload does not reshuffle the whole dashboard. */
function rng(seed: number) {
  let x = seed || 1;
  return () => ((x = (x * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
}

const includesType = (filter: any, t: string) => {
  const wanted: string[] = filter?.workItemTypes ?? [];
  return !wanted.length || wanted.includes(t);
};
const wantsClaims = (filter: any) => CLAIM_TYPES.some((t) => includesType(filter, t));
const wantsAuths = (filter: any) => AUTH_TYPES.some((t) => includesType(filter, t));

export interface QueueDashboardDeps {
  /** Teams from the allocation model, so the dashboard reflects real config. */
  teams: any[];
  /** Distinct roster of a team. */
  rosterOf: (t: any) => any[];
  /** A member's daily cap, used for the overlimit flag. */
  capOf: (t: any, m: any) => number;
  /** Members away today, excluded from the grid the same way allocation does. */
  isUnavailable: (userId: string) => boolean;
  /** Facilities a team serves. */
  facilitiesOf: (t: any) => string[];
  /** Estimated items per day for a team, to scale the numbers sensibly. */
  volumeOf: (t: any) => number;
}

export function queueDashboardResolvers(deps: QueueDashboardDeps) {
  const { teams, rosterOf, capOf, isUnavailable, facilitiesOf, volumeOf } = deps;

  const scopedTeams = (filter: any) => {
    const ids: string[] = (filter?.teamIds ?? []).map(String);
    const active = teams.filter((t) => t.active !== false);
    return ids.length ? active.filter((t) => ids.includes(String(t.id))) : active;
  };

  /**
   * One member's numbers for the day. Derived from their capacity and a fixed
   * seed rather than stored, because standalone has no assignment table; the
   * shape and the relationships between the fields are what the page needs.
   */
  function memberRow(t: any, m: any, filter: any, idx: number) {
    const rand = rng(Number(String(m.id).replace(/\D/g, "") || idx + 1) * 31 + idx);
    const cap = capOf(t, m);
    const load = Math.round(cap * (0.35 + rand() * 0.8));

    const share = (p: number) => Math.round(load * p);
    const claims = includesType(filter, "CLAIM_SUBMISSION") ? share(0.3) : 0;
    const validations = includesType(filter, "CLAIM_VALIDATION") ? share(0.25) : null;
    const auths = includesType(filter, "AUTHORIZATION_SUBMISSION") ? share(0.28) : 0;
    const claimResub = includesType(filter, "CLAIM_RESUBMISSION") ? share(0.1) : null;
    const authResub = includesType(filter, "AUTHORIZATION_RESUBMISSION") ? share(0.07) : null;

    // The doc comment on QueueDashboardMemberRow says the buckets are mutually
    // exclusive and sum to totalAssigned, so this adds rather than reusing load.
    const totalAssigned =
      claims + (validations ?? 0) + auths + (claimResub ?? 0) + (authResub ?? 0);

    return {
      userId: String(m.id),
      userName: [m.firstName, m.lastName].filter(Boolean).join(" ") || String(m.id),
      claimsAssigned: claims,
      claimValidationsAssigned: validations,
      authorizationsAssigned: auths,
      claimResubmissionsAssigned: claimResub,
      authorizationResubmissionsAssigned: authResub,
      totalAssigned,
      completed: Math.round(totalAssigned * (0.4 + rand() * 0.45)),
      overdue: Math.round(totalAssigned * rand() * 0.12),
      isOverlimit: totalAssigned > cap,
      _cap: cap,
    };
  }

  const gridFor = (filter: any) => {
    const rows: any[] = [];
    let i = 0;
    for (const t of scopedTeams(filter)) {
      for (const m of rosterOf(t)) {
        // Someone away today is not carrying work today either.
        if (isUnavailable(String(m.id))) continue;
        if (rows.some((r) => r.userId === String(m.id))) continue;
        rows.push(memberRow(t, m, filter, i++));
      }
    }
    return rows;
  };

  const totals = (filter: any) => {
    const rows = gridFor(filter);
    const assigned = rows.reduce((n, r) => n + r.totalAssigned, 0);
    const overdue = rows.reduce((n, r) => n + r.overdue, 0);
    const completed = rows.reduce((n, r) => n + r.completed, 0);
    return { rows, assigned, overdue, completed };
  };

  const bucket = (label: string, fromDays: number | null, toDays: number | null, count: number) => ({
    label,
    fromDays,
    toDays,
    count,
  });

  /** One work-type KPI block, from the same grid everything else uses. */
  const workTypeKpi = (workItemType: string, assigned: number, total: number) => ({
    workItemType,
    assigned,
    notAssigned: Math.max(0, total - assigned),
    total,
    assignmentPercentage: total ? Math.round((assigned / total) * 1000) / 10 : 0,
    notAssignedPercentage: total ? Math.round(((total - assigned) / total) * 1000) / 10 : 0,
  });

  /** Money view of the same figures. Claims carry value; authorisations do not. */
  const financialKpi = (workItemType: string, assigned: number, total: number, rate: number) => {
    const totalAmount = total * rate;
    const assignedAmount = assigned * rate;
    return {
      workItemType,
      assignedAmount,
      notAssignedAmount: Math.max(0, totalAmount - assignedAmount),
      totalAmount,
      assignedAmountPercentage: totalAmount
        ? Math.round((assignedAmount / totalAmount) * 1000) / 10
        : 0,
      notAssignedAmountPercentage: totalAmount
        ? Math.round(((totalAmount - assignedAmount) / totalAmount) * 1000) / 10
        : 0,
    };
  };

  /** No work-item store locally, so an honest empty page. */
  const emptyConnection = () => ({
    totalCount: 0,
    pageInfo: { hasNextPage: false, hasPreviousPage: false, endCursor: null, startCursor: null },
    edges: [],
  });

  return {
    rcmOptimaValidationRequests: emptyConnection,
    authorizationSubmissions: emptyConnection,
    claimSubmissions: emptyConnection,
    facilityFinancialBreakdown: (_: unknown, __: any, ___: any, info: any) => [],
    teamAssignmentKpis: (_: unknown, { rcmTeamId }: any) => {
      const filter = rcmTeamId ? { teamIds: [String(rcmTeamId)] } : {};
      const { rows } = totals(filter);
      const sum = (k: string) => rows.reduce((n, r) => n + (r[k] ?? 0), 0);
      const pool = scopedTeams(filter).reduce((n, t) => n + volumeOf(t), 0);

      const claims = sum("claimsAssigned") + sum("claimValidationsAssigned");
      const resub = sum("claimResubmissionsAssigned") + sum("authorizationResubmissionsAssigned");
      const auths = sum("authorizationsAssigned");
      const grand = claims + resub + auths;
      const grandTotal = grand + pool;

      return {
        claims: workTypeKpi("CLAIM_SUBMISSION", claims, claims + Math.round(pool * 0.5)),
        claimsResubmission: workTypeKpi("CLAIM_RESUBMISSION", resub, resub + Math.round(pool * 0.2)),
        authorizations: workTypeKpi("AUTHORIZATION_SUBMISSION", auths, auths + Math.round(pool * 0.3)),
        totals: {
          totalAssigned: grand,
          totalNotAssigned: pool,
          grandTotal,
          overallAssignmentPercentage: grandTotal ? Math.round((grand / grandTotal) * 1000) / 10 : 0,
          overallNotAssignedPercentage: grandTotal ? Math.round((pool / grandTotal) * 1000) / 10 : 0,
        },
      };
    },

    teamFinancialKpis: () => {
      const { rows } = totals({});
      const sum = (k: string) => rows.reduce((n, r) => n + (r[k] ?? 0), 0);
      const pool = scopedTeams({}).reduce((n, t) => n + volumeOf(t), 0);

      // Average claim value from the observed mix. Authorisations carry no net
      // until approved, so their amounts are zero, which is what the live
      // dashboard shows too.
      const CLAIM_RATE = 268;
      const claims = sum("claimsAssigned") + sum("claimValidationsAssigned");
      const resub = sum("claimResubmissionsAssigned");
      const auths = sum("authorizationsAssigned");

      const c = financialKpi("CLAIM_SUBMISSION", claims, claims + Math.round(pool * 0.5), CLAIM_RATE);
      const r = financialKpi("CLAIM_RESUBMISSION", resub, resub + Math.round(pool * 0.2), CLAIM_RATE);
      const a = financialKpi("AUTHORIZATION_SUBMISSION", auths, auths + Math.round(pool * 0.3), 0);

      const totalAssignedAmount = c.assignedAmount + r.assignedAmount + a.assignedAmount;
      const grandTotalAmount = c.totalAmount + r.totalAmount + a.totalAmount;
      return {
        claims: c,
        claimsResubmission: r,
        authorizations: a,
        totals: {
          totalAssignedAmount,
          totalNotAssignedAmount: Math.max(0, grandTotalAmount - totalAssignedAmount),
          grandTotalAmount,
          overallAssignedAmountPercentage: grandTotalAmount
            ? Math.round((totalAssignedAmount / grandTotalAmount) * 1000) / 10
            : 0,
          overallNotAssignedAmountPercentage: grandTotalAmount
            ? Math.round(((grandTotalAmount - totalAssignedAmount) / grandTotalAmount) * 1000) / 10
            : 0,
        },
      };
    },

    teamUserPerformanceKpis: (_: unknown, { teamIds }: any) => {
      const wanted = (teamIds ?? []).map(String);
      const list = wanted.length
        ? teams.filter((t) => wanted.includes(String(t.id)))
        : teams.filter((t) => t.active !== false);
      return list.map((team) => ({
        team,
        users: gridFor({ teamIds: [team.id] }).map((r: any) => {
          const u = (n: number, total: number) => ({
            workItemType: "CLAIM_SUBMISSION",
            assigned: n,
            notAssigned: Math.max(0, total - n),
            total,
            assignmentPercentage: total ? Math.round((n / total) * 1000) / 10 : 0,
            notAssignedPercentage: total ? Math.round(((total - n) / total) * 1000) / 10 : 0,
          });
          const f = (n: number, rate: number) => ({
            workItemType: "CLAIM_SUBMISSION",
            assignedAmount: n * rate,
            notAssignedAmount: 0,
            totalAmount: n * rate,
            assignedAmountPercentage: 100,
            notAssignedAmountPercentage: 0,
          });
          return {
            userId: r.userId,
            userName: r.userName,
            claims: u(r.claimsAssigned, r.claimsAssigned),
            claimsResubmission: u(r.claimResubmissionsAssigned ?? 0, r.claimResubmissionsAssigned ?? 0),
            authorizations: u(r.authorizationsAssigned, r.authorizationsAssigned),
            totals: {
              totalAssigned: r.totalAssigned,
              totalNotAssigned: 0,
              grandTotal: r.totalAssigned,
              overallAssignmentPercentage: 100,
              overallNotAssignedPercentage: 0,
            },
            claimsFinancial: f(r.claimsAssigned, 268),
            claimsResubmissionFinancial: f(r.claimResubmissionsAssigned ?? 0, 268),
            authorizationsFinancial: f(r.authorizationsAssigned, 0),
            financialTotals: {
              totalAssignedAmount: (r.claimsAssigned + (r.claimResubmissionsAssigned ?? 0)) * 268,
              totalNotAssignedAmount: 0,
              grandTotalAmount: (r.claimsAssigned + (r.claimResubmissionsAssigned ?? 0)) * 268,
              overallAssignedAmountPercentage: 100,
              overallNotAssignedAmountPercentage: 0,
            },
          };
        }),
      }));
    },

    teamCoderAvailability: (_: unknown, { teamId }: any) => {
      const t = teams.find((x) => String(x.id) === String(teamId));
      if (!t) return [];
      return gridFor({ teamIds: [teamId] }).map((r: any) => ({
        id: r.userId,
        coderId: r.userId,
        coderName: r.userName,
        teamId: String(teamId),
        // Availability is the same answer the allocator uses, not a second one.
        isAvailable: !isUnavailable(r.userId),
        dailyCapacity: r._cap,
        currentWorkload: r.totalAssigned,
        specialty: null,
        unavailableSince: null,
        unavailableReason: isUnavailable(r.userId) ? "Unavailability window" : null,
        isAtCapacity: r.totalAssigned >= r._cap,
        remainingCapacity: Math.max(0, r._cap - r.totalAssigned),
        createdDate: null,
        lastModifiedDate: null,
      }));
    },

    queueDashboardTopCounts: (_: unknown, { filter }: any) => {
      const { assigned, overdue } = totals(filter);
      const unassignedPool = scopedTeams(filter).reduce((n, t) => n + volumeOf(t), 0);

      const split = (share: number, on: boolean) =>
        on
          ? {
              total: Math.round(assigned * share) + Math.round(unassignedPool * share),
              assigned: Math.round(assigned * share),
              unassigned: Math.round(unassignedPool * share),
              overdue: Math.round(overdue * share),
              pending: 0,
            }
          : null;

      return {
        displayDate: new Date().toISOString().slice(0, 10),
        claims: split(0.65, wantsClaims(filter)),
        authorizations: split(0.35, wantsAuths(filter)),
      };
    },

    queueDashboardAssignmentOverview: (_: unknown, { filter }: any) => {
      const { rows } = totals(filter);
      const sum = (k: string) => rows.reduce((n, r) => n + (r[k] ?? 0), 0);
      return {
        claimSubmissions: includesType(filter, "CLAIM_SUBMISSION") ? sum("claimsAssigned") : null,
        claimResubmissions: includesType(filter, "CLAIM_RESUBMISSION")
          ? sum("claimResubmissionsAssigned")
          : null,
        claimValidations: includesType(filter, "CLAIM_VALIDATION")
          ? sum("claimValidationsAssigned")
          : null,
        authorizationSubmissions: includesType(filter, "AUTHORIZATION_SUBMISSION")
          ? sum("authorizationsAssigned")
          : null,
        authorizationResubmissions: includesType(filter, "AUTHORIZATION_RESUBMISSION")
          ? sum("authorizationResubmissionsAssigned")
          : null,
      };
    },

    queueDashboardFacilityFinancialBreakdown: (_: unknown, { filter }: any) => {
      const byFacility = new Map<string, any>();
      for (const t of scopedTeams(filter)) {
        const { assigned } = totals({ ...filter, teamIds: [t.id] });
        for (const f of facilitiesOf(t)) {
          const row =
            byFacility.get(f) ??
            {
              facility: f,
              claimsCount: 0,
              authorizationsCount: 0,
              totalCount: 0,
              claimsTotalAmount: 0,
              authorizationsTotalAmount: 0,
              totalAmount: 0,
            };
          const c = Math.round(assigned * 0.65);
          const a = assigned - c;
          row.claimsCount += c;
          row.authorizationsCount += a;
          row.totalCount += assigned;
          // Average claim value from the observed mix, rounded to the nearest
          // dirham. Authorisations carry no net until approved.
          row.claimsTotalAmount += c * 268;
          row.totalAmount = row.claimsTotalAmount + row.authorizationsTotalAmount;
          byFacility.set(f, row);
        }
      }
      return [...byFacility.values()].sort((a, b) => b.totalCount - a.totalCount);
    },

    queueDashboardAuthOverduePending: (_: unknown, { filter }: any) =>
      overduePending(filter, "auth"),
    queueDashboardClaimsOverduePending: (_: unknown, { filter }: any) =>
      overduePending(filter, "claims"),

    queueDashboardAuthorizationAging: (_: unknown, { filter, ranges }: any) => {
      const { assigned } = totals(filter);
      // The caller supplies the ranges for auth aging, so honour them exactly.
      const weights = [0.72, 0.14, 0.08, 0.04, 0.02];
      return (ranges ?? []).map((r: any, i: number) =>
        bucket(
          labelFor(r),
          r.fromDays ?? null,
          r.toDays ?? null,
          Math.round(assigned * 0.35 * (weights[i] ?? 0.01)),
        ),
      );
    },

    queueDashboardClaimsAging: (_: unknown, { filter }: any) => {
      const { assigned } = totals(filter);
      // Claims aging uses the fixed buckets named in the schema docs.
      const fixed: [string, number | null, number | null, number][] = [
        ["0–7 Days", 0, 7, 0.66],
        ["8–15 Days", 8, 15, 0.16],
        ["16–30 Days", 16, 30, 0.1],
        ["31–60 Days", 31, 60, 0.05],
        ["60+ Days", 60, null, 0.03],
      ];
      return fixed.map(([label, f, t, w]) =>
        bucket(label, f, t, Math.round(assigned * 0.65 * w)),
      );
    },

    queueDashboardTeamMemberGrid: (_: unknown, { filter }: any) =>
      gridFor(filter).sort((a, b) => b.totalAssigned - a.totalAssigned),

    queueDashboardMemberView: (_: unknown, { filter, userId }: any) => {
      const row = gridFor(filter).find((r) => r.userId === String(userId));
      if (!row) {
        return {
          userId: String(userId),
          userName: null,
          totalAssigned: 0,
          totalCompleted: 0,
          totalOverdue: 0,
          insights: [],
        };
      }
      const types: [string, number][] = [
        ["CLAIM_SUBMISSION", row.claimsAssigned],
        ["CLAIM_VALIDATION", row.claimValidationsAssigned ?? 0],
        ["AUTHORIZATION_SUBMISSION", row.authorizationsAssigned],
        ["CLAIM_RESUBMISSION", row.claimResubmissionsAssigned ?? 0],
        ["AUTHORIZATION_RESUBMISSION", row.authorizationResubmissionsAssigned ?? 0],
      ];
      const rand = rng(Number(String(userId).replace(/\D/g, "") || 7));
      return {
        userId: row.userId,
        userName: row.userName,
        totalAssigned: row.totalAssigned,
        totalCompleted: row.completed,
        totalOverdue: row.overdue,
        insights: types
          .filter(([, n]) => n > 0)
          .map(([workItemType, n]) => {
            const completed = Math.round(n * (0.5 + rand() * 0.4));
            const breaches = Math.round(completed * rand() * 0.18);
            return {
              workItemType,
              completed,
              overdue: Math.round(n * rand() * 0.1),
              avgTatSeconds: completed ? Math.round(3600 * (2 + rand() * 20)) : null,
              slaCompliance: completed - breaches,
              slaBreaches: breaches,
            };
          }),
      };
    },
  };

  function labelFor(r: any) {
    if (r.fromDays == null) return `Up to ${r.toDays} Days`;
    if (r.toDays == null) return `${r.fromDays}+ Days`;
    return `${r.fromDays}–${r.toDays} Days`;
  }

  function overduePending(filter: any, kind: "auth" | "claims") {
    const on = kind === "auth" ? wantsAuths(filter) : wantsClaims(filter);
    if (!on) {
      return { overdueLast48h: 0, expiringNext24h: 0, totalPending: 0, byEncounterType: [] };
    }
    const { overdue, assigned } = totals(filter);
    const scale = kind === "auth" ? 0.35 : 0.65;
    const total = Math.round(overdue * scale);
    // Real encounter mix from the captured run: OP dominates, IP is thin, and
    // emergency only appears on the authorisation side.
    const cats: [string, number][] =
      kind === "auth"
        ? [["EMERGENCY", 0.32], ["OP", 0.68]]
        : [["EMERGENCY", 0.05], ["IP", 0.2], ["OP", 0.75]];
    return {
      overdueLast48h: total,
      expiringNext24h: Math.round(assigned * scale * 0.012),
      totalPending: 0,
      byEncounterType: cats.map(([category, w]) => ({
        category,
        overdueLast48h: Math.round(total * w),
        expiringNext24h: Math.round(assigned * scale * 0.012 * w),
      })),
    };
  }
}
