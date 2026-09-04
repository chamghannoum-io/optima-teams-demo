import * as React from "react";
import { format, setMonth, setYear } from "date-fns";
import { DayPicker, getDefaultClassNames } from "react-day-picker";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { cn } from "./utils.js";
import { isRTL, useI18n } from "@optima/i18n";
import "react-day-picker/style.css";

export interface DatePickerProps {
  date?: Date;
  onDateChange?: (date: Date | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** When true, shows month and year dropdowns for quick selection (e.g. Date of Birth). */
  dateOfBirth?: boolean;
  /** When true, shows month and year dropdowns (jump selection) instead of month-by-month navigation. */
  showMonthYearDropdowns?: boolean;
  error?: string;
  /** When true, shows a clear button when a date is selected. */
  clearable?: boolean;
  /**
   * When true, the trigger becomes an editable text field so the date can be typed
   * directly (DD/MM/YYYY) in addition to being picked from the calendar. The calendar
   * icon still opens the picker.
   */
  typeable?: boolean;
  /** data-testid for the trigger button */
  triggerTestId?: string;
  /** react-hook-form field path; emitted as `data-rhf-field` on the trigger for scroll-to-error lookups. */
  name?: string;
}

const DOB_START_YEAR = 120;
const DOB_DEFAULT_YEAR_OFFSET = 30;
const DEFAULT_START_YEAR = 1900;
const DEFAULT_END_YEAR_OFFSET = 20;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const TYPEABLE_PLACEHOLDER = "DD/MM/YYYY";
/** Digit widths of the day / month / year segments (DD/MM/YYYY). */
const SEG_W = [2, 2, 4] as const;
type Segs = [string, string, string];

type PickerView = "days" | "months" | "years";

export function DatePicker({
  date,
  onDateChange,
  placeholder = "Pick a date",
  disabled,
  className,
  dateOfBirth = false,
  showMonthYearDropdowns = true,
  error,
  clearable = false,
  typeable = false,
  triggerTestId,
  name,
}: DatePickerProps) {
  // subscribes to languageChanged so isRTL() re-evaluates on language switch
  const t = useI18n();
  const resolvedPlaceholder =
    placeholder === "Pick a date"
      ? t("common.pickDate", { defaultValue: "Pick a date" })
      : placeholder;
  const [open, setOpen] = React.useState(false);
  const now = new Date();

  const minYear = dateOfBirth ? now.getFullYear() - DOB_START_YEAR : DEFAULT_START_YEAR;
  const maxYear = dateOfBirth ? now.getFullYear() : now.getFullYear() + DEFAULT_END_YEAR_OFFSET;

  const defaultMonth =
    date ??
    (dateOfBirth
      ? new Date(now.getFullYear() - DOB_DEFAULT_YEAR_OFFSET, now.getMonth(), 1)
      : undefined);

  const [displayMonth, setDisplayMonth] = React.useState<Date>(defaultMonth ?? now);
  const [view, setView] = React.useState<PickerView>("days");
  const [yearPageStart, setYearPageStart] = React.useState(
    Math.floor((displayMonth ?? now).getFullYear() / 12) * 12
  );

  // Reset view when popover opens
  React.useEffect(() => {
    if (open) {
      setView("days");
      const m = date ?? defaultMonth ?? now;
      setDisplayMonth(m);
      setYearPageStart(Math.floor(m.getFullYear() / 12) * 12);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const enableCustomNav = dateOfBirth || showMonthYearDropdowns;

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDateChange?.(undefined);
  };

  // ── Typeable (manual, segment-isolated entry) ───────────────────────────
  // The field is edited as three independent segments — day / month / year.
  // Editing one segment can never shift digits into another because each is
  // stored on its own; the masked string is only a rendering of the three
  // (OPTIMA-3656). `activeSeg` controls when the "/" separators appear so a
  // partly-typed date still shows the segment the caret is heading into.
  const isTypingRef = React.useRef(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  // Selection (start/end char offsets) to restore after React re-renders the
  // masked value — also used to highlight a whole segment on focus/click.
  const pendingSelectionRef = React.useRef<{ start: number; end: number } | null>(null);
  // When set, that segment is "selected"; the next digit replaces it wholesale
  // instead of overtyping a single digit within it (native date-field feel).
  const freshSegRef = React.useRef<number | null>(null);
  const [segs, setSegs] = React.useState<Segs>(() => (date ? dateToSegs(date) : ["", "", ""]));
  const [activeSeg, setActiveSeg] = React.useState(0);
  const [typedError, setTypedError] = React.useState<string | undefined>(undefined);
  const todayNoon = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0, 0);

  const displayValue = segsToDisplay(segs, activeSeg);

  // Re-rendering the controlled value resets the DOM caret; restore the intended
  // caret/selection here, after the value is committed to the DOM.
  React.useLayoutEffect(() => {
    if (pendingSelectionRef.current && inputRef.current) {
      const { start, end } = pendingSelectionRef.current;
      inputRef.current.setSelectionRange(start, end);
      pendingSelectionRef.current = null;
    }
  });

  // Keep the segments in sync with the selected date (calendar pick / parent
  // change), but never clobber what the user is actively typing.
  React.useEffect(() => {
    if (!isTypingRef.current) {
      setSegs(date ? dateToSegs(date) : ["", "", ""]);
      setActiveSeg(0);
      setTypedError(undefined);
    }
  }, [date]);

  /**
   * Validate the three segments and, when they form a complete valid date,
   * propagate it. `commit` (blur/Enter) surfaces the "incomplete" message; while
   * typing an incomplete value stays quiet so the user isn't nagged. Bad
   * day/month and future/out-of-range dates flag immediately. A value that fails
   * validation never propagates — the committed date is cleared so a stale value
   * can't sit behind a visible error.
   */
  const applySegs = (next: Segs, commit: boolean) => {
    const [d, m, y] = next;
    if (!d && !m && !y) {
      setTypedError(undefined);
      onDateChange?.(undefined);
      return;
    }
    const day = d ? parseInt(d, 10) : undefined;
    const month = m ? parseInt(m, 10) : undefined;
    const year = y.length === 4 ? parseInt(y, 10) : undefined;
    if (day !== undefined && (day < 1 || day > 31)) {
      setTypedError("Enter a valid day (01–31)");
      onDateChange?.(undefined);
      return;
    }
    if (month !== undefined && (month < 1 || month > 12)) {
      setTypedError("Enter a valid month (01–12)");
      onDateChange?.(undefined);
      return;
    }
    // Day-of-month: once the month is known, reject a day it can't have (e.g.
    // 31/04 or 30/02). February needs the year for leap-year accuracy, so while
    // the year is still incomplete it's treated leniently (max 29).
    if (day !== undefined && month !== undefined && day > daysInMonth(month, year)) {
      setTypedError("Enter a valid day");
      onDateChange?.(undefined);
      return;
    }
    const complete = d.length === 2 && m.length === 2 && y.length === 4;
    if (!complete) {
      setTypedError(commit ? `Enter a valid date (${TYPEABLE_PLACEHOLDER})` : undefined);
      onDateChange?.(undefined);
      return;
    }
    const noon = new Date(year!, month! - 1, day!, 12, 0, 0, 0);
    if (dateOfBirth && noon > todayNoon) {
      setTypedError("Date of birth can't be in the future");
      onDateChange?.(undefined);
      return;
    }
    if (year! < minYear || year! > maxYear) {
      setTypedError(`Enter a year between ${minYear} and ${maxYear}`);
      onDateChange?.(undefined);
      return;
    }
    setTypedError(undefined);
    onDateChange?.(noon);
    setDisplayMonth(noon);
  };

  // Commit edited segments to state, position the caret, and validate. When a
  // segment fills, focus advances to (and selects) the next one so left-to-right
  // typing flows; otherwise the caret sits just after the edited digit.
  const commitSegs = (next: Segs, seg: number, intra: number) => {
    if (intra === SEG_W[seg]! && seg < 2) {
      const nextSeg = seg + 1;
      freshSegRef.current = nextSeg;
      const start = segStartChar(next, nextSeg);
      pendingSelectionRef.current = { start, end: start + next[nextSeg]!.length };
      setActiveSeg((prev) => Math.max(prev, nextSeg));
    } else {
      freshSegRef.current = null;
      const pos = segStartChar(next, seg) + intra;
      pendingSelectionRef.current = { start: pos, end: pos };
      setActiveSeg((prev) => Math.max(prev, seg));
    }
    setSegs(next);
    applySegs(next, false);
  };

  // Highlight a whole segment (native date-field behaviour): the next digit then
  // replaces it rather than overtyping one digit inside it.
  const selectSegment = (seg: number) => {
    freshSegRef.current = seg;
    setActiveSeg((prev) => Math.max(prev, seg));
    const start = segStartChar(segs, seg);
    pendingSelectionRef.current = { start, end: start + segs[seg]!.length };
  };

  // In typeable mode, live typing feedback takes precedence over the caller's
  // error (e.g. a form's "Required") so the specific message shows as you type;
  // it falls back to the caller's error once the typed value is clean.
  const activeError = typeable ? (typedError ?? error) : error;

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      {typeable ? (
        <PopoverPrimitive.Anchor asChild>
          <div
            className={cn(
              "flex h-[40px] w-full items-center rounded-lg border bg-white dark:bg-dark-surface px-4 text-xs text-slate-900 dark:text-dark-text transition-all duration-300",
              "focus-within:border-primary focus-within:ring-primary/10 focus-within:ring-1 focus-within:outline-none",
              activeError
                ? "border-red-500 focus-within:border-red-500 focus-within:ring-red-500/10"
                : "border-slate-200 dark:border-dark-border hover:border-slate-300 dark:hover:border-slate-600",
              disabled &&
                "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-400 dark:border-dark-border dark:bg-dark-bg",
              className
            )}
          >
            <input
              ref={inputRef}
              type="text"
              inputMode="numeric"
              maxLength={10}
              disabled={disabled}
              aria-invalid={activeError ? true : undefined}
              data-testid={triggerTestId}
              data-rhf-field={name}
              value={displayValue}
              placeholder={TYPEABLE_PLACEHOLDER}
              className="min-w-0 flex-1 bg-transparent text-xs text-slate-900 dark:text-dark-text outline-none placeholder:text-[11px] placeholder:text-slate-300 disabled:cursor-not-allowed dark:placeholder:text-slate-600"
              onChange={(e) => {
                // Reached only via paste / autofill / IME — plain keystrokes are
                // handled in onKeyDown (which preventDefaults). Rebuild the
                // segments from the raw digits.
                const digits = e.target.value.replace(/\D/g, "").slice(0, 8);
                const next: Segs = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)];
                const active = next[2] ? 2 : next[1] ? 1 : 0;
                freshSegRef.current = null;
                setSegs(next);
                setActiveSeg(active);
                const pos = segsToDisplay(next, active).length;
                pendingSelectionRef.current = { start: pos, end: pos };
                applySegs(next, false);
              }}
              onFocus={() => {
                isTypingRef.current = true;
              }}
              onClick={() => {
                const el = inputRef.current;
                if (!el) return;
                const caret = el.selectionStart ?? 0;
                // Only snap on a plain click; leave a user's drag-selection alone.
                if ((el.selectionEnd ?? caret) !== caret) return;
                selectSegment(locateSeg(segs, activeSeg, caret).seg);
              }}
              onBlur={() => {
                isTypingRef.current = false;
                freshSegRef.current = null;
                // Pad a single-digit day/month on the way out ("5" → "05").
                const padded: Segs = [
                  segs[0] ? segs[0].padStart(2, "0") : "",
                  segs[1] ? segs[1].padStart(2, "0") : "",
                  segs[2],
                ];
                if (padded[0] !== segs[0] || padded[1] !== segs[1]) setSegs(padded);
                applySegs(padded, true);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  applySegs(segs, true);
                  return;
                }
                // Let shortcuts / navigation (copy, paste, select-all, arrows)
                // fall through to the browser.
                if (e.metaKey || e.ctrlKey || e.altKey) return;

                const el = e.currentTarget;
                const selStart = el.selectionStart ?? 0;
                const selEnd = el.selectionEnd ?? selStart;
                const hasRange = selStart !== selEnd;
                const wholeSelected = hasRange && selStart === 0 && selEnd === displayValue.length;

                if (/^[0-9]$/.test(e.key)) {
                  e.preventDefault();
                  const next: Segs = [segs[0], segs[1], segs[2]];
                  // Select-all → start a fresh date from the typed digit.
                  if (wholeSelected) {
                    commitSegs([e.key, "", ""], 0, 1);
                    return;
                  }
                  // A range (segment double-clicked / snapped) → replace that
                  // segment; other segments are untouched.
                  if (hasRange) {
                    const seg = locateSeg(segs, activeSeg, selStart).seg;
                    next[seg] = e.key;
                    commitSegs(next, seg, 1);
                    return;
                  }
                  const { seg, intra } = locateSeg(segs, activeSeg, selStart);
                  const w = SEG_W[seg]!;
                  const cur = segs[seg]!;
                  // A click-selected segment: the first digit replaces it.
                  if (freshSegRef.current === seg) {
                    next[seg] = e.key;
                    commitSegs(next, seg, 1);
                    return;
                  }
                  if (intra < cur.length) {
                    // Overtype a digit in place — stays within this segment.
                    next[seg] = cur.slice(0, intra) + e.key + cur.slice(intra + 1);
                    commitSegs(next, seg, intra + 1);
                    return;
                  }
                  if (cur.length < w) {
                    // Append while the segment is still filling.
                    next[seg] = cur + e.key;
                    commitSegs(next, seg, cur.length + 1);
                    return;
                  }
                  // Segment full with caret at its end → flow into the next one.
                  if (seg < 2) {
                    next[seg + 1] = e.key;
                    commitSegs(next, seg + 1, 1);
                  }
                  return;
                }

                if (e.key === "Backspace" || e.key === "Delete") {
                  e.preventDefault();
                  const next: Segs = [segs[0], segs[1], segs[2]];
                  if (wholeSelected) {
                    commitSegs(["", "", ""], 0, 0);
                    return;
                  }
                  // Clear just the highlighted segment; neighbours stay put.
                  if (hasRange) {
                    const seg = locateSeg(segs, activeSeg, selStart).seg;
                    next[seg] = "";
                    commitSegs(next, seg, 0);
                    return;
                  }
                  const { seg, intra } = locateSeg(segs, activeSeg, selStart);
                  const cur = segs[seg]!;
                  if (e.key === "Backspace") {
                    if (intra > 0) {
                      next[seg] = cur.slice(0, intra - 1) + cur.slice(intra);
                      commitSegs(next, seg, intra - 1);
                    } else if (seg > 0) {
                      // At a segment start → trim the previous segment's last digit.
                      next[seg - 1] = segs[seg - 1]!.slice(0, -1);
                      commitSegs(next, seg - 1, next[seg - 1]!.length);
                    }
                  } else if (intra < cur.length) {
                    next[seg] = cur.slice(0, intra) + cur.slice(intra + 1);
                    commitSegs(next, seg, intra);
                  } else if (seg < 2) {
                    next[seg + 1] = segs[seg + 1]!.slice(1);
                    commitSegs(next, seg + 1, 0);
                  }
                  return;
                }

                // Swallow any other printable character (letters, punctuation).
                if (e.key.length === 1) e.preventDefault();
              }}
            />
            <div className="ms-auto flex items-center gap-1 ps-1">
              {clearable && date && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="rounded p-0.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-dark-hover dark:hover:text-slate-300"
                >
                  <svg
                    className="h-3.5 w-3.5"
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
              <PopoverPrimitive.Trigger asChild>
                <button
                  type="button"
                  disabled={disabled}
                  aria-label="Open calendar"
                  className="rounded p-0.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-500 dark:hover:bg-dark-hover dark:hover:text-slate-300"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                </button>
              </PopoverPrimitive.Trigger>
            </div>
          </div>
        </PopoverPrimitive.Anchor>
      ) : null}
      {!typeable && (
        <PopoverPrimitive.Trigger asChild>
          <button
            type="button"
            disabled={disabled}
            data-testid={triggerTestId}
            data-rhf-field={name}
            className={cn(
              "flex h-[40px] w-full items-center justify-between rounded-lg border bg-white dark:bg-dark-surface px-4 text-xs text-slate-900 dark:text-dark-text transition-all duration-300",
              "focus:border-primary focus:ring-primary/10 focus:ring-1 focus:outline-none",
              "disabled:cursor-not-allowed disabled:border-slate-100 disabled:bg-slate-50 disabled:text-slate-400 dark:disabled:border-dark-border dark:disabled:bg-dark-bg",
              error
                ? "border-red-500 focus:border-red-500 focus:ring-red-500/10"
                : "border-slate-200 dark:border-dark-border hover:border-slate-300 dark:hover:border-slate-600",
              !date && "text-[11px] text-slate-300 dark:text-slate-600",
              className
            )}
          >
            <span className="flex-1 truncate text-start">
              {date ? format(date, "PPP") : resolvedPlaceholder}
            </span>
            <div className="ms-auto flex items-center gap-1">
              {clearable && date && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="rounded p-0.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-dark-hover dark:hover:text-slate-300"
                >
                  <svg
                    className="h-3.5 w-3.5"
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
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
          </button>
        </PopoverPrimitive.Trigger>
      )}
      {/* One message for both modes — a red border alone leaves the reader guessing. */}
      {activeError && (
        <p className="mt-1 px-1 text-xs text-red-600 dark:text-red-400">{activeError}</p>
      )}
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          className="z-[1000] w-auto rounded-xl border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-surface p-3 shadow-custom outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
          align={isRTL() ? "end" : "start"}
          sideOffset={4}
        >
          {enableCustomNav && view === "months" ? (
            <MonthGrid
              displayMonth={displayMonth}
              onSelectMonth={(month) => {
                setDisplayMonth(setMonth(displayMonth, month));
                setView("days");
              }}
              onShowYears={() => setView("years")}
            />
          ) : enableCustomNav && view === "years" ? (
            <YearGrid
              pageStart={yearPageStart}
              selectedYear={displayMonth.getFullYear()}
              minYear={minYear}
              maxYear={maxYear}
              onSelectYear={(year) => {
                setDisplayMonth(setYear(displayMonth, year));
                setView("months");
              }}
              onPageChange={setYearPageStart}
            />
          ) : (
            <DayPicker
              mode="single"
              selected={date}
              month={enableCustomNav ? displayMonth : undefined}
              onMonthChange={enableCustomNav ? setDisplayMonth : undefined}
              onSelect={(newDate) => {
                onDateChange?.(normalizeToLocalNoon(newDate));
                setOpen(false);
              }}
              autoFocus
              {...(!enableCustomNav && defaultMonth !== undefined && { defaultMonth })}
              formatters={
                enableCustomNav
                  ? {
                      formatCaption: (month) => format(month, "MMMM yyyy"),
                    }
                  : undefined
              }
              components={
                enableCustomNav
                  ? {
                      CaptionLabel: ({ children }) => (
                        <button
                          type="button"
                          onClick={() => setView("months")}
                          className="text-sm font-medium text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
                        >
                          {children}
                        </button>
                      ),
                    }
                  : undefined
              }
              style={calendarStyle}
              classNames={{
                today: `${getDefaultClassNames().today} font-semibold`,
              }}
            />
          )}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

/**
 * Pin the selected day to local 12:00 instead of 00:00. Callers that serialize
 * with `.toISOString().slice(0, 10)` would otherwise get the previous day in
 * any UTC+ timezone (e.g. picking Apr 27 in UTC+3 → "2026-04-26"). Noon stays
 * on the same calendar day in every real-world offset (±14h).
 */
function normalizeToLocalNoon(date: Date | undefined): Date | undefined {
  if (!date) return undefined;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0);
}

/** Split a Date into zero-padded day / month / year segment strings. */
function dateToSegs(d: Date): Segs {
  return [
    String(d.getDate()).padStart(2, "0"),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getFullYear()).padStart(4, "0"),
  ];
}

/**
 * Render the three segments as "DD/MM/YYYY". A "/" separator appears once the
 * user has reached or filled a segment (tracked via `activeSeg`), so a partly
 * typed date still shows the segment the caret is heading into.
 */
function segsToDisplay(segs: Segs, activeSeg: number): string {
  const last = Math.max(activeSeg, segs[2] ? 2 : segs[1] ? 1 : 0);
  let out = segs[0];
  if (last >= 1) out += "/" + segs[1];
  if (last >= 2) out += "/" + segs[2];
  return out;
}

/** Char index in the masked string where the given segment's digits begin. */
function segStartChar(segs: Segs, seg: number): number {
  if (seg === 0) return 0;
  if (seg === 1) return segs[0].length + 1;
  return segs[0].length + 1 + segs[1].length + 1;
}

/**
 * Map a caret char index to the segment it sits in and the digit offset within
 * that segment. The character position (not a digit count) is used so a caret
 * just after a "/" resolves to the start of the next segment rather than the
 * end of the previous one.
 */
function locateSeg(segs: Segs, activeSeg: number, caret: number): { seg: number; intra: number } {
  const display = segsToDisplay(segs, activeSeg);
  const s1 = display.indexOf("/");
  const s2 = s1 === -1 ? -1 : display.indexOf("/", s1 + 1);
  if (s1 === -1 || caret <= s1) {
    return { seg: 0, intra: Math.min(caret, segs[0].length) };
  }
  if (s2 === -1 || caret <= s2) {
    return { seg: 1, intra: Math.max(0, Math.min(caret - (s1 + 1), segs[1].length)) };
  }
  return { seg: 2, intra: Math.max(0, Math.min(caret - (s2 + 1), segs[2].length)) };
}

/**
 * Number of days in a 1-based month. When the year is unknown, February is
 * treated leniently (29) so a leap-year date isn't rejected before the year is
 * typed; once the year is known, the exact leap-year rule applies.
 */
function daysInMonth(month: number, year: number | undefined): number {
  if (month === 2) {
    if (year === undefined) return 29;
    const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    return leap ? 29 : 28;
  }
  const days = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return days[month - 1] ?? 31;
}

const calendarStyle = {
  "--rdp-accent-color": "#2563eb",
  "--rdp-accent-background-color": "#dbeafe",
  "--rdp-day_button-border-radius": "0.375rem",
  "--rdp-day-height": "32px",
  "--rdp-day-width": "32px",
  "--rdp-day_button-height": "30px",
  "--rdp-day_button-width": "30px",
  "--rdp-nav_button-height": "1.75rem",
  "--rdp-nav_button-width": "1.75rem",
  "--rdp-nav-height": "2rem",
  "--rdp-weekday-padding": "0.25rem 0",
  fontSize: "0.8125rem",
} as React.CSSProperties;

// ── Month Grid ──────────────────────────────────────────────────────────

function MonthGrid({
  displayMonth,
  onSelectMonth,
  onShowYears,
}: {
  displayMonth: Date;
  onSelectMonth: (month: number) => void;
  onShowYears: () => void;
}) {
  const currentMonth = displayMonth.getMonth();

  return (
    <div className="w-[252px]">
      <div className="flex items-center justify-center mb-3">
        <button
          type="button"
          onClick={onShowYears}
          className="text-sm font-semibold text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        >
          {displayMonth.getFullYear()}
        </button>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {MONTHS.map((name, idx) => (
          <button
            key={name}
            type="button"
            onClick={() => onSelectMonth(idx)}
            className={cn(
              "rounded-md px-2 py-2 text-xs font-medium transition-colors",
              idx === currentMonth
                ? "bg-blue-600 text-white"
                : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            )}
          >
            {name}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Year Grid ───────────────────────────────────────────────────────────

function YearGrid({
  pageStart,
  selectedYear,
  minYear,
  maxYear,
  onSelectYear,
  onPageChange,
}: {
  pageStart: number;
  selectedYear: number;
  minYear: number;
  maxYear: number;
  onSelectYear: (year: number) => void;
  onPageChange: (start: number) => void;
}) {
  const years = Array.from({ length: 12 }, (_, i) => pageStart + i);
  const canPrev = pageStart > minYear;
  const canNext = pageStart + 12 <= maxYear;

  return (
    <div className="w-[252px]">
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          disabled={!canPrev}
          onClick={() => onPageChange(pageStart - 12)}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>
        <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {pageStart} – {pageStart + 11}
        </span>
        <button
          type="button"
          disabled={!canNext}
          onClick={() => onPageChange(pageStart + 12)}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {years.map((year) => {
          const outOfRange = year < minYear || year > maxYear;
          return (
            <button
              key={year}
              type="button"
              disabled={outOfRange}
              onClick={() => onSelectYear(year)}
              className={cn(
                "rounded-md px-2 py-2 text-xs font-medium transition-colors",
                outOfRange && "text-gray-300 dark:text-gray-600 cursor-not-allowed",
                !outOfRange && year === selectedYear
                  ? "bg-blue-600 text-white"
                  : !outOfRange &&
                      "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              )}
            >
              {year}
            </button>
          );
        })}
      </div>
    </div>
  );
}
