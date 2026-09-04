import { type HTMLAttributes, forwardRef } from "react";
import { cn } from "./utils.js";

/**
 * Badge — Cortex Design System (SKILL 5.12)
 *
 * Uses CSS custom properties from badge-colors defined in styles.css.
 * rounded-full, text-xs font-medium, semantic dark patterns.
 */

type BadgeVariant = "default" | "success" | "warning" | "error" | "info";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantStyles: Record<BadgeVariant, string> = {
  default:
    "bg-slate-100 dark:bg-slate-500/10 text-slate-600 dark:text-[#94A3B8] border border-slate-200 dark:border-slate-500/20",
  success:
    "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20",
  warning:
    "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20",
  error:
    "bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-500/20",
  info: "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20",
};

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = "default", ...props }, ref) => (
    <span
      ref={ref}
      className={cn(
        "inline-flex items-center rounded-full px-2 py-[3px] text-[11px] font-semibold leading-tight whitespace-nowrap",
        variantStyles[variant],
        className
      )}
      {...props}
    />
  )
);
Badge.displayName = "Badge";
