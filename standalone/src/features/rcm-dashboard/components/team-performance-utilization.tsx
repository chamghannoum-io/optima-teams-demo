import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Skeleton,
} from "@/components/enhanced";
import {
  useQueueDashboardTeamMemberGridQuery,
  type QueueDashboardMemberRow,
} from "@/__generated__/graphql";
import {
  useQueueDashboardFilter,
  showsClaims,
  showsAuthorizations,
  showsResubmissions,
} from "../queue-dashboard-filter-context";
import { MemberDetailDrawer } from "./member-detail-drawer";
import { SortIcon } from "./team-performance-icons";
import { TeamPerformanceFilterToolbar } from "./team-performance-filter-toolbar";
import {
  TeamPerformanceKpiBoxes,
  OverlimitAlert,
  computeKpiTotals,
} from "./team-performance-kpi-boxes";
import { TeamPerformanceCardView } from "./team-performance-card-view";
import { TeamPerformanceHeatmapView } from "./team-performance-heatmap-view";
import { TeamPerformanceComparisonPanel } from "./team-performance-comparison-panel";
import { GroupTableRows } from "./team-performance-table";
import {
  applyFilter,
  applySort,
  computeFilterCounts,
  groupRows,
  MAX_COMPARE,
  PAGE_SIZE,
  type FilterKey,
  type GroupKey,
  type SortField,
  type ViewMode,
} from "./team-performance-helpers";

const SEARCH_DEBOUNCE_MS = 250;

