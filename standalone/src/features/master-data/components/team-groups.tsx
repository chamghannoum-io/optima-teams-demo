/**
 * Allocation groups for a team.
 *
 * A group is a narrower rule than its team's, plus the people who work it. The
 * rule is edited by CriteriaBuilder, so this component knows nothing about
 * departments, payers or divisions, and a client who routes on something else
 * gets the same editor without a change here.
 *
 * One failure mode is flagged live, on the group it belongs to: two groups
 * whose rules are identical AND which share a member. Both halves are needed.
 * Identical rules alone are legal and sometimes meant, two shifts covering one
 * slice of work; overlap alone is what narrowest-wins is for and flagging it
 * put an amber line on nearly every card in the estate, which reads as noise
 * and gets ignored. Identical plus a shared person is specific, rare and
 * always a mistake, so the card names the person rather than the rule.
 *
 * High cost lives on the card too, as a switch and an amount. It is stored as
 * an ordinary criterion on the group's rule (ITEM_VALUE > n), which is why a
 * high-cost group routes, scores and explains itself through the same code as
 * every other group. The amount comes off a list only a supervisor can edit.
 *
 * Coverage gaps are deliberately NOT shown here any more. A per-work-item-type
 * progress strip used to sit above the groups, and on a payer split it read
 * "90 / 90, complete" on every row for every claims team, because the catch-all
 * groups admit every payer , three green bars that could not say anything else.
 * Uncovered values are still reported, estate-wide and per team, on the
 * readiness dashboard, which is where someone goes to be told what is wrong
 * rather than mid-edit.
 */
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { gql, useMutation, useQuery } from "@apollo/client";
import {
  Plus,
  Trash2,
  Users,
  X,
  Search,
  CalendarOff,
  Coins,
  Lock,
  Copy,
} from "lucide-react";

import {
  cn,
  Button,
  Badge,
  Input,
  Switch,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@optima/ui";
import { useIsRcmSupervisor } from "@optima/auth";

import { CriteriaBuilder, DIMENSIONS_QUERY, type Criterion } from "./criteria-builder.js";
import { HighCostAmountsDialog } from "./high-cost-amounts-dialog.js";
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
  members: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    unavailableToday?: boolean | null;
    unavailabilities?: any[];
  }[];
}

export interface TeamGroupsProps {
  groups: TeamGroup[];
  onChange: (groups: TeamGroup[]) => void;
  /** The team's rule. Groups inherit it and may only narrow it. */
  teamCriteria: Criterion[];
  memberOptions: { id: string; firstName?: string | null; lastName?: string | null }[];
  /** Saved team id, so value lists and the rationale can be scoped. */
  teamId?: string | null;
  /**
   * Who supervises this team, as chosen on step 1 and possibly not saved yet.
   * Supervisors sit in every group by design, so the duplicate check has to
   * ignore them or it fires on every team that has one.
   */
  supervisorIds?: string[];
  className?: string;
}

const personName = (u: { firstName?: string | null; lastName?: string | null }) =>
  [u.firstName, u.lastName].filter(Boolean).join(" ") || "-";
const initials = (n: string) =>
  n.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();

const criterionFor = (criteria: Criterion[], code: string) =>
  criteria.find((c) => c.dimension === code);

/** Group wins on a shared dimension, unless the team locked it. */
const merge = (team: Criterion[], group: Criterion[]): Criterion[] => {
  const locked = new Set(team.filter((c) => c.locked).map((c) => c.dimension));
  const out = new Map<string, Criterion>();
  for (const c of team) out.set(c.dimension, c);
  for (const c of group) if (!locked.has(c.dimension)) out.set(c.dimension, c);
  return [...out.values()];
};

export const HIGH_COST_DIMENSION = "ITEM_VALUE";

/** The high-cost amount on a rule, or null when the switch is off. */
const highCostOf = (criteria: Criterion[]): number | null => {
  const c = criterionFor(criteria, HIGH_COST_DIMENSION);
  if (!c || c.operator !== "GREATER_THAN") return null;
  const n = Number(c.values[0]);
  return Number.isFinite(n) ? n : null;
};

/** Turn the switch on at an amount, or off with null. */
const withHighCost = (criteria: Criterion[], amount: number | null): Criterion[] => {
  const rest = criteria.filter((c) => c.dimension !== HIGH_COST_DIMENSION);
  return amount == null
    ? rest
    : [...rest, { dimension: HIGH_COST_DIMENSION, operator: "GREATER_THAN", values: [String(amount)] }];
};

/**
 * A rule's identity, independent of the order its clauses happen to be in.
 * Mirrors `criteriaSignature` in allocation-model.ts; the wizard holds unsaved
 * state, so it cannot ask the server what it is about to be told.
 */
