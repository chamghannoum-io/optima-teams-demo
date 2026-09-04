import { useState, useRef, useEffect, useMemo } from "react";
import { useI18n } from "@optima/i18n";
import { isBaseOption } from "@optima/shared";
import { Filter, Search, X, ChevronDown, ChevronUp } from "lucide-react";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./dialog.js";
import { Button } from "./button.js";
import { Input } from "./input.js";
import { Textarea } from "./textarea.js";
import { DatePicker, type DatePickerProps } from "./date-picker.js";
import { Label } from "./label.js";
import { Badge } from "./badge.js";
import { cn } from "./utils.js";
import { Combobox } from "./combobox.js";

// ── Types ──────────────────────────────────────────────────────────────────

export type FilterFieldType =
  | "text"
  | "number"
  /** Comma-separated list of numeric ids — accepts digits and separators only. */
  | "numeric-list"
  | "date"
  | "select"
  | "multiselect"
  | "multiline"
  | "combobox"
  | "autocomplete"
  | "single-select";

export interface FilterOption {
  value: string;
  label: string;
  color?: string;
}

export interface FilterFieldConfig {
  name: string;
  label: string;
  type: FilterFieldType;
  options?: FilterOption[];
  multiple?: boolean;
  placeholder?: string;
  /** Optional group name for visual grouping in the filter modal. */
  group?: string;
  /** Extra props forwarded to `DatePicker` when `type: "date"`. */
  datePickerProps?: Omit<
    DatePickerProps,
    "date" | "onDateChange" | "placeholder" | "disabled" | "className"
  >;
  /** Custom render function for the field (used with `autocomplete` type). */
  render?: (value: unknown, onChange: (val: unknown) => void) => React.ReactNode;
}

export interface TableFiltersProps {
  fields: FilterFieldConfig[];
  values: Record<string, unknown>;
  onApply: (values: Record<string, unknown>) => void;
  onClear: () => void;
  /** When true, chips are not rendered inline. Use `TableFilterChips` to render them elsewhere. */
  hideChips?: boolean;
  /** Called when the filter dialog is opened */
  onOpen?: () => void;
  labels?: {
    button?: string;
    title?: string;
    description?: string;
    apply?: string;
    clearAll?: string;
  };
}

// ── Internal Types ─────────────────────────────────────────────────────────

interface DatePair {
  fromField: FilterFieldConfig;
  toField: FilterFieldConfig;
  label: string;
}

type DisplayItem =
  | { kind: "single"; field: FilterFieldConfig }
  | { kind: "datePair"; pair: DatePair };

// ── Helpers ────────────────────────────────────────────────────────────────

function hasValue(value: unknown): boolean {
  if (value == null || value === "") return false;
  if (Array.isArray(value) && value.length === 0) return false;
  if (isBaseOption(value)) return value.key !== "";
  if (Array.isArray(value) && value.length > 0 && isBaseOption(value[0])) return true;
  return true;
}

function countActiveFilters(values: Record<string, unknown>): number {
  let count = 0;
  for (const v of Object.values(values)) {
    if (!hasValue(v)) continue;
    count++;
  }
  return count;
}

