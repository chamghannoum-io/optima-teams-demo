/**
 * What last night's allocation actually did.
 *
 * The readiness panel answers "will tonight work". This answers "did it", and
 * until now nothing could: Optima already writes every run to
 * assignment_auto_assign_request_response_log and exposes none of it, so the
 * numbers a supervisor needs at 9am sit in the database unreachable.
 *
 * Laid out to match features/rcm-dashboard upstream, a counts strip then
 * paired chart and breakdown cards, so this reads as the same dashboard
 * rather than a second one bolted alongside.
 */
import { useMemo, useState } from "react";
import { gql, useQuery } from "@apollo/client";
import { AlertTriangle, CheckCircle2, CircleSlash, Layers, Users } from "lucide-react";

import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  ListItem,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
} from "@optima/ui";

import { ChartCard } from "./dashboard-chart.js";
import { KpiBox } from "./readiness-kpis.js";

const RUNS = gql`
  query AllocationRuns($first: Int) {
    optimaAllocationRuns(first: $first) {
      id
      startedAt
      failed
      dryRun
      triggeredBy
      totals {
        ranked
        matched
        assigned
        unmatched
        overflow
        fallback
        assignees
      }
      byGroup {
        groupId
        groupName
        teamName
        matched
        assigned
      }
      unmatchedByDimension {
        dimension
        label
        count
        topValues {
          value
          count
        }
      }
      overflow {
        groupName
        count
        reason
      }
    }
  }
`;

const pct = (n: number, of: number) => (of > 0 ? Math.round((n / of) * 100) : 0);
const day = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });

/**
 * Counts strip, mirroring upstream's TopCountsPanel. Uses the same slim KpiBox
 * the readiness panel does, so the two strips on this page read as one design.
 */
function RunTotals({ run }: { run: any }) {
  const t = run.totals;
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      <KpiBox label="Ranked" value={t.ranked} icon={Layers} />
      <KpiBox
        label="Assigned"
        value={t.assigned}
        icon={CheckCircle2}
        tone="green"
        hint={`${pct(t.assigned, t.ranked)}% of the queue`}
      />
      <KpiBox
        label="Unmatched"
        value={t.unmatched}
        icon={CircleSlash}
        tone={t.unmatched ? "red" : "green"}
        hint={t.unmatched ? "No group accepted these. A coverage problem." : "Everything routed"}
      />
      <KpiBox
        label="Overflow"
        value={t.overflow}
        icon={AlertTriangle}
        tone={t.overflow ? "amber" : "green"}
        hint={
          t.overflow
            ? "A group accepted these and had no capacity. A staffing problem, not a coverage one."
            : "Capacity held"
        }
      />
      <KpiBox label="Given work" value={t.assignees} icon={Users} hint="Distinct people assigned" />
    </div>
  );
}

/**
 * Why work fell through, by the dimension that rejected it.
 *
 * This is the panel criteria bought us. v2 could only say "no group accepts
 * this item"; because a rule is data, the matcher can name the clause, and a
 * supervisor gets "Department: Internal Medicine, 176" instead of a number.
 */
