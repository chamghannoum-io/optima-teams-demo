import { useState, useCallback } from "react";
import type { FilterFieldConfig } from "./table-filters.js";

export interface SortValue {
  field: string;
  direction: "ASC" | "DESC";
}

export interface PageInfo {
  hasNextPage?: boolean;
  hasPreviousPage?: boolean;
  endCursor?: string | null;
  startCursor?: string | null;
}

/**
 * Builds the `{ first, last, after, before }` variables for a Relay-style
 * cursor query, with a page-index fallback when no cursor is set yet.
 *
 * Cursor semantics (page positions, 0-indexed):
 * - `after` = position AFTER which to fetch = previous-page index
 *   (`currentPage - 2`, clamped to 0). Initial forward request → `after: "0"`.
 * - `before` = position BEFORE which to fetch = next-page index
 *   (`currentPage`). Jumping to the last page → `before: "<lastPage>"`.
 *
 * `currentPage` is 1-indexed to match the rest of the table state.
 */
export function buildCursorPaginationVariables(opts: {
  direction: "forward" | "backward";
  pageSize: number;
  currentPage: number;
  afterCursor?: string | null;
  beforeCursor?: string | null;
}): { first?: number; last?: number; after?: string; before?: string } {
  const { direction, pageSize, currentPage, afterCursor, beforeCursor } = opts;
  const previousPageIndex = String(Math.max(0, currentPage - 2));
  const nextPageIndex = String(Math.max(0, currentPage));
  const isForward = direction === "forward";
  return {
    first: isForward ? pageSize : undefined,
    last: isForward ? undefined : pageSize,
    after: isForward ? (afterCursor ?? previousPageIndex) : undefined,
    before: isForward ? undefined : (beforeCursor ?? nextPageIndex),
  };
}

interface UseFilterableTableOptions {
  defaultSort: SortValue;
  defaultPageSize?: number;
  pageSizeOptions?: number[];
  /** Filter values applied on mount. Cleared like any user-applied filter. */
  defaultFilterValues?: Record<string, unknown>;
}