function formatChipValue(value: unknown, field: FilterFieldConfig): string | null {
  if (value == null || value === "") return null;

  // IBaseOption (single)
  if (isBaseOption(value)) return value.label || value.key || null;

  // IBaseOption[] (multiple autocomplete)
  if (Array.isArray(value) && value.length > 0 && isBaseOption(value[0])) {
    if (value.length <= 2)
      return value.map((v) => (isBaseOption(v) ? v.label : String(v))).join(", ");
    return `${value.length} selected`;
  }

  if (field.type === "date" && value instanceof Date) {
    return value.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  if ((field.type === "select" || field.type === "multiselect") && Array.isArray(value)) {
    if (value.length === 0) return null;
    if (value.length <= 2) {
      const labels = value.map((v) => {
        const opt = field.options?.find((o) => o.value === v);
        return opt?.label ?? v;
      });
      return labels.join(", ");
    }
    return `${value.length} selected`;
  }

  if ((field.type === "select" || field.type === "single-select") && typeof value === "string") {
    const opt = field.options?.find((o) => o.value === value);
    return opt?.label ?? value;
  }

  if (field.type === "multiline" && typeof value === "string") {
    const lines = value
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (lines.length === 0) return null;
    return lines.length <= 2 ? lines.join(", ") : `${lines.length} values`;
  }

  return String(value);
}

function derivePairLabel(fromField: FilterFieldConfig): string {
  const label = fromField.label
    .replace(/\s*(from|to)\s*$/i, "")
    .replace(/^\s*(from|to)\s*/i, "")
    .trim();
  return label || "Date";
}

// ── Searchable Select ──────────────────────────────────────────────────────

const SEARCHABLE_THRESHOLD = 5;

function SearchableSelect({
  field,
  value,
  onChange,
}: {
  field: FilterFieldConfig;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const [optionSearch, setOptionSearch] = useState("");
  const options = field.options ?? [];
  const showSearch = options.length > SEARCHABLE_THRESHOLD;

  const filtered =
    showSearch && optionSearch.trim()
      ? options.filter((opt) => opt.label.toLowerCase().includes(optionSearch.toLowerCase()))
      : options;

  if (field.multiple) {
    const selected = Array.isArray(value) ? (value as string[]) : [];
    // Show selected items first, then the rest
    const sortedFiltered = [
      ...filtered.filter((opt) => selected.includes(opt.value)),
      ...filtered.filter((opt) => !selected.includes(opt.value)),
    ];

    return (
      <div className="rounded-lg border border-slate-200 dark:border-dark-border">
        {showSearch && (
          <div className="border-b border-slate-200 dark:border-dark-border px-2 py-1.5 dark:border-dark-border">
            <input
              type="text"
              value={optionSearch}
              onChange={(e) => setOptionSearch(e.target.value)}
              placeholder="Search..."
              className="w-full bg-transparent text-sm text-slate-900 dark:text-dark-text outline-none placeholder:text-slate-400 dark:text-slate-500 dark:text-dark-text dark:placeholder:text-slate-500"
            />
          </div>
        )}
        <div
          className={cn(
            "flex max-h-40 flex-col gap-0.5 overflow-y-auto p-1.5",
            showSearch && "min-h-40"
          )}
        >
          {sortedFiltered.length === 0 ? (
            <div className="px-1.5 py-2 text-center text-xs text-slate-400 dark:text-slate-500">
              No matches
            </div>
          ) : (
            sortedFiltered.map((opt) => (
              <label
                key={opt.value}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm",
                  selected.includes(opt.value)
                    ? "bg-primary/5 dark:bg-primary/10"
                    : "hover:bg-slate-100 dark:hover:bg-dark-hover"
                )}
              >
                <input
                  type="checkbox"
                  checked={selected.includes(opt.value)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      onChange([...selected, opt.value]);
                    } else {
                      onChange(selected.filter((v) => v !== opt.value));
                    }
                  }}
                  className="h-4 w-4 rounded border-slate-300 dark:border-dark-border text-primary focus:ring-primary"
                />
                <span className="truncate">{opt.label}</span>
              </label>
            ))
          )}
        </div>
        {selected.length > 0 && (
          <div className="border-t border-slate-200 dark:border-dark-border px-2 py-1 dark:border-dark-border">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {selected.length} selected
            </span>
          </div>
        )}
      </div>
    );
  }

  // Single-select
  const selectedVal = (value as string) ?? "";
  return (
    <div className="rounded-lg border border-slate-200 dark:border-dark-border">
      {showSearch && (
        <div className="border-b border-slate-200 dark:border-dark-border px-2 py-1.5 dark:border-dark-border">
          <input
            type="text"
            value={optionSearch}
            onChange={(e) => setOptionSearch(e.target.value)}
            placeholder="Search..."
            className="w-full bg-transparent text-sm text-slate-900 dark:text-dark-text outline-none placeholder:text-slate-400 dark:text-slate-500 dark:text-dark-text dark:placeholder:text-slate-500"
          />
        </div>
      )}
      <div
        className={cn(
          "flex max-h-40 flex-col gap-0.5 overflow-y-auto p-1.5",
          showSearch && "min-h-40"
        )}
      >
        {filtered.length === 0 ? (
          <div className="px-1.5 py-2 text-center text-xs text-slate-400 dark:text-slate-500">
            No matches
          </div>
        ) : (
          filtered.map((opt) => (
            <label
              key={opt.value}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm",
                selectedVal === opt.value
                  ? "bg-primary/5 dark:bg-primary/10"
                  : "hover:bg-slate-100 dark:hover:bg-dark-hover"
              )}
            >
              <input
                type="radio"
                name={field.name}
                value={opt.value}
                checked={selectedVal === opt.value}
                onChange={() => onChange(opt.value)}
                className="h-4 w-4 border-slate-300 dark:border-dark-border text-primary focus:ring-primary"
              />
              <span className="truncate">{opt.label}</span>
            </label>
          ))
        )}
      </div>
    </div>
  );
}

