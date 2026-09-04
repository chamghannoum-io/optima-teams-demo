import React from "react";
import { cn } from "../utils.js";
import { motion } from "motion/react";

export type ProgressBarSize = "xs" | "sm" | "md" | "lg";
export type ProgressBarColor = "green" | "red" | "blue" | "amber" | "primary" | "slate" | "auto";

export interface ProgressBarProps {
  value: number;
  max?: number;
  color?: ProgressBarColor;
  thresholds?: { danger: number; warning: number };
  size?: ProgressBarSize;
  animated?: boolean;
  showLabel?: boolean;
  labelFormatter?: (value: number, max: number) => string;
  className?: string;
}

const HEIGHT: Record<ProgressBarSize, string> = { xs: "h-1", sm: "h-1.5", md: "h-2", lg: "h-3" };
const COLOR: Record<Exclude<ProgressBarColor, "auto">, string> = {
  green: "bg-emerald-500",
  red: "bg-red-500",
  blue: "bg-blue-500",
  amber: "bg-amber-500",
  primary: "bg-primary",
  slate: "bg-slate-400",
};
const TEXT_COLOR: Record<Exclude<ProgressBarColor, "auto">, string> = {
  green: "text-emerald-600 dark:text-emerald-400",
  red: "text-red-600 dark:text-red-400",
  blue: "text-blue-600 dark:text-blue-400",
  amber: "text-amber-600 dark:text-amber-400",
  primary: "text-primary dark:text-primary-300",
  slate: "text-slate-500 dark:text-slate-400",
};

function resolveColor(
  pct: number,
  thresholds: { danger: number; warning: number }
): Exclude<ProgressBarColor, "auto"> {
  if (pct <= thresholds.danger) return "red";
  if (pct <= thresholds.warning) return "amber";
  return "green";
}

const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  max = 100,
  color = "auto",
  thresholds = { danger: 40, warning: 70 },
  size = "md",
  animated = false,
  showLabel = false,
  labelFormatter,
  className,
}) => {
  const pct = Math.min(Math.max((value / max) * 100, 0), 100);
  const resolved = color === "auto" ? resolveColor(pct, thresholds) : color;
  const label = labelFormatter ? labelFormatter(value, max) : `${Math.round(pct)}%`;
  const BarInner = animated ? motion.div : "div";
  const barProps = animated
    ? {
        initial: { width: 0 },
        animate: { width: `${pct}%` },
        transition: { duration: 0.6, ease: "easeOut" as const },
      }
    : { style: { width: `${pct}%` } };

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div
        className={cn(
          "flex-1 bg-slate-100 dark:bg-dark-elevated rounded-full overflow-hidden",
          HEIGHT[size]
        )}
      >
        <BarInner
          className={cn(
            "h-full rounded-full transition-all duration-500 ease-out",
            COLOR[resolved]
          )}
          {...barProps}
        />
      </div>
      {showLabel && (
        <span
          className={cn("text-xs font-semibold w-10 text-right tabular-nums", TEXT_COLOR[resolved])}
        >
          {label}
        </span>
      )}
    </div>
  );
};

export default ProgressBar;
