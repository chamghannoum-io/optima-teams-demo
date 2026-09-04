import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import { cn } from "./utils.js";

/**
 * Label — Cortex Design System (SKILL 5.2 label pattern)
 *
 * text-[10px] font-bold text-[#2D3670] dark:text-[#a5b1db] uppercase tracking-wider
 * Micro label rule: any text-[10px] label MUST be uppercase tracking-widest font-bold
 */

export const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn(
      "text-[10px] font-bold leading-none uppercase tracking-wider",
      "text-[#2D3670] dark:text-[#a5b1db]",
      "peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
      className
    )}
    {...props}
  />
));
Label.displayName = LabelPrimitive.Root.displayName;
