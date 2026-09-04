import * as React from "react";
import { DayPicker, getDefaultClassNames, type DateRange } from "react-day-picker";
import { cn } from "./utils.js";
import "react-day-picker/style.css";

export type { DateRange };

export interface DateRangeCalendarProps {
  /** Currently selected range; `from` is set on the first click, `to` on the second. */
  range?: DateRange;
  /** Called with the updated range on every day click (range-selection semantics). */
  onRangeChange?: (range: DateRange | undefined) => void;
  /** Earliest selectable day; days before it are disabled. */
  fromDate?: Date;
  /** Date ranges tinted on the calendar (e.g. already-booked windows). */
  highlightedRanges?: DateRange[];
  /** Months rendered side by side (default 1). */
  numberOfMonths?: number;
  className?: string;
}

/**
 * Inline calendar for picking a date range: the first click sets the start
 * date, the second sets the end date, and clicking a day before the start
 * restarts the range from that day.
 * @example <DateRangeCalendar range={range} onRangeChange={setRange} fromDate={new Date()} />
 */
export function DateRangeCalendar({
  range,
  onRangeChange,
  fromDate,
  highlightedRanges,
  numberOfMonths = 1,
  className,
}: DateRangeCalendarProps) {
  const defaults = getDefaultClassNames();
  return (
    <div
      className={cn(
        "w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-dark-surface px-3 py-2.5",
        className
      )}
    >
      <DayPicker
        mode="range"
        selected={range}
        onSelect={(next) => onRangeChange?.(normalizeRange(next))}
        numberOfMonths={numberOfMonths}
        disabled={fromDate ? { before: fromDate } : undefined}
        modifiers={highlightedRanges?.length ? { highlighted: highlightedRanges } : undefined}
        modifiersClassNames={{
          highlighted:
            "bg-amber-100 dark:bg-amber-900/40 text-amber-900 dark:text-amber-300 font-semibold",
        }}
        style={calendarStyle}
        classNames={{
          // Stretch the month grid to the container so the calendar fills its host
          months: `${defaults.months} w-full max-w-full`,
          month: `${defaults.month} w-full`,
          month_grid: `${defaults.month_grid} w-full table-fixed`,
          month_caption: `${defaults.month_caption} px-1`,
          caption_label: `${defaults.caption_label} text-sm font-bold text-gray-900 dark:text-gray-100`,
          weekday: `${defaults.weekday} text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500`,
          today: `${defaults.today} font-semibold`,
        }}
      />
    </div>
  );
}

/**
 * Pin the selected days to local 12:00 instead of 00:00 so callers that
 * serialize to YYYY-MM-DD can't shift a day across timezones (matches the
 * behavior of DatePicker's normalizeToLocalNoon).
 */
function normalizeRange(range: DateRange | undefined): DateRange | undefined {
  if (!range) return undefined;
  return { from: toLocalNoon(range.from), to: toLocalNoon(range.to) };
}

function toLocalNoon(date: Date | undefined): Date | undefined {
  if (!date) return undefined;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0);
}

const calendarStyle = {
  "--rdp-accent-color": "#2563eb",
  "--rdp-accent-background-color": "#dbeafe",
  "--rdp-day_button-border-radius": "0.5rem",
  // Fluid cells: the grid is table-fixed w-full, buttons fill their cell so the
  // range band renders as one continuous strip edge to edge
  "--rdp-day-width": "auto",
  "--rdp-day-height": "40px",
  "--rdp-day_button-width": "100%",
  "--rdp-day_button-height": "36px",
  "--rdp-nav_button-height": "2rem",
  "--rdp-nav_button-width": "2rem",
  "--rdp-nav-height": "2.25rem",
  "--rdp-weekday-padding": "0.4rem 0",
  fontSize: "0.875rem",
} as React.CSSProperties;
