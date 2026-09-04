import { createElement, type ReactNode } from "react";
import { describe, it, expect } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { MockedProvider, type MockedResponse } from "@apollo/client/testing";

import { SystemCodesAutocompleteDocument, CodeSystemCode } from "@/__generated__/graphql";

import { useTeamTagSuggestions } from "../hooks/use-team-tag-suggestions";
import type { TeamTag } from "../team-tags-autocomplete";

function suggestionsMock(codes: { code: string; display: string }[]): MockedResponse {
  return {
    request: {
      query: SystemCodesAutocompleteDocument,
      variables: { first: 20, filter: { codeSystemCode: CodeSystemCode.RcmTeamTag } },
    },
    result: {
      data: {
        codeSystemConcepts: {
          pageInfo: { endCursor: null, hasNextPage: false },
          edges: codes.map((c) => ({
            node: { id: c.code, code: c.code, display: c.display, arabicDisplay: null },
          })),
        },
      },
    },
  };
}

function renderWithMocks(mocks: MockedResponse[], value: TeamTag[], open: boolean) {
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(MockedProvider, { mocks, addTypename: false }, children);
  return renderHook(() => useTeamTagSuggestions(value, () => {}, open), { wrapper });
}

describe("useTeamTagSuggestions", () => {
  it("does not fetch suggestions while closed", () => {
    const { result } = renderWithMocks([], [], false);
    expect(result.current.loading).toBe(false);
    expect(result.current.suggestions).toEqual([]);
  });

  it("loads suggestions when open, excluding already-selected codes", async () => {
    const mocks = [
      suggestionsMock([
        { code: "dep_dental", display: "Dental" },
        { code: "enc_ip", display: "Inpatient" },
      ]),
    ];
    const selected: TeamTag[] = [{ code: "dep_dental", display: "Dental" }];
    const { result } = renderWithMocks(mocks, selected, true);

    await waitFor(() => expect(result.current.suggestions).toHaveLength(1));
    expect(result.current.suggestions[0]?.code).toBe("enc_ip");
  });

  it("flags a typed value as addable when it matches no tag or suggestion", async () => {
    const mocks = [suggestionsMock([{ code: "enc_ip", display: "Inpatient" }])];
    const { result } = renderWithMocks(mocks, [], true);
    await waitFor(() => expect(result.current.suggestions).toHaveLength(1));

    act(() => result.current.setSearch("custom-tag"));
    expect(result.current.trimmed).toBe("custom-tag");
    expect(result.current.canAddCustom).toBe(true);
  });

  it("does not flag a typed value as addable when it matches an existing tag's display", async () => {
    const selected: TeamTag[] = [{ code: "dep_dental", display: "Dental" }];
    const { result } = renderWithMocks([suggestionsMock([])], selected, true);
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.setSearch("Dental"));
    expect(result.current.trimmed).toBe("Dental");
    expect(result.current.canAddCustom).toBe(false);
  });
});
