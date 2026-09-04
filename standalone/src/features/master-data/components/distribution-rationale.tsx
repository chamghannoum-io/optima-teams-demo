import { useState } from "react";
import { gql, useQuery } from "@apollo/client";
import { Info, X, TrendingUp } from "lucide-react";

import { cn, Badge, Skeleton } from "@optima/ui";

const RATIONALE = gql`
  query DistributionRationale($teamId: ID!, $groupCount: Int!) {
    optimaDistributionRationale(teamId: $teamId, groupCount: $groupCount) {
      facilityId
      axis
      totalPerDay
      criteriaCount
      burstFactor
      concentrationRatio
      tailCount
      tailSharePct
      top {
        name
        perDay
        sharePct
      }
      naiveSpread
      balancedSpread
    }
  }
`;

/**
 * Explains why Auto-distribute splits the way it does.
 *
 * The recommendation packs by observed daily volume rather than by an equal count of
 * departments, because arrival volume is heavily concentrated — one department can be
 * a quarter of a facility's work while a dozen others are under an item a day. This
 * shows the numbers behind that, and what an even-count split would have produced
 * instead, so the suggestion is auditable rather than a black box.
 *
 * Source: the work-item profile (12 months of arrivals, per facility).
 */
export function DistributionRationale({
  teamId,
  groupCount,
  className,
}: {
  teamId: string;
  groupCount: number;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const { data, loading } = useQuery(RATIONALE, {
    variables: { teamId, groupCount: Math.max(1, groupCount) },
    skip: !open || !teamId,
  });
  const r = data?.optimaDistributionRationale;

  const spread = (arr: number[]) => {
    if (!arr?.length) return 0;
    const mx = Math.max(...arr);
    const mn = Math.min(...arr);
    return mn > 0 ? Math.round((mx / mn) * 100) / 100 : 0;
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Why this distribution?"
        className={cn(
          "inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-dark-hover dark:hover:text-slate-200",
          className
        )}
      >
        <Info size={15} />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/40 p-6"
          onClick={() => setOpen(false)}
        >
          <div
            className="flex max-h-[80vh] w-full max-w-xl flex-col overflow-hidden rounded-xl bg-white shadow-xl dark:bg-dark-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-slate-200 p-4 dark:border-dark-border">
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-dark-text">
                  Why this distribution?
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Based on 12 months of observed arrivals at{" "}
                  {r?.facilityId ?? "this facility"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-dark-hover"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-4">
              {loading && <Skeleton className="h-40 w-full rounded-lg" />}

              {r && (
                <>
                  {/* headline numbers */}
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      ["Arrivals", `${r.totalPerDay.toFixed(0)}/day`],
                      [r.axis === "DEPARTMENT" ? "Departments" : "Payers", String(r.criteriaCount)],
                      ["Peak factor", `${r.burstFactor.toFixed(2)}×`],
                    ].map(([label, value]) => (
                      <div
                        key={label}
                        className="rounded-lg border border-slate-200 p-2.5 dark:border-dark-border"
                      >
                        <p className="text-[10px] uppercase tracking-wide text-slate-500">
                          {label}
                        </p>
                        <p className="text-sm font-semibold text-slate-900 dark:text-dark-text">
                          {value}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* the concentration that makes an even count wrong */}
                  <div>
                    <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
                      <TrendingUp size={12} /> Volume is concentrated
                    </p>
                    <div className="space-y-1">
                      {r.top.map((c: any) => (
                        <div key={c.name} className="flex items-center gap-2">
                          <span className="w-44 truncate text-xs text-slate-700 dark:text-slate-300">
                            {c.name}
                          </span>
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-dark-surface">
                            <div
                              className="h-full rounded-full bg-primary"
                              style={{ width: `${Math.min(100, c.sharePct * 3)}%` }}
                            />
                          </div>
                          <span className="w-24 shrink-0 text-right text-[11px] tabular-nums text-slate-500">
                            {c.perDay.toFixed(0)}/day · {c.sharePct.toFixed(0)}%
                          </span>
                        </div>
                      ))}
                    </div>
                    <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
                      The busiest carries <strong>{r.top[0]?.sharePct.toFixed(0)}%</strong> of
                      all work — <strong>{r.concentrationRatio.toFixed(1)}×</strong> the median
                      department
                      {r.tailCount > 0 && (
                        <>
                          , and <strong>{r.tailCount}</strong> sit under one item a day
                          (just {r.tailSharePct.toFixed(1)}% of volume)
                        </>
                      )}
                      . So an equal <em>count</em> per group is not an equal{" "}
                      <em>workload</em>.
                    </p>
                  </div>

                  {/* the comparison that justifies the choice */}
                  <div className="rounded-lg border border-slate-200 p-3 dark:border-dark-border">
                    <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                      Across {groupCount} group{groupCount === 1 ? "" : "s"}
                    </p>
                    <div className="space-y-2">
                      <div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-600 dark:text-slate-400">
                            Even count per group
                          </span>
                          <Badge variant="warning">
                            {spread(r.naiveSpread).toFixed(2)}× spread
                          </Badge>
                        </div>
                        <p className="mt-0.5 font-mono text-[11px] text-slate-500">
                          {r.naiveSpread.map((n: number) => n.toFixed(0)).join(" · ")} /day
                        </p>
                      </div>
                      <div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-slate-900 dark:text-dark-text">
                            Balanced by volume (used)
                          </span>
                          <Badge variant="success">
                            {spread(r.balancedSpread).toFixed(2)}× spread
                          </Badge>
                        </div>
                        <p className="mt-0.5 font-mono text-[11px] text-slate-500">
                          {r.balancedSpread.map((n: number) => n.toFixed(0)).join(" · ")} /day
                        </p>
                      </div>
                    </div>
                  </div>

                  <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                    Auto-distribute deals each unassigned{" "}
                    {r.axis === "DEPARTMENT" ? "department" : "payer"} — heaviest first — to
                    whichever group is currently lightest. Anything you have already assigned
                    stays where it is. The peak factor ({r.burstFactor.toFixed(2)}×) is the
                    facility's P90/P50 ratio, used to project busy-day load.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