// ── Filter Field Renderer ──────────────────────────────────────────────────

function FilterField({
  field,
  value,
  onChange,
}: {
  field: FilterFieldConfig;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  switch (field.type) {
    case "text":
      return (
        <Input
          data-testid={`filter-input-${field.name}`}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder ?? field.label}
        />
      );

    case "numeric-list":
      // Digits and separators only: the ids these fields feed are numeric
      // server-side, and a stray character makes the API fail instead of
      // returning no rows (ISSUE-21367).
      return (
        <Input
          data-testid={`filter-input-${field.name}`}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value.replace(/[^\d\s,]/g, ""))}
          placeholder={field.placeholder ?? field.label}
        />
      );

    case "multiline":
      return (
        <Textarea
          data-testid={`filter-textarea-${field.name}`}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder ?? `Enter values separated by commas or newlines`}
          rows={3}
        />
      );

    case "date":
      return (
        <DatePicker
          date={value instanceof Date ? value : undefined}
          onDateChange={(d) => onChange(d ?? undefined)}
          placeholder={field.placeholder ?? field.label}
          {...field.datePickerProps}
        />
      );

    case "select": {
      if (!field.options || field.options.length === 0) {
        return (
          <div className="flex items-center rounded-lg border border-slate-200 dark:border-dark-border px-3 py-2 text-sm text-slate-400 dark:text-slate-500 dark:border-dark-border dark:text-slate-500">
            No options available
          </div>
        );
      }

      return <SearchableSelect field={field} value={value} onChange={onChange} />;
    }

    case "autocomplete": {
      if (field.render) {
        return <>{field.render(value, onChange)}</>;
      }
      const options = field.options ?? [];
      return (
        <Combobox
          value={(value as string | undefined) ?? ""}
          onValueChange={(val) => onChange(val || undefined)}
          options={options}
          placeholder={field.placeholder ?? field.label}
          searchPlaceholder="Search..."
          className="w-full"
        />
      );
    }

    default:
      return null;
  }
}

// ── Clear Button ───────────────────────────────────────────────────────────

