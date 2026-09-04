import { useState, type ReactNode } from "react";
import { Badge } from "./badge.js";

// ── Types ─────────────────────────────────────────────────────────────────

export interface ItemCardProps {
  /** Item code (e.g. CPT code) */
  code?: string | null;
  /** Item description */
  display?: string | null;
  /** Item type (e.g. "Service", "Medication") */
  type?: string | null;
  /** Number of edits on this item */
  editCount: number;
  /** Whether to show a selection checkbox */
  selectable?: boolean;
  /** Whether this item is selected */
  selected?: boolean;
  /** Called when selection toggles */
  onToggleSelect?: () => void;
  /** Whether to start collapsed (default: collapsed if no edits) */
  defaultCollapsed?: boolean;
  /** Edit cards to render inside the collapsible body */
  children?: ReactNode;
}

// ── Component ─────────────────────────────────────────────────────────────

export function ItemCard({
  code,
  display,
  type,
  editCount,
  selectable = false,
  selected = false,
  onToggleSelect,
  defaultCollapsed,
  children,
}: ItemCardProps) {
  const hasEdits = editCount > 0;
  const [collapsed, setCollapsed] = useState(defaultCollapsed ?? !hasEdits);

  return (
    <div
      className={`rounded-lg border p-4 ${
        hasEdits
          ? "border-red-200 bg-red-50/30 dark:border-red-800/50 dark:bg-red-950/10"
          : "border-green-200 bg-green-50/30 dark:border-green-800/50 dark:bg-green-950/10"
      } ${selected ? "ring-2 ring-indigo-400 ring-offset-1 dark:ring-indigo-600" : ""}`}
    >
      {/* Item header */}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            {selectable && (
              <input
                type="checkbox"
                checked={selected}
                onChange={onToggleSelect}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
            )}
            <span className="font-mono text-xs font-semibold text-gray-900 dark:text-gray-100">
              {code}
            </span>
            {type && (
              <Badge variant="default" className="py-0 text-[10px]">
                {type}
              </Badge>
            )}
            {hasEdits ? (
              <span className="inline-flex items-center rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-900/40 dark:text-red-400">
                {editCount} edit{editCount > 1 ? "s" : ""}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-900/40 dark:text-green-400">
                <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
                No Edits
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">{display}</p>
        </div>

        {/* Collapse toggle — only shown when there are edits to expand */}
        {/* {hasEdits && ( */}
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className="ml-2 rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700"
          >
            <svg
              className={`h-4 w-4 transition-transform duration-200 ${collapsed ? "" : "rotate-180"}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        {/* )} */}
      </div>

      {/* Collapsible body */}
      <div
        className={`transition-all duration-200 ${
          collapsed ? "max-h-0 overflow-hidden opacity-0" : "max-h-[5000px] opacity-100"
        }`}
      >
        {hasEdits && children ? (
          <div className="mt-3 space-y-2 border-t border-gray-200 pt-3 dark:border-gray-700">
            {children}
          </div>
        ) : null}
      </div>
    </div>
  );
}
