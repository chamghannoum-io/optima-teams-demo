import * as React from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";
import { cn } from "./utils.js";

/**
 * Switch — Cortex Design System (SKILL 5.18 Toggle)
 *
 * Checked: bg-emerald-500 (not blue-600)
 * Unchecked: bg-slate-300 dark:bg-slate-600
 * Focus: ring-[#2D3670]/30
 */

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      "peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow-sm transition-colors duration-200",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2D3670]/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-[#111827]",
      "disabled:cursor-not-allowed disabled:opacity-50",
      "data-[state=checked]:bg-emerald-500",
      "data-[state=unchecked]:bg-slate-300 dark:data-[state=unchecked]:bg-slate-600",
      className
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        "pointer-events-none block h-4 w-4 rounded-full bg-white shadow-lg ring-0 transition-transform duration-200",
        "data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0",
        "rtl:data-[state=checked]:translate-x-0 rtl:data-[state=unchecked]:translate-x-4"
      )}
    />
  </SwitchPrimitives.Root>
));
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };
