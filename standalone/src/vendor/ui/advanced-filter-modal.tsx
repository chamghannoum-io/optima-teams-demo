import { useI18n } from "@optima/i18n";
import { useState, useMemo, useRef } from "react";
import type { ReactNode } from "react";
import { X, Search, Check, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { cn } from "./utils.js";
import { Button } from "./button.js";
import { Input } from "./input.js";
import { Combobox } from "./combobox.js";
import { DatePicker } from "./date-picker.js";

// ── Types ──────────────────────────────────────────────────────────────────

export interface FilterChipOption {
  id: string;
  label: string;
  description?: string;
  color?: string;
}

export type AdvancedFilterSectionType = "chips" | "input" | "autocomplete" | "custom" | "date";

export interface AdvancedFilterSection {
  id: string;
  title: string;
  type: AdvancedFilterSectionType;
  options?: FilterChipOption[];
  placeholder?: string;
  /** When false (default), only one chip can be selected at a time. When true, multiple chips can be selected together. */
  multiple?: boolean;
  /** Custom render for the section body. Receives the current value and an onChange callback. Only used when type is "custom". */
  render?: (value: unknown, onChange: (val: unknown) => void) => ReactNode;
}

export type AdvancedFilterValues = Record<string, unknown>;

export type AdvancedFilterSearchMode = "options" | "fields" | "none";

interface AdvancedFilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  sections: AdvancedFilterSection[];
  initialValues: AdvancedFilterValues;
  onApply: (values: AdvancedFilterValues) => void;
  searchMode?: AdvancedFilterSearchMode;
  "data-testid"?: string;
}

const MAX_VISIBLE_TAGS = 2;

interface MultiAutocompleteProps {
  values: string[];
  onValuesChange: (values: string[]) => void;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
  searchPlaceholder?: string;
  className?: string;
}

