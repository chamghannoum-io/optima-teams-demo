import React from "react";
import type { LucideIcon } from "lucide-react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "../utils.js";
import Dot from "./dot.js";
import type { BadgeColor } from "./badge-colors.js";

export type TrendDirection = "up" | "down" | "neutral";

export interface TrendProps {
  label: string;
  direction?: TrendDirection;
  icon?: LucideIcon;
  color?: "green" | "red" | "amber" | "blue" | "slate" | "primary";
  dot?: BadgeColor;
  italic?: boolean;
  className?: string;
}

const COLOR_MAP: Record<NonNullable<TrendProps["color"]>, string> = {
  green: "text-emerald-600 dark:text-emerald-400",
  red: "text-red-600 dark:text-red-400",
  amber: "text-amber-600 dark:text-amber-400",
  blue: "text-blue-600 dark:text-blue-400",
  slate: "text-slate-500 dark:text-slate-400",
  primary: "text-primary dark:text-primary-300",
};

const DIR_COLOR: Record<TrendDirection, NonNullable<TrendProps["color"]>> = {
  up: "green",
  down: "red",
  neutral: "slate",
};
const DIR_ICON: Record<TrendDirection, LucideIcon> = {
  up: TrendingUp,
  down: TrendingDown,
  neutral: Minus,
};

const Trend: React.FC<TrendProps> = ({ label, direction, icon, color, dot, italic, className }) => {
  const resolvedColor = color ?? (direction ? DIR_COLOR[direction] : "slate");
  const showIcon = !dot && (icon || direction);
  const Icon = icon ?? (direction ? DIR_ICON[direction] : undefined);
  const isItalic = italic ?? (!showIcon && !dot);

  return (
    <div
      className={cn(
        "flex items-center gap-1 text-[10px] font-bold",
        COLOR_MAP[resolvedColor],
        isItalic && "italic",
        className
      )}
    >
      {dot && <Dot color={dot} size="sm" />}
      {showIcon && Icon && <Icon size={10} />}
      <span>{label}</span>
    </div>
  );
};

export default Trend;
