/**
 * Stands in for @/__generated__/graphql.
 *
 * That module is codegen output and is not committed upstream, so the real Teams page
 * cannot import it here. These are the same hook signatures the page calls, backed by
 * the local v2 schema — which means the genuine teams.tsx / edit-team-drawer.tsx /
 * create-team-drawer.tsx run unmodified against v2 data.
 *
 * The v1 operation names are kept (optimaTeams, not optimaTeamsV2) because that is what
 * the real page asks for; the local schema aliases them onto the v2 model.
 */
import { gql, useQuery, useMutation, useLazyQuery } from "@apollo/client";

/* ── enums the page imports ── */

export const OptimaTeamRotationFrequency = {
  Daily: "DAILY",
  Weekly: "WEEKLY",
  Monthly: "MONTHLY",
} as const;

export const OptimaTeamUnavailabilityAction = {
  Unassign: "UNASSIGN",
  Redistribute: "REDISTRIBUTE",
} as const;

export const OptimaTagOperation = {
  And: "AND",
  Or: "OR",
} as const;

export type OptimaTeamTagInput = {
  tag?: string | null;
  isGroup?: boolean | null;
  tagOperation?: string | null;
  tags?: OptimaTeamTagInput[] | null;
};

export const CodeSystemCode = {
  TeamTag: "TEAM_TAG",
} as const;

/* ── documents ── */

const TEAM_FIELDS = gql`
  fragment TeamFields on RcmTeamV2 {
    id
    name
    nameAr
    description
    active
    tag
    createdDate
    division
    encounterScope
    logicAxis
    facilityId
    rotationEnabled
    rotationFrequency
    nextRotationDate
    branchIds
    branches {
      id
      name
      nameAr
    }
    usersDetails {
      id
      firstName
      lastName
      email
      appRole
      isActive
    }
    groups {
      id
      name
      active
      workItemTypes
      encounterScope
      departments
      payers
      payerCatchAll
      claimStatuses
      specificity
      members {
        id
        firstName
        lastName
        email
      }
      capacity {
        memberCount
        totalCapacity
      }
    }
    capacity {
      memberCount
      totalCapacity
      duplicateMemberships
    }
    coverage {
      uncoveredDepartments
      uncoveredPayers
      emptyGroupIds
      complete
    }
  }
`;

export const GetOptimaTeamsDocument = gql`
  ${TEAM_FIELDS}
  query GetOptimaTeams($filter: OptimaTeamFilterInput) {
    optimaTeams(filter: $filter) {
      ...TeamFields
    }
  }
`;

export const UpdateOptimaTeamDocument = gql`
  mutation UpdateOptimaTeam($id: ID!, $input: OptimaTeamInput!) {
    optimaTeamUpdate(id: $id, input: $input) {
      id
      name
      active
    }
  }
`;

export const CreateOptimaTeamDocument = gql`
  mutation CreateOptimaTeam($input: OptimaTeamInput!) {
    optimaTeamCreate(input: $input) {
      id
      name
    }
  }
`;

export const AddOptimaTeamUsersDocument = gql`
  mutation AddOptimaTeamUsers($id: ID!, $userIds: [ID!]!) {
    optimaTeamUserAdd(id: $id, userIds: $userIds) {
      id
    }
  }
`;

export const RemoveOptimaTeamUsersDocument = gql`
  mutation RemoveOptimaTeamUsers($id: ID!, $userIds: [ID!]!) {
    optimaTeamUserRemove(id: $id, userIds: $userIds) {
      id
    }
  }
`;

export const GetOptimaTeamMembersDocument = gql`
  query GetOptimaTeamMembers($id: ID!, $availableOnly: Boolean) {
    optimaTeam(id: $id) {
      id
      name
      members(availableOnly: $availableOnly) {
        userId
        unavailableToday
        user {
          id
          firstName
          lastName
          email
        }
        unavailabilities {
          id
          startDate
          endDate
          reason
          cancelled
          activeToday
        }
      }
    }
  }
`;

export const SetUnavailabilityDocument = gql`
  mutation SetOptimaTeamUserUnavailability($input: OptimaTeamUserUnavailabilityInput!) {
    optimaTeamUserUnavailabilitySet(input: $input) {
      id
    }
  }
`;

export const CancelUnavailabilityDocument = gql`
  mutation CancelOptimaTeamUserUnavailability($id: ID!) {
    optimaTeamUserUnavailabilityCancel(id: $id) {
      id
    }
  }
`;

export const BranchesAutocompleteDocument = gql`
  query BranchesAutocomplete($first: Int, $filter: BranchFilterInput) {
    branches(first: $first, filter: $filter) {
      edges {
        node {
          id
          name
          nameAr
        }
      }
    }
  }
`;

export const SystemCodesAutocompleteDocument = gql`
  query SystemCodesAutocomplete($first: Int, $filter: CodeSystemConceptSearchFilter) {
    codeSystemConcepts(first: $first, filter: $filter) {
      edges {
        node {
          code
          display
        }
      }
    }
  }
`;

export const GetUsersDocument = gql`
  query GetUsers($filter: UserFilterInput) {
    users(filter: $filter) {
      edges {
        node {
          id
          firstName
          lastName
          email
          isActive
        }
      }
    }
  }
`;

/* ── hooks, matching the generated signatures ── */

export const useGetOptimaTeamsQuery = (opts?: any) => useQuery(GetOptimaTeamsDocument, opts);
export const useUpdateOptimaTeamMutation = (opts?: any) =>
  useMutation(UpdateOptimaTeamDocument, opts);
export const useCreateOptimaTeamMutation = (opts?: any) =>
  useMutation(CreateOptimaTeamDocument, opts);
export const useAddOptimaTeamUsersMutation = (opts?: any) =>
  useMutation(AddOptimaTeamUsersDocument, opts);
export const useRemoveOptimaTeamUsersMutation = (opts?: any) =>
  useMutation(RemoveOptimaTeamUsersDocument, opts);
export const useGetOptimaTeamMembersQuery = (opts?: any) =>
  useQuery(GetOptimaTeamMembersDocument, opts);
export const useSetOptimaTeamUserUnavailabilityMutation = (opts?: any) =>
  useMutation(SetUnavailabilityDocument, opts);
export const useCancelOptimaTeamUserUnavailabilityMutation = (opts?: any) =>
  useMutation(CancelUnavailabilityDocument, opts);
export const useBranchesAutocompleteQuery = (opts?: any) =>
  useQuery(BranchesAutocompleteDocument, opts);
export const useSystemCodesAutocompleteQuery = (opts?: any) =>
  useQuery(SystemCodesAutocompleteDocument, opts);
export const useGetUsersLazyQuery = (opts?: any) => useLazyQuery(GetUsersDocument, opts);

/* ── types the page references ── */

export type GetOptimaTeamsQuery = {
  optimaTeams: Array<Record<string, any>> | null;
};
