import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn } from "./utils.js";

export interface ComboboxProps {
  value?: string;
  onValueChange?: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
  label?: string;
  emptyMessage?: string;
  searchPlaceholder?: string;
  className?: string;
  containerClassName?: string;
  /** Loading indicator shown inside the option list (e.g. while fetching). */
  loading?: boolean;
  /** When true, options are assumed already filtered by the parent — internal client-side filter is skipped. */
  serverFiltered?: boolean;
  /** Controlled search value. When provided, the internal search state is ignored. */
  searchValue?: string;
  /** Fires on every keystroke in the search input. Use for debounced server-side search. */
  onSearchChange?: (term: string) => void;
  /** Fires when the option list scrolls within ~24px of the bottom. Use for cursor-based load-more. */
  onScrollEnd?: () => void;
  /** Notified when the popover opens/closes. Use to lazy-load the first page. */
  onOpenChange?: (open: boolean) => void;
  disabled?: boolean;
}

export function Combobox({
  value,
  onValueChange,
  options,
  placeholder = "Select option...",
  label,
  emptyMessage = "No results found.",
  searchPlaceholder = "Search...",
  className,
  containerClassName,
  loading = false,
  serverFiltered = false,
  searchValue,
  onSearchChange,
  onScrollEnd,
  onOpenChange,
  disabled = false,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [internalSearch, setInternalSearch] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);
  const search = searchValue ?? internalSearch;

  const selectedOption = options.find((option) => option.value === value);

  const filteredOptions = React.useMemo(() => {
    if (serverFiltered || !search) return options;
    const term = search.toLowerCase();
    return options.filter(
      (option) =>
        option.label.toLowerCase().includes(term) || option.value.toLowerCase().includes(term)
    );
  }, [options, search, serverFiltered]);

  const handleScroll = React.useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      if (!onScrollEnd) return;
      const el = e.currentTarget;
      if (el.scrollHeight - el.scrollTop - el.clientHeight < 24) onScrollEnd();
    },
    [onScrollEnd]
  );

  return (
    <div className={cn("flex flex-col gap-1.5", containerClassName)}>
      {label && (
        <div className="px-1">
          <label className="text-[10px] font-bold text-primary dark:text-primary-300 uppercase tracking-wider">
            {label}
          </label>
        </div>
      )}
      <PopoverPrimitive.Root
        open={disabled ? false : open}
        onOpenChange={(v) => {
          if (disabled) return;
          setOpen(v);
          if (!v) {
            setInternalSearch("");
            onSearchChange?.("");
          }
          onOpenChange?.(v);
        }}
      >
        <PopoverPrimitive.Trigger asChild>
          <button
            type="button"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            title={selectedOption?.label}
            className={cn(
              "flex h-[40px] w-full items-center justify-between bg-white dark:bg-dark-surface border border-slate-200 dark:border-dark-border rounded-lg px-4 text-xs text-slate-900 dark:text-dark-text transition-all duration-300",
              "hover:border-slate-300 dark:hover:border-slate-600",
              "focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/10",
              "disabled:bg-slate-50 dark:disabled:bg-dark-bg disabled:text-slate-400 disabled:border-slate-100 dark:disabled:border-dark-border disabled:cursor-not-allowed",
              open && "border-primary ring-1 ring-primary/10",
              className
            )}
          >
            <span
              className={cn(
                "min-w-0 flex-1 truncate pe-2 text-left",
                !selectedOption && "text-slate-300 dark:text-slate-600 text-[11px]"
              )}
            >
              {selectedOption ? selectedOption.label : placeholder}
            </span>
            <ChevronDown
              size={16}
              className={cn(
                "text-slate-400 dark:text-slate-500 transition-colors shrink-0",
                open && "text-primary dark:text-primary-300"
              )}
            />
          </button>
        </PopoverPrimitive.Trigger>
        <PopoverPrimitive.Portal>
          <PopoverPrimitive.Content
            className="z-[200] w-[--radix-popover-trigger-width] rounded-xl border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-surface p-0 shadow-custom overflow-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2"
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
                onChange={(e) => {
                  const next = e.target.value;
                  if (searchValue === undefined) setInternalSearch(next);
                  onSearchChange?.(next);
                }}
                placeholder={searchPlaceholder}
                className="flex h-[40px] w-full bg-transparent py-3 text-xs text-slate-900 dark:text-dark-text outline-none placeholder:text-slate-300 dark:placeholder:text-slate-600 placeholder:text-[11px]"
              />
            </div>
            <div
              onScroll={handleScroll}
              className="max-h-[300px] overflow-y-auto p-1"
              role="listbox"
            >
              {filteredOptions.length === 0 && !loading && (
                <div className="py-6 text-center text-xs text-slate-400 dark:text-slate-500">
                  {emptyMessage}
                </div>
              )}
              {filteredOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={value === option.value}
                  onClick={() => {
                    onValueChange?.(option.value === value ? "" : option.value);
                    setOpen(false);
                    setInternalSearch("");
                    onSearchChange?.("");
                  }}
                  className={cn(
                    "relative flex w-full cursor-pointer items-center rounded-lg px-2 py-2 text-xs text-slate-700 dark:text-slate-300 outline-none transition-colors",
                    "hover:bg-slate-50 dark:hover:bg-dark-hover",
                    value === option.value &&
                      "bg-primary/5 dark:bg-primary/10 text-primary dark:text-primary-300 font-medium"
                  )}
                >
                  <span className="absolute start-2 flex h-4 w-4 items-center justify-center">
                    {value === option.value && (
                      <Check size={14} className="text-primary dark:text-primary-300" />
                    )}
                  </span>
                  <span className="ps-6">{option.label}</span>
                </button>
              ))}
              {loading && (
                <div className="px-3 py-2.5 text-center text-xs text-slate-400 dark:text-slate-500">
                  Loading...
                </div>
              )}
            </div>
          </PopoverPrimitive.Content>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>
    </div>
  );
}
