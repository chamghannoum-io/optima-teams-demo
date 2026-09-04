import { useTranslation } from "react-i18next";
import { CalendarOff } from "lucide-react";

import { Badge, cn } from "@optima/ui";

import type { MemberUnavailability } from "../types.js";
import { formatDayMonthYear } from "../utils.js";

export interface MemberUnavailabilityIndicatorProps {
  /** The member's active or upcoming window; renders nothing when absent. */
  unavailability?: MemberUnavailability | null;
  /** True when the server flags the member as unavailable today. */
  unavailableToday: boolean;
  className?: string;
}

/**
 * Per-member unavailability indicator: amber "Unavailable until …" while the
 * window covers today, neutral "Unavailable {start} – {end}" for an upcoming one.
 * @example <MemberUnavailabilityIndicator unavailability={window} unavailableToday />
 */
export function MemberUnavailabilityIndicator({
  unavailability,
  unavailableToday,
  className,
}: MemberUnavailabilityIndicatorProps) {
  const { t } = useTranslation("provider");
  if (!unavailability) return null;

  const start = formatDayMonthYear(unavailability.startDate);
  const end = formatDayMonthYear(unavailability.endDate);
  const label = unavailableToday
    ? t("masterData.teams.unavailableUntil", {
        defaultValue: "Unavailable until {{date}}",
        date: end,
      })
    : start === end
      ? t("masterData.teams.unavailableOn", {
          defaultValue: "Unavailable on {{date}}",
          date: start,
        })
      : t("masterData.teams.unavailablePeriod", {
          defaultValue: "Unavailable {{start}} – {{end}}",
          start,
          end,
        });

  return (
    <Badge
      variant={unavailableToday ? "warning" : "default"}
      className={cn("inline-flex items-center gap-1 whitespace-nowrap", className)}
      title={unavailability.reason}
    >
      <CalendarOff size={12} className="shrink-0" />
      {label}
    </Badge>
  );
}
