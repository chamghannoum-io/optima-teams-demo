import { useCallback, useMemo, useState } from "react";
import { createColumnHelper } from "@tanstack/react-table";
import {
  Button,
  PageHeader,
  PageContent,
  DataTable,
  Badge,
  TableFilters,
  TableFilterChips,
  TablePagination,
  useFilterableTable,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/enhanced";
import type { FilterFieldConfig } from "@/components/enhanced";
import { Pencil, Users } from "lucide-react";
import { Permission, usePermission, useAuth, isRcmSupervisor } from "@optima/auth";
import {
  useBranchesAutocompleteQuery,
  useGetOptimaTeamsQuery,
  useUpdateOptimaTeamMutation,
  type GetOptimaTeamsQuery,
  CodeSystemCode,
} from "@/__generated__/graphql";
import { ApiAutocomplete } from "@/shared/autocomplete/index.js";
import { autocompleteQueriesMapper } from "@/autocompletes/index.js";
import { isBaseOption, type IBaseOption } from "@optima/shared";
import { toast } from "@optima/ui";
import { isApolloGraphqlErrorAlreadyToastedGlobally, logApiError } from "@optima/shared";
import { useTranslation } from "react-i18next";
import { TeamWizard } from "./team-wizard.js";

type OptimaTeam = NonNullable<GetOptimaTeamsQuery["optimaTeams"]>[number];

const columnHelper = createColumnHelper<OptimaTeam>();

function PencilIcon() {
  return <Pencil size={16} />;
}

export default function TeamsPage() {
  const { t } = useTranslation("provider");
  const { user } = useAuth();
  const hasManageTeamsPermission = usePermission(Permission.ManageProgramTeams);
  const normalizedVendorType = user?.vendorUserType?.toLowerCase().replace(/[\s_-]/g, "") ?? "";
  const normalizedAppRole = user?.appRole?.toLowerCase().replace(/[\s_-]/g, "") ?? "";
  const isRcmSupervisorUser =
    isRcmSupervisor(user?.vendorUserType) ||
    normalizedVendorType === "rcmsupervisor" ||
    normalizedAppRole === "rcmsupervisor";
  const canManageTeams = hasManageTeamsPermission || isRcmSupervisorUser;
  const [editTeam, setEditTeam] = useState<OptimaTeam | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  // 1 = Team Info (edit pencil); 2 = Members (manage-members shortcut)
  const [editInitialStep, setEditInitialStep] = useState(1);
  const [updateTeam] = useUpdateOptimaTeamMutation();
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());
  const {
    data: providerBranchesData,
    loading: loadingProviderBranches,
    error: providerBranchesError,
  } = useBranchesAutocompleteQuery({
    variables: {
      first: 100,
      filter: user?.vendorId ? { vendors: [String(user.vendorId)] } : undefined,
    },
    skip: !user?.vendorId,
  });

  const table = useFilterableTable({
    defaultSort: { field: "createdDate", direction: "DESC" },
    defaultPageSize: 10,
    pageSizeOptions: [10, 25, 50],
  });

  const providerBranchIds = useMemo(
    () =>
      providerBranchesData?.branches?.edges
        ?.map((edge) => edge?.node?.id)
        .filter((id): id is string => typeof id === "string" && id.length > 0) ?? [],
    [providerBranchesData]
  );

  const filter = useMemo(() => {
    const f: Record<string, unknown> = {};
    const name = table.filterValues.name as string | undefined;
    const status = table.filterValues.status as string | undefined;
    const tagValue = table.filterValues.tag;
    const tag = isBaseOption(tagValue) ? tagValue.key : undefined;

    if (name?.trim()) f.name = name.trim();
    if (status === "true") f.active = true;
    if (status === "false") f.active = false;
    if (tag) f.tag = tag;
    if (providerBranchIds.length > 0) f.branchIds = providerBranchIds;
    if (user?.vendorId) f.vendorId = String(user.vendorId);

    return Object.keys(f).length > 0 ? f : undefined;
  }, [table.filterValues, providerBranchIds, user?.vendorId]);

  const shouldSkipTeamsQuery = loadingProviderBranches || providerBranchIds.length === 0;

  const { data, loading, error, refetch } = useGetOptimaTeamsQuery({
    variables: { filter },
    skip: shouldSkipTeamsQuery,
  });

  const isLoading = loadingProviderBranches || loading;
  const combinedError = providerBranchesError ?? error;
  const refetchTeams = useCallback(async () => {
    if (!shouldSkipTeamsQuery) {
      await refetch();
    }
  }, [shouldSkipTeamsQuery, refetch]);

  const filterFields: FilterFieldConfig[] = useMemo(
    () => [
      {
        name: "search",
        label: t("common.search"),
        type: "text",
        placeholder: t("masterData.teams.searchPlaceholder"),
      },
      {
        name: "name",
        label: t("common.name"),
        type: "text",
        placeholder: t("masterData.teams.namePlaceholder"),
      },
      {
        name: "status",
        label: t("common.status"),
        type: "select",
        options: [
          { value: "true", label: t("userManagement.active") },
          { value: "false", label: t("userManagement.inactive") },
        ],
      },
      {
        name: "tag",
        label: t("masterData.teams.tag", "Tag"),
        type: "autocomplete",
        render: (value, onChange) => (
          <ApiAutocomplete
            config={autocompleteQueriesMapper.systemCodeDisplayOnly.queryConfig}
            filter={{ codeSystemCode: CodeSystemCode.RcmTeamTag }}
            value={value as never}
            onChange={(val) => onChange((val ?? null) as IBaseOption | null)}
            placeholder={t("masterData.teams.tagsPlaceholder", "Search by tag")}
          />
        ),
      },
    ],
    [t]
  );

  const teams = useMemo(() => {
    let base = [...(data?.optimaTeams ?? [])].sort((a, b) => {
      const da = a.createdDate ? new Date(a.createdDate).getTime() : 0;
      const db = b.createdDate ? new Date(b.createdDate).getTime() : 0;
      return db - da;
    });

    const search = (table.filterValues.search as string | undefined)?.trim().toLowerCase();

    // Text search across name/description/tags/members
    if (search) {
      base = base.filter((team) => {
        const members = team.usersDetails?.filter(Boolean) ?? [];
        const memberText = members
          .map((user) => [user?.firstName, user?.lastName, user?.email].filter(Boolean).join(" "))
          .join(" ");

        const haystack = [team.name, team.nameAr ?? "", team.description ?? "", memberText]
          .join(" ")
          .toLowerCase();

        return haystack.includes(search);
      });
    }

    return base;
  }, [data, table.filterValues]);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const totalCount = teams.length;
  const totalPages = Math.ceil(totalCount / pageSize);
  const paginatedTeams = useMemo(
    () => teams.slice((page - 1) * pageSize, page * pageSize),
    [teams, page, pageSize]
  );

  const columns = useMemo(
    () => [
      columnHelper.display({
        id: "name",
        header: t("common.name"),
        cell: (info) => {
          const team = info.row.original;
          return (
            <div>
              <p className="font-medium text-slate-900 dark:text-dark-text">{team.name}</p>
              {team.nameAr && (
                <p className="text-xs text-slate-500 dark:text-slate-400" dir="rtl">
                  {team.nameAr}
                </p>
              )}
            </div>
          );
        },
      }),
      columnHelper.display({
        id: "scope",
        header: t("masterData.teams.scope", "Worklist"),
        cell: (info) => {
          const team = info.row.original as never as {
            division?: string; encounterScope?: string; logicAxis?: string; facilityId?: string;
          };
          if (!team.division) {
            return <span className="text-sm text-slate-400">—</span>;
          }
          return (
            <div className="flex flex-wrap items-center gap-1">
              <Badge variant="default">{team.division}</Badge>
              <Badge variant="default">{team.encounterScope}</Badge>
              <Badge variant="info">by {team.logicAxis}</Badge>
            </div>
          );
        },
      }),
      columnHelper.display({
        id: "groups",
        header: t("masterData.teams.groups", "Groups"),
        cell: (info) => {
          const team = info.row.original as never as {
            groups?: { members?: unknown[] }[];
            capacity?: { totalCapacity?: number; duplicateMemberships?: number };
          };
          const groups = team.groups ?? [];
          const empty = groups.filter((g) => !(g.members ?? []).length).length;
          return (
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5">
                <Badge variant="default">{groups.length}</Badge>
                {empty > 0 && (
                  <span className="text-[11px] text-amber-700 dark:text-amber-400">
                    {empty} empty
                  </span>
                )}
              </div>
              {(team.capacity?.totalCapacity ?? 0) > 0 && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {team.capacity?.totalCapacity?.toLocaleString()} / day
                </p>
              )}
            </div>
          );
        },
      }),
      columnHelper.display({
        id: "created",
        header: t("common.createdAt"),
        cell: (info) => {
          const date = info.row.original.createdDate;
          if (!date) return <span className="text-sm text-slate-400">—</span>;
          return (
            <span className="text-sm text-slate-700 dark:text-slate-300">
              {new Date(date).toLocaleDateString()}
            </span>
          );
        },
      }),
      columnHelper.display({
        id: "members",
        header: t("masterData.teams.members"),
        cell: (info) => {
          const users = info.row.original.usersDetails?.filter(Boolean) ?? [];
          const count = users.length;
          return (
            <div className="flex items-center gap-2">
              <Badge variant="info">
                {count} {count === 1 ? t("masterData.teams.member") : t("masterData.teams.members")}
              </Badge>
              {count > 0 && (
                <div className="flex -space-x-1.5">
                  {users.slice(0, 3).map((user, i) => {
                    const name = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "?";
                    const initials = name
                      .split(/\s+/)
                      .map((w) => w[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase();
                    const colors = ["bg-blue-500", "bg-green-500", "bg-purple-500", "bg-amber-500"];
                    return (
                      <div
                        key={user?.id ?? i}
                        className={`flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-bold text-white ring-2 ring-white dark:ring-dark-bg ${colors[i % colors.length]}`}
                        title={name}
                      >
                        {initials}
                      </div>
                    );
                  })}
                  {count > 3 && (
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-[9px] font-bold text-slate-600 ring-2 ring-white dark:bg-dark-card dark:text-slate-300 dark:ring-dark-bg">
                      +{count - 3}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        },
      }),
      columnHelper.display({
        id: "status",
        header: t("common.status"),
        cell: (info) => {
          const team = info.row.original;
          const active = team.active;
          const isToggling = togglingIds.has(team.id);

          if (!canManageTeams) {
            return (
              <Badge variant={active ? "success" : "warning"}>
                {active ? t("userManagement.active") : t("userManagement.inactive")}
              </Badge>
            );
          }

          return (
            <button
              type="button"
              disabled={isToggling}
              onClick={async () => {
                setTogglingIds((prev) => new Set(prev).add(team.id));
                try {
                  await updateTeam({
                    variables: {
                      id: team.id,
                      input: { name: team.name ?? "", active: !active },
                    },
                  });
                  await refetchTeams();
                  toast.success(`Team ${!active ? "activated" : "deactivated"}`);
                } catch (err) {
                  logApiError("Toggle team active", err);
                  if (!isApolloGraphqlErrorAlreadyToastedGlobally(err)) {
                    toast.error(`Failed: ${err instanceof Error ? err.message : "Unknown error"}`);
                  }
                } finally {
                  setTogglingIds((prev) => {
                    const next = new Set(prev);
                    next.delete(team.id);
                    return next;
                  });
                }
              }}
              className="flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors rtl:[transform:scaleX(-1)] ${
                  active ? "bg-green-500" : "bg-slate-300 dark:bg-dark-elevated"
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white dark:bg-dark-surface transition-transform ${
                    active ? "translate-x-4" : "translate-x-0.5"
                  }`}
                />
              </div>
              <span className="text-xs text-slate-600 dark:text-slate-400">
                {active ? t("userManagement.active") : t("userManagement.inactive")}
              </span>
            </button>
          );
        },
      }),
      ...(canManageTeams
        ? [
            columnHelper.display({
              id: "actions",
              header: t("common.actions"),
              cell: (info) => {
                const team = info.row.original;
                return (
                  <TooltipProvider>
                    <div className="flex items-center gap-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={() => {
                              setEditTeam(team);
                              setWizardOpen(true);
                            }}
                            className="rounded-md p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:bg-dark-elevated dark:hover:bg-dark-hover"
                          >
                            <PencilIcon />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>{t("common.edit")}</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={() => {
                              setEditTeam(team);
                              setWizardOpen(true);
                            }}
                            className="rounded-md p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:bg-dark-elevated dark:hover:bg-dark-hover"
                          >
                            <Users size={16} />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>{t("masterData.teams.manageMembers")}</TooltipContent>
                      </Tooltip>
                    </div>
                  </TooltipProvider>
                );
              },
            }),
          ]
        : []),
    ],
    [t, canManageTeams, updateTeam, togglingIds, refetchTeams]
  );

  if (combinedError) {
    return (
      <div>
        <PageHeader title={t("masterData.teams.title")} />
        <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-red-800 dark:text-red-400">
          {t("common.error")}: {combinedError.message}
        </div>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title={t("masterData.teams.title")}
        subtitle={t("common.team", { count: teams.length })}
        actions={
          <div className="flex items-center gap-2">
            <TableFilters {...table.getFilterProps(filterFields)} />
            {canManageTeams && (
              <Button onClick={() => { setEditTeam(null); setWizardOpen(true); }}>
                {t("masterData.teams.addTeam", "Add Team")}
              </Button>
            )}
          </div>
        }
      />

      <PageContent>
        <TableFilterChips {...table.getChipProps(filterFields)} />

        <DataTable
          columns={columns}
          data={paginatedTeams}
          isLoading={isLoading}
          emptyMessage={t("masterData.teams.noResults")}
          pagination={
            <TablePagination
              currentPage={page}
              pageSize={pageSize}
              pageSizeOptions={[10, 25, 50]}
              totalCount={totalCount}
              hasNextPage={page < totalPages}
              hasPreviousPage={page > 1}
              onNextPage={() => setPage((p) => p + 1)}
              onPreviousPage={() => setPage((p) => p - 1)}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
              onFirstPage={() => setPage(1)}
              onLastPage={() => setPage(totalPages)}
            />
          }
        />

        <TeamWizard
          open={wizardOpen}
          onOpenChange={(o) => {
            setWizardOpen(o);
            if (!o) setEditTeam(null);
          }}
          team={editTeam}
          onSuccess={() => void refetchTeams()}
        />
      </PageContent>
    </>
  );
}
