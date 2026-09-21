import { useMemo, useState } from "react";
import { useWorkingBranch } from "@optima/shared";
import {
  useGetUnassignedAuthorizationsQuery,
  type GetUnassignedAuthorizationsQuery,
} from "@/__generated__/graphql";

export type UnassignedAuthNode = NonNullable<
  NonNullable<
    NonNullable<GetUnassignedAuthorizationsQuery["authorizationSubmissions"]>["edges"]
  >[number]
>["node"];

export interface UnassignedAuthItem extends NonNullable<UnassignedAuthNode> {
  ageDays: number;
}

export interface UseUnassignedAuthorizationsOptions {
  fromDate?: string;
  toDate?: string;
  first?: number;
  last?: number;
  after?: string;
  before?: string;
}

export function useUnassignedAuthorizations(opts: UseUnassignedAuthorizationsOptions = {}) {
  const workingBranch = useWorkingBranch();
  const { fromDate, toDate, first, last, after, before } = opts;

  const { data, loading, refetch } = useGetUnassignedAuthorizationsQuery({
    variables: {
      first,
      last,
      after,
      before,
      filter: {
        assignmentAssignedTo: [null],
        ...(workingBranch?.id ? { branchId: workingBranch.id } : {}),
        ...(fromDate ? { createdDateFrom: fromDate } : {}),
        ...(toDate ? { createdDateTo: toDate } : {}),
      },
      sortBy: { field: "CREATED_AT" as never, direction: "DESC" as never },
    },
  });

  const pageInfo = data?.authorizationSubmissions?.pageInfo;
  const totalCount = data?.authorizationSubmissions?.totalCount ?? 0;

  // Timestamp snapshot per mount — keeps the memo pure; ageDays granularity
  // makes a per-mount snapshot indistinguishable in the UI.
  const [now] = useState(() => Date.now());

  const items: UnassignedAuthItem[] = useMemo(() => {
    return (data?.authorizationSubmissions?.edges ?? [])
      .map((edge) => edge?.node)
      .filter((node): node is NonNullable<UnassignedAuthNode> => node != null)
      .map((node) => {
        const ageDays = node.createdAt
          ? Math.floor((now - new Date(node.createdAt).getTime()) / (1000 * 60 * 60 * 24))
          : 0;
        return { ...node, ageDays };
      });
  }, [data, now]);

  return { items, loading, refetch, pageInfo, totalCount };
}