function UnmatchedBreakdown({ run }: { run: any }) {
  const rows = run.unmatchedByDimension ?? [];
  return (
    <Card className="flex w-full flex-col">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle>Why work fell through</CardTitle>
        <Badge variant={run.totals.unmatched ? "error" : "success"}>
          {run.totals.unmatched.toLocaleString()} items
        </Badge>
      </CardHeader>
      <CardContent className="flex-1">
        {!rows.length ? (
          <EmptyState title="Everything was routed" className="py-8" />
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {rows.map((r: any) => (
              <ListItem
                key={r.dimension ?? "none"}
                title={r.label}
                subtitle={
                  r.topValues.length
                    ? r.topValues.map((v: any) => `${v.value} (${v.count})`).join(", ")
                    : undefined
                }
                trailing={
                  <span className="text-sm font-semibold tabular-nums text-slate-700 dark:text-slate-200">
                    {r.count.toLocaleString()}
                  </span>
                }
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Groups that accepted more than they could take. Capacity, not coverage. */
function OverflowBreakdown({ run }: { run: any }) {
  const rows = run.overflow ?? [];
  return (
    <Card className="flex w-full flex-col">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle>Accepted but not placed</CardTitle>
        <Badge variant={rows.length ? "warning" : "success"}>
          {run.totals.overflow.toLocaleString()} items
        </Badge>
      </CardHeader>
      <CardContent className="flex-1">
        {!rows.length ? (
          <EmptyState
            title="No overflow"
            description="Every group had capacity for the work it accepted."
            className="py-8"
          />
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {rows.map((o: any) => (
              <ListItem
                key={o.groupName}
                title={o.groupName}
                subtitle={o.reason}
                trailing={
                  <span className="text-sm font-semibold tabular-nums text-slate-700 dark:text-slate-200">
                    {o.count.toLocaleString()}
                  </span>
                }
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function AllocationRuns() {
  const { data, loading } = useQuery(RUNS, {
    variables: { first: 14 },
    fetchPolicy: "cache-and-network",
  });
  const [runId, setRunId] = useState<string>("");

  const runs = useMemo(() => data?.optimaAllocationRuns ?? [], [data]);
  const run = runs.find((r: any) => r.id === runId) ?? runs[0];

  /** Oldest to newest, so the trend reads left to right like a calendar. */
  const history = useMemo(() => [...runs].reverse(), [runs]);

  /**
   * Group names repeat across teams: four teams each have a "Submission", so
   * the bare name is not a label. Qualify only the ambiguous ones, and only
   * with the part of the team name that tells them apart.
   */
  const topGroups = useMemo(() => {
    const rows = [...(run?.byGroup ?? [])].slice(0, 8);
    const seen = new Map<string, number>();
    for (const g of rows) seen.set(g.groupName, (seen.get(g.groupName) ?? 0) + 1);
    return rows.map((g: any) => ({
      ...g,
      label:
        (seen.get(g.groupName) ?? 0) > 1
          ? `${g.groupName}
${g.teamName.replace(/^(Claims|Authorization) Team\s*/i, "")}`
          : g.groupName,
    }));
  }, [run]);

  if (loading && !runs.length) {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-[88px] rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-[320px] rounded-xl" />
      </div>
    );
  }

  if (!run) {
    return (
      <EmptyState
        title="Allocation has not run yet"
        description="Once the nightly workflow runs, what it did shows up here."
        className="py-10"
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Select value={run.id} onValueChange={setRunId}>
            <SelectTrigger className="h-10 w-[220px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {runs.map((r: any) => (
                <SelectItem key={r.id} value={r.id}>
                  {day(r.startedAt)}
                  {r.failed ? " · failed" : ""}
                  {r.triggeredBy ? " · manual" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {run.failed && <Badge variant="error">run failed</Badge>}
          {run.dryRun && <Badge variant="info">dry run</Badge>}
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {new Date(run.startedAt).toLocaleString()} · {run.triggeredBy ?? "nightly trigger"}
        </p>
      </div>

      <RunTotals run={run} />

      <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-3">
        <div className="flex lg:col-span-2">
          <ChartCard
            title="Assigned by group"
            action={
              <span className="text-xs text-slate-500 dark:text-slate-400">
                top {topGroups.length} of {run.byGroup.length}
              </span>
            }
            categories={topGroups.map((g: any) => g.label)}
            series={[{ data: topGroups.map((g: any) => g.assigned) }]}
            height={300}
          />
        </div>
        <div className="flex">
          <UnmatchedBreakdown run={run} />
        </div>
      </div>

      <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2">
        <ChartCard
          title="Assigned and unmatched, last 14 runs"
          categories={history.map((r: any) => day(r.startedAt))}
          series={[
            { name: "Assigned", data: history.map((r: any) => r.totals.assigned) },
            { name: "Unmatched", data: history.map((r: any) => r.totals.unmatched) },
          ]}
          height={280}
          rotateLabels
        />
        <OverflowBreakdown run={run} />
      </div>
    </div>
  );
}
