/**
 * Estate readiness, split into pieces the dashboard composes.
 *
 * The point is that a supervisor should never find out at midnight that a day's
 * work had nowhere to go. Everything here warns and lets them continue: a
 * BLOCKER means work matched to that team cannot be assigned at all, a WARNING
 * means some of it will fall through. Neither stops them editing.
 *
 * The figures are deliberately compact, in the dashboard's KPI-box style rather
 * than the tall gradient cards, so they inform the page instead of dominating it.
 */
import { useMemo, useState } from "react";
import { gql, useQuery } from "@apollo/client";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Info,
  ShieldAlert,
} from "lucide-react";
import { Badge, ListItem, SectionHeader, cn } from "@optima/ui";

import { KpiBox, KpiRow } from "./readiness-kpis.js";

export const READINESS = gql`
  query AllocationReadiness {
    optimaAllocationReadiness {
      teamsTotal
      teamsReady
      unhandled
      unownedIssues
      itemsAtRiskPerDay
      issues {
        severity
        kind
        teamId
        teamName
        facilityId
        message
        supervisorNames
        itemsAtRiskPerDay
      }
      supervisorAlerts {
        userId
        name
        teamNames
        blockers
        warnings
        itemsAtRiskPerDay
      }
    }
  }
`;

type Issue = {
  severity: "BLOCKER" | "WARNING" | "INFO";
  kind: string;
  teamId: string | null;
  teamName: string | null;
  facilityId: string | null;
  message: string;
  supervisorNames: string[];
  itemsAtRiskPerDay: number;
};

type SupervisorAlert = {
  userId: string;
  name: string;
  teamNames: string[];
  blockers: number;
  warnings: number;
  itemsAtRiskPerDay: number;
};

const SEVERITY = {
  BLOCKER: { badge: "error" as const, icon: ShieldAlert, tone: "text-red-600 dark:text-red-400" },
  WARNING: {
    badge: "warning" as const,
    icon: AlertTriangle,
    tone: "text-orange-600 dark:text-orange-400",
  },
  INFO: { badge: "info" as const, icon: Info, tone: "text-blue-600 dark:text-blue-400" },
};

/** Plain-language heading for a group of issues sharing a cause. */
const KIND_LABEL: Record<string, string> = {
  NO_GROUPS: "Teams with no groups",
  EMPTY_GROUP: "Groups with no members",
  GROUP_WIDENS_TEAM: "Groups wider than their team",
  UNCOVERED_DEPARTMENT: "Departments with no group",
  UNCOVERED_PAYER: "Payers with no group",
  NO_SUPERVISOR: "Teams with no supervisor",
  UNHANDLED_TYPE: "Work item types nobody handles",
  OVERLAPPING_TEAMS: "Teams competing for the same work",
};

/** Falls back to a readable label for a dimension or policy added later. */
const kindLabel = (kind: string) => {
  if (KIND_LABEL[kind]) return KIND_LABEL[kind];
  if (kind.startsWith("UNCOVERED_"))
    return `${kind.slice(10).replace(/_/g, " ").toLowerCase()} with no group`;
  if (kind.startsWith("NO_HANDLER_"))
    return `Nobody cleared for ${kind.slice(11).replace(/_/g, " ").toLowerCase()}`;
  return kind.replace(/_/g, " ").toLowerCase();
};

export function useReadiness() {
  const { data, loading } = useQuery(READINESS, { fetchPolicy: "cache-and-network" });
  const r = data?.optimaAllocationReadiness;
  const issues: Issue[] = useMemo(() => r?.issues ?? [], [r]);
  return {
    loading,
    readiness: r,
    issues,
    blockers: issues.filter((i) => i.severity === "BLOCKER"),
    warnings: issues.filter((i) => i.severity === "WARNING"),
    alerts: (r?.supervisorAlerts ?? []) as SupervisorAlert[],
  };
}

