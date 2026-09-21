/**
 * Port of `@/shared/autocomplete/ApiAutocomplete` and `@/autocompletes`.
 *
 * This is the real component, not a stand-in: Radix popover trigger, debounced
 * server search, infinite scroll on the relay connection, multi-select with
 * removable tags. Props, markup and class names follow
 * `provider-app/apps/provider/src/shared/autocomplete/ApiAutocomplete.tsx` so a
 * picker here looks and behaves exactly like every other picker in Optima.
 *
 * Only the data source differs: the configs below point at the local schema
 * instead of the gateway.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { useQuery } from "@apollo/client";
import { Check, ChevronsUpDown, Loader2, Search, X } from "lucide-react";

import { cn } from "../ui/utils.js";
import {
  createAutocompleteQueryConfig,
  extractNodes,
  extractPageInfo,
  isBaseOption,
  mapToBaseOptions,
  type AutocompleteApiConfig,
  type IBaseOption,
} from "./shared.js";
import { DimensionOptionsDocument, RcmUsersDocument } from "./generated.js";

const DEFAULT_PAGE_SIZE = 20;
const DEBOUNCE_MS = 300;
const FETCH_MORE_THRESHOLD_PX = 50;

export interface ApiAutocompleteProps {
  config: AutocompleteApiConfig;
  value?: IBaseOption | IBaseOption[] | null;
  onChange: (val: IBaseOption | IBaseOption[] | null) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  /** Additional filter variables merged into the query alongside the search key. */
  filter?: Record<string, unknown>;
  multiple?: boolean;
  className?: string;
  hideOption?: (value: any) => boolean;
  /** When true and multiple=true, shows selected items as removable tags. */
  showMultipleAsTags?: boolean;
  /** Tags shown before "(X more)". Default 4. */
  maxVisibleTags?: number;
  name?: string;
}

