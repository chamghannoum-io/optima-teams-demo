import { useState, type ReactNode } from "react";
import { motion } from "motion/react";
import { cn } from "./utils.js";
import { Input } from "./input.js";
import { Button } from "./button.js";
import { Badge } from "./badge.js";
import { AdvancedFilterModal } from "./advanced-filter-modal.js";
import type {
  AdvancedFilterSection,
  AdvancedFilterValues,
  AdvancedFilterSearchMode,
} from "./advanced-filter-modal.js";

/**
 * ListPanel — Cortex Design System (SKILL 5.38)
 *
 * Sidebar panel for list/detail views. 3 variants:
 *
 * default:  Width 320px, search + filter + sort + view toggle + item count
 * compact:  Width 240px, px-4 py-3 header, optional search, scrollable children
 * mini:     Width 192px, px-3 py-2 header, uppercase title text-[10px], scrollable children
 *
 * All animate width + opacity via motion.div (0.3s easeInOut).
 * All have border-r + bg-white dark:bg-dark-surface.
 */

// ── Shared props (compact / mini / simple default) ──

export interface ListPanelProps {
  variant?: "default" | "compact" | "mini";
  title: string;
  subtitle?: string;
  count?: number;
  countClassName?: string;
  headerIcon?: ReactNode;
  headerActions?: ReactNode;
  children: ReactNode;
  width?: number;
  isCollapsed?: boolean;
  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  footer?: ReactNode;
  className?: string;
  /** Filter sections for AdvancedFilterModal (default variant only) */
  filterSections?: AdvancedFilterSection[];
  /** Current filter values (default variant only) */
  filterValues?: AdvancedFilterValues;
  /** Filter search mode (default variant only) */
  filterSearchMode?: AdvancedFilterSearchMode;
  /** Callback when filters applied (default variant only) */
  onApplyFilters?: (values: AdvancedFilterValues) => void;
  /** Active filter chips to display [{key, label}] */
  activeFilters?: Array<{ key: string; label: string; value: string }>;
  /** Remove a single filter */
  onRemoveFilter?: (key: string) => void;
  /** Sort label shown in footer */
  sortLabel?: string;
  /** Sort toggle callback */
  onSortToggle?: () => void;
  /** Item count for count bar */
  itemCount?: number;
  /** Label for count bar (e.g. "Providers") */
  countLabel?: string;
  /** Current view mode */
  viewMode?: "list" | "table";
  /** View mode change */
  onViewModeChange?: (mode: "list" | "table") => void;
  /** Content for table view mode */
  tableContent?: ReactNode;
}

const DEFAULT_WIDTH = {
  default: 320,
  compact: 240,
  mini: 192,
} as const;

/* ─── Mini Variant ─── */

