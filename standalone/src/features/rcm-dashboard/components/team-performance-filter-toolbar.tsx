import { useTranslation } from "react-i18next";
import { Search, Table2, LayoutGrid, Grid3X3, Columns2, X } from "lucide-react";
import { cn } from "@/components/enhanced";
import {
  FILTER_CHIPS,
  type FilterKey,
  type GroupKey,
  type ViewMode,
} from "./team-performance-helpers";

interface Props {
  // Filter
  activeFilter: FilterKey;
  setActiveFilter: (key: FilterKey) => void;
  filterCounts: Record<FilterKey, number>;

  // Group-by
  groupBy: GroupKey;
  setGroupBy: (key: GroupKey) => void;

  // Search
  searchValue: string;
  setSearchValue: (v: string) => void;
  searchPending: boolean;

  // Compare
  compareMode: boolean;
  setCompareMode: (v: boolean) => void;
  closeCompare: () => void;
  compareCount: number;

  // View
  viewMode: ViewMode;
  setViewMode: (m: ViewMode) => void;
}

export function TeamPerformanceFilterToolbar({
  activeFilter,
  setActiveFilter,
  filterCounts,
  groupBy,
  setGroupBy,
  searchValue,
  setSearchValue,
  searchPending,
  compareMode,
  setCompareMode,
  closeCompare,
  compareCount,
  viewMode,
  setViewMode,
}: Props) {
  const { t } = useTranslation("provider");

  return (
    <div className="flex flex-wrap items-center gap-2 px-6 py-2 border-y border-slate-100 dark:border-dark-border/50 bg-slate-50/50 dark:bg-dark-card/30">
      {/* Filter chips */}
      <div className="flex flex-wrap items-center gap-1">
        {FILTER_CHIPS.map(({ key, labelKey, defaultLabel }) => {
          const on = activeFilter === key;
          const count = filterCounts[key];
          return (
            <button
              key={key}
              type="button"
              aria-pressed={on}
              onClick={() => setActiveFilter(key)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold transition-all",
                on
                  ? "border-primary bg-primary text-white shadow-sm"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-dark-border dark:bg-dark-surface dark:text-slate-300"
              )}
            >
              {t(labelKey, { defaultValue: defaultLabel })}
              <span
                className={cn(
                  "rounded-full px-1.5 text-[10px]",
                  on ? "bg-white/20" : "bg-slate-100 dark:bg-dark-card"
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Group-by */}
      <div className="flex items-center gap-1 ms-2">
        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {t("rcmDashboard.groupBy", { defaultValue: "Group" })}
        </label>
        <select
          value={groupBy}
          onChange={(e) => setGroupBy(e.target.value as GroupKey)}
          className="h-7 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 focus:border-primary focus:outline-none dark:border-dark-border dark:bg-dark-surface dark:text-slate-200"
        >
          <option value="none">{t("rcmDashboard.groupNone", { defaultValue: "None" })}</option>
          <option value="status">
            {t("rcmDashboard.groupStatus", { defaultValue: "Status" })}
          </option>
          <option value="load">{t("rcmDashboard.groupLoad", { defaultValue: "Load" })}</option>
        </select>
      </div>

      {/* Search */}
      <div className="relative ms-auto">
        <Search
          size={14}
          className={cn(
            "absolute left-3 top-1/2 -translate-y-1/2",
            searchPending
              ? "animate-pulse text-primary dark:text-primary-300"
              : "text-slate-400 dark:text-slate-500"
          )}
        />
        <input
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          placeholder={t("rcmDashboard.searchMember", { defaultValue: "Search member…" })}
          className="h-8 w-[220px] rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-xs text-slate-700 placeholder:text-slate-400 focus:border-primary focus:outline-none dark:border-dark-border dark:bg-dark-surface dark:text-slate-200"
        />
      </div>

      {/* Compare toggle */}
      {!compareMode ? (
        <button
          type="button"
          onClick={() => setCompareMode(true)}
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 dark:border-dark-border dark:bg-dark-surface dark:text-slate-300"
        >
          <Columns2 size={14} />
          {t("rcmDashboard.compare", { defaultValue: "Compare" })}
        </button>
      ) : (
        <button
          type="button"
          onClick={closeCompare}
          className="inline-flex items-center gap-1.5 rounded-md border border-primary bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary dark:text-primary-300"
        >
          <X size={14} />
          {t("rcmDashboard.exitCompare", { defaultValue: "Exit compare" })} ({compareCount})
        </button>
      )}

      {/* View mode */}
      <div className="inline-flex rounded-md border border-slate-200 bg-white p-0.5 dark:border-dark-border dark:bg-dark-surface">
        <button
          type="button"
          aria-pressed={viewMode === "table"}
          onClick={() => setViewMode("table")}
          className={cn(
            "inline-flex h-6 w-7 items-center justify-center rounded text-slate-500 transition-colors",
            viewMode === "table"
              ? "bg-primary/10 text-primary dark:text-primary-300"
              : "hover:bg-slate-100 dark:hover:bg-dark-card"
          )}
          title={t("rcmDashboard.viewTable", { defaultValue: "Table view" })}
        >
          <Table2 size={14} />
        </button>
        <button
          type="button"
          aria-pressed={viewMode === "cards"}
          onClick={() => setViewMode("cards")}
          className={cn(
            "inline-flex h-6 w-7 items-center justify-center rounded text-slate-500 transition-colors",
            viewMode === "cards"
              ? "bg-primary/10 text-primary dark:text-primary-300"
              : "hover:bg-slate-100 dark:hover:bg-dark-card"
          )}
          title={t("rcmDashboard.viewCards", { defaultValue: "Card view" })}
        >
          <LayoutGrid size={14} />
        </button>
        <button
          type="button"
          aria-pressed={viewMode === "heatmap"}
          onClick={() => setViewMode("heatmap")}
          className={cn(
            "inline-flex h-6 w-7 items-center justify-center rounded text-slate-500 transition-colors",
            viewMode === "heatmap"
              ? "bg-primary/10 text-primary dark:text-primary-300"
              : "hover:bg-slate-100 dark:hover:bg-dark-card"
          )}
          title={t("rcmDashboard.viewHeatmap", { defaultValue: "Heatmap view" })}
        >
          <Grid3X3 size={14} />
        </button>
      </div>
    </div>
  );
}
