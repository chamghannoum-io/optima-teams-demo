import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Trash2, Users, X, AlertTriangle, Search, Wand2 } from "lucide-react";

import { cn, Button, Label, Badge, Input, Switch, Alert, AlertDescription } from "@optima/ui";

import { DistributionRationale } from "./distribution-rationale.js";

/** One allocation group within a team. Groups carry the criteria and the members. */
export interface TeamGroup {
  id: string;
  name: string;
  active: boolean;
  workItemTypes: string[];
  encounterScope: string;
  departments: string[];
  payers: string[];
  payerCatchAll: boolean;
  claimStatuses: string[];
  members: { id: string; firstName?: string | null; lastName?: string | null }[];
}

export interface TeamGroupsProps {
  groups: TeamGroup[];
  onChange: (groups: TeamGroup[]) => void;
  division: string;
  logicAxis: string;
  departmentOptions: string[];
  payerOptions: string[];
  memberOptions: { id: string; firstName?: string | null; lastName?: string | null }[];
  /** Saved team id, so the rationale can be looked up. Absent while creating. */
  teamId?: string | null;
  className?: string;
}

const AUTH_TYPES = ["AUTHORIZATION_SUBMISSION", "AUTHORIZATION_RESUBMISSION"];
const CLAIM_TYPES = ["CLAIM_VALIDATION", "CLAIM_SUBMISSION", "CLAIM_RESUBMISSION", "RECONCILIATION"];
const CLAIM_STATUSES = ["OPEN", "CHECKED", "VALIDATED"];

const shortType = (t: string) =>
  t.replace("AUTHORIZATION_", "Auth ").replace("CLAIM_", "Claim ").replace("_", " ").toLowerCase();
const personName = (u: { firstName?: string | null; lastName?: string | null }) =>
  [u.firstName, u.lastName].filter(Boolean).join(" ") || "—";
const initials = (n: string) =>
  n.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();

/**
 * Allocation groups for a team.
 *
 * Everything a group matches on is visible without opening it — the departments or
 * payers are shown as chips on the card, not hidden behind a count. Coverage problems
 * (uncovered, or claimed by two groups) are flagged live as you edit, because those
 * are the two ways a configuration silently drops or double-books work.
 */
