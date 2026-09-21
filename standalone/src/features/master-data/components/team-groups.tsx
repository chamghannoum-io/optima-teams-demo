/**
 * Allocation groups for a team.
 *
 * A group is a narrower rule than its team's, plus the people who work it. The
 * rule is edited by CriteriaBuilder, so this component knows nothing about
 * departments, payers or divisions, and a client who routes on something else
 * gets the same editor without a change here.
 *
 * Two failure modes are flagged live, because both silently lose work:
 * a value no group admits (nothing is allocated for it) and a value two groups
 * admit for the same work item type (narrowest-wins decides, maybe not as meant).
 */
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { gql, useMutation, useQuery } from "@apollo/client";
import { Plus, Trash2, Users, X, AlertTriangle, Search, CalendarOff } from "lucide-react";

import { cn, Button, Badge, Input, Switch } from "@optima/ui";

import { CriteriaBuilder, DIMENSIONS_QUERY, type Criterion } from "./criteria-builder.js";
import { MemberUnavailabilityDialog } from "./member-unavailability-dialog.js";

const SET_UNAVAILABILITY = gql`
  mutation SetTeamMemberUnavailability($input: OptimaTeamUserUnavailabilityInput!) {
    optimaTeamUserUnavailabilitySet(input: $input) {
      id
      startDate
      endDate
      cancelled
      activeToday
    }
  }
`;

const CANCEL_UNAVAILABILITY = gql`
  mutation CancelTeamMemberUnavailability($id: ID!) {
    optimaTeamUserUnavailabilityCancel(id: $id) {
      id
      cancelled
    }
  }
`;

/** yyyy-mm-dd in local time, which is how the window is read. */
const isoDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
import { DistributionRationale } from "./distribution-rationale.js";

/** One allocation group within a team. Criteria carry the routing, members the work. */
export interface TeamGroup {
  id: string;
  name: string;
  active: boolean;
  criteria: Criterion[];
  members: { id: string; firstName?: string | null; lastName?: string | null }[];
}

export interface TeamGroupsProps {
  groups: TeamGroup[];
  onChange: (groups: TeamGroup[]) => void;
  /** The team's rule. Groups inherit it and may only narrow it. */
  teamCriteria: Criterion[];
  memberOptions: { id: string; firstName?: string | null; lastName?: string | null }[];
  /** Saved team id, so value lists and the rationale can be scoped. */
  teamId?: string | null;
  className?: string;
}

const VALUES_QUERY = gql`
  query GroupCoverageValues($dimension: String!, $teamId: ID) {
    dimensionValues(dimension: $dimension, teamId: $teamId) {
      value
      perDay
    }
  }
`;

const shortType = (t: string) =>
  t.replace("AUTHORIZATION_", "Auth ").replace("CLAIM_", "Claim ").replace("_", " ").toLowerCase();
const personName = (u: { firstName?: string | null; lastName?: string | null }) =>
  [u.firstName, u.lastName].filter(Boolean).join(" ") || "-";
const initials = (n: string) =>
  n.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();

const criterionFor = (criteria: Criterion[], code: string) =>
  criteria.find((c) => c.dimension === code);

/** Values of a dimension a rule admits, out of the universe available. */
function admitted(criteria: Criterion[], code: string, universe: string[]): string[] {
  const c = criterionFor(criteria, code);
  if (!c || c.operator === "ANY") return [...universe];
  const set = new Set(c.values);
  return c.operator === "NOT_IN"
    ? universe.filter((v) => !set.has(v))
    : universe.filter((v) => set.has(v));
}

const merge = (team: Criterion[], group: Criterion[]): Criterion[] => {
  const out = new Map<string, Criterion>();
  for (const c of team) out.set(c.dimension, c);
  for (const c of group) out.set(c.dimension, c);
  return [...out.values()];
};

