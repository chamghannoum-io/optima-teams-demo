import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ArrowDown, ArrowUp, GripVertical, MapPin, X } from "lucide-react";

import { cn, Label } from "@optima/ui";
import type { IBaseOption } from "@optima/shared";

import { useDragReorder } from "../hooks/use-drag-reorder.js";
import { moveItem } from "../utils.js";

export interface TeamBranchAllocationProps {
  /** Selected branches/facilities in their current allocation order. */
  branches: IBaseOption[];
  /** Called with the full list whenever a branch is reordered or removed. */
  onChange: (branches: IBaseOption[]) => void;
  /** Marks the section label with a required asterisk. */
  required?: boolean;
  /** The branch picker control (e.g. ApiAutocomplete) rendered inside the section. */
  children: ReactNode;
  className?: string;
}

/**
 * Single "Branches & Allocation Order" section: a picker slot to add branches
 * plus a numbered list where rows are drag-and-drop reorderable (arrow buttons
 * as keyboard fallback) and removable inline.
 * @example
 * <TeamBranchAllocation branches={selected} onChange={setSelected} required>
 *   <ApiAutocomplete … multiple />
 * </TeamBranchAllocation>
 */
export function TeamBranchAllocation({
  branches,
  onChange,
  required = false,
  children,
  className,
}: TeamBranchAllocationProps) {
  const { t } = useTranslation("provider");
  const drag = useDragReorder(branches, onChange);

  const removeBranch = (key: string) => onChange(branches.filter((b) => b.key !== key));

  return (
    <div
      className={cn(
        "rounded-lg border border-slate-200 dark:border-dark-border p-4 space-y-3",
        className
      )}
    >
      <div className="space-y-0.5">
        <Label>
          {t("masterData.teams.branchesAllocation", "Branches & Allocation Order")}
          {required && " *"}
        </Label>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {t(
            "masterData.teams.allocationOrderHint",
            "Add branches, then drag rows to set the allocation priority — work is allocated in the order listed."
          )}
        </p>
      </div>

      {children}

      {branches.length === 0 ? (
        <div className="rounded-md border border-dashed border-slate-200 dark:border-dark-border p-4 text-center">
          <MapPin className="mx-auto mb-1 text-slate-300 dark:text-slate-600" size={20} />
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t(
              "masterData.teams.noBranchesSelected",
              "No branches added yet. Use the field above to add branches."
            )}
          </p>
        </div>
      ) : (
        <ol className="rounded-md border border-slate-200 dark:border-dark-border">
          {branches.map((branch, index) => (
            <li
              key={branch.key}
              draggable
              onDragStart={() => drag.handleDragStart(index)}
              onDragEnter={() => drag.handleDragEnter(index)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => event.preventDefault()}
              onDragEnd={drag.handleDragEnd}
              className={cn(
                "flex items-center gap-2 px-2 py-2 border-b border-slate-100 dark:border-dark-border last:border-b-0 transition-colors",
                drag.dragIndex === index
                  ? "bg-blue-50 dark:bg-blue-900/20 opacity-70"
                  : "bg-transparent hover:bg-slate-50 dark:hover:bg-dark-hover"
              )}
            >
              <span
                title={t("masterData.teams.dragToReorder", "Drag to reorder")}
                className="cursor-grab active:cursor-grabbing text-slate-400 dark:text-slate-500"
              >
                <GripVertical size={14} />
              </span>
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-dark-elevated text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                {index + 1}
              </span>
              <span className="flex-1 truncate text-sm text-slate-900 dark:text-dark-text">
                {branch.label}
              </span>
              <button
                type="button"
                onClick={() => onChange(moveItem(branches, index, "up"))}
                disabled={index === 0}
                aria-label={t("masterData.teams.moveUp", "Move up")}
                className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30 disabled:hover:bg-transparent dark:text-slate-400 dark:hover:bg-dark-hover dark:hover:text-slate-200"
              >
                <ArrowUp size={14} />
              </button>
              <button
                type="button"
                onClick={() => onChange(moveItem(branches, index, "down"))}
                disabled={index === branches.length - 1}
                aria-label={t("masterData.teams.moveDown", "Move down")}
                className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30 disabled:hover:bg-transparent dark:text-slate-400 dark:hover:bg-dark-hover dark:hover:text-slate-200"
              >
                <ArrowDown size={14} />
              </button>
              <button
                type="button"
                onClick={() => removeBranch(branch.key)}
                aria-label={t("masterData.teams.removeBranch", "Remove branch")}
                className="rounded-md p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400"
              >
                <X size={14} />
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
