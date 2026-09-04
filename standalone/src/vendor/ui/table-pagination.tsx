import { cn } from "./utils.js";
import { useI18n } from "@optima/i18n";
import { ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from "lucide-react";

/**
 * TablePagination — Cortex Design System (SKILL §5.15)
 *
 * MUST be rendered inside the same card container as <DataTable>.
 * Uses border-t to stitch visually to the table above.
 *
 * Container: flex items-center justify-between px-6 py-4 bg-white dark:bg-dark-surface border-t
 * Left:  "{t("common.rowsPerPage")}" + Select (w-20) + "Showing X-Y of Z"
 * Right: First/Prev/Next/Last buttons (h-8 w-8) + "Page X of Y"
 */

interface TablePaginationProps {
  currentPage: number;
  pageSize: number;
  pageSizeOptions?: number[];
  totalCount?: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  onNextPage: () => void;
  onPreviousPage: () => void;
  onPageSizeChange: (size: number) => void;
  onFirstPage?: () => void;
  onLastPage?: () => void;
}

export function TablePagination({
  currentPage,
  pageSize,
  pageSizeOptions = [10, 25, 50, 100],
  totalCount,
  hasNextPage,
  hasPreviousPage,
  onNextPage,
  onPreviousPage,
  onPageSizeChange,
  onFirstPage,
  onLastPage,
}: TablePaginationProps) {
  const t = useI18n();
  const rangeStart = (currentPage - 1) * pageSize + 1;
  const rangeEnd =
    totalCount != null ? Math.min(currentPage * pageSize, totalCount) : currentPage * pageSize;

  const totalPages = totalCount != null ? Math.ceil(totalCount / pageSize) : undefined;
  const isFirstPage = currentPage <= 1;
  const isLastPage = totalPages != null ? currentPage >= totalPages : !hasNextPage;

  const navBtn = cn(
    "inline-flex items-center justify-center p-1 h-8 w-8 rounded-lg transition-all",
    "text-slate-400 dark:text-slate-500",
    "hover:bg-slate-50 dark:hover:bg-dark-hover hover:text-slate-600 dark:hover:text-slate-300",
    "disabled:opacity-30 disabled:pointer-events-none"
  );

  return (
    <nav
      aria-label="Table pagination"
      className={cn(
        "flex items-center justify-between px-4 py-3",
        "bg-white dark:bg-[#111827]",
        "border-t border-slate-200 dark:border-[#2A3141]"
      )}
    >
      {/* Left: Rows per page + showing range */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500 dark:text-slate-400 font-medium whitespace-nowrap">
            {t("common.rowsPerPage")}
          </label>
          <div className="w-20">
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className={cn(
                "h-[40px] w-full pl-4 pr-10 appearance-none rounded-lg text-xs",
                "bg-white dark:bg-dark-surface",
                "border border-slate-200 dark:border-dark-border",
                "text-slate-900 dark:text-dark-text",
                "hover:border-slate-300 dark:hover:border-slate-600",
                "focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/10"
              )}
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
        </div>

        {totalCount != null && (
          <span
            className="text-xs text-slate-500 dark:text-slate-400 font-medium"
            aria-live="polite"
          >
            {t("common.showing")}{" "}
            <span className="text-slate-900 dark:text-dark-text font-semibold">
              {rangeStart}–{rangeEnd}
            </span>{" "}
            {t("common.of")}{" "}
            <span className="text-slate-900 dark:text-dark-text font-semibold">
              {totalCount.toLocaleString()}
            </span>
          </span>
        )}
      </div>

      {/* Right: Navigation buttons */}
      <div className="flex items-center gap-2" role="group" aria-label="Page navigation">
        <div className="flex items-center gap-1">
          {onFirstPage && (
            <button
              type="button"
              disabled={isFirstPage}
              onClick={onFirstPage}
              className={navBtn}
              aria-label={t("common.firstPage")}
            >
              <ChevronsLeft size={16} strokeWidth={2} />
            </button>
          )}
          <button
            type="button"
            disabled={!hasPreviousPage}
            onClick={onPreviousPage}
            className={navBtn}
            aria-label={t("common.previousPage")}
          >
            <ChevronLeft size={16} strokeWidth={2} />
          </button>
        </div>

        <div className="flex items-center gap-1 px-2">
          <span className="text-xs text-slate-500 dark:text-slate-400">{t("common.page")}</span>
          <span className="text-xs font-bold text-slate-900 dark:text-dark-text">
            {currentPage}
          </span>
          {totalPages != null && (
            <>
              <span className="text-xs text-slate-500 dark:text-slate-400">{t("common.of")}</span>
              <span className="text-xs font-bold text-slate-900 dark:text-dark-text">
                {totalPages}
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={!hasNextPage}
            onClick={onNextPage}
            className={navBtn}
            aria-label={t("common.nextPage")}
          >
            <ChevronRight size={16} strokeWidth={2} />
          </button>
          {onLastPage && (
            <button
              type="button"
              disabled={isLastPage}
              onClick={onLastPage}
              className={navBtn}
              aria-label={t("common.lastPage")}
            >
              <ChevronsRight size={16} strokeWidth={2} />
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