export function TeamGroups({
  groups,
  onChange,
  division,
  logicAxis,
  departmentOptions,
  payerOptions,
  memberOptions,
  teamId,
  className,
}: TeamGroupsProps) {
  const { t } = useTranslation("provider");
  const [picker, setPicker] = useState<{ groupId: string; kind: "criteria" | "members" } | null>(null);
  const [filter, setFilter] = useState("");

  const byDept = logicAxis === "DEPARTMENT";
  const allowedTypes = division === "AUTH" ? AUTH_TYPES : CLAIM_TYPES;
  const options = byDept ? departmentOptions : payerOptions;
  const criteriaOf = (g: TeamGroup) => (byDept ? g.departments : g.payers);

  /*
   * Coverage is per WORK ITEM TYPE, not per team.
   *
   * A group covering ENT for auth submission does nothing for auth resubmission —
   * each type needs its own full sweep of the facility's departments. So the check
   * runs once per type the team is expected to handle, and a department is only
   * "covered" for a type if some group handles that type AND names it.
   */
  const { perType, overlapping, claimedBy, placedIn, memberIn, totalGaps } = useMemo(() => {
    const types = [...new Set(groups.flatMap((g) => (g.active ? g.workItemTypes : [])))];
    const anyCatchAll = !byDept && groups.some((g) => g.active && g.payerCatchAll);

    const perType = (types.length ? types : allowedTypes).map((wt) => {
      const covered = new Set<string>();
      for (const g of groups) {
        if (!g.active || !g.workItemTypes.includes(wt)) continue;
        for (const c of criteriaOf(g)) covered.add(c);
      }
      const handledBy = groups.filter((g) => g.active && g.workItemTypes.includes(wt));
      const missing = anyCatchAll ? [] : options.filter((o) => !covered.has(o));
      return { workItemType: wt, covered: covered.size, missing, groupCount: handledBy.length };
    });

    // Duplicates only matter within the same work item type.
    const counts = new Map<string, string[]>();
    for (const wt of types) {
      const seen = new Map<string, string[]>();
      for (const g of groups) {
        if (!g.active || !g.workItemTypes.includes(wt)) continue;
        for (const c of criteriaOf(g)) seen.set(c, [...(seen.get(c) ?? []), g.name]);
      }
      for (const [c, gs] of seen) {
        // Distinct groups only — one group handling several types is not a clash.
        const distinct = [...new Set(gs)];
        if (distinct.length > 1) counts.set(`${c}|${wt}`, distinct);
      }
    }
    // Chip highlighting: which criteria clash somewhere.
    const claimedBy = new Map<string, string[]>();
    for (const [key, gs] of counts) claimedBy.set(key.split("|")[0], gs);

    // Where every criterion currently sits, clash or not. The picker uses this so a
    // user adding a second "Submission — AJM" group can see what the first already
    // covers and pick only the remainder.
    const placedIn = new Map<string, { group: string; types: string[] }[]>();
    for (const g of groups) {
      if (!g.active) continue;
      for (const c of criteriaOf(g)) {
        placedIn.set(c, [...(placedIn.get(c) ?? []), { group: g.name, types: g.workItemTypes }]);
      }
    }
    // Same for people: a member may legitimately serve several groups, but the user
    // should know before adding them again.
    const memberIn = new Map<string, string[]>();
    for (const g of groups) {
      if (!g.active) continue;
      for (const m of g.members ?? []) {
        memberIn.set(m.id, [...(memberIn.get(m.id) ?? []), g.name]);
      }
    }

    return {
      perType,
      overlapping: [...counts.entries()].map(([k, gs]) => [k.split("|")[0], k.split("|")[1], gs] as const),
      claimedBy,
      placedIn,
      memberIn,
      totalGaps: perType.reduce((n, p) => n + p.missing.length, 0),
    };
  }, [groups, options, byDept, allowedTypes]);

  const addGroup = () => {
    const g: TeamGroup = {
      id: crypto.randomUUID(),
      name: `Group ${groups.length + 1}`,
      active: true,
      workItemTypes: [],
      encounterScope: "BOTH",
      departments: [],
      payers: [],
      payerCatchAll: false,
      claimStatuses: [],
      members: [],
    };
    onChange([...groups, g]);
  };
  const update = (id: string, patch: Partial<TeamGroup>) =>
    onChange(groups.map((g) => (g.id === id ? { ...g, ...patch } : g)));
  const remove = (id: string) => onChange(groups.filter((g) => g.id !== id));
  const toggle = (list: string[], v: string) =>
    list.includes(v) ? list.filter((x) => x !== v) : [...list, v];

  /**
   * Fills coverage gaps, one work item type at a time.
   *
   * Coverage is per type: a department needs exactly one group that handles that
   * type and names it. Groups covering several types can satisfy more than one pass
   * with a single entry, so the criterion is added only where it is actually missing.
   */
  const autoDistribute = () => {
    const active = groups.filter((g) => g.active);
    if (!active.length) return;
    const next = groups.map((g) => ({
      ...g,
      departments: [...g.departments],
      payers: [...g.payers],
    }));
    const idx = new Map(next.map((g, i) => [g.id, i]));
    const has = (g: TeamGroup, o: string) => criteriaOf(next[idx.get(g.id)!]).includes(o);
    const size = (g: TeamGroup) => criteriaOf(next[idx.get(g.id)!]).length;

    const types = [...new Set(active.flatMap((g) => g.workItemTypes))];
    for (const wt of types.length ? types : [null as unknown as string]) {
      const handlers = active.filter((g) => !wt || g.workItemTypes.includes(wt));
      if (!handlers.length) continue;

      for (const o of options) {
        // Already covered for this type by one of its handlers? Nothing to do.
        if (handlers.some((g) => has(g, o))) continue;

        // A multi-type group would also start serving this criterion for its other
        // types — where another group may already cover it. Prefer a handler that
        // does not create such a clash; fall back to the lightest if none is clean.
        const clean = handlers.filter((g) =>
          g.workItemTypes.every(
            (other) =>
              other === wt ||
              !active.some((h) => h.id !== g.id && h.workItemTypes.includes(other) && has(h, o))
          )
        );
        const pool = clean.length ? clean : handlers;
        let target = pool[0];
        for (const g of pool) if (size(g) < size(target)) target = g;
        const slot = next[idx.get(target.id)!];
        if (byDept) slot.departments.push(o);
        else slot.payers.push(o);
      }
    }
    onChange(next);
  };

  const chip = (on: boolean) =>
    cn("rounded-md border px-2.5 py-1 text-xs font-medium transition",
      on ? "border-primary bg-primary text-white"
         : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-dark-border dark:bg-dark-surface dark:text-slate-300 dark:hover:bg-dark-hover");

  const open = picker ? groups.find((g) => g.id === picker.groupId) : null;
  const pickerOptions = picker?.kind === "criteria"
    ? options.filter((o) => o.toLowerCase().includes(filter.toLowerCase()))
    : memberOptions.filter((m) => personName(m).toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className={cn("space-y-4", className)}>
      {/* ── coverage, per work item type ── */}
      {byDept && perType.length > 0 && (
        <div className="rounded-lg border border-slate-200 dark:border-dark-border">
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2 dark:border-dark-border/50">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Department coverage — checked per work item type
            </span>
            {totalGaps > 0 && groups.length > 0 && (
              <button type="button" onClick={autoDistribute}
                className="text-xs font-medium text-primary underline underline-offset-2 dark:text-primary-300">
                Fill the gaps
              </button>
            )}
          </div>
          <div className="divide-y divide-slate-100 dark:divide-dark-border/50">
            {perType.map((pt) => {
              const done = pt.missing.length === 0;
              const total = options.length;
              return (
                <div key={pt.workItemType} className="flex items-center gap-3 px-3 py-2">
                  <span className="w-40 shrink-0 text-xs font-medium text-slate-700 dark:text-slate-300">
                    {shortType(pt.workItemType)}
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-dark-surface">
                    <div
                      className={cn("h-full rounded-full", done ? "bg-emerald-500" : "bg-amber-400")}
                      style={{ width: `${total ? (pt.covered / total) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="w-28 shrink-0 text-right text-[11px] tabular-nums text-slate-500">
                    {pt.covered} / {total}
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
            <div className="border-t border-slate-100 px-3 py-2 dark:border-dark-border/50">
              {perType
                .filter((p) => p.missing.length > 0)
                .slice(0, 2)
                .map((p) => (
                  <p key={p.workItemType} className="text-[11px] text-amber-700 dark:text-amber-400">
                    <strong>{shortType(p.workItemType)}</strong> has no group for{" "}
                    {p.missing.slice(0, 5).join(", ")}
                    {p.missing.length > 5 && ` +${p.missing.length - 5} more`} — that work
                    will not be allocated.
                  </p>
                ))}
            </div>
          )}
        </div>
      )}

      {!byDept && perType.some((p) => p.missing.length > 0) && (
        <Alert variant="warning">
          <AlertTriangle size={15} />
          <AlertDescription>
            {perType
              .filter((p) => p.missing.length > 0)
              .map((p) => `${shortType(p.workItemType)}: ${p.missing.length} payers uncovered`)
              .join("; ")}
            . Mark a group catch-all to absorb them.
          </AlertDescription>
        </Alert>
      )}

      {overlapping.length > 0 && (
        <Alert variant="warning">
          <AlertTriangle size={15} />
          <AlertDescription>
            <strong>
              {overlapping.length} {byDept ? "department" : "payer"}
              {overlapping.length === 1 ? "" : "s"} claimed twice within the same work type.
            </strong>{" "}
            {overlapping.slice(0, 3).map(([c, wt, gs]) => `${c} in ${shortType(wt)} (${gs.join(" + ")})`).join("; ")}
            {overlapping.length > 3 && ` +${overlapping.length - 3} more`}. The narrowest group
            wins, so the wider one never sees them.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex items-center justify-between gap-2">
        <div>
          <Label>{t("masterData.teams.groups", "Groups")}</Label>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {byDept
              ? `Every department needs a group for each work item type the team handles`
              : "Groups name high-volume payers; catch-all absorbs the rest"}
          </p>
        </div>
        <div className="flex gap-2">
          {groups.length > 0 && (
            <div className="flex items-center gap-0.5">
              <Button type="button" variant="secondary" size="sm" onClick={autoDistribute}>
                <Wand2 size={14} /> Auto-distribute
              </Button>
              {teamId && (
                <DistributionRationale teamId={teamId} groupCount={groups.filter((g) => g.active).length} />
              )}
            </div>
          )}
          <Button type="button" variant="secondary" size="sm" onClick={addGroup}>
            <Plus size={14} /> {t("masterData.teams.addGroup", "Add Group")}
          </Button>
        </div>
      </div>

      {groups.length === 0 && (
        <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center dark:border-dark-border">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No groups yet — this team cannot receive work.
          </p>
          <Button type="button" variant="secondary" size="sm" className="mt-2" onClick={addGroup}>
            <Plus size={14} /> Add the first group
          </Button>
        </div>
      )}

      {/* ── one card per group; criteria visible as chips, not a count ── */}
      {groups.map((g) => {
        const criteria = criteriaOf(g);
        const noMembers = !g.members.length;
        return (
          <div key={g.id}
            className={cn("rounded-lg border bg-white dark:bg-dark-card",
              noMembers ? "border-red-200 dark:border-red-500/30" : "border-slate-200 dark:border-dark-border")}>
            {/* header */}
            <div className="flex items-center gap-3 border-b border-slate-100 p-3 dark:border-dark-border/50">
              <Input value={g.name} onChange={(e: any) => update(g.id, { name: e.target.value })}
                className="h-9 max-w-[240px] font-medium" />
              <div className="flex flex-1 flex-wrap gap-1">
                {allowedTypes.map((wt) => (
                  <button key={wt} type="button" className={chip(g.workItemTypes.includes(wt))}
                    onClick={() => update(g.id, { workItemTypes: toggle(g.workItemTypes, wt) })}>
                    {shortType(wt)}
                  </button>
                ))}
              </div>
              <Switch checked={g.active} onCheckedChange={(v: boolean) => update(g.id, { active: v })} />
              <Button type="button" variant="ghost" size="sm" onClick={() => remove(g.id)}>
                <Trash2 size={15} />
              </Button>
            </div>

            <div className="grid grid-cols-[1fr_260px] divide-x divide-slate-100 dark:divide-dark-border/50">
              {/* criteria — always visible */}
              <div className="space-y-2 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    {byDept ? "Departments" : "Payers"} ({criteria.length})
                  </span>
                  <Button type="button" variant="ghost" size="sm"
                    onClick={() => { setPicker({ groupId: g.id, kind: "criteria" }); setFilter(""); }}>
                    <Plus size={13} /> Add
                  </Button>
                </div>
                {criteria.length === 0 ? (
                  <p className="py-2 text-xs text-slate-400">
                    None yet — this group matches nothing.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {criteria.map((c) => {
                      const dup = (claimedBy.get(c) ?? []).length > 1;
                      return (
                        <span key={c}
                          className={cn("inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs",
                            dup ? "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
                                : "border-slate-200 bg-slate-50 text-slate-700 dark:border-dark-border dark:bg-dark-surface dark:text-slate-300")}
                          title={dup ? `Also in ${(claimedBy.get(c) ?? []).filter((n) => n !== g.name).join(", ")}` : undefined}>
                          {c}
                          <button type="button"
                            onClick={() => update(g.id, byDept
                              ? { departments: g.departments.filter((x) => x !== c) }
                              : { payers: g.payers.filter((x) => x !== c) })}
                            className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
                            <X size={11} />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}

                {division === "CLAIM" && (
                  <div className="pt-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Claim statuses
                    </span>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {CLAIM_STATUSES.map((s) => (
                        <button key={s} type="button" className={chip(g.claimStatuses.includes(s))}
                          onClick={() => update(g.id, { claimStatuses: toggle(g.claimStatuses, s) })}>
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {!byDept && (
                  <label className="flex items-center gap-2 pt-1 text-xs text-slate-600 dark:text-slate-300">
                    <Switch checked={g.payerCatchAll}
                      onCheckedChange={(v: boolean) => update(g.id, { payerCatchAll: v })} />
                    Catch-all — also take any payer no group names
                  </label>
                )}
              </div>

              {/* members — always visible */}
              <div className="space-y-2 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <Users size={11} className="mr-1 inline" /> Members ({g.members.length})
                  </span>
                  <Button type="button" variant="ghost" size="sm"
                    onClick={() => { setPicker({ groupId: g.id, kind: "members" }); setFilter(""); }}>
                    <Plus size={13} /> Add
                  </Button>
                </div>
                {noMembers ? (
                  <p className="py-2 text-xs text-red-600 dark:text-red-400">
                    No members — work matched here cannot be assigned.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {g.members.map((m) => (
                      <span key={m.id}
                        className="inline-flex items-center gap-1 rounded-full bg-slate-100 py-0.5 pl-0.5 pr-2 text-xs dark:bg-dark-surface">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[9px] font-semibold text-white">
                          {initials(personName(m))}
                        </span>
                        <span className="max-w-[110px] truncate text-slate-700 dark:text-slate-300">
                          {personName(m)}
                        </span>
                        <button type="button"
                          onClick={() => update(g.id, { members: g.members.filter((x) => x.id !== m.id) })}
                          className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
                          <X size={11} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {/* ── picker overlay: full width, not a cramped inline list ── */}
      {open && picker && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 p-6"
          onClick={() => setPicker(null)}>
          <div className="flex max-h-[70vh] w-full max-w-lg flex-col rounded-xl bg-white shadow-xl dark:bg-dark-card"
            onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-slate-200 p-4 dark:border-dark-border">
              <p className="text-sm font-semibold text-slate-900 dark:text-dark-text">
                {picker.kind === "criteria"
                  ? `Add ${byDept ? "departments" : "payers"} to ${open.name}`
                  : `Add members to ${open.name}`}
              </p>
              <div className="relative mt-2">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input autoFocus value={filter} onChange={(e: any) => setFilter(e.target.value)}
                  placeholder="Search…" className="pl-9" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {pickerOptions.length === 0 && (
                <p className="p-4 text-center text-sm text-slate-500">No matches.</p>
              )}
              {picker.kind === "criteria"
                ? (pickerOptions as string[]).map((o) => {
                    const on = criteriaOf(open).includes(o);
                    const elsewhere = (placedIn.get(o) ?? []).filter((x) => x.group !== open.name);
                    // Does another group already cover it for the SAME work types?
                    const clash = elsewhere.some((x) =>
                      x.types.some((ty) => open.workItemTypes.includes(ty))
                    );
                    return (
                      <button key={o} type="button"
                        onClick={() => update(open.id, byDept
                          ? { departments: toggle(open.departments, o) }
                          : { payers: toggle(open.payers, o) })}
                        className={cn("flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm",
                          on ? "bg-primary/10 text-primary dark:text-primary-300"
                             : "hover:bg-slate-50 dark:hover:bg-dark-hover")}>
                        <span className="truncate">{o}</span>
                        <span className="flex shrink-0 items-center gap-1.5">
                          {elsewhere.length > 0 && (
                            <span className={cn("text-[11px]",
                              clash ? "text-amber-700 dark:text-amber-400"
                                    : "text-slate-500 dark:text-slate-400")}>
                              in {elsewhere.map((x) => x.group).join(", ")}
                              {clash && " — same work type"}
                            </span>
                          )}
                          {on && <Badge variant="info">added</Badge>}
                        </span>
                      </button>
                    );
                  })
                : (pickerOptions as typeof memberOptions).map((m) => {
                    const on = open.members.some((x) => x.id === m.id);
                    const elsewhere = (memberIn.get(m.id) ?? []).filter((n) => n !== open.name);
                    return (
                      <button key={m.id} type="button"
                        onClick={() => update(open.id, {
                          members: on ? open.members.filter((x) => x.id !== m.id) : [...open.members, m],
                        })}
                        className={cn("flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm",
                          on ? "bg-primary/10 text-primary dark:text-primary-300"
                             : "hover:bg-slate-50 dark:hover:bg-dark-hover")}>
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
              <Button type="button" onClick={() => setPicker(null)}>Done</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
