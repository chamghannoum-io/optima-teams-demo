import { memo } from "react";
import { cn } from "./utils.js";
import type { ReactNode } from "react";

export type AccentColor = "blue" | "green" | "amber" | "red" | "purple" | "indigo" | "teal";

const accentStyles: Record<
  AccentColor,
  {
    bg: string;
    border: string;
    hoverBorder: string;
    iconBg: string;
    iconText: string;
    title: string;
    value: string;
    circle: string;
  }
> = {
  blue: {
    bg: "bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/30 dark:to-gray-800",
    border: "border-blue-100 dark:border-blue-900/40",
    hoverBorder: "hover:border-blue-400 dark:hover:border-blue-500",
    iconBg: "bg-blue-100 dark:bg-blue-900/50",
    iconText: "text-blue-600 dark:text-blue-400",
    title: "text-blue-700 dark:text-blue-300",
    value: "text-blue-600 dark:text-blue-400",
    circle: "bg-blue-100/60 dark:bg-blue-800/20",
  },
  green: {
    bg: "bg-gradient-to-br from-green-50 to-white dark:from-green-950/30 dark:to-gray-800",
    border: "border-green-100 dark:border-green-900/40",
    hoverBorder: "hover:border-green-400 dark:hover:border-green-500",
    iconBg: "bg-green-100 dark:bg-green-900/50",
    iconText: "text-green-600 dark:text-green-400",
    title: "text-green-700 dark:text-green-300",
    value: "text-green-600 dark:text-green-400",
    circle: "bg-green-100/60 dark:bg-green-800/20",
  },
  amber: {
    bg: "bg-gradient-to-br from-amber-50 to-white dark:from-amber-950/30 dark:to-gray-800",
    border: "border-amber-100 dark:border-amber-900/40",
    hoverBorder: "hover:border-amber-400 dark:hover:border-amber-500",
    iconBg: "bg-amber-100 dark:bg-amber-900/50",
    iconText: "text-amber-600 dark:text-amber-400",
    title: "text-amber-700 dark:text-amber-300",
    value: "text-amber-600 dark:text-amber-400",
    circle: "bg-amber-100/60 dark:bg-amber-800/20",
  },
  red: {
    bg: "bg-gradient-to-br from-red-50 to-white dark:from-red-950/30 dark:to-gray-800",
    border: "border-red-100 dark:border-red-900/40",
    hoverBorder: "hover:border-red-400 dark:hover:border-red-500",
    iconBg: "bg-red-100 dark:bg-red-900/50",
    iconText: "text-red-600 dark:text-red-400",
    title: "text-red-700 dark:text-red-300",
    value: "text-red-600 dark:text-red-400",
    circle: "bg-red-100/60 dark:bg-red-800/20",
  },
  purple: {
    bg: "bg-gradient-to-br from-purple-50 to-white dark:from-purple-950/30 dark:to-gray-800",
    border: "border-purple-100 dark:border-purple-900/40",
    hoverBorder: "hover:border-purple-400 dark:hover:border-purple-500",
    iconBg: "bg-purple-100 dark:bg-purple-900/50",
    iconText: "text-purple-600 dark:text-purple-400",
    title: "text-purple-700 dark:text-purple-300",
    value: "text-purple-600 dark:text-purple-400",
    circle: "bg-purple-100/60 dark:bg-purple-800/20",
  },
  indigo: {
    bg: "bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-950/30 dark:to-gray-800",
    border: "border-indigo-100 dark:border-indigo-900/40",
    hoverBorder: "hover:border-indigo-400 dark:hover:border-indigo-500",
    iconBg: "bg-indigo-100 dark:bg-indigo-900/50",
    iconText: "text-indigo-600 dark:text-indigo-400",
    title: "text-indigo-700 dark:text-indigo-300",
    value: "text-indigo-600 dark:text-indigo-400",
    circle: "bg-indigo-100/60 dark:bg-indigo-800/20",
  },
  teal: {
    bg: "bg-gradient-to-br from-teal-50 to-white dark:from-teal-950/30 dark:to-gray-800",
    border: "border-teal-100 dark:border-teal-900/40",
    hoverBorder: "hover:border-teal-400 dark:hover:border-teal-500",
    iconBg: "bg-teal-100 dark:bg-teal-900/50",
    iconText: "text-teal-600 dark:text-teal-400",
    title: "text-teal-700 dark:text-teal-300",
    value: "text-teal-600 dark:text-teal-400",
    circle: "bg-teal-100/60 dark:bg-teal-800/20",
  },
};

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  trend?: { value: number; label: string };
  accent?: AccentColor;
  className?: string;
}

export const KPICard = memo(function KPICard({
  title,
  value,
  subtitle,
  icon,
  trend,
  accent,
  className,
}: KPICardProps) {
  const styles = accent ? accentStyles[accent] : null;

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border px-4 py-4",
        "shadow-custom transition-all duration-200 hover:-translate-y-0.5",
        styles
          ? [styles.bg, styles.border, styles.hoverBorder]
          : "border-gray-200 bg-white hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-gray-600",
        className
      )}
    >
      {/* Decorative circle — bottom right */}
      {styles && (
        <div
          className={cn(
            "pointer-events-none absolute -bottom-6 -right-6 h-20 w-20 rounded-full transition-transform duration-300 group-hover:scale-110",
            styles.circle
          )}
        />
      )}

      {/* Top row: icon + value */}
      <div className="relative flex items-start justify-between">
        {icon && styles ? (
          <div
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
              styles.iconBg,
              styles.iconText
            )}
          >
            {icon}
          </div>
        ) : (
          <div />
        )}
        <p
          className={cn(
            "text-2xl font-bold tabular-nums",
            styles?.value ?? "text-gray-900 dark:text-gray-100"
          )}
        >
          {value}
        </p>
      </div>

      {/* Bottom: title + subtitle/trend */}
      <div className="relative mt-3">
        <p
          className={cn(
            "text-sm font-semibold",
            styles?.title ?? "text-gray-900 dark:text-gray-100"
          )}
        >
          {title}
        </p>
        {subtitle && (
          <p className="mt-0.5 text-[11px] text-gray-400 dark:text-gray-500">{subtitle}</p>
        )}
        {trend && (
          <p
            className={cn(
              "mt-1 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-medium",
              trend.value >= 0
                ? "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                : "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400"
            )}
          >
            {trend.value >= 0 ? "\u2191" : "\u2193"} {Math.abs(trend.value)}% {trend.label}
          </p>
        )}
      </div>
    </div>
  );
});
