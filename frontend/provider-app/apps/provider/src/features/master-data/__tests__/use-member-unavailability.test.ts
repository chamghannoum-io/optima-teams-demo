import { createElement, type ReactNode } from "react";
import { describe, it, expect } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { MockedProvider, type MockedResponse } from "@apollo/client/testing";

import {
  CancelOptimaTeamUserUnavailabilityDocument,
  GetOptimaTeamMembersDocument,
  SetOptimaTeamUserUnavailabilityDocument,
} from "@/__generated__/graphql";

import { useMemberUnavailability } from "../hooks/use-member-unavailability";
import { formatIsoDate } from "../utils";

const TEAM_ID = "team-1";

const yesterday = new Date();
yesterday.setDate(yesterday.getDate() - 1);
const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);

const membersResult = (unavailableToday: boolean) => ({
  data: {
    optimaTeam: {
      id: TEAM_ID,
      members: [
        {
          userId: "m1",
          user: { id: "m1" },
          unavailableToday,
          unavailabilities: unavailableToday
            ? [
                {
                  id: "w1",
                  startDate: formatIsoDate(yesterday),
                  endDate: formatIsoDate(tomorrow),
                  reason: "annual leave",
                  cancelled: false,
                  activeToday: true,
                  createdBy: "supervisor",
                  createdDate: null,
                },
              ]
            : [],
        },
        { userId: "m2", user: { id: "m2" }, unavailableToday: false, unavailabilities: [] },
      ],
    },
  },
});

const membersQueryMock = (unavailableToday: boolean): MockedResponse => ({
  request: { query: GetOptimaTeamMembersDocument, variables: { id: TEAM_ID } },
  result: membersResult(unavailableToday),
});

function renderWithMocks(mocks: MockedResponse[]) {
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(MockedProvider, { mocks, addTypename: false }, children);
  return renderHook(() => useMemberUnavailability(TEAM_ID), { wrapper });
}

describe("useMemberUnavailability", () => {
  it("exposes the server's unavailableToday flags and current window, and manages the dialog", async () => {
    const { result } = renderWithMocks([membersQueryMock(true)]);

    await waitFor(() => expect(result.current.isMemberUnavailable("m1")).toBe(true));
    expect(result.current.isMemberUnavailable("m2")).toBe(false);
    expect(result.current.unavailabilityByMemberId["m1"]).toMatchObject({
      id: "w1",
      reason: "annual leave",
    });
    expect(result.current.unavailabilitiesByMemberId["m1"]).toHaveLength(1);
    expect(result.current.unavailabilityByMemberId["m2"]).toBeUndefined();

    act(() => result.current.openDialog("m1"));
    expect(result.current.dialogMemberId).toBe("m1");
    act(() => result.current.closeDialog());
    expect(result.current.dialogMemberId).toBeNull();
  });

  it("persists a window via the set mutation and refetches members", async () => {
    const setMutationMock: MockedResponse = {
      request: {
        query: SetOptimaTeamUserUnavailabilityDocument,
        variables: {
          input: {
            teamId: TEAM_ID,
            userId: "m1",
            startDate: formatIsoDate(yesterday),
            endDate: formatIsoDate(tomorrow),
            reason: "annual leave",
            action: "UNASSIGN",
          },
        },
      },
      result: {
        data: {
          optimaTeamUserUnavailabilitySet: {
            id: "w1",
            rcmTeamId: TEAM_ID,
            userId: "m1",
            startDate: formatIsoDate(yesterday),
            endDate: formatIsoDate(tomorrow),
            reason: "annual leave",
            cancelled: false,
          },
        },
      },
    };
    const { result } = renderWithMocks([
      membersQueryMock(false),
      setMutationMock,
      membersQueryMock(true),
    ]);

    await waitFor(() => expect(result.current.isMemberUnavailable("m1")).toBe(false));
    await act(() =>
      result.current.confirmUnavailability(
        "m1",
        { startDate: yesterday, endDate: tomorrow, reason: "annual leave" },
        "UNASSIGN"
      )
    );
    await waitFor(() => expect(result.current.isMemberUnavailable("m1")).toBe(true));
  });

  it("soft-cancels the member's current window and refetches", async () => {
    const cancelMutationMock: MockedResponse = {
      request: {
        query: CancelOptimaTeamUserUnavailabilityDocument,
        variables: { id: "w1" },
      },
      result: {
        data: { optimaTeamUserUnavailabilityCancel: { id: "w1", cancelled: true } },
      },
    };
    const { result } = renderWithMocks([
      membersQueryMock(true),
      cancelMutationMock,
      membersQueryMock(false),
    ]);

    await waitFor(() => expect(result.current.isMemberUnavailable("m1")).toBe(true));
    await act(() => result.current.cancelUnavailability("w1"));
    await waitFor(() => expect(result.current.isMemberUnavailable("m1")).toBe(false));
  });
});