const signatureOf = (criteria: Criterion[]): string =>
  [...criteria]
    .filter((c) => c.operator === "ANY" || c.values.length)
    .map((c) => `${c.dimension}:${c.operator}:${[...c.values].sort().join(",")}`)
    .sort()
    .join("|");

export function TeamGroups({
  groups,
  onChange,
  teamCriteria,
  memberOptions,
  teamId,
  supervisorIds = [],
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

  /**
   * Groups whose rule is identical to another's AND which share a member,
   * keyed by group id so the card can say it about itself.
   *
   * Both halves matter. Two groups with the same rule and different people is
   * a shift split, which is legal and common. Two groups with the same rule
   * and the same person in both means the narrowest-wins tie-break is choosing
   * between pools that are partly the same pool, and that person silently
   * carries a double share. The merged rule is compared, not the group's own:
   * what the team locked is part of what this group actually runs, so two
   * groups left looking different by a clause the team overrides are still
   * duplicates.
   *
   * Supervisors are skipped, read off the team's own list rather than off a
   * flag on the person: they are added to every group deliberately, so
   * including them would fire this on every team that has one.
   */
  const duplicates = useMemo(() => {
    const supervises = new Set(supervisorIds.map(String));
    const bySignature = new Map<string, TeamGroup[]>();
    for (const g of groups) {
      if (!g.active) continue;
      const sig = signatureOf(merge(teamCriteria, g.criteria));
      bySignature.set(sig, [...(bySignature.get(sig) ?? []), g]);
    }

    const out = new Map<string, { others: string[]; members: string[] }>();
    for (const sharing of bySignature.values()) {
      if (sharing.length < 2) continue;
      const count = new Map<string, { name: string; n: number }>();
      for (const g of sharing) {
        for (const m of g.members ?? []) {
          if (supervises.has(String(m.id))) continue;
          const cur = count.get(m.id) ?? { name: personName(m), n: 0 };
          count.set(m.id, { ...cur, n: cur.n + 1 });
        }
      }
      const repeated = [...count.values()].filter((m) => m.n > 1).map((m) => m.name);
      if (!repeated.length) continue;
      for (const g of sharing) {
        out.set(g.id, {
          others: sharing.filter((x) => x.id !== g.id).map((x) => x.name || "Untitled group"),
          members: repeated,
        });
      }
    }
    return out;
  }, [groups, teamCriteria, supervisorIds]);

  /*
   * High cost, which is a criterion the generic builder cannot draw.
   *
   * Offered on every group. An earlier cut gated it on the registry's
   * `appliesToTypes` so an authorisation team never saw it; that was wrong,
   * any group can be the one that takes the expensive work. The only gate
   * left is the dimension existing at all, and `appliesToTypes` is still
   * honoured generically for whatever dimension does use it.
   */
  const valueDim = useMemo(
    () => dimensions.find((d: any) => d.code === HIGH_COST_DIMENSION),
    [dimensions],
  );
  const [amounts, setAmounts] = useState<number[] | null>(null);
  const [editingAmounts, setEditingAmounts] = useState(false);
  const canEditAmounts = useIsRcmSupervisor();
  const effectiveAmounts = amounts ?? valueDim?.numericOptions ?? [];

  const teamTypes = useMemo(() => {
    const own = criterionFor(teamCriteria, "WORK_ITEM_TYPE");
    const fromGroups = groups.flatMap(
      (g) => criterionFor(g.criteria, "WORK_ITEM_TYPE")?.values ?? [],
    );
    return own && own.operator === "IN" && own.values.length
      ? [...own.values, ...fromGroups]
      : fromGroups;
  }, [teamCriteria, groups]);

  const highCostAvailable =
    !!valueDim &&
    (!(valueDim.appliesToTypes ?? []).length ||
      !teamTypes.length ||
      teamTypes.some((w: string) => (valueDim.appliesToTypes ?? []).includes(w)));

  /** Which other groups each person is already in, for the member picker. */
  const memberIn = useMemo(() => {
    const out = new Map<string, string[]>();
    for (const g of groups) {
      if (!g.active) continue;
      for (const m of g.members ?? []) out.set(m.id, [...(out.get(m.id) ?? []), g.name]);
    }
    return out;
  }, [groups]);

  /**
   * The switch and the amount, on one row.
   *
   * It reads as a property of the group because that is how the business
   * talks about it , "this group does the expensive resubmissions" , but it
   * writes an ordinary clause onto the group's rule. Everything downstream,
   * the matcher, the tie-break, the preview, the "why did this go here", then
   * treats it as any other filter with no special case for money anywhere.
   */
  function HighCostRow({ group }: { group: TeamGroup }) {
    const amount = highCostOf(group.criteria);
    const on = amount != null;
    // A supervisor can empty the list, and an amount a group already uses may
    // have been taken off it; keep showing it so the group does not appear
    // unset, and so turning the switch off is a deliberate act.
    const options = [...new Set([...effectiveAmounts, ...(on ? [amount] : [])])].sort(
      (a, b) => a - b,
    );
    const unit = valueDim?.unit ?? "";

    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md bg-slate-50 px-3 py-2 dark:bg-dark-surface">
        <label className="flex cursor-pointer items-center gap-2">
          <Switch
            checked={on}
            disabled={!on && !options.length}
            onCheckedChange={(v: boolean) =>
              update(group.id, {
                criteria: withHighCost(group.criteria, v ? (options[0] ?? null) : null),
              })
            }
          />
          <span className="flex items-center gap-1 text-xs font-medium text-slate-700 dark:text-slate-300">
            <Coins size={12} /> High cost
          </span>
        </label>

        {on ? (
          <>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">over</span>
            <Select
              value={String(amount)}
              onValueChange={(v: string) =>
                update(group.id, { criteria: withHighCost(group.criteria, Number(v)) })
              }
            >
              <SelectTrigger className="h-8 w-36 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {options.map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n.toLocaleString()}
                    {unit ? ` ${unit}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              Only work over this reaches this group. Anything below goes to whichever
              other group matches.
            </span>
          </>
        ) : (
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            {options.length
              ? "Off. This group takes work of any value."
              : "No amounts are configured, so this cannot be switched on."}
          </span>
        )}

        {/*
          * The amount is a dropdown because a supervisor owns the list. Saying
          * so, next to the control and with their name on it, is what stops it
          * reading as an arbitrary restriction.
          */}
        <button
          type="button"
          onClick={() => setEditingAmounts(true)}
          className="ml-auto flex items-center gap-1 text-[11px] text-slate-500 underline underline-offset-2 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
        >
          {!canEditAmounts && <Lock size={10} />}
          {canEditAmounts ? "Manage amounts" : "Who sets these?"}
        </button>
      </div>
    );
  }

  const addGroup = () => {
    onChange([
      ...groups,
      { id: crypto.randomUUID(), name: `Group ${groups.length + 1}`, active: true, criteria: [], members: [] },
    ]);
  };
  const update = (id: string, patch: Partial<TeamGroup>) =>
    onChange(groups.map((g) => (g.id === id ? { ...g, ...patch } : g)));
  const remove = (id: string) => onChange(groups.filter((g) => g.id !== id));

  const open = picker ? groups.find((g) => g.id === picker) : null;
  const pickerOptions = memberOptions.filter((m) =>
    personName(m).toLowerCase().includes(filter.toLowerCase()),
  );

  return (
    <div className={cn("space-y-4", className)}>

      {teamId && splitDim && groups.length > 0 && (
        <DistributionRationale teamId={teamId} groupCount={groups.filter((g) => g.active).length} />
      )}

      {/* the groups */}
      {groups.map((g) => {
        const noMembers = !(g.members ?? []).length;
        const dup = duplicates.get(g.id);
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
                onChange={(criteria) =>
                  // The builder does not render claim value, so it cannot
                  // return it. Carry the group's high-cost clause across its
                  // edits rather than letting a department change switch it off.
                  update(g.id, { criteria: withHighCost(criteria, highCostOf(g.criteria)) })
                }
                level="GROUP"
                teamId={teamId}
                inherited={teamCriteria}
              />

              {highCostAvailable && <HighCostRow group={g} />}

              {dup && (
                <p className="flex items-start gap-1.5 text-[11px] text-amber-700 dark:text-amber-400">
                  <Copy size={12} className="mt-0.5 shrink-0" />
                  <span>
                    Same filters as {dup.others.join(", ")}, and{" "}
                    <strong>{dup.members.join(", ")}</strong>{" "}
                    {dup.members.length === 1 ? "is" : "are"} in both. The same work can go to{" "}
                    {dup.members.length === 1 ? "them" : "them"} twice. Give the groups
                    different filters, or {dup.members.length === 1 ? "that person" : "those people"}{" "}
                    one group.
                  </span>
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

      {editingAmounts && valueDim && (
        <HighCostAmountsDialog
          open
          dimension={HIGH_COST_DIMENSION}
          unit={valueDim.unit}
          amounts={effectiveAmounts}
          canEdit={canEditAmounts}
          inUse={groups
            .map((g) => highCostOf(g.criteria))
            .filter((n): n is number => n != null)}
          onClose={() => setEditingAmounts(false)}
          onSaved={setAmounts}
        />
      )}

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
