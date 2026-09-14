/**
 * Estate-wide readiness, shown above the teams table.
 *
 * The point is that a supervisor should never find out at midnight that a day's
 * work had nowhere to go. Everything here warns and lets them continue: a
 * BLOCKER means work matched to that team cannot be assigned at all, a WARNING
 * means some of it will fall through. Neither stops them editing.
 */
import { useMemo, useState } from "react";
import { gql, useQuery } from "@apollo/client";
import { AlertTriangle, CheckCircle2, ChevronDown, Info, ShieldAlert } from "lucide-react";
import { Badge, Button, CortexKPICard, cn } from "@optima/ui";

export const READINESS = gql`
  query AllocationReadiness {
    optimaAllocationReadiness {
      teamsTotal
      teamsReady
      unhandled
      issues {
        severity
        kind
        teamId
        teamName
        facilityId
        message
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
  UNCOVERED_DEPARTMENTS: "Departments with no group",
  NO_PAYER_CATCH_ALL: "Payer teams with no catch-all",
  NO_HIGH_COST_HANDLER: "No high-cost handler",
  UNHANDLED_TYPE: "Work item types nobody handles",
};

export function AllocationReadinessPanel({
  onOpenTeam,
}: {
  onOpenTeam?: (teamId: string) => void;
}) {
  const { data, loading } = useQuery(READINESS, { fetchPolicy: "cache-and-network" });
  const [expanded, setExpanded] = useState(false);

  const r = data?.optimaAllocationReadiness;
  const issues: Issue[] = useMemo(() => r?.issues ?? [], [r]);

  const blockers = issues.filter((i) => i.severity === "BLOCKER");
  const warnings = issues.filter((i) => i.severity === "WARNING");

  // Group by cause so a facility-wide gap reads as one line, not twenty.
  const grouped = useMemo(() => {
    const by = new Map<string, Issue[]>();
    for (const i of issues) by.set(i.kind, [...(by.get(i.kind) ?? []), i]);
    return [...by.entries()].sort(
      (a, b) =>
        (a[1][0].severity === "BLOCKER" ? 0 : 1) - (b[1][0].severity === "BLOCKER" ? 0 : 1) ||
        b[1].length - a[1].length
    );
  }, [issues]);

  if (loading && !r) return null;
  if (!r) return null;

  const allClear = !issues.length;

  return (
    <div className="mb-4 space-y-3">
      <div className="grid gap-4 sm:grid-cols-3">
        <CortexKPICard
          label="Teams ready"
          value={`${r.teamsReady} / ${r.teamsTotal}`}
          subValue={allClear ? "All teams can receive work" : "Ready means nothing falls through"}
          color={r.teamsReady === r.teamsTotal ? "green" : "orange"}
          icon={CheckCircle2}
        />
        <CortexKPICard
          label="Blockers"
          value={blockers.length}
          subValue={blockers.length ? "Work matched here cannot be assigned" : "None"}
          color={blockers.length ? "red" : "slate"}
          icon={ShieldAlert}
        />
        <CortexKPICard
          label="Warnings"
          value={warnings.length}
          subValue={warnings.length ? "Some work will fall through" : "None"}
          color={warnings.length ? "orange" : "slate"}
          icon={AlertTriangle}
        />
      </div>

      {!allClear && (
        <div className="rounded-xl bg-white shadow-custom dark:bg-dark-surface">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex w-full items-center justify-between rounded-xl px-5 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-dark-hover"
          >
            <span>
              {issues.length} {issues.length === 1 ? "issue" : "issues"} across {grouped.length}{" "}
              {grouped.length === 1 ? "cause" : "causes"}
            </span>
            <ChevronDown
              size={16}
              className={cn("transition-transform", expanded && "rotate-180")}
            />
          </button>

          {expanded && (
            <div className="space-y-4 border-t border-slate-100 px-5 py-4 dark:border-dark-border">
              {grouped.map(([kind, list]) => {
                const cfg = SEVERITY[list[0].severity] ?? SEVERITY.INFO;
                const Icon = cfg.icon;
                return (
                  <div key={kind}>
                    <div className="mb-2 flex items-center gap-2">
                      <Icon size={14} className={cfg.tone} />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        {KIND_LABEL[kind] ?? kind}
                      </span>
                      <Badge variant={cfg.badge}>{list.length}</Badge>
                    </div>
                    <ul className="space-y-1 ps-6">
                      {list.map((i, n) => (
                        <li
                          key={`${kind}-${n}`}
                          className="flex items-start justify-between gap-3 text-sm text-slate-600 dark:text-slate-300"
                        >
                          <span>{i.message}</span>
                          {i.teamId && onOpenTeam && (
                            <Button
                              variant="link"
                              size="sm"
                              className="shrink-0"
                              onClick={() => onOpenTeam(i.teamId!)}
                            >
                              Fix
                            </Button>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