function ClearFieldButton({ onClick, testId }: { onClick: () => void; testId?: string }) {
  const t = useI18n();
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId ?? "clear-filter-button"}
      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-slate-400 dark:text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-600 dark:hover:bg-dark-hover dark:hover:text-slate-300"
      title={t("filters.clearTooltip")}
    >
      <X size={12} />
    </button>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export function TableFilters({
  fields,
  values,
  onApply,
  onClear,
  hideChips,
  onOpen,
  labels,
}: TableFiltersProps) {
  const t = useI18n();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Record<string, unknown>>({ ...values });
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  const activeCount = countActiveFilters(values);

  // Auto-focus search input when dialog opens
  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => searchRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [open]);

  const handleOpen = (nextOpen: boolean) => {
    if (nextOpen) {
      setDraft({ ...values });
      setSearch("");
      onOpen?.();
    }
    setOpen(nextOpen);
  };

  const handleDraftChange = (name: string, value: unknown) => {
    setDraft((prev) => ({ ...prev, [name]: value }));
  };

  const handleApply = () => {
    onApply(draft);
    setOpen(false);
  };

  const handleClearAll = () => {
    onClear();
    setDraft({});
    setOpen(false);
  };

  const handleRemoveFilter = (name: string) => {
    const next = { ...values };
    delete next[name];
    onApply(next);
  };

  const handleClearField = (name: string) => {
    setDraft((prev) => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
  };

  const handleClearPair = (pair: DatePair) => {
    setDraft((prev) => {
      const next = { ...prev };
      delete next[pair.fromField.name];
      delete next[pair.toField.name];
      return next;
    });
  };

  // ── Date pair detection ────────────────────────────────────────────────

  const { datePairs, pairedFieldNames } = useMemo(() => {
    const pairs: DatePair[] = [];
    const pairedNames = new Set<string>();

    for (const field of fields) {
      if (field.type !== "date" || pairedNames.has(field.name)) continue;

      const fromMatch = field.name.match(/^from(.+)$/);
      if (!fromMatch) continue;

      const toName = `to${fromMatch[1]}`;
      const toField = fields.find((f) => f.name === toName);

      if (toField) {
        pairedNames.add(field.name);
        pairedNames.add(toField.name);
        pairs.push({
          fromField: field,
          toField,
          label: derivePairLabel(field),
        });
      }
    }

    return { datePairs: pairs, pairedFieldNames: pairedNames };
  }, [fields]);

  // ── Build display items maintaining field order ────────────────────────

  const displayItems = useMemo(() => {
    const items: DisplayItem[] = [];
    const processedPairs = new Set<string>();

    for (const field of fields) {
      if (pairedFieldNames.has(field.name)) {
        const pair = datePairs.find(
          (p) => p.fromField.name === field.name || p.toField.name === field.name
        );
        if (pair && !processedPairs.has(pair.fromField.name)) {
          processedPairs.add(pair.fromField.name);
          items.push({ kind: "datePair", pair });
        }
      } else {
        items.push({ kind: "single", field });
      }
    }

    return items;
  }, [fields, pairedFieldNames, datePairs]);

  // ── Filter by search ──────────────────────────────────────────────────

  const filteredItems = useMemo(() => {
    if (!search.trim()) return displayItems;
    const q = search.toLowerCase();
    return displayItems.filter((item) => {
      if (item.kind === "single") {
        return item.field.label.toLowerCase().includes(q);
      }
      return (
        item.pair.label.toLowerCase().includes(q) ||
        item.pair.fromField.label.toLowerCase().includes(q) ||
        item.pair.toField.label.toLowerCase().includes(q)
      );
    });
  }, [displayItems, search]);

  // ── Sort: committed-active filters first (stable while dialog is open) ──

  // Partition by committed values so fields don't jump while the user is editing
  const isItemCommitted = (item: DisplayItem): boolean => {
    if (item.kind === "single") return hasValue(values[item.field.name]);
    return hasValue(values[item.pair.fromField.name]) || hasValue(values[item.pair.toField.name]);
  };

  // Draft-active check for visual highlighting only (real-time feedback)
  const isItemDraftActive = (item: DisplayItem): boolean => {
    if (item.kind === "single") return hasValue(draft[item.field.name]);
    return hasValue(draft[item.pair.fromField.name]) || hasValue(draft[item.pair.toField.name]);
  };

  const committedActiveItems = filteredItems.filter(isItemCommitted);
  const committedInactiveItems = filteredItems.filter((item) => !isItemCommitted(item));

  const totalFieldCount = displayItems.length;
  const visibleFieldCount = filteredItems.length;

  // Count active display items (pairs count as 1)
  const draftActiveCount = useMemo(() => {
    let count = 0;
    for (const item of displayItems) {
      if (item.kind === "single") {
        if (hasValue(draft[item.field.name])) count++;
      } else {
        if (hasValue(draft[item.pair.fromField.name]) || hasValue(draft[item.pair.toField.name])) {
          count++;
        }
      }
    }
    return count;
  }, [displayItems, draft]);

  // ── Render helpers ────────────────────────────────────────────────────

  const renderSingleField = (field: FilterFieldConfig, active: boolean) => (
    <div
      key={field.name}
      data-testid={`filter-section-${field.name}`}
      className={cn(
        "rounded-lg p-3 transition-colors",
        active ? "bg-primary/5 dark:bg-primary/10" : "hover:bg-slate-50 dark:hover:bg-dark-hover"
      )}
    >
      <div className="flex items-start gap-3">
        <div className="w-36 shrink-0 pt-2">
          <Label className="text-xs font-medium text-slate-700 dark:text-slate-300">
            {field.label}
          </Label>
        </div>
        <div className="min-w-0 flex-1">
          <FilterField
            field={field}
            value={draft[field.name]}
            onChange={(v) => handleDraftChange(field.name, v)}
          />
        </div>
        {hasValue(draft[field.name]) && (
          <div className="pt-2">
            <ClearFieldButton onClick={() => handleClearField(field.name)} />
          </div>
        )}
      </div>
    </div>
  );

  const renderDatePair = (pair: DatePair, active: boolean) => (
    <div
      key={pair.fromField.name}
      className={cn(
        "rounded-lg p-3 transition-colors",
        active ? "bg-primary/5 dark:bg-primary/10" : "hover:bg-slate-50 dark:hover:bg-dark-hover"
      )}
    >
      <div className="mb-2 flex items-center justify-between">
        <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">
          {pair.label}
        </Label>
        {(hasValue(draft[pair.fromField.name]) || hasValue(draft[pair.toField.name])) && (
          <ClearFieldButton onClick={() => handleClearPair(pair)} />
        )}
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <DatePicker
            date={
              draft[pair.fromField.name] instanceof Date
                ? (draft[pair.fromField.name] as Date)
                : undefined
            }
            onDateChange={(d) => handleDraftChange(pair.fromField.name, d ?? undefined)}
            placeholder={t("common.dateFrom")}
          />
        </div>
        <span className="text-sm text-slate-400 dark:text-slate-500 rtl:rotate-180 inline-block">
          &rarr;
        </span>
        <div className="flex-1">
          <DatePicker
            date={
              draft[pair.toField.name] instanceof Date
                ? (draft[pair.toField.name] as Date)
                : undefined
            }
            onDateChange={(d) => handleDraftChange(pair.toField.name, d ?? undefined)}
            placeholder={t("common.dateTo")}
          />
        </div>
      </div>
    </div>
  );

  const renderItem = (item: DisplayItem, active: boolean) => {
    if (item.kind === "single") return renderSingleField(item.field, active);
    return renderDatePair(item.pair, active);
  };

  return (
    <div className={hideChips ? undefined : "flex flex-wrap items-center gap-2"}>
      <Dialog open={open} onOpenChange={handleOpen}>
        <DialogTrigger asChild>
          <Button variant="secondary" size="sm" data-testid="filter-button">
            {labels?.button ?? t("filters.button")}
            <Filter size={16} />
            {activeCount > 0 && (
              <span className="ms-1 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-primary px-1 text-xs font-semibold text-white">
                {activeCount}
              </span>
            )}
          </Button>
        </DialogTrigger>

        <DialogContent
          data-testid="filter-modal"
          className="flex max-h-[85vh] flex-col overflow-hidden rounded-2xl border border-slate-200 dark:border-dark-border shadow-2xl sm:max-w-2xl gap-0"
        >
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 dark:text-dark-text flex items-center gap-2">
              {labels?.title ?? t("filters.title")}
              {draftActiveCount > 0 && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#2D3670] text-white">
                  {draftActiveCount} Active
                </span>
              )}
            </DialogTitle>
            <DialogDescription className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
              {labels?.description ?? t("filters.description")}
            </DialogDescription>
          </DialogHeader>

          {/* Search bar */}
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-dark-border/50 py-4 px-6">
            <div className="relative flex-1">
              <Search
                size={16}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none"
              />
              <Input
                ref={searchRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("filters.searchPlaceholder")}
                className="pl-9"
                data-testid="filter-search-input"
              />
            </div>
            <span className="whitespace-nowrap text-xs text-slate-400 dark:text-slate-500">
              {visibleFieldCount} of {totalFieldCount}
            </span>
          </div>

          {/* Scrollable filter list */}
          <div className="-mx-1 flex-1 space-y-2 overflow-y-auto px-6 py-4">
            {/* Active filters section (pinned by committed values, highlighted by draft) */}
            {committedActiveItems.length > 0 && (
              <div className="space-y-2">
                <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-primary dark:text-primary-300">
                  {t("filters.activeFilters")}
                </div>
                {committedActiveItems.map((item) => renderItem(item, isItemDraftActive(item)))}
                {committedInactiveItems.length > 0 && (
                  <div className="my-2 border-t border-slate-100 dark:border-dark-border/50" />
                )}
              </div>
            )}

            {/* Remaining filters (highlighted by draft if user has started filling them) */}
            {committedInactiveItems.map((item) => renderItem(item, isItemDraftActive(item)))}

            {/* Empty search results */}
            {filteredItems.length === 0 && search && (
              <div className="py-8 text-center text-sm text-slate-400 dark:text-slate-500">
                {t("filters.noFiltersMatch", { search })}
              </div>
            )}
          </div>

          <DialogFooter className="sm:justify-between items-center bg-slate-50 dark:bg-dark-card border-t border-slate-100 dark:border-dark-border/50 px-6 py-4 mt-0 rounded-b-2xl">
            <div>
              {draftActiveCount > 0 && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  data-testid="clear-all-filters-button"
                  className="text-[10px] font-bold uppercase tracking-widest text-primary dark:text-primary-300 hover:underline transition-colors"
                >
                  {labels?.clearAll ?? t("filters.resetAll")}
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
                {t("filters.cancel")}
              </Button>
              <Button size="sm" onClick={handleApply} data-testid="apply-filters-button">
                {labels?.apply ?? t("filters.apply")}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Inline chips (when not using external TableFilterChips) */}
      {!hideChips &&
        fields.map((field) => {
          const chipText = formatChipValue(values[field.name], field);
          if (!chipText) return null;
          return (
            <Badge
              key={field.name}
              variant="default"
              className="gap-1 pl-2.5 bg-white dark:bg-dark-surface"
            >
              <span className="font-semibold">{field.label}:</span> {chipText}
              <button
                type="button"
                onClick={() => handleRemoveFilter(field.name)}
                className="ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full hover:bg-primary/20 dark:hover:bg-primary/30"
              >
                <X size={12} />
              </button>
            </Badge>
          );
        })}
    </div>
  );
}

