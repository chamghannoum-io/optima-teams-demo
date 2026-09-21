import { useMemo, useState } from "react";
import { useWorkingBranch } from "@optima/shared";
import {
  useGetUnassignedValidationRequestsQuery,
  type GetUnassignedValidationRequestsQuery,
} from "@/__generated__/graphql";

export type UnassignedNode = NonNullable<
  NonNullable<
    NonNullable<GetUnassignedValidationRequestsQuery["rcmOptimaValidationRequests"]>["edges"]
  >[number]
>["node"];

export interface UnassignedItem extends NonNullable<UnassignedNode> {
  ageDays: number;
}

export interface UseUnassignedRequestsOptions {
  /** ISO date string. Filters the list to items created on/after this date. */
  fromDate?: string;
  /** ISO date string. Filters the list to items created on/before this date. */
  toDate?: string;
  /** Relay cursor pagination variables (from useFilterableTable). */
  first?: number;
  last?: number;
  after?: string;
  before?: string;
}

export function useUnassignedRequests(opts: UseUnassignedRequestsOptions = {}) {
  const workingBranch = useWorkingBranch();
  const { fromDate, toDate, first, last, after, before } = opts;

  const { data, loading, refetch } = useGetUnassignedValidationRequestsQuery({
    variables: {
      first,
      last,
      after,
      before,
      filter: {
        assignmentAssignedTo: [null],
        isLatestBill: true,
        ...(workingBranch?.id ? { branchId: workingBranch.id } : {}),
        ...(fromDate ? { fromDate } : {}),
        ...(toDate ? { toDate } : {}),
      },
      sortBy: { field: "CREATED" as never, direction: "DESC" as never },
    },
  });

  const pageInfo = data?.rcmOptimaValidationRequests?.pageInfo;
  const totalCount = data?.rcmOptimaValidationRequests?.totalCount ?? 0;

  // Timestamp snapshot per mount — keeps the memo pure; ageDays granularity
  // makes a per-mount snapshot indistinguishable in the UI.
  const [now] = useState(() => Date.now());

  const items: UnassignedItem[] = useMemo(() => {
    return (data?.rcmOptimaValidationRequests?.edges ?? [])
      .map((edge) => edge?.node)
      .filter((node): node is NonNullable<UnassignedNode> => node != null)
      .map((node) => {
        const ageDays = node.createdDate
          ? Math.floor((now - new Date(node.createdDate).getTime()) / (1000 * 60 * 60 * 24))
          : 0;
        return { ...node, ageDays };
      });
  }, [data, now]);

  return { items, loading, refetch, pageInfo, totalCount };
}