export function TeamGroups({
  groups,
  onChange,
  teamCriteria,
  memberOptions,
  teamId,
  className,
}: TeamGroupsProps) {
  const { t: _t } = useTranslation("provider");
  const [picker, setPicker] = useState<string | null>(null);
  /** Which member's availability is being edited, if any. */
  const [away, setAway] = useState<{ groupId: string; member: any } | null>(null);
  const [setUnavailable, { loading: savingAway }] = useMutation(SET_UNAVAILABILITY);
  const [cancelUnavailable] = useMutation(CANCEL_UNAVAILABILITY);

  /**
   * Reflect the saved window on the chip straight away. The member list is
   * wizard state rather than a live query, so without this the name only greys
   * out on reopen, and it looks like the save did nothing.
   */
  const markAway = (
    userId: string,
    unavailableToday: boolean,
    windows: (existing: any[]) => any[],
  ) => {
    onChange(
      groups.map((g) => ({
        ...g,
        members: g.members.map((m: any) =>
          String(m.id) === String(userId)
            ? {
                ...m,
                unavailableToday,
                unavailabilities: windows(m.unavailabilities ?? []).filter(Boolean),
              }
            : m,
        ),
      })),
    );
  };
  const [filter, setFilter] = useState("");

  const { data: dimData } = useQuery(DIMENSIONS_QUERY);
  const dimensions = dimData?.allocationDimensions ?? [];

  /**
   * The dimension these groups split on: the coverage-checked one they actually
   * constrain. This is what `logicAxis` used to declare up front; it is now just
   * observed, so a team can be re-split on another axis without a schema concept.
   */
  const splitDim = useMemo(() => {
    const checked = dimensions.filter(
      (d: any) => d.coverageChecked && d.code !== "WORK_ITEM_TYPE",
    );
    const scored = checked
      .map((d: any) => ({
        d,
        n: groups.filter((g) => g.active && criterionFor(g.criteria, d.code)).length,
      }))
      .sort((a: any, b: any) => b.n - a.n);
    return scored[0]?.n ? scored[0].d : null;
  }, [dimensions, groups]);

  const { data: valData } = useQuery(VALUES_QUERY, {
    variables: { dimension: splitDim?.code ?? "DEPARTMENT", teamId: teamId ?? null },
    skip: !splitDim,
  });
  const universe: string[] = useMemo(
    () => (valData?.dimensionValues ?? []).map((v: any) => v.value),
    [valData],
  );

  const workItemTypes: string[] = useMemo(() => {
    const c = criterionFor(teamCriteria, "WORK_ITEM_TYPE");
    return c && c.operator === "IN" ? c.values : [];
  }, [teamCriteria]);

  /**
   * Coverage is per work item type, not per team: a group covering ENT for auth
   * submission does nothing for auth resubmission, so each type needs its own
   * sweep. A value counts as covered only if some group handles that type and
   * admits the value.
   */
  const { perType, claimedBy, memberIn, totalGaps } = useMemo(() => {
    const handledTypes = [
      ...new Set(
        groups.flatMap((g) =>
          g.active ? admitted(merge(teamCriteria, g.criteria), "WORK_ITEM_TYPE", workItemTypes) : [],
        ),
      ),
    ];

    const admits = (g: TeamGroup, wt: string) =>
      admitted(merge(teamCriteria, g.criteria), "WORK_ITEM_TYPE", workItemTypes).includes(wt);
    const valuesOf = (g: TeamGroup) =>
      splitDim ? admitted(g.criteria, splitDim.code, universe) : [];

    const perType = handledTypes.map((wt) => {
      const covered = new Set<string>();
      for (const g of groups) {
        if (!g.active || !admits(g, wt)) continue;
        for (const v of valuesOf(g)) covered.add(v);
      }
      return {
        workItemType: wt,
        covered: covered.size,
        missing: universe.filter((o) => !covered.has(o)),
        groupCount: groups.filter((g) => g.active && admits(g, wt)).length,
      };
    });

    // Two groups admitting the same value for the same type is the clash worth
    // seeing. One group spanning several types is not.
    const claimedBy = new Map<string, string[]>();
    for (const wt of handledTypes) {
      const seen = new Map<string, string[]>();
      for (const g of groups) {
        if (!g.active || !admits(g, wt)) continue;
        for (const v of valuesOf(g)) seen.set(v, [...(seen.get(v) ?? []), g.name]);
      }
      for (const [v, gs] of seen) {
        const distinct = [...new Set(gs)];
        if (distinct.length > 1) claimedBy.set(v, distinct);
      }
    }

    const memberIn = new Map<string, string[]>();
    for (const g of groups) {
      if (!g.active) continue;
      for (const m of g.members ?? []) memberIn.set(m.id, [...(memberIn.get(m.id) ?? []), g.name]);
    }

    return {
      perType,
      claimedBy,
      memberIn,
      totalGaps: perType.reduce((n, p) => n + p.missing.length, 0),
    };
  }, [groups, teamCriteria, workItemTypes, splitDim, universe]);

  const addGroup = () => {
    onChange([
      ...groups,
      { id: crypto.randomUUID(), name: `Group ${groups.length + 1}`, active: true, criteria: [], members: [] },
    ]);
  };
  const update = (id: string, patch: Partial<TeamGroup>) =>
    onChange(groups.map((g) => (g.id === id ? { ...g, ...patch } : g)));
  const remove = (id: string) => onChange(groups.filter((g) => g.id !== id));

  /**
   * Fills coverage gaps on the split dimension, one work item type at a time,
   * putting each uncovered value into the lightest group that handles that type.
   */
  const fillGaps = () => {
    if (!splitDim) return;
    const next = groups.map((g) => ({ ...g, criteria: g.criteria.map((c) => ({ ...c, values: [...c.values] })) }));
    const idx = new Map(next.map((g, i) => [g.id, i]));
    const valuesOf = (g: TeamGroup) => {
      const c = criterionFor(next[idx.get(g.id)!].criteria, splitDim.code);
      return c?.values ?? [];
    };
    const addValue = (g: TeamGroup, v: string) => {
      const slot = next[idx.get(g.id)!];
      const c = criterionFor(slot.criteria, splitDim.code);
      if (c) c.values.push(v);
      else slot.criteria.push({ dimension: splitDim.code, operator: "IN", values: [v] });
    };
    const admits = (g: TeamGroup, wt: string) =>
      admitted(merge(teamCriteria, g.criteria), "WORK_ITEM_TYPE", workItemTypes).includes(wt);

    for (const pt of perType) {
      const handlers = next.filter((g) => g.active && admits(g, pt.workItemType));
      if (!handlers.length) continue;
      for (const v of pt.missing) {
        if (handlers.some((g) => valuesOf(g).includes(v))) continue;
        let target = handlers[0];
        for (const g of handlers) if (valuesOf(g).length < valuesOf(target).length) target = g;
        addValue(target, v);
      }
    }
    onChange(next);
  };

  const open = picker ? groups.find((g) => g.id === picker) : null;
  const pickerOptions = memberOptions.filter((m) =>
    personName(m).toLowerCase().includes(filter.toLowerCase()),
  );

  return (
    <div className={cn("space-y-4", className)}>
      {/* coverage, per work item type */}
      {splitDim && perType.length > 0 && universe.length > 0 && (
        <div className="rounded-lg border border-slate-200 dark:border-dark-border">
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2 dark:border-dark-border/50">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              {splitDim.label} coverage, checked per work item type
            </span>
            {totalGaps > 0 && groups.length > 0 && (
              <button
                type="button"
                onClick={fillGaps}
                className="text-xs font-medium text-primary underline underline-offset-2 dark:text-primary-300"
              >
                Fill the gaps
              </button>
            )}
          </div>
          <div className="divide-y divide-slate-100 dark:divide-dark-border/50">
            {perType.map((pt) => {
              const done = pt.missing.length === 0;
              return (
                <div key={pt.workItemType} className="flex items-center gap-3 px-3 py-2">
                  <span className="w-40 shrink-0 text-xs font-medium text-slate-700 dark:text-slate-300">
                    {shortType(pt.workItemType)}
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-dark-surface">
                    <div
                      className={cn("h-full rounded-full", done ? "bg-emerald-500" : "bg-amber-400")}
                      style={{ width: `${universe.length ? (pt.covered / universe.length) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="w-28 shrink-0 text-right text-[11px] tabular-nums text-slate-500">
                    {pt.covered} / {universe.length}
                  </span>
                  {done ? (
                    <Badge variant="success">complete</Badge>
                  ) : (
                    <Badge variant="warning">{pt.missing.length} missing</Badge>
                  )}
                </div>
              );
            })}
          </div>
          {perType.some((p) => p.missing.length > 0) && (
            <div className="space-y-0.5 border-t border-slate-100 px-3 py-2 dark:border-dark-border/50">
              {perType
                .filter((p) => p.missing.length > 0)
                .slice(0, 2)
                .map((p) => (
                  <p key={p.workItemType} className="text-[11px] text-amber-700 dark:text-amber-400">
                    <strong>{shortType(p.workItemType)}</strong> has no group for{" "}
                    {p.missing.slice(0, 5).join(", ")}
                    {p.missing.length > 5 && ` +${p.missing.length - 5} more`}. That work will
                    not be allocated.
                  </p>
                ))}
            </div>
          )}
        </div>
      )}

      {teamId && splitDim && groups.length > 0 && (
        <DistributionRationale teamId={teamId} groupCount={groups.filter((g) => g.active).length} />
      )}

      {/* the groups */}
      {groups.map((g) => {
        const noMembers = !(g.members ?? []).length;
        return (
          <div
            key={g.id}
            className={cn(
              "rounded-lg border bg-white dark:bg-dark-card",
              g.active
                ? "border-slate-200 dark:border-dark-border"
                : "border-dashed border-slate-300 opacity-60 dark:border-dark-border",
            )}
          >
            <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2 dark:border-dark-border/50">
              <Input
                value={g.name}
                onChange={(e: any) => update(g.id, { name: e.target.value })}
                className="h-8 max-w-xs text-sm font-medium"
                placeholder="Group name"
              />
              <label className="ml-auto flex items-center gap-1.5 text-[11px] text-slate-500">
                <Switch
                  checked={g.active}
                  onCheckedChange={(v: boolean) => update(g.id, { active: v })}
                />
                Active
              </label>
              <button
                type="button"
                aria-label={`Delete ${g.name}`}
                onClick={() => remove(g.id)}
                className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
              >
                <Trash2 size={14} />
              </button>
            </div>

            <div className="space-y-2 border-b border-slate-100 p-3 dark:border-dark-border/50">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Matches
              </span>
              <CriteriaBuilder
                criteria={g.criteria}
                onChange={(criteria) => update(g.id, { criteria })}
                level="GROUP"
                teamId={teamId}
                inherited={teamCriteria}
              />
              {splitDim &&
                admitted(g.criteria, splitDim.code, universe).some((v) => claimedBy.has(v)) && (
                  <p className="flex items-start gap-1.5 text-[11px] text-amber-700 dark:text-amber-400">
                    <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                    Some values here are also taken by another group for the same work item
                    type. The narrower rule wins.
                  </p>
                )}
            </div>

            {/* members, always visible */}
            <div className="space-y-2 p-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <Users size={11} className="mr-1 inline" /> Members ({g.members.length})
                </span>
                <Button
                  type="button"
                  variant="tertiary"
                  size="sm"
                  onClick={() => {
                    setPicker(g.id);
                    setFilter("");
                  }}
                >
                  <Plus size={13} /> Add
                </Button>
              </div>
              {noMembers ? (
                <p className="py-2 text-xs text-red-600 dark:text-red-400">
                  No members. Work matched here cannot be assigned.
                </p>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {g.members.map((m) => (
                    <span
                      key={m.id}
                      className="inline-flex items-center gap-1 rounded-full bg-slate-100 py-0.5 pl-0.5 pr-2 text-xs dark:bg-dark-surface"
                    >
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[9px] font-semibold text-white">
                        {initials(personName(m))}
                      </span>
                      <span
                        className={cn(
                          "max-w-[110px] truncate",
                          m.unavailableToday
                            ? "text-slate-400 line-through dark:text-slate-500"
                            : "text-slate-700 dark:text-slate-300",
                        )}
                      >
                        {personName(m)}
                      </span>
                      {/*
                       * Availability belongs next to the name, because a member
                       * who is away is still on the team and still shown, and
                       * the only thing that changes is that allocation skips
                       * them tonight.
                       */}
                      <button
                        type="button"
                        aria-label={`Set availability for ${personName(m)}`}
                        title={
                          m.unavailableToday
                            ? `${personName(m)} is unavailable today`
                            : `Mark ${personName(m)} unavailable`
                        }
                        onClick={() => setAway({ groupId: g.id, member: m })}
                        className={cn(
                          "rounded p-0.5",
                          m.unavailableToday
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-200",
                        )}
                      >
                        <CalendarOff size={11} />
                      </button>
                      <button
                        type="button"
                        aria-label={`Remove ${personName(m)}`}
                        onClick={() =>
                          update(g.id, { members: g.members.filter((x) => x.id !== m.id) })
                        }
                        className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                      >
                        <X size={11} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}

      <Button type="button" variant="outline" onClick={addGroup}>
        <Plus size={14} /> Add group
      </Button>

      {/*
       * Availability. The window is a property of the person, so it is saved
       * straight away rather than held until the wizard is submitted: the
       * member is on the team already, and being away is not a draft.
       */}
      {away && (
        <MemberUnavailabilityDialog
          open
          memberName={personName(away.member)}
          existing={(away.member.unavailabilities ?? []).filter((u: any) => !u.cancelled)}
          saving={savingAway}
          onClose={() => setAway(null)}
          onCancelWindow={async (id: string) => {
            await cancelUnavailable({ variables: { id } });
            markAway(away.member.id, false, (w: any[]) =>
              w.map((u) => (String(u.id) === String(id) ? { ...u, cancelled: true } : u)),
            );
          }}
          onConfirm={async ({ startDate, endDate, reason }, resolution) => {
            if (!teamId) return;
            const res = await setUnavailable({
              variables: {
                input: {
                  teamId,
                  userId: away.member.id,
                  startDate: isoDay(startDate),
                  endDate: isoDay(endDate),
                  reason,
                  action: resolution === "UNASSIGN" ? "UNASSIGN" : "REDISTRIBUTE",
                },
              },
            });
            const saved = res.data?.optimaTeamUserUnavailabilitySet;
            markAway(away.member.id, !!saved?.activeToday, (w: any[]) => [...w, saved]);
          }}
        />
      )}

      {/* member picker */}
      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 p-6"
          onClick={() => setPicker(null)}
        >
          <div
            className="flex max-h-[70vh] w-full max-w-lg flex-col rounded-xl bg-white shadow-xl dark:bg-dark-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-slate-200 p-4 dark:border-dark-border">
              <p className="text-sm font-semibold text-slate-900 dark:text-dark-text">
                Add members to {open.name}
              </p>
              <div className="relative mt-2">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <Input
                  autoFocus
                  value={filter}
                  onChange={(e: any) => setFilter(e.target.value)}
                  placeholder="Search…"
                  className="pl-9"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {pickerOptions.length === 0 && (
                <p className="p-4 text-center text-sm text-slate-500">No matches.</p>
              )}
              {pickerOptions.map((m) => {
                const on = open.members.some((x) => x.id === m.id);
                const elsewhere = (memberIn.get(m.id) ?? []).filter((n) => n !== open.name);
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() =>
                      update(open.id, {
                        members: on
                          ? open.members.filter((x) => x.id !== m.id)
                          : [...open.members, m],
                      })
                    }
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm",
                      on
                        ? "bg-primary/10 text-primary dark:text-primary-300"
                        : "hover:bg-slate-50 dark:hover:bg-dark-hover",
                    )}
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[9px] font-semibold text-white">
                      {initials(personName(m))}
                    </span>
                    <span className="flex-1 truncate">{personName(m)}</span>
                    {elsewhere.length > 0 && (
                      <span className="shrink-0 text-[11px] text-slate-500 dark:text-slate-400">
                        also in {elsewhere.join(", ")}
                      </span>
                    )}
                    {on && <Badge variant="info">added</Badge>}
                  </button>
                );
              })}
            </div>
            <div className="flex justify-end border-t border-slate-200 p-3 dark:border-dark-border">
              <Button type="button" onClick={() => setPicker(null)}>
                Done
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
