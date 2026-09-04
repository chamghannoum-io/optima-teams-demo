import React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "../utils.js";

interface CortexKPICardProps {
  label: string;
  value: React.ReactNode;
  subValue?: React.ReactNode;
  trend?: React.ReactNode;
  color?: "green" | "red" | "blue" | "orange" | "slate" | "primary" | "violet";
  icon?: LucideIcon;
  variant?: "icon" | "plain";
  className?: string;
}

const COLOR_MAP = {
  green: "to-emerald-100/60 dark:to-emerald-900/20",
  red: "to-red-100/60 dark:to-red-900/20",
  blue: "to-blue-100/60 dark:to-blue-900/20",
  orange: "to-orange-100/60 dark:to-orange-900/20",
  slate: "to-slate-100/60 dark:to-slate-800/30",
  primary: "to-primary/10 dark:to-primary/5",
  violet: "to-violet-100/60 dark:to-violet-900/20",
};

const ICON_COLOR_MAP = {
  green: "text-emerald-600 dark:text-emerald-400",
  red: "text-red-600 dark:text-red-400",
  blue: "text-blue-600 dark:text-blue-400",
  orange: "text-orange-600 dark:text-orange-400",
  slate: "text-slate-500 dark:text-slate-400",
  primary: "text-primary dark:text-primary-300",
  violet: "text-violet-600 dark:text-violet-400",
};

const CortexKPICard: React.FC<CortexKPICardProps> = ({
  label,
  value,
  subValue,
  trend,
  color = "slate",
  icon: Icon,
  variant,
  className,
}) => {
  const resolvedVariant = variant ?? (Icon ? "icon" : "plain");

  return (
    <div
      className={cn(
        "p-5 rounded-xl bg-white dark:bg-dark-surface bg-gradient-to-br from-white dark:from-dark-surface via-white dark:via-dark-surface shadow-custom flex flex-col justify-between min-h-[120px]",
        COLOR_MAP[color],
        className
      )}
    >
      <div>
        {resolvedVariant === "icon" && Icon && (
          <div
            className={cn(
              "p-2 bg-white/60 dark:bg-dark-card/60 rounded-lg border border-slate-100 dark:border-dark-border/50 inline-flex mb-3",
              ICON_COLOR_MAP[color]
            )}
          >
            <Icon size={16} strokeWidth={2} />
          </div>
        )}
        <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-3 uppercase tracking-wider">
          {label}
        </div>
        <div className="text-2xl font-bold text-slate-900 dark:text-dark-text">{value}</div>
        {subValue && (
          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
            {subValue}
          </div>
        )}
      </div>
      {trend && <div className="mt-2">{trend}</div>}
    </div>
  );
};

export default CortexKPICard;
