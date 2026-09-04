import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "./utils.js";

/**
 * Button — Cortex Design System (SKILL 5.1)
 *
 * 9 variants: primary (#2D3670), green, blue, amber, red, outline, tertiary (ghost), destructive (redOutline), link
 * 2 sizes: L (h-[44px] px-6 text-sm), S (h-[40px] px-4 text-xs) — mapped from sm/md/lg
 * Radius: rounded-lg (--radius-button: 8px)
 * Active: active:scale-[0.98]
 * Hover: hover:shadow-lg
 *
 * Backward compat: "primary"|"secondary"|"ghost"|"destructive" maps to Cortex equivalents
 */

type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "destructive"
  | "green"
  | "blue"
  | "amber"
  | "red"
  | "outline"
  | "tertiary"
  | "redOutline"
  | "link";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  "data-testid"?: string;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: "bg-primary text-white hover:bg-primary-600 border-transparent",
  green: "bg-emerald-600 text-white hover:bg-emerald-700 border-transparent",
  blue: "bg-blue-600 text-white hover:bg-blue-700 border-transparent",
  amber: "bg-amber-600 text-white hover:bg-amber-700 border-transparent",
  red: "bg-red-600 text-white hover:bg-red-700 border-transparent",
  outline:
    "bg-white dark:bg-dark-surface text-slate-600 dark:text-slate-300 border-slate-200 dark:border-dark-border hover:bg-slate-50 dark:hover:bg-dark-hover",
  // Backward compat: "secondary" = outline
  secondary:
    "bg-white dark:bg-dark-surface text-slate-600 dark:text-slate-300 border-slate-200 dark:border-dark-border hover:bg-slate-50 dark:hover:bg-dark-hover",
  tertiary:
    "bg-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-dark-hover border-transparent",
  // Backward compat: "ghost" = tertiary
  ghost:
    "bg-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-dark-hover border-transparent",
  destructive: "bg-red-600 text-white hover:bg-red-700 border-transparent",
  redOutline:
    "bg-white dark:bg-dark-surface text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20",
  // Inline text action ("Reset to defaults", "+ Add rule") — no chrome, no fixed height.
  link: "bg-transparent border-transparent font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline hover:shadow-none active:scale-100",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "h-[40px] px-4 text-xs",
  md: "h-[40px] px-4 text-xs",
  lg: "h-[44px] px-6 text-sm",
};

/** `link` flows inline with its surrounding text, so it opts out of the fixed button box. */
const linkSizeStyles: Record<ButtonSize, string> = {
  sm: "h-auto p-0 text-xs",
  md: "h-auto p-0 text-xs",
  lg: "h-auto p-0 text-sm",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant = "primary", size = "md", disabled, "data-testid": testId, ...props },
    ref
  ) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-lg font-semibold border whitespace-nowrap",
          "transition-all active:scale-[0.98]",
          "hover:shadow-lg hover:shadow-slate-200/50 dark:hover:shadow-black/20",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
          "disabled:opacity-50 disabled:pointer-events-none",
          variantStyles[variant],
          variant === "link" ? linkSizeStyles[size] : sizeStyles[size],
          disabled && "cursor-not-allowed",
          className
        )}
        disabled={disabled}
        data-testid={testId}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
