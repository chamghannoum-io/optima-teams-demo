import { useState } from "react";
import { useQuery, gql } from "@apollo/client";
import { useTranslation } from "react-i18next";
import { Play, AlertTriangle } from "lucide-react";

import { cn, Button, Label, Badge, Skeleton } from "@optima/ui";

const PREVIEW = gql`
  query AllocationPreview($teamId: ID!, $itemCount: Int) {
    optimaAllocationPreview(teamId: $teamId, itemCount: $itemCount) {
      teamName
      totalItems
      assignedCount
      unassignedCount
      byGroup {
        groupId
        groupName
        matched
        assigned
        capacity
      }
      byAssignee {
        userId
        name
        groupName
        assigned
        capacity
        remaining
      }
      items {
        id
        workItemType
        department
        payer
        claimStatus
        encounterType
        priority
        ageDays
        rank
        groupName
        assigneeName
      }
      unmatched {
        id
        workItemType
        department
        payer
        reason
      }
    }
  }
`;

const shortType = (t: string) =>
  t.replace("AUTHORIZATION_", "Auth ").replace("CLAIM_", "Claim ").replace("_", " ").toLowerCase();

/**
 * Dry-run of the allocation engine for one team.
 *
 * Runs the same pipeline the nightly job would — rank, match to the narrowest
 * accepting group, then distribute to the least-loaded member with capacity — over a
 * day's arrivals drawn from the facility's observed volume mix. Nothing is assigned;
 * this is the summary a supervisor checks before trusting a configuration.
 *
 * @example <AllocationPreview teamId={team.id} />
 */
export function AllocationPreview({ teamId, className }: { teamId: string; className?: string }) {
  const { t } = useTranslation("provider");
  const [run, setRun] = useState(false);
  const [tab, setTab] = useState<"groups" | "people" | "items" | "unmatched">("groups");

  const { data, loading } = useQuery(PREVIEW, {
    variables: { teamId, itemCount: 300 },
    skip: !run,
  });
  const p = data?.optimaAllocationPreview;

  if (!run) {
    return (
      <div className={cn("space-y-2", className)}>
        <div className="flex items-center justify-between gap-2">
          <div className="space-y-0.5">
            <Label>{t("masterData.teams.allocationPreview", "Allocation preview")}</Label>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Dry-run the engine over a day's arrivals — see which group takes what, and
              who ends up with it. Nothing is assigned.
            </p>
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={() => setRun(true)}>
            <Play size={14} /> {t("masterData.teams.runPreview", "Run preview")}
          </Button>
        </div>
      </div>
    );
  }

  if (loading || !p) return <Skeleton className="h-40 w-full rounded-lg" />;

  const pct = p.totalItems ? Math.round((p.assignedCount / p.totalItems) * 100) : 0;
  const tabs = [
    ["groups", `By group (${p.byGroup.length})`],
    ["people", `By person (${p.byAssignee.length})`],
    ["items", `Items (${p.items.length})`],
    ["unmatched", `Unallocated (${p.unassignedCount})`],
  ] as const;

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between gap-2">
        <Label>{t("masterData.teams.allocationPreview", "Allocation preview")}</Label>
        <Button type="button" variant="ghost" size="sm" onClick={() => setRun(false)}>
          Reset
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[
          ["Arrivals", p.totalItems, "default"],
          ["Allocated", `${p.assignedCount} (${pct}%)`, p.assignedCount ? "success" : "error"],
          ["Unallocated", p.unassignedCount, p.unassignedCount ? "warning" : "success"],
        ].map(([label, value, variant]) => (
          <div
            key={label as string}
            className="rounded-lg border border-slate-200 p-3 dark:border-dark-border"
          >
            <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
            <Badge variant={variant as never}>{value}</Badge>
          </div>
        ))}
      </div>

      {p.unassignedCount > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>
            {p.unassignedCount} of {p.totalItems} items would not be allocated. See the
            Unallocated tab for why.
          </span>
        </div>
      )}

      <div className="flex gap-1 border-b border-slate-200 dark:border-dark-border">
        {tabs.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              "border-b-2 px-3 py-1.5 text-xs font-medium transition",
              tab === key
                ? "border-primary text-primary"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-200 dark:border-dark-border">
        <table className="w-full">
          <thead className="sticky top-0 bg-slate-50 dark:bg-dark-surface">
            <tr>
              {(tab === "groups"
                ? ["Group", "Matched", "Allocated", "Capacity"]
                : tab === "people"
                  ? ["Person", "Group", "Allocated", "Remaining"]
                  : tab === "items"
                    ? ["Item", "Type", "Criteria", "Rank", "Group", "Assignee"]
                    : ["Item", "Type", "Criteria", "Why not allocated"]
              ).map((h) => (
                <th
                  key={h}
                  className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tab === "groups" &&
              p.byGroup.map((g: any) => (
                <tr key={g.groupId} className="border-t border-slate-100 dark:border-dark-border/50">
                  <td className="px-3 py-2 text-xs font-medium">{g.groupName}</td>
                  <td className="px-3 py-2 text-xs">{g.matched}</td>
                  <td className="px-3 py-2 text-xs">
                    <Badge variant={g.assigned < g.matched ? "warning" : "success"}>
                      {g.assigned}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-500">{g.capacity}</td>
                </tr>
              ))}
            {tab === "people" &&
              p.byAssignee.map((a: any) => (
                <tr key={a.userId} className="border-t border-slate-100 dark:border-dark-border/50">
                  <td className="px-3 py-2 text-xs font-medium">{a.name}</td>
                  <td className="px-3 py-2 text-xs text-slate-500">{a.groupName}</td>
                  <td className="px-3 py-2 text-xs">{a.assigned}</td>
                  <td className="px-3 py-2 text-xs text-slate-500">{a.remaining}</td>
                </tr>
              ))}
            {tab === "items" &&
              p.items.slice(0, 100).map((i: any) => (
                <tr key={i.id} className="border-t border-slate-100 dark:border-dark-border/50">
                  <td className="px-3 py-2 text-[11px] text-slate-500">{i.id}</td>
                  <td className="px-3 py-2 text-[11px]">{shortType(i.workItemType)}</td>
                  <td className="px-3 py-2 text-[11px]">
                    {i.department ?? i.payer}
                    {i.claimStatus && <span className="text-slate-400"> · {i.claimStatus}</span>}
                  </td>
                  <td className="px-3 py-2 text-[11px] font-medium">{i.rank}</td>
                  <td className="px-3 py-2 text-[11px] text-slate-500">{i.groupName}</td>
                  <td className="px-3 py-2 text-[11px]">{i.assigneeName}</td>
                </tr>
              ))}
            {tab === "unmatched" &&
              p.unmatched.slice(0, 100).map((i: any) => (
                <tr key={i.id} className="border-t border-slate-100 dark:border-dark-border/50">
                  <td className="px-3 py-2 text-[11px] text-slate-500">{i.id}</td>
                  <td className="px-3 py-2 text-[11px]">{shortType(i.workItemType)}</td>
                  <td className="px-3 py-2 text-[11px]">{i.department ?? i.payer}</td>
                  <td className="px-3 py-2 text-[11px] text-amber-700 dark:text-amber-400">
                    {i.reason}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
        {tab === "items" && p.items.length > 100 && (
          <p className="px-3 py-2 text-[11px] text-slate-500">
            Showing first 100 of {p.items.length}.
          </p>
        )}
      </div>
    </div>
  );
}
