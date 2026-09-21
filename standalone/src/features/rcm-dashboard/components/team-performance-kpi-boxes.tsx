import { useTranslation } from "react-i18next";
import { Users, CheckCircle, AlertCircle, AlertTriangle } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/components/enhanced";
import type { MemberRow } from "./team-performance-helpers";

interface KpiTotals {
  totalMembers: number;
  totalAssigned: number;
  completed: number;
  overdue: number;
  overlimitCount: number;
}

export function computeKpiTotals(rows: MemberRow[]): KpiTotals {
  return {
    totalMembers: rows.length,
    totalAssigned: rows.reduce((s, r) => s + Number(r.totalAssigned ?? 0), 0),
    completed: rows.reduce((s, r) => s + Number(r.completed ?? 0), 0),
    overdue: rows.reduce((s, r) => s + Number(r.overdue ?? 0), 0),
    overlimitCount: rows.filter((r) => r.isOverlimit).length,
  };
}

interface BoxProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone?: "default" | "red" | "amber" | "green";
}

function Box({ label, value, icon: Icon, tone = "default" }: BoxProps) {
  const valueClass = {
    default: "text-slate-900 dark:text-dark-text",
    red: "text-red-700 dark:text-red-300",
    amber: "text-amber-700 dark:text-amber-300",
    green: "text-green-700 dark:text-green-300",
  }[tone];
  const iconClass = {
    default: "text-slate-400 dark:text-slate-500",
    red: "text-red-500 dark:text-red-400",
    amber: "text-amber-500 dark:text-amber-400",
    green: "text-green-500 dark:text-green-400",
  }[tone];

  return (
    <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-dark-border dark:bg-dark-card/40">
      <Icon size={16} className={iconClass} />
      <div className="flex flex-col gap-0.5">
        <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {label}
        </span>
        <span className={cn("text-base font-bold leading-none", valueClass)}>
          {typeof value === "number" ? value.toLocaleString() : value}
        </span>
      </div>
    </div>
  );
}

export function TeamPerformanceKpiBoxes({ totals }: { totals: KpiTotals }) {
  const { t } = useTranslation("provider");

  return (
    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
      <Box
        label={t("rcmDashboard.members", { defaultValue: "Members" })}
        value={totals.totalMembers}
        icon={Users}
      />
      <Box
        label={t("rcmDashboard.totalAssigned", { defaultValue: "Total Assigned" })}
        value={totals.totalAssigned}
        icon={Users}
      />
      <Box
        label={t("rcmDashboard.completedLabel", { defaultValue: "Completed" })}
        value={totals.completed}
        icon={CheckCircle}
        tone="green"
      />
      <Box
        label={t("rcmDashboard.overdueLabel", { defaultValue: "Overdue" })}
        value={totals.overdue}
        icon={AlertCircle}
        tone={totals.overdue > 0 ? "red" : "default"}
      />
    </div>
  );
}

export function OverlimitAlert({ count }: { count: number }) {
  const { t } = useTranslation("provider");
  if (count === 0) return null;
  return (
    <div className="mt-3 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900/40 dark:bg-red-950/20">
      <AlertTriangle size={20} className="mt-0.5 shrink-0 text-red-500" />
      <div>
        <p className="text-sm font-medium text-red-800 dark:text-red-200">
          {t("rcmDashboard.overlimitMembersTitle", { defaultValue: "Members over capacity" })}
        </p>
        <p className="mt-0.5 text-xs text-red-600 dark:text-red-400">
          {t("rcmDashboard.overlimitMembersDesc", {
            defaultValue: `${count} member${count === 1 ? " is" : "s are"} flagged as overlimit.`,
            count,
          })}
        </p>
      </div>
    </div>
  );
}
