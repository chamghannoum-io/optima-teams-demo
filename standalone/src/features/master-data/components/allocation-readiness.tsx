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
import { Badge, CortexKPICard, ListItem, SectionHeader, cn } from "@optima/ui";

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
            <div className="border-t border-slate-200 dark:border-dark-border">
              {grouped.map(([kind, list]) => {
                const cfg = SEVERITY[list[0].severity] ?? SEVERITY.INFO;
                const Icon = cfg.icon;
                return (
                  <div key={kind}>
                    <div className="border-b border-slate-200 bg-slate-50 px-5 py-2 dark:border-dark-border dark:bg-dark-card">
                      <SectionHeader
                        micro
                        title={KIND_LABEL[kind] ?? kind}
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
                          // Not every issue names a team to open. Those rows still
                          // matter, so they stay full strength; they just do not
                          // offer a hover or a cursor.
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
      )}
    </div>
  );
}
