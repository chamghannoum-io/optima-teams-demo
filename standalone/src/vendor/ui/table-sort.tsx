import { useState } from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { ArrowUpDown, Check, ChevronUp, ChevronDown } from "lucide-react";
import { Button } from "./button.js";
import { cn } from "./utils.js";

export interface SortField {
  value: string;
  label: string;
}

export interface TableSortProps {
  fields: SortField[];
  value: { field: string; direction: "ASC" | "DESC" } | null;
  onChange: (value: { field: string; direction: "ASC" | "DESC" }) => void;
  labels?: {
    button?: string;
    sortBy?: string;
    direction?: string;
    ascending?: string;
    descending?: string;
  };
}

export function TableSort({ fields, value, onChange, labels }: TableSortProps) {
  const [open, setOpen] = useState(false);
  const isActive = value !== null;

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <Button variant="secondary" size="sm" data-testid="sort-button">
          <ArrowUpDown size={16} />
          {labels?.button ?? "Sort"}
          {isActive && (
            <span className="ml-1 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-primary px-1 text-xs font-semibold text-white">
              1
            </span>
          )}
        </Button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          className="z-50 w-64 rounded-xl border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-surface shadow-custom overflow-hidden outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2"
          align="end"
          sideOffset={4}
        >
          {/* Sort by section */}
          <div className="p-2">
            <div className="mb-1.5 px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              {labels?.sortBy ?? "Sort by"}
            </div>
            <div className="space-y-0.5">
              {fields.map((field) => {
                const isSelected = value?.field === field.value;
                return (
                  <button
                    key={field.value}
                    type="button"
                    onClick={() => {
                      onChange({
                        field: field.value,
                        direction: value?.direction ?? "DESC",
                      });
                    }}
                    data-testid={`sort-by-${field.value}`}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg px-2 py-2 text-xs transition-colors",
                      isSelected
                        ? "bg-primary/5 dark:bg-primary/10 text-primary dark:text-primary-300 font-medium"
                        : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-dark-hover"
                    )}
                  >
                    <span className="flex h-4 w-4 items-center justify-center">
                      {isSelected && (
                        <Check size={14} className="text-primary dark:text-primary-300" />
                      )}
                    </span>
                    {field.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-slate-100 dark:border-dark-border/50" />

          {/* Direction section */}
          <div className="p-2">
            <div className="mb-1.5 px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              {labels?.direction ?? "Direction"}
            </div>
            <div className="flex gap-1 rounded-lg bg-slate-50 dark:bg-dark-card p-1">
              <button
                type="button"
                onClick={() => {
                  if (value) {
                    onChange({ field: value.field, direction: "ASC" });
                  }
                }}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                  value?.direction === "ASC"
                    ? "bg-white dark:bg-dark-surface text-slate-900 dark:text-dark-text shadow-sm"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                )}
                data-testid="sort-asc-button"
              >
                <ChevronUp size={14} />
                {labels?.ascending ?? "Ascending"}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (value) {
                    onChange({ field: value.field, direction: "DESC" });
                  }
                }}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                  value?.direction === "DESC"
                    ? "bg-white dark:bg-dark-surface text-slate-900 dark:text-dark-text shadow-sm"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                )}
                data-testid="sort-desc-button"
              >
                <ChevronDown size={14} />
                {labels?.descending ?? "Descending"}
              </button>
            </div>
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