export function useFilterableTable<TSortField extends string = string>(
  options: UseFilterableTableOptions
) {
  const [pageSize, setPageSize] = useState(options.defaultPageSize ?? 10);
  const [filterValues, setFilterValues] = useState<Record<string, unknown>>(
    () => options.defaultFilterValues ?? {}
  );
  const [sortBy, setSortBy] = useState<SortValue>(options.defaultSort);
  const [currentPage, setCurrentPage] = useState(1);
  const [afterCursor, setAfterCursor] = useState<string | undefined>();
  const [beforeCursor, setBeforeCursor] = useState<string | undefined>();
  const [direction, setDirection] = useState<"forward" | "backward">("forward");

  const {
    first: paginationFirst,
    last: paginationLast,
    after: currentAfter,
    before: currentBefore,
  } = buildCursorPaginationVariables({
    direction,
    pageSize,
    currentPage,
    afterCursor,
    beforeCursor,
  });
  const isLastPage = direction === "backward" && !beforeCursor;

  const resetPagination = useCallback(() => {
    setCurrentPage(1);
    setDirection("forward");
    setAfterCursor(undefined);
    setBeforeCursor(undefined);
  }, []);

  const applyFilters = useCallback((vals: Record<string, unknown>) => {
    setFilterValues(vals);
    setCurrentPage(1);
    setDirection("forward");
    setAfterCursor(undefined);
    setBeforeCursor(undefined);
  }, []);

  const clearFilters = useCallback(() => {
    setFilterValues({});
    setCurrentPage(1);
    setDirection("forward");
    setAfterCursor(undefined);
    setBeforeCursor(undefined);
  }, []);

  const applySort = useCallback((val: { field: string; direction: "ASC" | "DESC" }) => {
    setSortBy({ field: val.field, direction: val.direction });
    setCurrentPage(1);
    setDirection("forward");
    setAfterCursor(undefined);
    setBeforeCursor(undefined);
  }, []);

  const handleNextPage = useCallback((pageInfo: PageInfo | undefined | null) => {
    if (pageInfo?.endCursor) {
      setDirection("forward");
      setAfterCursor(pageInfo.endCursor);
      setBeforeCursor(undefined);
      setCurrentPage((prev) => prev + 1);
    }
  }, []);

  const handlePrevPage = useCallback((pageInfo: PageInfo | undefined | null) => {
    if (pageInfo?.startCursor) {
      setDirection("backward");
      setBeforeCursor(pageInfo.startCursor);
      setAfterCursor(undefined);
      setCurrentPage((prev) => prev - 1);
    }
  }, []);

  const handleFirstPage = useCallback(() => {
    setDirection("forward");
    setAfterCursor(undefined);
    setBeforeCursor(undefined);
    setCurrentPage(1);
  }, []);

  const handleLastPage = useCallback((totalPages: number) => {
    setDirection("backward");
    setAfterCursor(undefined);
    setBeforeCursor(undefined);
    setCurrentPage(totalPages);
  }, []);

  const handlePageSizeChange = useCallback((size: number) => {
    setPageSize(size);
    setCurrentPage(1);
    setDirection("forward");
    setAfterCursor(undefined);
    setBeforeCursor(undefined);
  }, []);

  return {
    // Raw state for building GraphQL variables
    pageSize,
    paginationFirst,
    paginationLast,
    filterValues,
    sortBy: sortBy as { field: TSortField; direction: "ASC" | "DESC" },
    currentAfter,
    currentBefore,
    currentPage,
    isLastPage,
    resetPagination,

    /**
     * Apply a full filter-values object directly (resets pagination) — for
     * quick facets rendered outside the filter modal, e.g. status chips.
     */
    applyFilters,
    /** Clear every applied filter (resets pagination). */
    clearFilters,

    // Prop spreader for <TableSort>
    getSortProps: (fields: { value: string; label: string }[]) => ({
      fields,
      value: sortBy,
      onChange: applySort,
    }),

    // Prop spreader for <TableFilters>
    getFilterProps: (
      fields: FilterFieldConfig[],
      labels?: {
        button?: string;
        title?: string;
        description?: string;
        apply?: string;
        clearAll?: string;
      }
    ) => ({
      fields,
      values: filterValues,
      hideChips: true as const,
      onApply: applyFilters,
      onClear: clearFilters,
      labels,
    }),

    // Prop spreader for <TableFilterChips>
    getChipProps: (fields: FilterFieldConfig[], maxVisible?: number) => ({
      fields,
      values: filterValues,
      maxVisible,
      onApply: applyFilters,
    }),

    // Prop spreader for <TablePagination>
    getPaginationProps: (totalCount: number, pageInfo: PageInfo | undefined | null) => {
      // When the backend doesn't expose a totalCount (value of 0/falsy), fall
      // back to the cursor-based pageInfo flags so Next/Prev still work.
      const hasTotal = totalCount > 0;
      const totalPages = hasTotal ? Math.ceil(totalCount / pageSize) : undefined;
      const hasNextPage = hasTotal
        ? currentPage < (totalPages as number)
        : Boolean(pageInfo?.hasNextPage);
      const hasPreviousPage = hasTotal
        ? currentPage > 1
        : currentPage > 1 || Boolean(pageInfo?.hasPreviousPage);
      return {
        currentPage,
        pageSize,
        pageSizeOptions: options.pageSizeOptions ?? [10, 25, 50],
        totalCount: hasTotal ? totalCount : undefined,
        hasNextPage,
        hasPreviousPage,
        onNextPage: () => handleNextPage(pageInfo),
        onPreviousPage: () => handlePrevPage(pageInfo),
        onPageSizeChange: handlePageSizeChange,
        onFirstPage: handleFirstPage,
        onLastPage: () => (totalPages != null ? handleLastPage(totalPages) : undefined),
      };
    },
  };
}
