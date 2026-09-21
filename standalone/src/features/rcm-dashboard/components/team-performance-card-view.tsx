import { useTranslation } from "react-i18next";
import { cn } from "@/components/enhanced";
import {
  getAvatarColor,
  getClaimsAssigned,
  getInitials,
  getResubmissionsAssigned,
  resolveMemberName,
  type GroupEntry,
  type MemberRow,
} from "./team-performance-helpers";

interface Props {
  groups: GroupEntry[];
  showGroupHeader: boolean;
  compareMode: boolean;
  compareIds: Set<string>;
  onToggleCompare: (id: string) => void;
  onSelectMember: (row: MemberRow) => void;
  showClaimsCol: boolean;
  showAuthsCol: boolean;
  showResubsCol: boolean;
}

// ── Inline SVG completion donut (no chart library) ────────────────────
function CompletionDonut({ completed, total }: { completed: number; total: number }) {
  const pct = total > 0 ? Math.min(100, (completed / total) * 100) : 0;
  const r = 32;
  const circumference = 2 * Math.PI * r;
  const filled = (pct / 100) * circumference;
  return (
    <svg width="80" height="80" viewBox="0 0 80 80" className="shrink-0">
      <circle
        cx="40"
        cy="40"
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth="6"
        className="text-slate-100 dark:text-dark-card"
      />
      <circle
        cx="40"
        cy="40"
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={`${filled} ${circumference}`}
        transform="rotate(-90 40 40)"
        className="text-emerald-500 dark:text-emerald-400"
      />
      <text
        x="40"
        y="44"
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-slate-900 text-[13px] font-bold dark:fill-dark-text"
      >
        {pct.toFixed(0)}%
      </text>
    </svg>
  );
}

// ── Per-row breakdown line ────────────────────────────────────────────
function BreakdownRow({
  color,
  label,
  count,
  total,
}: {
  color: string;
  label: string;
  count: number;
  total: number;
}) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="inline-flex items-center gap-1.5 truncate text-slate-600 dark:text-slate-300">
        <span className={cn("h-2 w-2 shrink-0 rounded-full", color)} />
        <span className="truncate">{label}</span>
      </span>
      <span className="ms-2 shrink-0 font-semibold text-slate-900 dark:text-dark-text">
        {count.toLocaleString()}
        {total > 0 && (
          <span className="ms-1 text-slate-500 dark:text-slate-400">
            ({pct.toFixed(0)}%)
          </span>
        )}
      </span>
    </div>
  );
}

// ── Small stat tile ───────────────────────────────────────────────────
function StatTile({
  value,
  label,
  tone,
}: {
  value: string | number;
  label: string;
  tone?: "default" | "green" | "red";
}) {
  const toneClass =
    tone === "green"
      ? "text-green-700 dark:text-green-300"
      : tone === "red"
        ? "text-red-700 dark:text-red-300"
        : "text-slate-900 dark:text-dark-text";

  return (
    <div className="flex flex-col items-center justify-center rounded-lg bg-slate-50 px-2 py-2.5 dark:bg-dark-card/40">
      <span className={cn("text-base font-bold leading-tight", toneClass)}>
        {typeof value === "number" ? value.toLocaleString() : value}
      </span>
      <span className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </span>
    </div>
  );
}

