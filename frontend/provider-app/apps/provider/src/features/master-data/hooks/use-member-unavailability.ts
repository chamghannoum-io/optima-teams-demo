import { useCallback, useMemo, useState } from "react";

import {
  OptimaTeamUnavailabilityAction,
  useCancelOptimaTeamUserUnavailabilityMutation,
  useGetOptimaTeamMembersQuery,
  useSetOptimaTeamUserUnavailabilityMutation,
} from "@/__generated__/graphql";

import type { MemberUnavailability, UnavailabilityResolution } from "../types.js";
import { formatIsoDate, isUnavailabilityOngoing, parseIsoDate } from "../utils.js";

const ACTION_BY_RESOLUTION: Record<UnavailabilityResolution, OptimaTeamUnavailabilityAction> = {
  UNASSIGN: OptimaTeamUnavailabilityAction.Unassign,
  REDISTRIBUTE: OptimaTeamUnavailabilityAction.Redistribute,
};

/** Both ids a membership row can be addressed by: the membership userId and the user entity id. */
function memberKeys(member: { userId: string; user?: { id: string } | null }): string[] {
  return [...new Set([member.userId, member.user?.id].filter((id): id is string => !!id))];
}

export interface UseMemberUnavailabilityResult {
  /** All active or upcoming (non-cancelled) windows per member id, soonest first. */
  unavailabilitiesByMemberId: Record<string, MemberUnavailability[]>;
  /** The member's nearest window (first of {@link unavailabilitiesByMemberId}). */
  unavailabilityByMemberId: Record<string, MemberUnavailability>;
  /** Member the manage-unavailability dialog is currently open for, if any. */
  dialogMemberId: string | null;
  openDialog: (memberId: string) => void;
  closeDialog: () => void;
  /** Persists the window with its resolution; UNASSIGN also moves the member's items to the unassigned bucket. */
  confirmUnavailability: (
    memberId: string,
    unavailability: MemberUnavailability,
    resolution: UnavailabilityResolution
  ) => Promise<void>;
  /** Soft-cancels a specific window by its server id (member is back early). */
  cancelUnavailability: (windowId: string) => Promise<void>;
  /** True when the server flags the member as unavailable today. */
  isMemberUnavailable: (memberId: string) => boolean;
  /** True while a set/cancel mutation is in flight. */
  saving: boolean;
  /** Message when loading the members' unavailability data failed. */
  membersError?: string;
}

/**
 * Server-backed unavailability state for the team setup drawer: reads members'
 * windows and `unavailableToday` flags for `teamId`, and persists changes via
 * `optimaTeamUserUnavailabilitySet` / `optimaTeamUserUnavailabilityCancel`.
 */
export function useMemberUnavailability(teamId: string | null): UseMemberUnavailabilityResult {
  const [dialogMemberId, setDialogMemberId] = useState<string | null>(null);

  const {
    data,
    refetch,
    error: membersQueryError,
  } = useGetOptimaTeamMembersQuery({
    variables: { id: teamId ?? "" },
    skip: !teamId,
  });
  const [setUnavailability, { loading: settingWindow }] =
    useSetOptimaTeamUserUnavailabilityMutation();
  const [cancelWindow, { loading: cancellingWindow }] =
    useCancelOptimaTeamUserUnavailabilityMutation();

  const members = useMemo(() => data?.optimaTeam?.members ?? [], [data]);

  const unavailabilitiesByMemberId = useMemo(() => {
    const result: Record<string, MemberUnavailability[]> = {};
    for (const member of members) {
      const ongoing = (member.unavailabilities ?? [])
        .filter((window) => !window.cancelled && window.startDate && window.endDate)
        .map<MemberUnavailability>((window) => ({
          id: window.id,
          startDate: parseIsoDate(String(window.startDate)),
          endDate: parseIsoDate(String(window.endDate)),
          reason: window.reason ?? undefined,
          createdBy: window.createdBy ?? undefined,
        }))
        .filter((window) => isUnavailabilityOngoing(window))
        .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
      // Key by both id domains: consumers look up with the team's usersDetails id,
      // which may differ from the membership row's userId
      if (ongoing.length > 0) {
        for (const key of memberKeys(member)) result[key] = ongoing;
      }
    }
    return result;
  }, [members]);

  const unavailabilityByMemberId = useMemo(() => {
    const result: Record<string, MemberUnavailability> = {};
    for (const [memberId, windows] of Object.entries(unavailabilitiesByMemberId)) {
      if (windows[0]) result[memberId] = windows[0];
    }
    return result;
  }, [unavailabilitiesByMemberId]);

  const unavailableTodayIds = useMemo(
    () => new Set(members.filter((m) => m.unavailableToday).flatMap((m) => memberKeys(m))),
    [members]
  );

  const openDialog = useCallback((memberId: string) => setDialogMemberId(memberId), []);
  const closeDialog = useCallback(() => setDialogMemberId(null), []);

  const confirmUnavailability = useCallback(
    async (
      memberId: string,
      unavailability: MemberUnavailability,
      resolution: UnavailabilityResolution
    ) => {
      if (!teamId) return;
      await setUnavailability({
        variables: {
          input: {
            teamId,
            userId: memberId,
            startDate: formatIsoDate(unavailability.startDate),
            endDate: formatIsoDate(unavailability.endDate),
            reason: unavailability.reason?.trim() || undefined,
            action: ACTION_BY_RESOLUTION[resolution],
          },
        },
      });
      await refetch();
    },
    [teamId, setUnavailability, refetch]
  );

  const cancelUnavailability = useCallback(
    async (windowId: string) => {
      await cancelWindow({ variables: { id: windowId } });
      await refetch();
    },
    [cancelWindow, refetch]
  );

  const isMemberUnavailable = useCallback(
    (memberId: string) => unavailableTodayIds.has(memberId),
    [unavailableTodayIds]
  );

  return {
    unavailabilitiesByMemberId,
    unavailabilityByMemberId,
    dialogMemberId,
    openDialog,
    closeDialog,
    confirmUnavailability,
    cancelUnavailability,
    isMemberUnavailable,
    saving: settingWindow || cancellingWindow,
    membersError: membersQueryError?.message,
  };
}