export function TeamPerformanceUtilization() {
  const { t } = useTranslation("provider");
  const { graphqlFilter, filter } = useQueueDashboardFilter();

  // Column visibility — driven by the page-level workItemTypes chips
  const showClaimsCol = showsClaims(filter.workItemTypes);
  const showAuthsCol = showsAuthorizations(filter.workItemTypes);

  // Local UI state
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("totalAssigned");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [activeFilter, _setActiveFilter] = useState<FilterKey>("all");
  const [groupBy, _setGroupBy] = useState<GroupKey>("none");
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [drawerUserId, setDrawerUserId] = useState<string | null>(null);
  const [drawerUserName, setDrawerUserName] = useState<string>("");
  const [drawerRow, setDrawerRow] = useState<QueueDashboardMemberRow | null>(null);
  const [page, setPage] = useState(0);
  const [compareMode, setCompareMode] = useState(false);
  const [compareIds, setCompareIds] = useState<Set<string>>(new Set());

  // Reset pagination on filter/search/group changes
  const setActiveFilter = useCallback((k: FilterKey) => {
    _setActiveFilter(k);
    setPage(0);
  }, []);
  const setGroupBy = useCallback((k: GroupKey) => {
    _setGroupBy(k);
    setPage(0);
  }, []);

  // Debounce search
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(searchInput), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [searchInput]);

  // Reset pagination when search settles (adjust state during render)
  const [prevDebouncedSearch, setPrevDebouncedSearch] = useState(debouncedSearch);
  if (debouncedSearch !== prevDebouncedSearch) {
    setPrevDebouncedSearch(debouncedSearch);
    setPage(0);
  }

  const { data, loading } = useQueueDashboardTeamMemberGridQuery({
    variables: { filter: graphqlFilter },
  });

  const rows = useMemo(() => data?.queueDashboardTeamMemberGrid ?? [], [data]);

  // Resubs column — hide when filter excludes them OR every row is null
  const showResubsCol = useMemo(() => {
    if (!showsResubmissions(filter.workItemTypes)) return false;
    return rows.some(
      (r) => r.claimResubmissionsAssigned != null || r.authorizationResubmissionsAssigned != null
    );
  }, [rows, filter.workItemTypes]);

  // Filter chips operate on the full row set (so counts reflect totals)
  const filterCounts = useMemo(() => computeFilterCounts(rows), [rows]);

  // Pipeline: chip filter → search → sort → group → paginate
  const chipFiltered = useMemo(() => applyFilter(rows, activeFilter), [rows, activeFilter]);
  const searched = useMemo(() => {
    if (!debouncedSearch.trim()) return chipFiltered;
    const q = debouncedSearch.trim().toLowerCase();
    return chipFiltered.filter((r) =>
      ((r.userName ?? "") + " " + r.userId).toLowerCase().includes(q)
    );
  }, [chipFiltered, debouncedSearch]);
  const sorted = useMemo(
    () => applySort(searched, sortField, sortDir),
    [searched, sortField, sortDir]
  );

  // Pagination on the flat list (groups are derived from the paged slice)
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const paged = useMemo(
    () => sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [sorted, page]
  );
  const groups = useMemo(() => groupRows(paged, groupBy), [paged, groupBy]);

  // KPI totals
  const totals = useMemo(() => computeKpiTotals(rows), [rows]);

  // Compare
  const compareMembers = useMemo(
    () => rows.filter((r) => compareIds.has(r.userId)),
    [rows, compareIds]
  );
  const handleCompareToggle = useCallback((id: string) => {
    setCompareIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < MAX_COMPARE) next.add(id);
      return next;
    });
  }, []);
  const closeCompare = useCallback(() => {
    setCompareMode(false);
    setCompareIds(new Set());
  }, []);

  // Sort handlers
  const handleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortField(field);
        setSortDir("desc");
      }
    },
    [sortField]
  );

  const renderSortHeader = (field: SortField, label: string, align: "left" | "right" = "right") => (
    <button
      type="button"
      className={`inline-flex items-center hover:text-slate-700 dark:hover:text-slate-200 ${
        align === "right" ? "ml-auto" : ""
      }`}
      onClick={() => handleSort(field)}
    >
      {label}
      <SortIcon dir={sortField === field ? sortDir : null} />
    </button>
  );

  const openDrawer = (row: QueueDashboardMemberRow) => {
    setDrawerUserId(row.userId);
    setDrawerUserName(row.userName?.trim() || row.userId);
    setDrawerRow(row);
  };

  const searchPending = searchInput !== debouncedSearch;

  if (loading && rows.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle>{t("rcmDashboard.teamPerformanceUtilization")}</CardTitle>
        </CardHeader>
        <CardContent>
          {/* KPI boxes row */}
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex flex-col gap-2 rounded-xl border border-slate-200 p-3 dark:border-dark-border"
              >
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-7 w-20" />
              </div>
            ))}
          </div>
          {/* Toolbar */}
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-8 w-24" />
            <Skeleton className="ms-auto h-8 w-28" />
          </div>
          {/* Member rows */}
          <div className="flex flex-col gap-2">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 dark:border-dark-border"
              >
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-2.5 w-20" />
                </div>
                <Skeleton className="h-3 w-10" />
                <Skeleton className="h-3 w-10" />
                <Skeleton className="h-3 w-10" />
                <Skeleton className="h-3 w-10" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <CardTitle>{t("rcmDashboard.teamPerformanceUtilization")}</CardTitle>
            <span className="text-xs text-slate-400 dark:text-slate-500">
              {sorted.length} {t("rcmDashboard.members", { defaultValue: "members" })}
            </span>
          </div>

          <TeamPerformanceKpiBoxes totals={totals} />
          <OverlimitAlert count={totals.overlimitCount} />
        </CardHeader>

        <TeamPerformanceFilterToolbar
          activeFilter={activeFilter}
          setActiveFilter={setActiveFilter}
          filterCounts={filterCounts}
          groupBy={groupBy}
          setGroupBy={setGroupBy}
          searchValue={searchInput}
          setSearchValue={setSearchInput}
          searchPending={searchPending}
          compareMode={compareMode}
          setCompareMode={setCompareMode}
          closeCompare={closeCompare}
          compareCount={compareIds.size}
          viewMode={viewMode}
          setViewMode={setViewMode}
        />

        <CardContent className="pt-0">
          {sorted.length === 0 ? (
            <EmptyState title={t("common.noData")} className="py-6" />
          ) : viewMode === "cards" ? (
            <TeamPerformanceCardView
              groups={groups}
              showGroupHeader={groupBy !== "none"}
              compareMode={compareMode}
              compareIds={compareIds}
              onToggleCompare={handleCompareToggle}
              onSelectMember={openDrawer}
              showClaimsCol={showClaimsCol}
              showAuthsCol={showAuthsCol}
              showResubsCol={showResubsCol}
            />
          ) : viewMode === "heatmap" ? (
            <TeamPerformanceHeatmapView
              rows={sorted}
              onSelectMember={openDrawer}
              showClaimsCol={showClaimsCol}
              showAuthsCol={showAuthsCol}
              showResubsCol={showResubsCol}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs font-medium uppercase tracking-wide text-slate-500 dark:border-dark-border dark:text-slate-400">
                    {compareMode && <th className="w-[40px] pb-2 pe-2" />}
                    <th className="pb-2 pe-3 font-medium">
                      {renderSortHeader("userName", t("rcmDashboard.member"), "left")}
                    </th>
                    {showClaimsCol && (
                      <th className="pb-2 pe-3 text-right font-medium">
                        {renderSortHeader("claimsAssigned", t("rcmDashboard.claims"))}
                      </th>
                    )}
                    {showAuthsCol && (
                      <th className="pb-2 pe-3 text-right font-medium">
                        {renderSortHeader(
                          "authorizationsAssigned",
                          t("rcmDashboard.authorizations")
                        )}
                      </th>
                    )}
                    {showResubsCol && (
                      <th className="pb-2 pe-3 text-right font-medium">
                        {renderSortHeader("resubmissionsAssigned", t("rcmDashboard.resubmissions"))}
                      </th>
                    )}
                    <th className="pb-2 pe-3 text-right font-medium">
                      {renderSortHeader("totalAssigned", t("rcmDashboard.assigned"))}
                    </th>
                    <th className="pb-2 pe-3 text-right font-medium">
                      {renderSortHeader(
                        "completed",
                        t("rcmDashboard.completedLabel", { defaultValue: "Completed" })
                      )}
                    </th>
                    <th className="pb-2 pe-3 text-right font-medium">
                      {renderSortHeader(
                        "overdue",
                        t("rcmDashboard.overdueLabel", { defaultValue: "Overdue" })
                      )}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map((group) => (
                    <GroupTableRows
                      key={group.key}
                      group={group}
                      showHeader={groupBy !== "none"}
                      compareMode={compareMode}
                      compareIds={compareIds}
                      onToggleCompare={handleCompareToggle}
                      onSelectMember={openDrawer}
                      showClaimsCol={showClaimsCol}
                      showAuthsCol={showAuthsCol}
                      showResubsCol={showResubsCol}
                    />
                  ))}
                </tbody>
              </table>

              {/* Pulse hint while debounce settles */}
              {searchPending && (
                <p className="mt-2 text-[10px] text-slate-400 dark:text-slate-500 animate-pulse">
                  {t("rcmDashboard.searchSettling", { defaultValue: "Updating results…" })}
                </p>
              )}

              {totalPages > 1 && (
                <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-dark-border">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {t("rcmDashboard.page", { defaultValue: "Page" })} {page + 1}{" "}
                    {t("rcmDashboard.of", { defaultValue: "of" })} {totalPages}
                  </p>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={page === 0}
                      onClick={() => setPage((p) => p - 1)}
                      className="rounded-md border border-slate-200 px-2.5 py-1 text-xs text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-dark-border dark:bg-dark-card dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      &larr;
                    </button>
                    <button
                      type="button"
                      disabled={page >= totalPages - 1}
                      onClick={() => setPage((p) => p + 1)}
                      className="rounded-md border border-slate-200 px-2.5 py-1 text-xs text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-dark-border dark:bg-dark-card dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      &rarr;
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {compareMode && compareIds.size >= 2 && (
        <TeamPerformanceComparisonPanel
          members={compareMembers}
          onClose={closeCompare}
          showClaimsCol={showClaimsCol}
          showAuthsCol={showAuthsCol}
          showResubsCol={showResubsCol}
        />
      )}

      <MemberDetailDrawer
        open={drawerUserId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDrawerUserId(null);
            setDrawerUserName("");
            setDrawerRow(null);
          }
        }}
        userId={drawerUserId}
        userName={drawerUserName}
        row={drawerRow}
      />
    </>
  );
}