/** The four figures, compact. */
export function ReadinessKpis({ onShowIssues }: { onShowIssues?: () => void }) {
  const { readiness: r, blockers, warnings } = useReadiness();
  if (!r) return null;
  const allClear = !blockers.length && !warnings.length;

  return (
    <KpiRow>
      <KpiBox
        label="Teams ready"
        value={`${r.teamsReady} / ${r.teamsTotal}`}
        icon={CheckCircle2}
        tone={r.teamsReady === r.teamsTotal ? "green" : "amber"}
        hint="Ready means nothing configured on that team falls through"
      />
      <KpiBox
        label="Blockers"
        value={blockers.length}
        icon={ShieldAlert}
        tone={blockers.length ? "red" : "default"}
        hint="Work matched here cannot be assigned at all"
        onClick={onShowIssues}
      />
      <KpiBox
        label="Warnings"
        value={warnings.length}
        icon={AlertTriangle}
        tone={warnings.length ? "amber" : "default"}
        hint="Some work will fall through"
        onClick={onShowIssues}
      />
      <KpiBox
        label="Items at risk"
        value={allClear ? 0 : Math.round(r.itemsAtRiskPerDay)}
        icon={AlertTriangle}
        tone={r.itemsAtRiskPerDay ? "amber" : "green"}
        hint="Estimated items per day with nowhere to go"
      />
    </KpiRow>
  );
}

/** Who gets told, rolled up per person. */
export function SupervisorDigest() {
  const { readiness: r, alerts } = useReadiness();
  if (!r || !alerts.length) return null;

  return (
    <div className="rounded-xl bg-white shadow-custom dark:bg-dark-surface">
      <div className="border-b border-slate-200 px-5 py-2 dark:border-dark-border">
        <SectionHeader
          micro
          title="Supervisors to notify"
          action={<Badge variant="warning">{alerts.length}</Badge>}
        />
      </div>
      {alerts.map((a) => (
        <ListItem
          key={a.userId}
          title={a.name}
          subtitle={`${a.teamNames.join(", ") || "No team named"} · ${
            a.blockers ? `${a.blockers} blocking, ` : ""
          }${a.warnings} warning${a.warnings === 1 ? "" : "s"}${
            a.itemsAtRiskPerDay
              ? `, about ${Math.round(a.itemsAtRiskPerDay).toLocaleString()} items/day at risk`
              : ""
          }`}
          className="cursor-default py-3 hover:bg-transparent"
          trailing={
            <Badge variant={a.blockers ? "error" : "warning"}>{a.blockers + a.warnings}</Badge>
          }
        />
      ))}
      {r.unownedIssues > 0 && (
        <p className="border-t border-slate-200 px-5 py-2.5 text-xs text-amber-700 dark:border-dark-border dark:text-amber-400">
          {r.unownedIssues} {r.unownedIssues === 1 ? "issue has" : "issues have"} no supervisor to
          notify. Tag one on the team so somebody is told.
        </p>
      )}
    </div>
  );
}