// ── Chip close button ──────────────────────────────────────────────────────

function ChipCloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full hover:bg-primary/20 dark:hover:bg-primary/30"
    >
      <X size={12} />
    </button>
  );
}

// ── Standalone Chip Bar ────────────────────────────────────────────────────

type ChipItem =
  | { kind: "single"; field: FilterFieldConfig; text: string }
  | {
      kind: "datePair";
      label: string;
      fromName: string;
      toName: string;
      text: string;
    };

function formatDateShort(value: unknown): string | null {
  if (!(value instanceof Date)) return null;
  return value.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function TableFilterChips({
  fields,
  values,
  onApply,
  maxVisible = 6,
}: {
  fields: FilterFieldConfig[];
  values: Record<string, unknown>;
  onApply: (values: Record<string, unknown>) => void;
  /** When chip count exceeds this, collapse into a summary. Default: 6 */
  maxVisible?: number;
}) {
  const [expanded, setExpanded] = useState(false);

  const handleRemove = (name: string) => {
    const next = { ...values };
    delete next[name];
    onApply(next);
  };

  const handleRemovePair = (fromName: string, toName: string) => {
    const next = { ...values };
    delete next[fromName];
    delete next[toName];
    onApply(next);
  };

  // Build chip items with merged date pairs
  const chipItems = useMemo(() => {
    const items: ChipItem[] = [];
    const processed = new Set<string>();

    for (const field of fields) {
      if (processed.has(field.name)) continue;

      // Try to detect date pair
      if (field.type === "date") {
        const fromMatch = field.name.match(/^from(.+)$/);
        if (fromMatch) {
          const toName = `to${fromMatch[1]}`;
          const toField = fields.find((f) => f.name === toName);
          if (toField) {
            processed.add(field.name);
            processed.add(toName);
            const fromDate = formatDateShort(values[field.name]);
            const toDate = formatDateShort(values[toName]);
            if (!fromDate && !toDate) continue;
            const text =
              fromDate && toDate
                ? `${fromDate} \u2192 ${toDate}`
                : fromDate
                  ? `from ${fromDate}`
                  : `to ${toDate}`;
            items.push({
              kind: "datePair",
              label: derivePairLabel(field),
              fromName: field.name,
              toName,
              text,
            });
            continue;
          }
        }
        // Check if this is a "to" field whose "from" was already paired
        const toMatch = field.name.match(/^to(.+)$/);
        if (toMatch) {
          const fromName = `from${toMatch[1]}`;
          if (processed.has(fromName)) continue;
        }
      }

      // Regular single field
      const chipText = formatChipValue(values[field.name], field);
      if (!chipText) continue;
      items.push({ kind: "single", field, text: chipText });
    }

    return items;
  }, [fields, values]);

  if (chipItems.length === 0) return null;

  const shouldCollapse = chipItems.length > maxVisible;
  const showIndividual = !shouldCollapse || expanded;

  const renderChip = (item: ChipItem) => {
    if (item.kind === "single") {
      return (
        <Badge
          key={item.field.name}
          variant="default"
          className="gap-1 pl-2.5 bg-white dark:bg-dark-surface"
        >
          <span className="font-semibold">{item.field.label}:</span> {item.text}
          <ChipCloseButton onClick={() => handleRemove(item.field.name)} />
        </Badge>
      );
    }
    return (
      <Badge
        key={item.fromName}
        variant="default"
        className="gap-1 pl-2.5 bg-white dark:bg-dark-surface"
      >
        <span className="font-semibold">{item.label}:</span> {item.text}
        <ChipCloseButton onClick={() => handleRemovePair(item.fromName, item.toName)} />
      </Badge>
    );
  };

  if (!showIndividual) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/20 dark:bg-primary/20 dark:text-primary-300 dark:hover:bg-primary/30"
      >
        {chipItems.length} filters active
        <ChevronDown size={12} />
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {chipItems.map(renderChip)}
      {shouldCollapse && (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs text-slate-500 dark:text-slate-400 transition-colors hover:bg-slate-100 dark:hover:bg-dark-hover"
        >
          Collapse
          <ChevronUp size={12} />
        </button>
      )}
    </div>
  );
}
