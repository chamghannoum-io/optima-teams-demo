import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  type Row,
  type RowSelectionState,
  useReactTable,
} from "@tanstack/react-table";
import { useState } from "react";
import { motion } from "motion/react";
import { cn } from "./utils";
import { DataTableEmpty } from "./data-table-empty";
import { Skeleton } from "./skeleton";

export interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  isLoading?: boolean;
  emptyMessage?: string;
  emptyDescription?: string;
  onRowClick?: (row: TData) => void;
  stickyHeader?: boolean;
  stripedRows?: boolean;
  compactMode?: boolean;
  className?: string;
  /**
   * Enable row selection for every row, or pass a predicate to allow it per row —
   * ineligible rows then report `row.getCanSelect() === false` and are skipped by the
   * select-all handler.
   */
  enableRowSelection?: boolean | ((row: Row<TData>) => boolean);
  rowSelection?: RowSelectionState;
  onRowSelectionChange?: (
    updaterOrValue: RowSelectionState | ((old: RowSelectionState) => RowSelectionState)
  ) => void;
  getRowId?: (row: TData, index: number) => string;
  /** Header background variant: "filled" (default, grey bg) or "plain" (white bg) */
  headerVariant?: "filled" | "plain";
  /**
   * Pins the last column (typically row actions) to the trailing edge of the
   * horizontal scroll container, so actions stay reachable while wide tables
   * scroll. Pinned cells paint an opaque surface and a start-side border to
   * separate them from the content scrolling underneath.
   */
  pinLastColumn?: boolean;
  /** Pagination slot rendered inside the same card container below the table */
  pagination?: React.ReactNode;
  /**
   * Drops the card surface (background, radius, shadow) so the table can sit inside a container
   * that already provides one — e.g. a `CardShell` section. A card nested in a card reads as two
   * panels and doubles the shadow, which is why this is a surface switch rather than a `className`
   * override at each call site.
   */
  embedded?: boolean;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  isLoading = false,
  emptyMessage = "No data available",
  emptyDescription = "Try adjusting your filters or search criteria",
  onRowClick,
  stickyHeader = false,
  stripedRows: _stripedRows = false,
  compactMode = false,
  className,
  enableRowSelection = false,
  rowSelection = {},
  onRowSelectionChange,
  getRowId,
  headerVariant = "filled",
  pinLastColumn = false,
  pagination,
  embedded = false,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    enableRowSelection,
    onRowSelectionChange,
    getRowId,
    state: {
      sorting,
      rowSelection,
    },
  });

  const cellPy = compactMode ? "py-3" : "py-4";
  // Embedded tables inherit the surface of the card they sit in; standalone ones bring their own.
  const surfaceClass = embedded
    ? "w-full overflow-hidden"
    : "w-full overflow-hidden rounded-xl bg-white dark:bg-dark-surface shadow-custom";
  const headerBg =
    headerVariant === "filled"
      ? "bg-slate-50 dark:bg-dark-surface"
      : "bg-white dark:bg-dark-surface";

  if (isLoading) {
    const skeletonWidths = ["w-10", "w-3/4", "w-2/3", "w-1/2", "w-1/3", "w-2/5", "w-3/5"];
    return (
      <div className={cn(surfaceClass, className)}>
        <div className="overflow-x-auto">
          <table className="w-full text-start border-collapse" data-testid="table-list">
            <thead className={cn(headerBg, "border-b border-slate-200 dark:border-dark-border")}>
              <tr>
                {columns.map((_, idx) => (
                  <th key={idx} className={cn("px-3 text-start", cellPy)}>
                    <Skeleton className="h-3 w-20 rounded" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 8 }).map((_, rowIdx) => (
                <tr key={rowIdx} className="border-b border-slate-100 dark:border-dark-border/50">
                  {columns.map((_, colIdx) => (
                    <td key={colIdx} className={cn("px-3", cellPy)}>
                      <Skeleton
                        className={cn(
                          "h-3.5 rounded",
                          skeletonWidths[(rowIdx + colIdx) % skeletonWidths.length]
                        )}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {pagination}
      </div>
    );
  }

  if (!data.length) {
    return (
      <div className={cn(surfaceClass, className)}>
        <DataTableEmpty message={emptyMessage} description={emptyDescription} embedded={embedded} />
      </div>
    );
  }

  return (
    <div className={cn(surfaceClass, className)}>
      <div className="overflow-x-auto">
        <table className="w-full text-start border-collapse" data-testid="table-list">
          <thead
            className={cn(
              headerBg,
              "border-b border-slate-200 dark:border-dark-border",
              stickyHeader && "sticky top-0 z-10"
            )}
          >
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header, headerIdx) => (
                  <th
                    key={header.id}
                    colSpan={header.colSpan}
                    style={
                      header.column.columnDef.minSize
                        ? { minWidth: header.column.columnDef.minSize }
                        : undefined
                    }
                    className={cn(
                      "px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap",
                      cellPy,
                      header.column.getCanSort() &&
                        "cursor-pointer select-none hover:text-slate-700 dark:hover:text-slate-300",
                      pinLastColumn &&
                        headerIdx === headerGroup.headers.length - 1 &&
                        cn(
                          "sticky end-0 z-10 border-s border-slate-200 dark:border-dark-border",
                          headerBg
                        )
                    )}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <div className="flex items-center gap-1">
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getIsSorted() && (
                        <span className="text-primary dark:text-primary-300">
                          {header.column.getIsSorted() === "desc" ? (
                            <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                              <path
                                fillRule="evenodd"
                                d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                                clipRule="evenodd"
                              />
                            </svg>
                          ) : (
                            <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                              <path
                                fillRule="evenodd"
                                d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z"
                                clipRule="evenodd"
                              />
                            </svg>
                          )}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row, rowIdx) => (
              <motion.tr
                key={row.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.25,
                  delay: Math.min(rowIdx * 0.03, 0.3),
                  ease: "easeOut",
                }}
                className={cn(
                  "border-b border-slate-100 dark:border-dark-border/50 transition-colors group",
                  "hover:bg-slate-50/50 dark:hover:bg-dark-hover/50",
                  row.getIsSelected() && "bg-primary/5",
                  onRowClick && "cursor-pointer"
                )}
                onClick={() => onRowClick?.(row.original)}
              >
                {row.getVisibleCells().map((cell, cellIdx, visibleCells) => (
                  <td
                    key={cell.id}
                    style={
                      cell.column.columnDef.minSize
                        ? { minWidth: cell.column.columnDef.minSize }
                        : undefined
                    }
                    className={cn(
                      "px-3 text-sm text-slate-700 dark:text-slate-300",
                      cellPy,
                      pinLastColumn &&
                        cellIdx === visibleCells.length - 1 &&
                        cn(
                          "sticky end-0 border-s border-slate-100 dark:border-dark-border/50",
                          // Pinned cells need an opaque surface (content scrolls
                          // underneath) that follows the row's hover/selected tint.
                          "bg-white dark:bg-dark-surface group-hover:bg-slate-50 dark:group-hover:bg-dark-hover",
                          row.getIsSelected() && "bg-primary/5"
                        )
                    )}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
      {pagination}
    </div>
  );
}