/** The issues themselves, grouped by cause. */
export function ReadinessIssues({
  onOpenTeam,
  open,
  onOpenChange,
}: {
  onOpenTeam?: (teamId: string) => void;
  /** Controlled when provided, so a KPI click can open this panel. */
  open?: boolean;
  onOpenChange?: (next: boolean) => void;
}) {
  const { readiness: r, issues } = useReadiness();
  const [internal, setInternal] = useState(false);
  const expanded = open ?? internal;
  const setExpanded = (next: boolean) => {
    setInternal(next);
    onOpenChange?.(next);
  };

  const grouped = useMemo(() => {
    const by = new Map<string, Issue[]>();
    for (const i of issues) by.set(i.kind, [...(by.get(i.kind) ?? []), i]);
    return [...by.entries()].sort(
      (a, b) =>
        (a[1][0].severity === "BLOCKER" ? 0 : 1) - (b[1][0].severity === "BLOCKER" ? 0 : 1) ||
        b[1].length - a[1].length,
    );
  }, [issues]);

  if (!r) return null;

  if (!issues.length) {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-white px-5 py-4 text-sm text-slate-600 shadow-custom dark:bg-dark-surface dark:text-slate-300">
        <CheckCircle2 size={16} className="text-emerald-500" />
        Every team can receive the work that reaches it. Nothing would fall through tonight.
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-white shadow-custom dark:bg-dark-surface">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between rounded-xl px-5 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-dark-hover"
      >
        <span>
          {issues.length} {issues.length === 1 ? "issue" : "issues"} across {grouped.length}{" "}
          {grouped.length === 1 ? "cause" : "causes"}
        </span>
        <ChevronDown size={16} className={cn("transition-transform", expanded && "rotate-180")} />
      </button>

      {expanded && (
        <div className="border-t border-slate-200 dark:border-dark-border">
          {grouped.map(([kind, list]) => {
            const cfg = SEVERITY[list[0].severity] ?? SEVERITY.INFO;
            const Icon = cfg.icon;
            return (
              <div key={kind}>
                <div className="border-b border-slate-200 bg-slate-50 px-5 py-2 dark:border-dark-border dark:bg-dark-card">
                  <SectionHeader
                    micro
                    title={kindLabel(kind)}
                    action={<Badge variant={cfg.badge}>{list.length}</Badge>}
                  />
                </div>
                {list.map((i, n) => {
                  // The message already leads with the team or facility it is
                  // about, so the row splits it rather than repeating it.
                  const subject = i.teamName ?? i.facilityId ?? "Estate";
                  const detail = i.message.startsWith(subject)
                    ? i.message.slice(subject.length).replace(/^[\s,.:]+/, "")
                    : i.message;
                  const clickable = !!(i.teamId && onOpenTeam);
                  return (
                    <ListItem
                      key={`${kind}-${n}`}
                      title={subject}
                      subtitle={detail}
                      onClick={clickable ? () => onOpenTeam!(i.teamId!) : undefined}
                      className={cn("py-3", !clickable && "cursor-default hover:bg-transparent")}
                      trailing={<Icon size={14} className={cfg.tone} />}
                      tag={
                        clickable ? (
                          <span className="text-xs font-medium text-primary dark:text-primary-300">
                            Fix
                          </span>
                        ) : undefined
                      }
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * A single line for the Teams tab: enough to know something is wrong and where
 * to go, without putting the whole dashboard above the table.
 */
export function ReadinessBanner({ onOpenDashboard }: { onOpenDashboard: () => void }) {
  const { readiness: r, blockers, warnings } = useReadiness();
  if (!r) return null;
  const total = blockers.length + warnings.length;
  if (!total) return null;

  return (
    <button
      type="button"
      onClick={onOpenDashboard}
      className={cn(
        "mb-3 flex w-full items-center gap-2.5 rounded-lg border px-4 py-2.5 text-start text-xs transition",
        blockers.length
          ? "border-red-200 bg-red-50 text-red-800 hover:bg-red-100 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"
          : "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300",
      )}
    >
      <AlertTriangle size={14} className="shrink-0" />
      <span className="flex-1">
        {blockers.length > 0 && (
          <strong>
            {blockers.length} blocker{blockers.length === 1 ? "" : "s"}
          </strong>
        )}
        {blockers.length > 0 && warnings.length > 0 && " and "}
        {warnings.length > 0 && (
          <strong>
            {warnings.length} warning{warnings.length === 1 ? "" : "s"}
          </strong>
        )}
        {r.itemsAtRiskPerDay > 0 &&
          `, about ${Math.round(r.itemsAtRiskPerDay).toLocaleString()} items/day at risk`}
        .
      </span>
      <span className="shrink-0 font-semibold underline underline-offset-2">Open dashboard</span>
    </button>
  );
}