export function ApiAutocomplete({
  config,
  value,
  onChange,
  label,
  placeholder = "Select...",
  disabled,
  filter: extraFilter,
  multiple = false,
  className,
  hideOption,
  showMultipleAsTags = false,
  maxVisibleTags = 4,
  name,
}: ApiAutocompleteProps) {
  const { useQuery: useConfigQuery, keyBy, labelBy, searchKey } = config;

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fetchingMoreRef = useRef(false);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(search), DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search]);

  // Build query variables: merge extra filter + search key.
  const variables = useMemo(() => {
    const searchFilter = searchKey && debouncedSearch ? { [searchKey]: debouncedSearch } : {};
    return { first: DEFAULT_PAGE_SIZE, filter: { ...extraFilter, ...searchFilter } };
  }, [debouncedSearch, searchKey, extraFilter]);

  useEffect(() => {
    fetchingMoreRef.current = false;
  }, [variables]);

  const { data: queryData, loading, fetchMore } = useConfigQuery({
    variables,
    fetchPolicy: "no-cache",
    skip: disabled || !open,
  });

  // Relay connection is under the first key of the response.
  const connectionKey = queryData ? Object.keys(queryData)[0] : undefined;
  const connection = connectionKey ? (queryData as any)?.[connectionKey] : undefined;
  const items = extractNodes(connection);
  const pageInfo = extractPageInfo(connection);

  const baseOptions = useMemo(
    () => mapToBaseOptions(items as any[], keyBy, labelBy),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items],
  );
  const options = useMemo(
    () => (hideOption ? baseOptions.filter((o) => !hideOption(o.value)) : baseOptions),
    [baseOptions, hideOption],
  );

  const displayValue = useMemo(() => {
    if (!value) return null;
    if (Array.isArray(value)) {
      if (value.length === 0) return null;
      if (value.length === 1) return value[0]?.label ?? null;
      return `${value.length} selected`;
    }
    return isBaseOption(value) ? value.label : null;
  }, [value]);

  const isSelected = (opt: IBaseOption) => {
    if (!value) return false;
    if (Array.isArray(value)) return value.some((v) => v.key === opt.key);
    return isBaseOption(value) && value.key === opt.key;
  };

  const handleSelect = (opt: IBaseOption) => {
    if (multiple) {
      const arr = Array.isArray(value) ? value : value ? [value as IBaseOption] : [];
      const next = arr.some((v) => v.key === opt.key)
        ? arr.filter((v) => v.key !== opt.key)
        : [...arr, opt];
      onChange(next);
      return;
    }
    onChange(opt);
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(multiple ? [] : null);
  };

  const handleRemoveTag = (e: React.MouseEvent, optionKey: string) => {
    e.stopPropagation();
    if (!Array.isArray(value)) return;
    onChange(value.filter((v) => v.key !== optionKey));
  };

  const handleScroll = useCallback(() => {
    const el = listRef.current;
    if (!el || !fetchMore || fetchingMoreRef.current || loading) return;
    if (!pageInfo.hasNextPage) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight > FETCH_MORE_THRESHOLD_PX) return;
    fetchingMoreRef.current = true;
    fetchMore({ variables: { ...variables, after: pageInfo.endCursor } }).finally(() => {
      fetchingMoreRef.current = false;
    });
  }, [fetchMore, loading, pageInfo, variables]);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setSearch("");
      setDebouncedSearch("");
      fetchingMoreRef.current = false;
    }
  };

  return (
    <div className={cn("relative", className)} data-rhf-field={name}>
      {label && (
        <label className="mb-1.5 block px-1 text-[10px] font-bold uppercase tracking-wider text-primary dark:text-primary-300">
          {label}
        </label>
      )}
      <PopoverPrimitive.Root open={open} onOpenChange={handleOpenChange}>
        <PopoverPrimitive.Trigger asChild>
          <button
            type="button"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn(
              "flex w-full items-center justify-between rounded-lg border border-slate-200 dark:border-dark-border",
              "bg-white px-4 text-xs dark:bg-dark-surface",
              "text-slate-900 dark:text-dark-text",
              "hover:border-slate-300 dark:hover:border-slate-600",
              "focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/10",
              "disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 dark:disabled:bg-dark-bg",
              "transition-all duration-300",
              showMultipleAsTags && multiple && Array.isArray(value) && value.length > 0
                ? "min-h-[40px] py-1.5"
                : "h-[40px]",
            )}
          >
            {showMultipleAsTags && multiple && Array.isArray(value) && value.length > 0 ? (
              <div className="flex flex-1 flex-wrap items-center gap-1 py-0.5">
                {value.slice(0, maxVisibleTags).map((item) => (
                  <span
                    key={item.key}
                    className="inline-flex max-w-[15rem] items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-800 dark:bg-dark-surface dark:text-dark-text"
                  >
                    <span className="truncate">{item.label}</span>
                    {/* A span, not a button: the trigger is already a button and
                        nesting them breaks keyboard navigation. */}
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => handleRemoveTag(e, item.key)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          handleRemoveTag(e as unknown as React.MouseEvent, item.key);
                        }
                      }}
                      className="cursor-pointer text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
                      aria-label={`Remove ${item.label}`}
                    >
                      ×
                    </span>
                  </span>
                ))}
                {value.length > maxVisibleTags && (
                  <span className="inline-flex items-center px-2 py-0.5 text-xs text-slate-500 dark:text-slate-400">
                    ({value.length - maxVisibleTags} more)
                  </span>
                )}
              </div>
            ) : (
              <span
                className={cn("truncate", !displayValue && "text-slate-400 dark:text-slate-500")}
              >
                {displayValue ?? placeholder}
              </span>
            )}
            <span className="ml-2 flex shrink-0 items-center gap-1">
              {displayValue && !showMultipleAsTags && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={handleClear}
                  className="rounded-full p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:bg-dark-elevated dark:hover:bg-dark-hover"
                >
                  <X size={14} />
                </span>
              )}
              <ChevronsUpDown size={16} className="opacity-50" />
            </span>
          </button>
        </PopoverPrimitive.Trigger>

        <PopoverPrimitive.Portal>
          <PopoverPrimitive.Content
            className={cn(
              "z-[99999] rounded-md border border-slate-200 dark:border-dark-border",
              "bg-white p-0 shadow-md outline-none dark:bg-dark-bg",
            )}
            style={{
              width: "var(--radix-popover-trigger-width)",
              maxWidth: "var(--radix-popover-trigger-width)",
            }}
            align="start"
            sideOffset={4}
            onOpenAutoFocus={(e) => {
              e.preventDefault();
              inputRef.current?.focus();
            }}
          >
            <div className="flex items-center overflow-hidden border-b border-slate-200 px-3 dark:border-dark-border">
              <Search size={16} className="mr-2 shrink-0 opacity-50" />
              <input
                ref={inputRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className="flex h-10 w-full min-w-0 bg-transparent py-3 text-sm outline-none placeholder:text-slate-400 dark:text-dark-text dark:placeholder:text-slate-500"
              />
              {loading && <Loader2 size={16} className="shrink-0 animate-spin text-slate-400" />}
            </div>

            <div
              ref={listRef}
              onScroll={handleScroll}
              onWheel={(e) => e.stopPropagation()}
              className={cn(
                "overflow-y-auto overflow-x-hidden overscroll-contain p-1",
                loading && options.length === 0 ? "h-[280px]" : "max-h-[280px]",
              )}
              role="listbox"
            >
              {loading && options.length === 0 && (
                <div className="flex h-full items-center justify-center">
                  <Loader2 size={20} className="animate-spin text-slate-400" />
                </div>
              )}
              {options.length === 0 && !loading && (
                <div className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                  No results found.
                </div>
              )}
              {options.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  role="option"
                  aria-selected={isSelected(opt)}
                  onClick={() => handleSelect(opt)}
                  className="relative flex w-full cursor-pointer items-center overflow-hidden rounded-sm px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-100 dark:bg-dark-elevated dark:text-dark-text dark:hover:bg-slate-800"
                >
                  <span className="mr-2 flex h-4 w-4 shrink-0 items-center justify-center">
                    {isSelected(opt) && <Check size={16} className="text-blue-600" />}
                  </span>
                  <span className="block truncate">{opt.label}</span>
                  {(opt.value as any)?.perDay > 0 && (
                    <span className="ml-auto shrink-0 pl-2 text-[11px] tabular-nums text-slate-400">
                      {(opt.value as any).perDay}/day
                    </span>
                  )}
                </button>
              ))}
              {pageInfo.hasNextPage && (
                <div className="py-2 text-center text-xs text-slate-400 dark:text-slate-500">
                  Scroll for more…
                </div>
              )}
            </div>
          </PopoverPrimitive.Content>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>
    </div>
  );
}

/**
 * The autocomplete registry, mirroring `@/autocompletes`.
 *
 * `dimensionOptions` is one paginated, searchable source that every routing
 * dimension binds to through the `filter.dimension` variable, which is what lets
 * a dimension added to the registry get a real Optima picker with no new wiring.
 */
export const autocompleteQueriesMapper = {
  dimensionOptions: createAutocompleteQueryConfig({
    useQuery: (opts: any) => useQuery(DimensionOptionsDocument, opts),
    keyBy: "id",
    labelBy: (item: any) => item?.name ?? item?.id ?? "",
    searchKey: "name_Icontains",
  }),
  rcmUser: createAutocompleteQueryConfig({
    useQuery: (opts: any) => useQuery(RcmUsersDocument, opts),
    keyBy: "id",
    labelBy: (item: any) =>
      [item?.firstName, item?.lastName].filter(Boolean).join(" ") || item?.email || item?.id || "",
    searchKey: "search",
  }),
};

export default ApiAutocomplete;