function MultiAutocomplete({
  values,
  onValuesChange,
  options,
  placeholder = "Search and select...",
  searchPlaceholder = "Search...",
  className,
}: MultiAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedOptions = options.filter((o) => values.includes(o.value));

  const filteredOptions = useMemo(() => {
    if (!search) return options;
    const term = search.toLowerCase();
    return options.filter(
      (o) => o.label.toLowerCase().includes(term) || o.value.toLowerCase().includes(term)
    );
  }, [options, search]);

  const toggle = (val: string) => {
    const next = values.includes(val) ? values.filter((v) => v !== val) : [...values, val];
    onValuesChange(next);
  };

  const visibleTags = selectedOptions.slice(0, MAX_VISIBLE_TAGS);
  const overflowCount = selectedOptions.length - visibleTags.length;

  return (
    <PopoverPrimitive.Root
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setSearch("");
      }}
    >
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "flex min-h-[40px] w-full items-center justify-between bg-white dark:bg-dark-surface border border-slate-200 dark:border-dark-border rounded-lg px-3 py-1.5 transition-all duration-300",
            "hover:border-slate-300 dark:hover:border-slate-600",
            "focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/10",
            open && "border-primary ring-1 ring-primary/10",
            className
          )}
        >
          <div className="flex flex-wrap gap-1 flex-1 min-w-0">
            {selectedOptions.length === 0 ? (
              <span className="text-slate-300 dark:text-slate-600 text-[11px] py-0.5">
                {placeholder}
              </span>
            ) : (
              <>
                {visibleTags.map((opt) => (
                  <span
                    key={opt.value}
                    className="inline-flex items-center gap-1 bg-primary/10 dark:bg-primary/20 text-primary dark:text-primary-300 rounded-md px-2 py-0.5 text-[11px] font-medium max-w-[140px]"
                  >
                    <span className="truncate">{opt.label}</span>
                    <span
                      role="button"
                      aria-label={`Remove ${opt.label}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggle(opt.value);
                      }}
                      className="shrink-0 text-primary/50 hover:text-primary dark:hover:text-primary-300 cursor-pointer"
                    >
                      <X size={10} />
                    </span>
                  </span>
                ))}
                {overflowCount > 0 && (
                  <span className="inline-flex items-center bg-slate-100 dark:bg-[#1C2535] text-slate-500 dark:text-[#94A3B8] rounded-md px-2 py-0.5 text-[11px] font-medium">
                    +{overflowCount}
                  </span>
                )}
              </>
            )}
          </div>
          <ChevronDown
            size={16}
            className={cn(
              "text-slate-400 dark:text-slate-500 transition-colors shrink-0 ml-1",
              open && "text-primary dark:text-primary-300"
            )}
          />
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          className="z-[200] w-[--radix-popover-trigger-width] rounded-xl border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-surface p-0 shadow-custom overflow-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2"
          align="start"
          sideOffset={4}
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            inputRef.current?.focus();
          }}
        >
          <div className="flex items-center border-b border-slate-100 dark:border-dark-border/50 px-3">
            <Search size={16} className="me-2 text-slate-400 dark:text-slate-500 shrink-0" />
            <input
              ref={inputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="flex h-[40px] w-full bg-transparent py-3 text-xs text-slate-900 dark:text-dark-text outline-none placeholder:text-slate-300 dark:placeholder:text-slate-600 placeholder:text-[11px]"
            />
          </div>
          <div className="max-h-[300px] overflow-y-auto p-1" role="listbox">
            {filteredOptions.length === 0 && (
              <div className="py-6 text-center text-xs text-slate-400 dark:text-slate-500">
                No results found.
              </div>
            )}
            {filteredOptions.map((option) => {
              const isSelected = values.includes(option.value);
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => toggle(option.value)}
                  className={cn(
                    "relative flex w-full cursor-pointer items-center rounded-lg px-2 py-2 text-xs text-slate-700 dark:text-slate-300 outline-none transition-colors",
                    "hover:bg-slate-50 dark:hover:bg-dark-hover",
                    isSelected &&
                      "bg-primary/5 dark:bg-primary/10 text-primary dark:text-primary-300 font-medium"
                  )}
                >
                  <span className="absolute start-2 flex h-4 w-4 items-center justify-center">
                    {isSelected && (
                      <Check size={14} className="text-primary dark:text-primary-300" />
                    )}
                  </span>
                  <span className="ps-6">{option.label}</span>
                </button>
              );
            })}
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

// ── Component ──────────────────────────────────────────────────────────────

export function AdvancedFilterModal({
  isOpen,
  onClose,
  searchMode = "options",
  sections,
  initialValues,
  onApply,
  "data-testid": dataTestId,
}: AdvancedFilterModalProps) {
  return (
    <AnimatePresence>
      {isOpen ? (
        <AdvancedFilterModalContent
          onClose={onClose}
          searchMode={searchMode}
          sections={sections}
          initialValues={initialValues}
          onApply={onApply}
          dataTestId={dataTestId}
        />
      ) : null}
    </AnimatePresence>
  );
}

interface AdvancedFilterModalContentProps {
  onClose: () => void;
  sections: AdvancedFilterSection[];
  initialValues: AdvancedFilterValues;
  onApply: (values: AdvancedFilterValues) => void;
  searchMode: AdvancedFilterSearchMode;
  dataTestId?: string;
}

function AdvancedFilterModalContent({
  onClose,
  searchMode,
  sections,
  initialValues,
  onApply,
  dataTestId,
}: AdvancedFilterModalContentProps) {
  const t = useI18n();
  const [values, setValues] = useState<AdvancedFilterValues>(initialValues);
  const [searchQuery, setSearchQuery] = useState("");

  const updateValue = (sectionId: string, newValue: unknown) => {
    setValues((prev) => ({ ...prev, [sectionId]: newValue }));
  };

  const toggleChip = (sectionId: string, optionId: string, multiple?: boolean) => {
    const current = (values[sectionId] as string[]) || [];
    if (multiple) {
      const next = current.includes(optionId)
        ? current.filter((id) => id !== optionId)
        : [...current, optionId];
      updateValue(sectionId, next);
    } else {
      // Single select: deselect if already selected, otherwise replace
      updateValue(sectionId, current.includes(optionId) ? [] : [optionId]);
    }
  };

  const handleReset = () => {
    const resetValues: AdvancedFilterValues = {};
    sections.forEach((s) => {
      if (s.type === "chips" || s.type === "autocomplete") resetValues[s.id] = [];
      else if (s.type === "custom" || s.type === "date") resetValues[s.id] = null;
      else resetValues[s.id] = "";
    });
    setValues(resetValues);
  };

  const handleApply = () => {
    onApply(values);
    onClose();
  };

  const filteredSections = useMemo(() => {
    if (searchMode === "none" || !searchQuery.trim()) return sections;
    const q = searchQuery.toLowerCase();

    if (searchMode === "fields") {
      // Search by section/field names - show entire section if title matches
      return sections.filter((section) => section.title.toLowerCase().includes(q));
    }

    // Search by options - filter options within sections
    return sections
      .map((section) => {
        if ((section.type !== "chips" && section.type !== "autocomplete") || !section.options)
          return section;
        const filtered = section.options.filter(
          (o) => o.label.toLowerCase().includes(q) || o.description?.toLowerCase().includes(q)
        );
        return { ...section, options: filtered };
      })
      .filter((section) => {
        if (section.type === "chips" || section.type === "autocomplete")
          return (section.options?.length || 0) > 0;
        return section.title.toLowerCase().includes(q);
      });
  }, [sections, searchQuery, searchMode]);

  const activeCount = useMemo(() => {
    let count = 0;
    Object.entries(values).forEach(([sectionId, val]) => {
      const section = sections.find((s) => s.id === sectionId);
      if (!section) return;
      if (section.type === "chips" && Array.isArray(val) && val.length > 0) count += val.length;
      else if (section.type === "autocomplete" && Array.isArray(val) && val.length > 0)
        count += val.length;
      else if (section.type === "input" && val) count += 1;
      else if ((section.type === "custom" || section.type === "date") && val != null) count += 1;
    });
    return count;
  }, [values, sections]);

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/30 z-[100]"
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white dark:bg-[#111827] rounded-2xl border border-slate-200 dark:border-[#2A3141] shadow-2xl z-[101] overflow-hidden flex flex-col max-h-[85vh]"
        data-testid={dataTestId ?? "filter-modal"}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-[#2A3141]/50 shrink-0">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900 dark:text-[#E2E8F0]">
                {t("filters.title")}
              </h3>
              {activeCount > 0 && (
                <span
                  data-testid="filter-modal-active-count"
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#2D3670] text-white"
                >
                  {activeCount} {t("filters.activeFilters")}
                </span>
              )}
            </div>
            <p className="text-[10px] font-bold text-slate-400 dark:text-[#64748B] uppercase tracking-widest mt-0.5">
              {t("filters.description")}
            </p>
          </div>
          <button
            onClick={onClose}
            data-testid="filter-modal-close-button"
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-[#E2E8F0] hover:bg-slate-50 dark:hover:bg-[#1C2535] rounded-lg transition-all"
          >
            <X size={18} />
          </button>
        </div>

        {/* Search */}
        {searchMode !== "none" && (
          <div className="px-6 py-4 border-b border-slate-50 dark:border-[#2A3141]/50 shrink-0">
            <div className="relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-[#64748B]"
              />
              <Input
                placeholder={t("filters.searchCategoriesPlaceholder")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="filter-search-input"
              />
            </div>
          </div>
        )}

        {/* Sections */}
        <div className="px-6 py-6 overflow-y-auto flex-1">
          <div className="flex flex-col gap-8">
            {filteredSections.length > 0 ? (
              filteredSections.map((section, sIdx) => (
                <motion.div
                  key={section.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: sIdx * 0.05 }}
                  data-testid={`filter-section-${section.id}`}
                  className="flex flex-col gap-3"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="text-[10px] font-bold text-slate-400 dark:text-[#64748B] uppercase tracking-widest">
                      {section.title}
                    </h4>
                    {(section.type === "chips" || section.type === "autocomplete") &&
                      section.options && (
                        <span className="text-[10px] text-slate-400 dark:text-[#64748B] font-medium">
                          {section.options.length} options
                        </span>
                      )}
                  </div>

                  {/* Chips */}
                  {section.type === "chips" && section.options && (
                    <div className="flex flex-wrap gap-2">
                      {section.options.map((option) => {
                        const selected = ((values[section.id] as string[]) || []).includes(
                          option.id
                        );
                        return (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => toggleChip(section.id, option.id, section.multiple)}
                            className={cn(
                              "px-4 py-2 rounded-lg text-xs font-medium transition-all border text-left flex flex-col gap-0.5",
                              selected
                                ? option.color
                                  ? "text-white border-transparent"
                                  : "bg-[#2D3670] text-white border-[#2D3670]"
                                : "bg-white dark:bg-[#151C28] text-slate-600 dark:text-[#94A3B8] border-slate-200 dark:border-[#2A3141] hover:border-slate-300 dark:hover:border-[#3A4151] hover:bg-slate-50 dark:hover:bg-[#1C2535]"
                            )}
                            style={
                              selected && option.color
                                ? {
                                    backgroundColor: option.color,
                                    borderColor: option.color,
                                  }
                                : undefined
                            }
                          >
                            <div className="flex items-center gap-2">
                              {option.color && (
                                <span
                                  className={cn(
                                    "w-2 h-2 rounded-full shrink-0 transition-all",
                                    selected && "ring-2 ring-white/40"
                                  )}
                                  style={{ backgroundColor: option.color }}
                                />
                              )}
                              {selected && !option.color && <Check size={12} />}
                              {option.label}
                            </div>
                            {option.description && (
                              <span
                                className={cn(
                                  "text-[9px] font-normal opacity-70",
                                  selected ? "text-white" : "text-slate-400 dark:text-[#64748B]"
                                )}
                              >
                                {option.description}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Autocomplete */}
                  {section.type === "autocomplete" &&
                    section.options &&
                    (section.multiple ? (
                      <MultiAutocomplete
                        values={(values[section.id] as string[]) || []}
                        onValuesChange={(vals) => updateValue(section.id, vals)}
                        options={section.options.map((o) => ({ value: o.id, label: o.label }))}
                        placeholder={section.placeholder || "Search and select..."}
                        searchPlaceholder="Search..."
                        className="w-full"
                      />
                    ) : (
                      <Combobox
                        value={((values[section.id] as string[]) || [])[0] || ""}
                        onValueChange={(value) => updateValue(section.id, value ? [value] : [])}
                        options={section.options.map((option) => ({
                          value: option.id,
                          label: option.label,
                        }))}
                        placeholder={section.placeholder || "Search and select..."}
                        searchPlaceholder="Search..."
                        className="w-full"
                      />
                    ))}

                  {/* Input */}
                  {section.type === "input" && (
                    <Input
                      placeholder={section.placeholder || "Enter value..."}
                      value={(values[section.id] as string) || ""}
                      onChange={(e) => updateValue(section.id, e.target.value)}
                      data-testid={`filter-input-${section.id}`}
                    />
                  )}

                  {/* Date */}
                  {section.type === "date" && (
                    <DatePicker
                      date={(values[section.id] as Date | undefined) ?? undefined}
                      onDateChange={(date) => updateValue(section.id, date ?? null)}
                      placeholder={section.placeholder || "Pick a date"}
                      clearable
                    />
                  )}

                  {/* Custom */}
                  {section.type === "custom" &&
                    section.render?.(values[section.id], (val) => updateValue(section.id, val))}
                </motion.div>
              ))
            ) : (
              <div className="py-12 flex flex-col items-center justify-center text-center gap-3">
                <div className="w-12 h-12 rounded-full bg-slate-50 dark:bg-[#151C28] flex items-center justify-center text-slate-300 dark:text-[#64748B]">
                  <Search size={24} />
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-bold text-slate-900 dark:text-[#E2E8F0]">
                    No filters found
                  </p>
                  <p className="text-xs text-slate-500 dark:text-[#94A3B8]">
                    Try searching for something else
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setSearchQuery("")}>
                  Clear Search
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-[#151C28] border-t border-slate-100 dark:border-[#2A3141] flex items-center justify-between shrink-0">
          <div>
            {activeCount > 0 && (
              <button
                onClick={handleReset}
                data-testid="clear-all-filters-button"
                className="text-[10px] font-bold text-[#2D3670] dark:text-[#a5b1db] uppercase tracking-widest hover:underline text-left"
              >
                Reset All
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              data-testid="filter-modal-cancel-button"
            >
              {t("filters.cancel")}
            </Button>
            <Button size="sm" onClick={handleApply} data-testid="apply-filters-button">
              {t("filters.apply")}
            </Button>
          </div>
        </div>
      </motion.div>
    </>
  );
}