export function TeamPerformanceCardView({
  groups,
  showGroupHeader,
  compareMode,
  compareIds,
  onToggleCompare,
  onSelectMember,
  showClaimsCol,
  showAuthsCol,
  showResubsCol,
}: Props) {
  const { t } = useTranslation("provider");

  return (
    <div className="flex flex-col gap-4">
      {groups.map((group) => (
        <div key={group.key} className="flex flex-col gap-2">
          {showGroupHeader && group.label && (
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {group.label}
            </p>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {group.members.map((row) => {
              const checked = compareIds.has(row.userId);
              const disabled = !checked && compareIds.size >= 3;
              const name = resolveMemberName(row);

              const claims = getClaimsAssigned(row);
              const auths = Number(row.authorizationsAssigned ?? 0);
              const resubsRaw = getResubmissionsAssigned(row);
              const resubs = resubsRaw ?? 0;
              const total = Number(row.totalAssigned ?? claims + auths + resubs);
              const completed = Number(row.completed ?? 0);
              const overdue = Number(row.overdue ?? 0);

              // Tiles visible by workItemTypes filter — Resubs follows showResubsCol
              const showResubsTile = showResubsCol && resubsRaw != null;

              return (
                <div
                  key={row.userId}
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelectMember(row)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") onSelectMember(row);
                  }}
                  className={cn(
                    "cursor-pointer overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-all hover:border-primary/30 hover:shadow-md dark:border-dark-border dark:bg-dark-surface dark:hover:border-primary-300/30",
                    row.isOverlimit &&
                      "border-red-200 dark:border-red-900/40 ring-1 ring-red-100 dark:ring-red-900/20"
                  )}
                >
                  {/* ── Header row ──────────────────────────────────── */}
                  <div className="flex items-start justify-between gap-2 px-4 pt-4">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <div
                        className={cn(
                          "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white",
                          getAvatarColor(name)
                        )}
                      >
                        {getInitials(name)}
                      </div>
                      <p className="truncate text-base font-bold text-slate-900 dark:text-dark-text">
                        {name}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {row.isOverlimit && (
                        <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-700 dark:bg-red-900/40 dark:text-red-300">
                          {t("rcmDashboard.overlimit", { defaultValue: "Over limit" })}
                        </span>
                      )}
                      {compareMode && (
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={disabled}
                          onChange={(e) => {
                            e.stopPropagation();
                            onToggleCompare(row.userId);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:opacity-40 dark:border-dark-border"
                        />
                      )}
                    </div>
                  </div>

                  {/* ── Stat tiles ──────────────────────────────────── */}
                  <div className="mt-3 grid grid-cols-2 gap-2 px-4 sm:grid-cols-3 lg:grid-cols-4">
                    <StatTile
                      value={total}
                      label={t("rcmDashboard.assigned", { defaultValue: "Assigned" })}
                    />
                    <StatTile
                      value={completed}
                      label={t("rcmDashboard.completedLabel", { defaultValue: "Completed" })}
                      tone="green"
                    />
                    <StatTile
                      value={overdue}
                      label={t("rcmDashboard.overdueLabel", { defaultValue: "Overdue" })}
                      tone={overdue > 0 ? "red" : "default"}
                    />
                    {showResubsTile && (
                      <StatTile
                        value={resubs}
                        label={t("rcmDashboard.resubmissions", { defaultValue: "Resubs" })}
                      />
                    )}
                  </div>

                  {/* ── Donut + breakdown ───────────────────────────── */}
                  <div className="mt-4 flex items-center gap-4 border-t border-slate-100 bg-slate-50/40 px-4 py-3 dark:border-dark-border/60 dark:bg-dark-card/20">
                    <CompletionDonut completed={completed} total={total} />
                    <div className="flex flex-1 flex-col gap-2">
                      {showClaimsCol && (
                        <BreakdownRow
                          color="bg-blue-500"
                          label={t("rcmDashboard.claims", { defaultValue: "Claims" })}
                          count={claims}
                          total={total}
                        />
                      )}
                      {showAuthsCol && (
                        <BreakdownRow
                          color="bg-violet-500"
                          label={t("rcmDashboard.authorizations", {
                            defaultValue: "Authorizations",
                          })}
                          count={auths}
                          total={total}
                        />
                      )}
                      {showResubsTile && (
                        <BreakdownRow
                          color="bg-pink-500"
                          label={t("rcmDashboard.resubmissions", {
                            defaultValue: "Resubmissions",
                          })}
                          count={resubs}
                          total={total}
                        />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
