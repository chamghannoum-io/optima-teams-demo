import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, cn } from "@/components/enhanced";
import {
  getAvatarColor,
  getClaimsAssigned,
  getInitials,
  getResubmissionsAssigned,
  resolveMemberName,
  type MemberRow,
} from "./team-performance-helpers";

interface Props {
  members: MemberRow[];
  onClose: () => void;
  showClaimsCol: boolean;
  showAuthsCol: boolean;
  showResubsCol: boolean;
}

function maxAcross(members: MemberRow[], field: keyof MemberRow): number {
  let max = 0;
  for (const m of members) {
    const v = Number(m[field] ?? 0);
    if (v > max) max = v;
  }
  return max;
}

function MetricRow({
  label,
  values,
  tone,
}: {
  label: string;
  values: number[];
  tone?: "default" | "green" | "red";
}) {
  const max = values.reduce((m, v) => Math.max(m, v), 0);
  const toneClass = {
    default: "text-slate-900 dark:text-dark-text",
    green: "text-green-700 dark:text-green-300",
    red: "text-red-700 dark:text-red-300",
  }[tone ?? "default"];

  return (
    <div className="grid grid-cols-[120px_1fr] items-center gap-3 border-b border-slate-100 py-2 last:border-b-0 dark:border-dark-border/40">
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {label}
      </span>
      <div className="grid grid-cols-3 gap-3">
        {values.map((v, i) => (
          <div key={i} className="flex flex-col gap-1">
            <span className={cn("text-sm font-semibold", toneClass)}>{v.toLocaleString()}</span>
            <div className="h-1 overflow-hidden rounded-full bg-slate-100 dark:bg-dark-card">
              <div
                className={cn(
                  "h-full rounded-full",
                  tone === "green" ? "bg-emerald-500" : tone === "red" ? "bg-red-500" : "bg-primary"
                )}
                style={{ width: max > 0 ? `${(v / max) * 100}%` : "0%" }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TeamPerformanceComparisonPanel({
  members,
  onClose,
  showClaimsCol,
  showAuthsCol,
  showResubsCol,
}: Props) {
  const { t } = useTranslation("provider");

  if (members.length < 2) return null;

  // Pad to a fixed 3-column layout — empty slots stay blank
  const slots: (MemberRow | null)[] = [members[0] ?? null, members[1] ?? null, members[2] ?? null];

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle>
            {t("rcmDashboard.compareTitle", { defaultValue: "Compare members" })}
          </CardTitle>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-6 w-6 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300"
            aria-label={t("rcmDashboard.exitCompare", { defaultValue: "Exit compare" })}
          >
            <X size={14} />
          </button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Member headers */}
        <div className="grid grid-cols-[120px_1fr] items-center gap-3 border-b border-slate-200 pb-3 dark:border-dark-border">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {t("rcmDashboard.member", { defaultValue: "Member" })}
          </span>
          <div className="grid grid-cols-3 gap-3">
            {slots.map((m, i) => {
              if (!m) {
                return (
                  <div key={i} className="text-xs italic text-slate-400 dark:text-slate-500">
                    {t("rcmDashboard.compareEmpty", { defaultValue: "Pick a member" })}
                  </div>
                );
              }
              const name = resolveMemberName(m);
              return (
                <div key={m.userId} className="flex items-center gap-2">
                  <div
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold text-white",
                      getAvatarColor(name)
                    )}
                  >
                    {getInitials(name)}
                  </div>
                  <p className="truncate text-sm font-semibold text-slate-900 dark:text-dark-text">
                    {name}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Metric rows */}
        <div className="flex flex-col">
          {showClaimsCol && (
            <MetricRow
              label={t("rcmDashboard.claims", { defaultValue: "Claims" })}
              values={slots.map((m) => (m ? getClaimsAssigned(m) : 0))}
            />
          )}
          {showAuthsCol && (
            <MetricRow
              label={t("rcmDashboard.authorizations", { defaultValue: "Auths" })}
              values={slots.map((m) => Number(m?.authorizationsAssigned ?? 0))}
            />
          )}
          {showResubsCol && (
            <MetricRow
              label={t("rcmDashboard.resubmissions", { defaultValue: "Resubs" })}
              values={slots.map((m) => (m ? (getResubmissionsAssigned(m) ?? 0) : 0))}
            />
          )}
          <MetricRow
            label={t("rcmDashboard.totalAssigned", { defaultValue: "Total" })}
            values={slots.map((m) => Number(m?.totalAssigned ?? 0))}
          />
          <MetricRow
            label={t("rcmDashboard.completedLabel", { defaultValue: "Completed" })}
            values={slots.map((m) => Number(m?.completed ?? 0))}
            tone="green"
          />
          <MetricRow
            label={t("rcmDashboard.overdueLabel", { defaultValue: "Overdue" })}
            values={slots.map((m) => Number(m?.overdue ?? 0))}
            tone="red"
          />
        </div>

        {/* Heaviest-load callout */}
        <div className="mt-3 text-[11px] text-slate-500 dark:text-slate-400">
          {t("rcmDashboard.compareHint", {
            defaultValue: `Heaviest total: ${maxAcross(members, "totalAssigned").toLocaleString()}`,
          })}
        </div>
      </CardContent>
    </Card>
  );
}