function MiniPanel({
  title,
  count,
  countClassName,
  children,
  width,
  isCollapsed = false,
  className,
}: ListPanelProps) {
  const w = width ?? DEFAULT_WIDTH.mini;

  return (
    <motion.div
      initial={false}
      animate={{ width: isCollapsed ? 0 : w, opacity: isCollapsed ? 0 : 1 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className={cn(
        "border-r border-slate-200 dark:border-[#2A3141]",
        "bg-white dark:bg-[#111827]",
        "flex flex-col h-full overflow-hidden shrink-0",
        className
      )}
    >
      <div className="flex flex-col h-full" style={{ width: w }}>
        <div className="px-3 py-2 border-b border-slate-100 dark:border-[#2A3141]/50 flex items-center justify-between shrink-0">
          <span className="text-xs font-medium text-slate-900 dark:text-[#E2E8F0]">{title}</span>
          {count !== undefined && (
            <span
              className={cn(
                "px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-slate-100 dark:bg-[#1A2234] text-slate-500 dark:text-[#94A3B8]",
                countClassName
              )}
            >
              {count}
            </span>
          )}
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </motion.div>
  );
}

/* ─── Compact Variant ─── */

function CompactPanel({
  title,
  subtitle,
  count,
  countClassName,
  headerIcon,
  children,
  width,
  isCollapsed = false,
  search,
  onSearchChange,
  searchPlaceholder = "Search...",
  className,
}: ListPanelProps) {
  const w = width ?? DEFAULT_WIDTH.compact;

  return (
    <motion.div
      initial={false}
      animate={{ width: isCollapsed ? 0 : w, opacity: isCollapsed ? 0 : 1 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className={cn(
        "border-r border-slate-200 dark:border-[#2A3141]",
        "bg-white dark:bg-[#111827]",
        "flex flex-col h-full overflow-hidden shrink-0",
        className
      )}
    >
      <div className="flex flex-col h-full" style={{ width: w }}>
        <div className="px-4 py-3 border-b border-slate-100 dark:border-[#2A3141]/50 flex flex-col gap-2 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {headerIcon}
              <span className="text-xs font-bold text-slate-900 dark:text-[#E2E8F0]">{title}</span>
            </div>
            {count !== undefined && (
              <span
                className={cn(
                  "px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-slate-100 dark:bg-[#1A2234] text-slate-500 dark:text-[#94A3B8]",
                  countClassName
                )}
              >
                {count}
              </span>
            )}
          </div>
          {subtitle && (
            <span className="text-[10px] text-slate-400 dark:text-[#64748B] font-medium">
              {subtitle}
            </span>
          )}
          {search !== undefined && onSearchChange && (
            <Input
              type="text"
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              className="h-7 text-[10px]"
            />
          )}
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </motion.div>
  );
}

/* ─── Default (Full) Variant ─── */

function DefaultPanel({
  title,
  subtitle,
  count,
  headerIcon,
  headerActions,
  children,
  width,
  isCollapsed = false,
  search,
  onSearchChange,
  searchPlaceholder = "Search",
  footer,
  className,
  // Filter props
  filterSections,
  filterValues,
  onApplyFilters,
  activeFilters,
  onRemoveFilter,
  // Sort props
  sortLabel,
  onSortToggle,
  // Count bar
  itemCount,
  countLabel,
  // View toggle
  viewMode = "list",
  onViewModeChange,
  tableContent,
  filterSearchMode,
}: ListPanelProps) {
  const w = width ?? DEFAULT_WIDTH.default;
  const [filterOpen, setFilterOpen] = useState(false);
  const hasFilters = !!filterSections && filterSections.length > 0;
  const hasActiveFilters = !!activeFilters && activeFilters.length > 0;

  return (
    <motion.div
      initial={false}
      animate={{
        width: isCollapsed && viewMode !== "table" ? 0 : viewMode === "table" ? "100%" : w,
        opacity: isCollapsed && viewMode !== "table" ? 0 : 1,
      }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className={cn(
        "border-r border-slate-200 dark:border-[#2A3141]",
        "bg-white dark:bg-[#111827]",
        "flex flex-col h-full overflow-hidden shrink-0",
        className
      )}
    >
      <div
        className={cn("flex flex-col h-full", viewMode === "table" ? "w-full" : "")}
        style={viewMode !== "table" ? { width: w } : undefined}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-[#2A3141] shrink-0">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2.5">
              {headerIcon}
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-900 dark:text-[#E2E8F0]">
                    {title}
                  </span>
                  {count !== undefined && (
                    <span className="px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-slate-100 dark:bg-[#1A2234] text-slate-500 dark:text-[#94A3B8]">
                      {count}
                    </span>
                  )}
                </div>
                {subtitle && (
                  <span className="text-xs text-slate-500 dark:text-[#94A3B8]">{subtitle}</span>
                )}
              </div>
            </div>
            {headerActions}
          </div>

          {/* Search + Filter trigger */}
          {search !== undefined && onSearchChange && (
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <svg
                  className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-[#64748B]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <Input
                  type="text"
                  placeholder={searchPlaceholder}
                  value={search}
                  onChange={(e) => onSearchChange(e.target.value)}
                  className="pl-9 pr-9"
                />
                {hasFilters && (
                  <button
                    type="button"
                    onClick={() => setFilterOpen(true)}
                    className={cn(
                      "absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded transition-colors",
                      hasActiveFilters
                        ? "text-[#2D3670] dark:text-[#a5b1db]"
                        : "text-slate-400 dark:text-[#64748B] hover:text-slate-600 dark:hover:text-[#94A3B8]"
                    )}
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                      />
                    </svg>
                  </button>
                )}
              </div>
              {headerActions}
            </div>
          )}

          {/* Active filter chips */}
          {hasActiveFilters && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {activeFilters!.map((f) => (
                <Badge key={f.key} variant="info" className="gap-1 pl-2 text-[10px]">
                  {f.label}: {f.value}
                  {onRemoveFilter && (
                    <button
                      type="button"
                      onClick={() => onRemoveFilter(f.key)}
                      className="ml-0.5 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full hover:bg-blue-200 dark:hover:bg-blue-800"
                    >
                      <svg
                        className="h-2.5 w-2.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  )}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {viewMode === "table" && tableContent ? (
            <div className="w-full overflow-auto p-5">{tableContent}</div>
          ) : (
            <div className="flex flex-col">
              {/* Item count bar */}
              {itemCount !== undefined && countLabel && (
                <div className="px-5 py-2 text-[10px] font-bold text-[#2D3670] dark:text-[#a5b1db] uppercase tracking-wider flex justify-between items-center bg-slate-50 dark:bg-[#151C28] border-b border-slate-200 dark:border-[#2A3141] shrink-0">
                  <span>
                    {itemCount} {countLabel}
                  </span>
                </div>
              )}
              <div className="flex flex-col">{children}</div>
            </div>
          )}
        </div>

        {/* Footer — Sort + View Toggle */}
        {(sortLabel || onViewModeChange || footer) && (
          <div className="p-4 border-t border-slate-200 dark:border-[#2A3141] bg-slate-50 dark:bg-[#151C28] flex items-center justify-between shrink-0">
            {footer ?? (
              <>
                {sortLabel && onSortToggle ? (
                  <Button variant="ghost" size="sm" onClick={onSortToggle}>
                    <svg
                      className="h-3.5 w-3.5 mr-1"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
                      />
                    </svg>
                    Sort by {sortLabel}
                  </Button>
                ) : (
                  <div />
                )}
                {onViewModeChange && (
                  <div className="flex items-center rounded-lg border border-slate-200 dark:border-[#2A3141] p-0.5">
                    <button
                      type="button"
                      onClick={() => onViewModeChange("list")}
                      className={cn(
                        "p-1 rounded-md transition-all",
                        viewMode === "list"
                          ? "bg-[#2D3670] text-white shadow-sm"
                          : "text-slate-400 dark:text-[#64748B] hover:text-slate-600"
                      )}
                    >
                      <svg
                        className="h-3.5 w-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 6h16M4 12h16M4 18h16"
                        />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => onViewModeChange("table")}
                      className={cn(
                        "p-1 rounded-md transition-all",
                        viewMode === "table"
                          ? "bg-[#2D3670] text-white shadow-sm"
                          : "text-slate-400 dark:text-[#64748B] hover:text-slate-600"
                      )}
                    >
                      <svg
                        className="h-3.5 w-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M3 10h18M3 14h18M10 3v18M14 3v18"
                        />
                      </svg>
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Filter modal */}
      {hasFilters && filterValues && onApplyFilters && (
        <AdvancedFilterModal
          isOpen={filterOpen}
          onClose={() => setFilterOpen(false)}
          sections={filterSections!}
          initialValues={filterValues}
          onApply={onApplyFilters}
          searchMode={filterSearchMode}
        />
      )}
    </motion.div>
  );
}

/* ─── Dispatcher ─── */

export function ListPanel(props: ListPanelProps) {
  if (props.variant === "mini") return <MiniPanel {...props} />;
  if (props.variant === "compact") return <CompactPanel {...props} />;
  return <DefaultPanel {...props} />;
}
