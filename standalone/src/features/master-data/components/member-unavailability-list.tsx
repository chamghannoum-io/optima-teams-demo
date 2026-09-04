import { useTranslation } from "react-i18next";
import { CalendarOff, X } from "lucide-react";

import { Button, cn } from "@optima/ui";

import type { MemberUnavailability } from "../types.js";
import { formatDayMonthYear } from "../utils.js";

export interface MemberUnavailabilityListProps {
  /** The member's active and upcoming windows, soonest first; renders nothing when empty. */
  unavailabilities: MemberUnavailability[];
  /** Cancels a window by its server id (member back early / entered by mistake). */
  onCancel?: (windowId: string) => void;
  /** Disables the cancel actions while a mutation is in flight. */
  disabled?: boolean;
  className?: string;
}

/**
 * Read-only list of a member's scheduled unavailability windows with a
 * per-window cancel action; shown inside the manage-unavailability dialog.
 * @example <MemberUnavailabilityList unavailabilities={windows} onCancel={cancelWindow} />
 */
export function MemberUnavailabilityList({
  unavailabilities,
  onCancel,
  disabled,
  className,
}: MemberUnavailabilityListProps) {
  const { t } = useTranslation("provider");
  if (unavailabilities.length === 0) return null;

  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
        {t("masterData.teams.scheduledUnavailability", "Scheduled unavailability")}
      </p>
      <ul className="space-y-1.5">
        {unavailabilities.map((window, index) => {
          const windowId = window.id;
          return (
            <li
              key={windowId ?? index}
              className="flex items-center justify-between gap-2 rounded-md bg-amber-50 dark:bg-amber-900/20 px-3 py-2"
            >
              <div className="flex items-start gap-2 min-w-0">
                <CalendarOff
                  className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400"
                  size={14}
                />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                    {formatDayMonthYear(window.startDate)} – {formatDayMonthYear(window.endDate)}
                  </p>
                  {window.reason && (
                    <p className="truncate text-xs text-amber-700/80 dark:text-amber-400/80">
                      {window.reason}
                    </p>
                  )}
                </div>
              </div>
              {onCancel && windowId && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={disabled}
                  onClick={() => onCancel(windowId)}
                  className="shrink-0 text-amber-700 hover:text-amber-900 dark:text-amber-400"
                  title={t("masterData.teams.markAsAvailable", "Mark as Available")}
                >
                  <span className="sr-only">
                    {t("masterData.teams.markAsAvailable", "Mark as Available")}
                  </span>
                  <X size={14} />
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
