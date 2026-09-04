import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { cn } from "./utils.js";

/**
 * Select — Cortex Design System (SKILL 5.3)
 *
 * Same styling as Input with appearance-none + built-in ChevronDown.
 * Dropdown: bg-white dark:bg-dark-surface, border dark:border-dark-border, rounded-md
 */

export function Select({
  dir,
  ...props
}: React.ComponentPropsWithoutRef<typeof SelectPrimitive.Root>) {
  const docDir = typeof document !== "undefined" ? document.documentElement.dir : "ltr";
  const resolvedDir: "ltr" | "rtl" = dir ?? ((docDir === "rtl" ? "rtl" : "ltr") as "ltr" | "rtl");
  return <SelectPrimitive.Root dir={resolvedDir} {...props} />;
}

export const SelectValue = SelectPrimitive.Value;

export const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger> & { "data-testid"?: string }
>(({ className, children, "data-testid": testId, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      "flex h-[40px] w-full items-center justify-between rounded-md px-4 text-xs",
      "border border-slate-200 dark:border-dark-border",
      "bg-white dark:bg-dark-surface",
      "text-slate-900 dark:text-dark-text",
      "placeholder:text-slate-300 dark:placeholder:text-slate-600",
      "hover:border-slate-300 dark:hover:border-slate-600",
      "focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/10",
      "disabled:bg-slate-50 dark:disabled:bg-dark-bg disabled:text-slate-400 disabled:cursor-not-allowed",
      "transition-all duration-300",
      className
    )}
    data-testid={testId}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <svg
        className="h-4 w-4 text-slate-400 dark:text-slate-500 shrink-0"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
));
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;

export const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = "popper", ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      className={cn(
        "relative z-[100] max-h-96 min-w-[8rem] overflow-hidden rounded-md",
        "border border-slate-200 dark:border-dark-border",
        "bg-white dark:bg-dark-surface",
        "text-slate-900 dark:text-dark-text",
        "shadow-custom dark:shadow-[0_0_12px_0_rgba(0,0,0,0.3)]",
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        position === "popper" &&
          "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
        className
      )}
      position={position}
      {...props}
    >
      <SelectPrimitive.Viewport
        className={cn(
          "p-1",
          position === "popper" &&
            "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]"
        )}
      >
        {children}
      </SelectPrimitive.Viewport>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
));
SelectContent.displayName = SelectPrimitive.Content.displayName;

export const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item> & { "data-testid"?: string }
>(({ className, children, "data-testid": testId, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex w-full cursor-default select-none items-center rounded-md py-2 ps-8 pe-3 text-xs outline-none",
      "focus:bg-slate-50 dark:focus:bg-dark-hover",
      "focus:text-slate-900 dark:focus:text-dark-text",
      "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      "transition-colors",
      className
    )}
    data-testid={testId}
    {...props}
  >
    <span className="absolute start-2 flex h-3.5 w-3.5 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <svg
          className="h-4 w-4 text-primary dark:text-primary-300"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
            clipRule="evenodd"
          />
        </svg>
      </SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
));
SelectItem.displayName = SelectPrimitive.Item.displayName;
