/**
 * Compact readiness figures.
 *
 * Mirrors `rcm-dashboard/components/team-performance-kpi-boxes.tsx`: a slim box
 * with the icon beside the number, not the tall gradient card. Four of these sit
 * in the space the old three took, and they stop dominating the page.
 */
import type { LucideIcon } from "lucide-react";
import { cn } from "@optima/ui";

export type KpiTone = "default" | "red" | "amber" | "green";

const VALUE_CLASS: Record<KpiTone, string> = {
  default: "text-slate-900 dark:text-dark-text",
  red: "text-red-700 dark:text-red-300",
  amber: "text-amber-700 dark:text-amber-300",
  green: "text-green-700 dark:text-green-300",
};

const ICON_CLASS: Record<KpiTone, string> = {
  default: "text-slate-400 dark:text-slate-500",
  red: "text-red-500 dark:text-red-400",
  amber: "text-amber-500 dark:text-amber-400",
  green: "text-green-500 dark:text-green-400",
};

export interface KpiBoxProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone?: KpiTone;
  hint?: string;
  onClick?: () => void;
}

export function KpiBox({ label, value, icon: Icon, tone = "default", hint, onClick }: KpiBoxProps) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      {...(onClick ? { type: "button" as const, onClick } : {})}
      title={hint}
      className={cn(
        "flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-start dark:border-dark-border dark:bg-dark-card/40",
        onClick && "transition hover:border-slate-300 hover:bg-white dark:hover:bg-dark-hover",
      )}
    >
      <Icon size={16} className={ICON_CLASS[tone]} />
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {label}
        </span>
        <span className={cn("text-base font-bold leading-none", VALUE_CLASS[tone])}>
          {typeof value === "number" ? value.toLocaleString() : value}
        </span>
      </div>
    </Tag>
  );
}

export function KpiRow({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{children}</div>;
}
