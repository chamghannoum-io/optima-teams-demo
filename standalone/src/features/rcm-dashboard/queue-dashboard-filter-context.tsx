import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { startOfDay, endOfDay } from "date-fns";
import {
  WorkItemType,
  useMeQuery,
  useQueueDashboardTeamAssignmentSettingQuery,
  type QueueDashboardFilterInput,
} from "@/__generated__/graphql";

interface QueueDashboardFilterValue {
  fromDate: Date;
  toDate: Date;
  vendorId: string | null;
  workItemTypes: WorkItemType[] | null;
  /** Selected team id. Maps to `teamIds: [teamId]` on the BE filter. */
  teamId: string | null;
  /** Human-readable team name kept alongside the id so any consumer can label
   *  the active team without re-querying the autocomplete. */
  teamName: string | null;
  /** Max claims capacity for the selected team. Null until loaded or when no
   *  team is selected. Fetched from `assignmentSettingByTeam`. */
  teamMaxClaim: number | null;
  /** Max authorizations capacity for the selected team (see `teamMaxClaim`). */
  teamMaxAuth: number | null;
  /** True while the assignment-setting query is in flight. */
  teamCapacityLoading: boolean;
  /** Selected branch id. Maps to `branches: [branchId]` on the BE filter. */
  branchId: string | null;
  /** Human-readable branch name (see `teamName`). */
  branchName: string | null;
}

interface QueueDashboardFilterContextType {
  filter: QueueDashboardFilterValue;
  setFromDate: (date: Date) => void;
  setToDate: (date: Date) => void;
  setVendorId: (id: string | null) => void;
  setWorkItemTypes: (types: WorkItemType[] | null) => void;
  /** Set team selection (id + name together so they never drift apart). */
  setTeam: (id: string | null, name: string | null) => void;
  /** Set branch selection (id + name together). */
  setBranch: (id: string | null, name: string | null) => void;
  resetToToday: () => void;
  graphqlFilter: QueueDashboardFilterInput;
}

const QueueDashboardFilterContext = createContext<QueueDashboardFilterContextType | null>(null);

// Default date range = local "today" so the "Today" preset chip in the
// filter modal is highlighted on load (its preset uses date-fns'
// startOfDay/endOfDay, also local). The BE compares timestamps either way.

export function QueueDashboardFilterProvider({ children }: { children: ReactNode }) {
  const [fromDate, setFromDate] = useState<Date>(() => startOfDay(new Date()));
  const [toDate, setToDate] = useState<Date>(() => endOfDay(new Date()));
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [workItemTypes, setWorkItemTypes] = useState<WorkItemType[] | null>(null);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [teamName, setTeamName] = useState<string | null>(null);
  const [branchId, setBranchId] = useState<string | null>(null);
  const [branchName, setBranchName] = useState<string | null>(null);

  // Auto-scope every queue-dashboard query to the signed-in user's vendor.
  // Manual setVendorId calls still win for any future override UI.
  const { data: meData } = useMeQuery();
  const meVendorId = meData?.me?.vendor?.id ?? null;
  // Adjust state during render: seed vendorId once the me-query resolves.
  if (meVendorId && vendorId == null) {
    setVendorId(meVendorId);
  }

  // Team capacity (maxClaim / maxAuth) — exposed alongside the team selection
  // so any consumer (filter chips, drawer, charts) can show capacity context
  // without re-querying. The filter-bar uses these to decide which work-item
  // type chips are enabled for the selected team.
  const { data: settingData, loading: teamCapacityLoading } =
    useQueueDashboardTeamAssignmentSettingQuery({
      variables: { teamId: teamId ?? "" },
      skip: !teamId,
      fetchPolicy: "cache-and-network",
    });
  const teamMaxClaim = teamId ? (settingData?.assignmentSettingByTeam?.maxClaim ?? null) : null;
  const teamMaxAuth = teamId ? (settingData?.assignmentSettingByTeam?.maxAuth ?? null) : null;

  const value = useMemo<QueueDashboardFilterContextType>(() => {
    const graphqlFilter: QueueDashboardFilterInput = {
      fromDate: fromDate.toISOString(),
      toDate: toDate.toISOString(),
    };
    if (vendorId) graphqlFilter.vendorId = vendorId;
    if (workItemTypes && workItemTypes.length > 0) graphqlFilter.workItemTypes = workItemTypes;
    if (teamId) graphqlFilter.teamIds = [teamId];
    if (branchId) graphqlFilter.branches = [branchId];

    return {
      filter: {
        fromDate,
        toDate,
        vendorId,
        workItemTypes,
        teamId,
        teamName,
        teamMaxClaim,
        teamMaxAuth,
        teamCapacityLoading,
        branchId,
        branchName,
      },
      setFromDate,
      setToDate,
      setVendorId,
      setWorkItemTypes,
      setTeam: (id, name) => {
        setTeamId(id);
        setTeamName(name);
      },
      setBranch: (id, name) => {
        setBranchId(id);
        setBranchName(name);
      },
      resetToToday: () => {
        setFromDate(startOfDay(new Date()));
        setToDate(endOfDay(new Date()));
      },
      graphqlFilter,
    };
  }, [
    fromDate,
    toDate,
    vendorId,
    workItemTypes,
    teamId,
    teamName,
    teamMaxClaim,
    teamMaxAuth,
    teamCapacityLoading,
    branchId,
    branchName,
  ]);

  return (
    <QueueDashboardFilterContext.Provider value={value}>
      {children}
    </QueueDashboardFilterContext.Provider>
  );
}

export function useQueueDashboardFilter(): QueueDashboardFilterContextType {
  const ctx = useContext(QueueDashboardFilterContext);
  if (!ctx) {
    throw new Error("useQueueDashboardFilter must be used within a QueueDashboardFilterProvider");
  }
  return ctx;
}

export function showsClaims(types: WorkItemType[] | null): boolean {
  if (!types || types.length === 0) return true;
  return types.some(
    (t) =>
      t === WorkItemType.ClaimSubmission ||
      t === WorkItemType.ClaimResubmission ||
      t === WorkItemType.ClaimValidation
  );
}

/** Narrow: pre-claims (validation requests) — corresponds to ClaimValidation work items. */
export function showsPreClaims(types: WorkItemType[] | null): boolean {
  if (!types || types.length === 0) return true;
  return types.some((t) => t === WorkItemType.ClaimValidation);
}

/** Narrow: real claims (claim submissions/resubmissions). */
export function showsClaimSubmissions(types: WorkItemType[] | null): boolean {
  if (!types || types.length === 0) return true;
  return types.some(
    (t) => t === WorkItemType.ClaimSubmission || t === WorkItemType.ClaimResubmission
  );
}

export function showsAuthorizations(types: WorkItemType[] | null): boolean {
  if (!types || types.length === 0) return true;
  return types.some(
    (t) =>
      t === WorkItemType.AuthorizationSubmission || t === WorkItemType.AuthorizationResubmission
  );
}

export function showsResubmissions(types: WorkItemType[] | null): boolean {
  if (!types || types.length === 0) return true;
  return types.some(
    (t) => t === WorkItemType.ClaimResubmission || t === WorkItemType.AuthorizationResubmission
  );
}
