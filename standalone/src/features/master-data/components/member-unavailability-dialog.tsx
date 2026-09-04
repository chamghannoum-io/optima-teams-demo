import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CalendarOff, Shuffle, Inbox, TriangleAlert } from "lucide-react";

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DateRangeCalendar,
  Input,
  Label,
  type DateRange,
} from "@optima/ui";

import type { MemberUnavailability, UnavailabilityResolution } from "../types.js";
import { formatDayMonthYear, unavailabilityRangesOverlap } from "../utils.js";
import { MemberUnavailabilityList } from "./member-unavailability-list.js";

export interface MemberUnavailabilityDialogProps {
  open: boolean;
  /** Display name of the member being flagged. */
  memberName: string;
  /** The member's existing active/upcoming windows, shown as a cancellable list. */
  existing?: MemberUnavailability[];
  onClose: () => void;
  /** Called once the supervisor confirms the period and picks a resolution. */
  onConfirm: (unavailability: MemberUnavailability, resolution: UnavailabilityResolution) => void;
  /** Cancels an existing window by its server id. */
  onCancelWindow?: (windowId: string) => void;
  /** Disables actions while a mutation is in flight. */
  saving?: boolean;
}

/**
 * Two-stage dialog to flag a team member as unavailable: pick a date range on
 * an inline calendar (first click = start, second click = end), then confirm
 * how the member's assigned items are handled. Existing windows are listed and
 * cancellable, and a range overlapping one blocks Continue before submit.
 * @example <MemberUnavailabilityDialog open memberName="Sara A." onClose={…} onConfirm={…} />
 */
export function MemberUnavailabilityDialog({
  open,
  memberName,
  existing = [],
  onClose,
  onConfirm,
  onCancelWindow,
  saving,
}: MemberUnavailabilityDialogProps) {
  const { t } = useTranslation("provider");
  const [stage, setStage] = useState<"dates" | "confirm">("dates");
  const [range, setRange] = useState<DateRange | undefined>(undefined);
  const [reason, setReason] = useState("");

  const startDate = range?.from;
  const endDate = range?.to ?? range?.from;
  const overlapsExisting =
    !!startDate &&
    !!endDate &&
    existing.some((window) => unavailabilityRangesOverlap({ startDate, endDate }, window));
  const canContinue = !!startDate && !!endDate && !overlapsExisting;

  const handleConfirm = (resolution: UnavailabilityResolution) => {
    if (!startDate || !endDate) return;
    onConfirm({ startDate, endDate, reason: reason.trim() || undefined }, resolution);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarOff size={18} />
            {t("masterData.teams.unavailabilityDialogTitle", "Manage Unavailability")}
          </DialogTitle>
          <DialogDescription>
            {stage === "dates"
              ? t("masterData.teams.unavailabilityDialogSubtitle", {
                  defaultValue: "Set the period during which {{name}} will be unavailable.",
                  name: memberName,
                })
              : t("masterData.teams.unavailabilityConfirmQuestion", {
                  defaultValue:
                    "What should happen to the work items assigned to {{name}} during this period?",
                  name: memberName,
                })}
          </DialogDescription>
        </DialogHeader>

        {stage === "dates" ? (
          <div className="px-6 space-y-4">
            <MemberUnavailabilityList
              unavailabilities={existing}
              onCancel={onCancelWindow}
              disabled={saving}
            />

            <div className="space-y-2">
              <Label>{t("masterData.teams.unavailabilityPeriod", "Unavailability Period")} *</Label>
              <DateRangeCalendar
                range={range}
                onRangeChange={setRange}
                highlightedRanges={existing.map((window) => ({
                  from: window.startDate,
                  to: window.endDate,
                }))}
              />
              <p className="text-center text-xs text-slate-500 dark:text-slate-400">
                {startDate && endDate
                  ? `${formatDayMonthYear(startDate)} – ${formatDayMonthYear(endDate)}`
                  : t(
                      "masterData.teams.unavailabilityRangeHint",
                      "Select a start date, then an end date."
                    )}
              </p>
            </div>

            {overlapsExisting && (
              <p className="flex items-start gap-2 rounded-md bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                <TriangleAlert className="mt-0.5 shrink-0" size={14} />
                {t(
                  "masterData.teams.unavailabilityOverlapWarning",
                  "These dates overlap an existing unavailability window. Cancel it above or pick different dates."
                )}
              </p>
            )}

            <div className="space-y-2">
              <Label htmlFor="unavailability-reason">
                {t("masterData.teams.unavailabilityReason", "Reason")}
              </Label>
              <Input
                id="unavailability-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={t(
                  "masterData.teams.unavailabilityReasonPlaceholder",
                  "e.g. annual leave"
                )}
              />
            </div>
          </div>
        ) : (
          <div className="px-6 space-y-3">
            <button
              type="button"
              onClick={() => handleConfirm("UNASSIGN")}
              className="flex w-full items-start gap-3 rounded-lg border border-slate-200 dark:border-dark-border p-3 text-start hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-900/10"
            >
              <Inbox className="mt-0.5 shrink-0 text-slate-500" size={18} />
              <span>
                <span className="block text-sm font-medium text-slate-900 dark:text-dark-text">
                  {t("masterData.teams.confirmUnassign", "Confirm and Unassign")}
                </span>
                <span className="block text-xs text-slate-500 dark:text-slate-400">
                  {t(
                    "masterData.teams.confirmUnassignHint",
                    "Move the member's assigned items to the unassigned bucket."
                  )}
                </span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => handleConfirm("REDISTRIBUTE")}
              className="flex w-full items-start gap-3 rounded-lg border border-slate-200 dark:border-dark-border p-3 text-start hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-900/10"
            >
              <Shuffle className="mt-0.5 shrink-0 text-slate-500" size={18} />
              <span>
                <span className="block text-sm font-medium text-slate-900 dark:text-dark-text">
                  {t("masterData.teams.confirmRedistribute", "Confirm and Redistribute")}
                </span>
                <span className="block text-xs text-slate-500 dark:text-slate-400">
                  {t(
                    "masterData.teams.confirmRedistributeHint",
                    "Redistribute the member's assigned items among available team members."
                  )}
                </span>
              </span>
            </button>
          </div>
        )}

        <DialogFooter>
          {stage === "dates" ? (
            <>
              <Button variant="outline" onClick={onClose}>
                {t("common.cancel", "Cancel")}
              </Button>
              <Button disabled={!canContinue || saving} onClick={() => setStage("confirm")}>
                {t("common.continue", "Continue")}
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => setStage("dates")}>
              {t("common.back", "Back")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
