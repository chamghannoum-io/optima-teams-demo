import React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "../utils.js";

type ButtonVariant =
  | "primary"
  | "green"
  | "outline"
  | "tertiary"
  | "blue"
  | "amber"
  | "red"
  | "redOutline"
  // Backward compat aliases from @optima/ui
  | "secondary"
  | "ghost"
  | "destructive";
type ButtonSize =
  | "L"
  | "S"
  // Backward compat aliases from @optima/ui
  | "sm"
  | "md"
  | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  leadingIcon?: LucideIcon;
  trailingIcon?: LucideIcon;
  children?: React.ReactNode;
  iconOnly?: boolean;
  round?: boolean;
  shortcut?: string;
}

const VARIANTS = {
  primary: "bg-primary text-white hover:bg-primary-600 border-transparent",
  green: "bg-emerald-600 text-white hover:bg-emerald-700 border-transparent",
  blue: "bg-blue-600 text-white hover:bg-blue-700 border-transparent",
  amber: "bg-amber-600 text-white hover:bg-amber-700 border-transparent",
  red: "bg-red-600 text-white hover:bg-red-700 border-transparent",
  redOutline:
    "bg-white dark:bg-dark-surface text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-300",
  outline:
    "bg-white dark:bg-dark-surface text-[#475569] dark:text-slate-300 border-[#E2E8F0] dark:border-dark-border hover:bg-slate-50 dark:hover:bg-dark-hover",
  tertiary:
    "bg-transparent text-[#475569] dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-dark-hover border-transparent",
  // Backward compat aliases (resolved via VARIANT_COMPAT before lookup)
  secondary:
    "bg-white dark:bg-dark-surface text-[#475569] dark:text-slate-300 border-[#E2E8F0] dark:border-dark-border hover:bg-slate-50 dark:hover:bg-dark-hover",
  ghost:
    "bg-transparent text-[#475569] dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-dark-hover border-transparent",
  destructive: "bg-red-600 text-white hover:bg-red-700 border-transparent",
} satisfies Record<ButtonVariant, string>;

const SHADOW = "hover:shadow-lg hover:shadow-slate-200/50 dark:hover:shadow-black/20";

// Backward compat: map old variant/size names to new ones
const VARIANT_COMPAT: Record<string, keyof typeof VARIANTS> = {
  secondary: "outline",
  ghost: "tertiary",
  destructive: "red",
};
const SIZE_COMPAT: Record<string, "L" | "S"> = {
  sm: "S",
  md: "S",
  lg: "L",
};

const Button: React.FC<ButtonProps> = ({
  variant: variantProp = "primary",
  size: sizeProp = "L",
  fullWidth = false,
  leadingIcon: LeadingIcon,
  trailingIcon: TrailingIcon,
  children,
  iconOnly = false,
  round = false,
  shortcut,
  className,
  ...props
}) => {
  const variant = (VARIANT_COMPAT[variantProp] ?? variantProp) as keyof typeof VARIANTS;
  const size = (SIZE_COMPAT[sizeProp] ?? sizeProp) as "L" | "S";
  const iconSize = size === "L" ? 18 : 14;

  if (iconOnly && LeadingIcon) {
    return (
      <button
        className={cn(
          "inline-flex items-center justify-center transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none border",
          VARIANTS[variant],
          size === "L" ? "p-2" : "p-1.5",
          round ? "rounded-full" : "rounded-lg",
          SHADOW,
          className
        )}
        {...props}
      >
        <LeadingIcon size={iconSize} strokeWidth={2.5} />
      </button>
    );
  }

  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none border font-sans whitespace-nowrap",
        fullWidth && "w-full",
        VARIANTS[variant],
        size === "L"
          ? cn("px-6 h-[44px] text-sm font-semibold rounded-lg", !children && "px-3")
          : cn("px-4 h-[40px] text-xs font-semibold rounded-lg", !children && "px-2.5"),
        SHADOW,
        className
      )}
      {...props}
    >
      {LeadingIcon && <LeadingIcon size={iconSize} strokeWidth={2.5} />}
      {children && <span>{children}</span>}
      {TrailingIcon && <TrailingIcon size={iconSize} strokeWidth={2.5} />}
      {shortcut && (
        <kbd className="ml-0.5 inline-flex items-center justify-center min-w-[16px] h-4 px-1 text-[9px] font-bold rounded border border-current/40 bg-current/10 leading-none tracking-tighter">
          {shortcut}
        </kbd>
      )}
    </button>
  );
};

export default Button;
