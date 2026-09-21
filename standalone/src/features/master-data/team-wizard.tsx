/**
 * Team wizard for the criteria-based allocation model, used for create and edit.
 *
 * There is no worklist-scope step any more. A team is a name, a routing rule and
 * the people in its groups; the rule is a list of criteria over whatever
 * dimensions the tenant is configured with, so this wizard has no facility,
 * division, encounter or logic-axis controls to become wrong for the next client.
 *
 *   1 Team Info , identity, and the rule that routes work to this team
 *   2 Groups    , the narrower rules and the people, per group
 *   3 Capacity  , daily limits per work item family, and who takes high-cost work
 *   4 Review    , summary plus a dry run of the allocation engine
 */
import { useEffect, useMemo, useState } from "react";
import { gql, useMutation, useQuery } from "@apollo/client";
import { useTranslation } from "react-i18next";
import { Check, Users, AlertTriangle, Layers, Filter } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  Button,
  Input,
  Label,
  Badge,
  Checkbox,
  Switch,
  Alert,
  AlertDescription,
  cn,
} from "@optima/ui";

import { TeamGroups, type TeamGroup } from "./components/team-groups.js";
import { CriteriaBuilder, type Criterion } from "./components/criteria-builder.js";

const SAVE_TEAM = gql`
  mutation SaveTeamV2($id: ID, $input: TeamV2Input!) {
    optimaTeamV2Save(id: $id, input: $input) {
      id
      name
    }
  }
`;

const OPTIONS = gql`
  query WizardOptions {
    allocationPolicies {
      code
      label
      description
      valueType
      scope
      appliesToTypes
      defaultNumber
      defaultFlag
      unit
      handlerTag
      sortOrder
    }
    capacityFamilies {
      code
      label
      workItemTypes
      defaultLimit
      allowExceedByDefault
    }
    allUsers {
      id
      firstName
      lastName
      email
    }
  }
`;

const STEPS = [
  { n: 1, label: "Team Info" },
  { n: 2, label: "Groups" },
  { n: 3, label: "Rules" },
  { n: 4, label: "Review" },
];

/** One policy's setting, per family where the policy is per-family. */
interface PolicySetting {
  code: string;
  family?: string | null;
  number?: number | null;
  flag?: boolean | null;
}

interface Policy {
  code: string;
  label: string;
  description: string;
  valueType: "NUMBER" | "FLAG";
  scope: "TEAM" | "FAMILY";
  appliesToTypes: string[];
  defaultNumber: number | null;
  defaultFlag: boolean | null;
  unit: string | null;
  handlerTag: string | null;
  sortOrder: number;
}

interface TeamWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  team?: any;
  onSuccess: () => void;
  /** Step to land on. The teams list uses it to jump straight to Groups. */
  initialStep?: number;
}

const criterionFor = (criteria: Criterion[], code: string) =>
  criteria.find((c) => c.dimension === code);

export function TeamWizard({
  open,
  onOpenChange,
  team,
  onSuccess,
  initialStep = 1,
}: TeamWizardProps) {
  const { t } = useTranslation("provider");
  const creating = !team;
  const [step, setStep] = useState(initialStep);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [active, setActive] = useState(true);
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [groups, setGroups] = useState<TeamGroup[]>([]);
  const [policies, setPolicies] = useState<PolicySetting[]>([]);
  const [uniformCapacity, setUniformCapacity] = useState(true);
  const [supervisorIds, setSupervisorIds] = useState<string[]>([]);
  /** Member ids per policy handler tag, e.g. HIGH_COST -> [...]. */
  const [handlers, setHandlers] = useState<Record<string, string[]>>({});
  const [capOverrides, setCapOverrides] = useState<Record<string, number | undefined>>({});
  const [saving, setSaving] = useState(false);

  const { data: opts } = useQuery(OPTIONS, { skip: !open });
  const [saveTeam] = useMutation(SAVE_TEAM);

  const families = opts?.capacityFamilies ?? [];
  const allPolicies: Policy[] = opts?.allocationPolicies ?? [];

  // Hydrate on open. Creating starts from a blank rule.
  useEffect(() => {
    if (!open) return;
    setStep(initialStep);
    if (team) {
      setName(team.name ?? "");
      setDescription(team.description ?? "");
      setActive(team.active ?? true);
      setCriteria(
        (team.criteria ?? []).map((c: any) => ({
          dimension: c.dimension,
          operator: c.operator,
          values: [...(c.values ?? [])],
        })),
      );
      setPolicies(
        (team.policies ?? []).map((p: any) => ({
          code: p.code,
          family: p.family ?? null,
          number: p.number ?? null,
          flag: p.flag ?? null,
        })),
      );
      setUniformCapacity(team.uniformCapacity ?? true);
      {
        const seen = new Map<string, any>();
        for (const g of team.groups ?? []) for (const m of g.members ?? []) seen.set(m.id, m);
        const people = [...seen.values()];
        setSupervisorIds(people.filter((m) => m.isSupervisor).map((m) => m.id));
        const byTag: Record<string, string[]> = {};
        for (const m of people) {
          for (const tag of m.handlerTags ?? []) byTag[tag] = [...(byTag[tag] ?? []), m.id];
        }
        setHandlers(byTag);
        setCapOverrides(
          Object.fromEntries(
            people.filter((m) => m.capacityOverride != null).map((m) => [m.id, m.capacityOverride]),
          ),
        );
      }
      setGroups(
        (team.groups ?? []).map((g: any) => ({
          id: g.id,
          name: g.name,
          active: g.active ?? true,
          criteria: (g.criteria ?? []).map((c: any) => ({
            dimension: c.dimension,
            operator: c.operator,
            values: [...(c.values ?? [])],
          })),
          members: g.members ?? [],
        })),
      );
    } else {
      setName("");
      setDescription("");
      setActive(true);
      setCriteria([]);
      setGroups([]);
      setPolicies([]);
      setUniformCapacity(true);
      setSupervisorIds([]);
      setHandlers({});
      setCapOverrides({});
    }
  }, [open, team, initialStep]);

  /** Team roster = de-duplicated union of every group's members. */
  const roster = useMemo(() => {
    const seen = new Map<string, any>();
    for (const g of groups) for (const m of g.members ?? []) seen.set(m.id, m);
    return [...seen.values()];
  }, [groups]);

  const memberships = groups.reduce((n, g) => n + (g.members?.length ?? 0), 0);
  const emptyGroups = groups.filter((g) => !(g.members ?? []).length);

  /** Work item types the groups actually handle, inheriting the team's rule. */
  const handledTypes = useMemo(() => {
    const teamTypes = criterionFor(criteria, "WORK_ITEM_TYPE");
    const universe = teamTypes?.operator === "IN" ? teamTypes.values : [];
    const out = new Set<string>();
    for (const g of groups) {
      if (!g.active) continue;
      const own = criterionFor(g.criteria, "WORK_ITEM_TYPE");
      const admitted =
        !own || own.operator === "ANY"
          ? universe
          : own.operator === "NOT_IN"
            ? universe.filter((v) => !own.values.includes(v))
            : own.values.filter((v) => !universe.length || universe.includes(v));
      admitted.forEach((v) => out.add(v));
    }
    return [...out];
  }, [criteria, groups]);

  /** Families the team's work touches, which is what per-family policies key on. */
  const activeFamilies = useMemo(() => {
    const codes = new Set<string>();
    for (const wt of handledTypes) {
      const f = families.find((x: any) => x.workItemTypes.includes(wt));
      if (f) codes.add(f.code);
    }
    return families.filter((f: any) => codes.has(f.code));
  }, [handledTypes, families]);

  /**
   * The policies this team's work makes relevant. A claims team is asked about a
   * high-cost threshold; an authorisation team is asked about urgency instead.
   * Neither is asked about the other, because the registry says which work each
   * policy applies to.
   */
  const applicable = useMemo(
    () =>
      allPolicies
        .filter((p) => handledTypes.some((t) => p.appliesToTypes.includes(t)))
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [allPolicies, handledTypes],
  );

  /**
   * Keep settings in step with what is applicable, preserving edits.
   *
   * Guarded on the registry having loaded. Without the guard this ran once with
   * an empty registry, dropped every family-scoped setting the team was
   * hydrated with, then recreated them from defaults, which silently turned off
   * overflow on teams that had it on.
   */
  const registryLoaded = allPolicies.length > 0 && families.length > 0;
  useEffect(() => {
    if (!registryLoaded) return;
    if (!applicable.length) {
      setPolicies((prev) => (prev.length ? [] : prev));
      return;
    }
    setPolicies((prev) => {
      const next: PolicySetting[] = [];
      for (const p of applicable) {
        const slots = p.scope === "FAMILY" ? activeFamilies.map((f: any) => f.code) : [null];
        for (const family of slots) {
          const found = prev.find((x) => x.code === p.code && (x.family ?? null) === family);
          if (found) {
            next.push(found);
            continue;
          }
          // A family carries its own defaults, and they differ from the policy's:
          // authorisation overflows past the cap, claims defer.
          const fam = families.find((f: any) => f.code === family);
          next.push({
            code: p.code,
            family,
            number:
              p.valueType === "NUMBER"
                ? (p.code === "DAILY_LIMIT" ? (fam?.defaultLimit ?? p.defaultNumber) : p.defaultNumber)
                : null,
            flag:
              p.valueType === "FLAG"
                ? (p.code === "ALLOW_EXCEED" ? (fam?.allowExceedByDefault ?? p.defaultFlag) : p.defaultFlag)
                : null,
          });
        }
      }
      const same =
        next.length === prev.length &&
        next.every(
          (n, i) => n.code === prev[i].code && (n.family ?? null) === (prev[i].family ?? null),
        );
      return same ? prev : next;
    });
  }, [registryLoaded, applicable, activeFamilies, families]);

  const settingFor = (code: string, family?: string | null) =>
    policies.find((p) => p.code === code && (p.family ?? null) === (family ?? null));

  const setSetting = (code: string, family: string | null, patch: Partial<PolicySetting>) =>
    setPolicies((prev) =>
      prev.map((p) =>
        p.code === code && (p.family ?? null) === family ? { ...p, ...patch } : p,
      ),
    );

  /** Handler tags in play, so the member table grows a column per policy. */
  const handlerPolicies = useMemo(
    () => applicable.filter((p) => p.handlerTag),
    [applicable],
  );

  const toggleHandler = (tag: string, memberId: string, on: boolean) =>
    setHandlers((prev) => {
      const cur = prev[tag] ?? [];
      return { ...prev, [tag]: on ? [...cur, memberId] : cur.filter((x) => x !== memberId) };
    });

  /** Capacity is the sum of each member's own cap, not a team-level figure. */
  const baseCap = useMemo(() => {
    const limits = policies
      .filter((p) => p.code === "DAILY_LIMIT" && typeof p.number === "number")
      .map((p) => p.number as number);
    return limits.length ? Math.max(...limits) : 150;
  }, [policies]);
  const derivedCapacity = useMemo(
    () =>
      roster.reduce(
        (sum, m) => sum + (uniformCapacity ? baseCap : (capOverrides[m.id] ?? baseCap)),
        0,
      ),
    [roster, baseCap, uniformCapacity, capOverrides],
  );

  const nameError = !name.trim();
  const noRule = criteria.every((c) => c.operator !== "ANY" && !c.values.length);
  const canNext = step === 1 ? !nameError : step === 2 ? groups.length > 0 : true;

  async function save() {
    setSaving(true);
    try {
      await saveTeam({
        variables: {
          id: team?.id ?? null,
          input: {
            name: name.trim(),
            description: description.trim() || null,
            active,
            criteria: criteria.map((c) => ({
              dimension: c.dimension,
              operator: c.operator,
              values: c.values,
            })),
            policies: policies.map((p) => ({
              code: p.code,
              family: p.family ?? null,
              number: p.number ?? null,
              flag: p.flag ?? null,
            })),
            uniformCapacity,
            supervisorIds,
            handlers: Object.entries(handlers).map(([tag, memberIds]) => ({ tag, memberIds })),
            groups: groups.map((g) => ({
              id: String(g.id).length > 8 ? null : g.id, // new groups have uuid ids
              name: g.name,
              active: g.active,
              criteria: g.criteria.map((c) => ({
                dimension: c.dimension,
                operator: c.operator,
                values: c.values,
              })),
              memberIds: (g.members ?? []).map((m) => m.id),
            })),
          },
        },
      });
      onSuccess();
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  const field = "space-y-1.5";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col overflow-hidden p-0 sm:max-w-5xl">
        <SheetHeader className="border-b border-slate-200 px-6 py-4 dark:border-dark-border">
          <SheetTitle>
            {creating ? t("masterData.teams.addTeam", "Add Team") : `Edit Team, ${team?.name}`}
          </SheetTitle>
        </SheetHeader>

        {/* Stepper */}
        <div className="flex items-center gap-2 border-b border-slate-200 px-6 py-3 dark:border-dark-border">
          {STEPS.map((s, i) => {
            const done = step > s.n;
            const current = step === s.n;
            return (
              <div key={s.n} className="flex flex-1 items-center gap-2">
                <button
                  type="button"
                  onClick={() => (s.n < step || canNext) && setStep(s.n)}
                  className="flex items-center gap-2"
                >
                  <span
                    className={cn(
                      "flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold",
                      current
                        ? "bg-primary text-white"
                        : done
                          ? "bg-emerald-500 text-white"
                          : "bg-slate-200 text-slate-500 dark:bg-dark-surface dark:text-slate-400",
                    )}
                  >
                    {done ? <Check size={12} /> : s.n}
                  </span>
                  <span
                    className={cn(
                      "text-xs font-medium",
                      current
                        ? "text-slate-900 dark:text-dark-text"
                        : "text-slate-500 dark:text-slate-400",
                    )}
                  >
                    {s.label}
                  </span>
                </button>
                {i < STEPS.length - 1 && (
                  <span className="h-px flex-1 bg-slate-200 dark:bg-dark-border" />
                )}
              </div>
            );
          })}
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {/* ── 1. Team Info ─────────────────────────────────────────── */}
          {step === 1 && (
            <>
              <div className={field}>
                <Label htmlFor="tw-name">Name *</Label>
                <Input
                  id="tw-name"
                  value={name}
                  onChange={(e: any) => setName(e.target.value)}
                  placeholder="e.g. Dubai authorisations"
                />
                {nameError && <p className="text-[11px] text-red-600">Name is required.</p>}
              </div>

              <div className={field}>
                <Label htmlFor="tw-desc">Description</Label>
                <Input
                  id="tw-desc"
                  value={description}
                  onChange={(e: any) => setDescription(e.target.value)}
                  placeholder="What this team is for, in a line"
                />
                <p className="text-[11px] text-slate-500">
                  The name and description are what the teams list shows, so make them say
                  what this team is for.
                </p>
              </div>

              <div className="rounded-lg border border-slate-200 p-4 dark:border-dark-border">
                <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <Filter size={12} /> Which work reaches this team
                </p>
                <p className="mb-3 text-[11px] text-slate-500 dark:text-slate-400">
                  Filters here prefilter the queue for the whole team. Its groups then narrow
                  it further. Leave a filter off and the team accepts anything on it.
                </p>
                <CriteriaBuilder
                  criteria={criteria}
                  onChange={setCriteria}
                  level="TEAM"
                  teamId={team?.id ?? null}
                />
                {noRule && criteria.length === 0 && (
                  <Alert variant="warning" className="mt-3">
                    <AlertTriangle size={15} />
                    <AlertDescription>
                      With no filters this team competes for every work item in the estate.
                      That is allowed, but it is rarely what is meant.
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              <label className="flex cursor-pointer items-center gap-2.5">
                <Checkbox checked={active} onCheckedChange={(v: any) => setActive(!!v)} />
                <span className="text-sm text-slate-900 dark:text-dark-text">Active</span>
              </label>
            </>
          )}

          {/* ── 2. Groups ────────────────────────────────────────────── */}
          {step === 2 && (
            <>
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 dark:border-dark-border dark:bg-dark-surface">
                <span className="text-xs font-medium text-slate-500">This team takes</span>
                {criteria
                  .filter((c) => c.operator === "ANY" || c.values.length)
                  .map((c) => (
                    <Badge key={c.dimension} variant="default">
                      {c.operator === "ANY"
                        ? `${c.dimension.toLowerCase()}: any`
                        : `${c.values.slice(0, 2).join(", ")}${c.values.length > 2 ? ` +${c.values.length - 2}` : ""}`}
                    </Badge>
                  ))}
                {criteria.length === 0 && (
                  <span className="text-xs italic text-slate-400">everything</span>
                )}
                <span className="ml-auto flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                  <Users size={13} /> {roster.length} on this team
                  {memberships > roster.length && (
                    <span className="text-slate-400">
                      ({memberships - roster.length} in more than one group)
                    </span>
                  )}
                </span>
              </div>

              {groups.length === 0 && (
                <Alert variant="warning">
                  <AlertTriangle size={15} />
                  <AlertDescription>
                    A team with no groups cannot receive work. Add at least one.
                  </AlertDescription>
                </Alert>
              )}
              {emptyGroups.length > 0 && (
                <Alert variant="warning">
                  <AlertTriangle size={15} />
                  <AlertDescription>
                    {emptyGroups.length} group{emptyGroups.length > 1 ? "s have" : " has"} no
                    members, work matched there cannot be assigned.
                  </AlertDescription>
                </Alert>
              )}

              <TeamGroups
                groups={groups}
                onChange={setGroups}
                teamCriteria={criteria}
                memberOptions={opts?.allUsers ?? []}
                teamId={team?.id ?? null}
              />
            </>
          )}

          {/* -- 3. Policies ------------------------------------------- */}
          {step === 3 && (
            <>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Rules for the work this team handles. Each is offered only when the team's
                own work makes it relevant, so a claims team is asked about value and an
                authorisation team about turnaround.
              </p>

              {applicable.length === 0 ? (
                <Alert variant="info">
                  <AlertDescription>
                    No work item types are covered by this team's groups yet, so no policy
                    applies. Add a group on the previous step.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-3">
                  {applicable.map((p) => {
                    const slots =
                      p.scope === "FAMILY" ? activeFamilies.map((f: any) => f.code) : [null];
                    return (
                      <div
                        key={p.code}
                        className="flex flex-wrap items-start gap-x-4 gap-y-2 rounded-lg border border-slate-200 px-4 py-3 dark:border-dark-border"
                      >
                        <div className="min-w-[15rem] flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium text-slate-900 dark:text-dark-text">
                              {p.label}
                            </span>
                            {p.handlerTag && <Badge variant="info">routes by clearance</Badge>}
                          </div>
                          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                            {p.description}
                          </p>
                        </div>

                        <div className="flex shrink-0 flex-wrap items-center gap-3">
                          {slots.map((family) => {
                            const setting = settingFor(p.code, family);
                            const famLabel =
                              families.find((f: any) => f.code === family)?.label ?? family;
                            const id = `pol-${p.code}-${family ?? "team"}`;
                            // With one family the label is noise: the team only
                            // does one kind of work, so the control speaks for itself.
                            const showFamily = family && slots.length > 1;
                            return (
                              <div key={id} className="flex items-center gap-2">
                                {p.valueType === "NUMBER" ? (
                                  <>
                                    <Label htmlFor={id} className="whitespace-nowrap text-[11px]">
                                      {showFamily ? `${famLabel} ` : ""}
                                      {p.unit ?? "value"}
                                    </Label>
                                    <Input
                                      id={id}
                                      type="number"
                                      className="w-24"
                                      value={setting?.number ?? ""}
                                      onChange={(e: any) =>
                                        setSetting(p.code, family, {
                                          number:
                                            e.target.value === "" ? null : Number(e.target.value),
                                        })
                                      }
                                    />
                                  </>
                                ) : (
                                  <label className="flex cursor-pointer items-center gap-2">
                                    <Switch
                                      checked={!!setting?.flag}
                                      onCheckedChange={(v: boolean) =>
                                        setSetting(p.code, family, { flag: v })
                                      }
                                    />
                                    {showFamily && (
                                      <span className="text-xs text-slate-600 dark:text-slate-300">
                                        {famLabel}
                                      </span>
                                    )}
                                  </label>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <label className="flex cursor-pointer items-start gap-2.5">
                <Checkbox
                  checked={!uniformCapacity}
                  onCheckedChange={(v: any) => setUniformCapacity(!v)}
                />
                <span>
                  <span className="text-sm font-medium text-slate-900 dark:text-dark-text">
                    Set capacity per member
                  </span>
                  <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                    Off, everyone gets the daily limits above. On, you can override per
                    person below; anyone left blank keeps the team figure.
                  </span>
                </span>
              </label>

              {roster.length > 0 && (
                <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-dark-border">
                  <table className="w-full min-w-[32rem] text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:border-dark-border dark:text-slate-400">
                        <th className="px-4 py-2 text-start">Member</th>
                        <th className="w-24 px-2 py-2 text-center">Supervisor</th>
                        {/* A column per policy that routes by clearance. Nothing here
                            names high cost; the registry decides what appears. */}
                        {handlerPolicies.map((p) => (
                          <th key={p.code} className="w-28 px-2 py-2 text-center">
                            {p.label}
                          </th>
                        ))}
                        <th className="w-28 px-4 py-2 text-end">Cap / day</th>
                      </tr>
                    </thead>
                    <tbody>
                      {roster.map((m) => {
                        const label =
                          [m.firstName, m.lastName].filter(Boolean).join(" ") || m.email || m.id;
                        return (
                          <tr
                            key={m.id}
                            className="border-b border-slate-100 last:border-0 dark:border-dark-border/50"
                          >
                            <td className="truncate px-4 py-2 text-slate-700 dark:text-slate-300">
                              {label}
                            </td>
                            <td className="px-2 py-2 text-center">
                              <Checkbox
                                checked={supervisorIds.includes(m.id)}
                                onCheckedChange={(v: any) =>
                                  setSupervisorIds((prev) =>
                                    v ? [...prev, m.id] : prev.filter((x) => x !== m.id),
                                  )
                                }
                              />
                            </td>
                            {handlerPolicies.map((p) => (
                              <td key={p.code} className="px-2 py-2 text-center">
                                <Checkbox
                                  checked={(handlers[p.handlerTag!] ?? []).includes(m.id)}
                                  onCheckedChange={(v: any) =>
                                    toggleHandler(p.handlerTag!, m.id, !!v)
                                  }
                                />
                              </td>
                            ))}
                            <td className="px-4 py-2">
                              <Input
                                type="number"
                                disabled={uniformCapacity}
                                placeholder={String(baseCap)}
                                value={capOverrides[m.id] ?? ""}
                                onChange={(e: any) =>
                                  setCapOverrides((prev) => ({
                                    ...prev,
                                    [m.id]:
                                      e.target.value === "" ? undefined : Number(e.target.value),
                                  }))
                                }
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {supervisorIds.length === 0 && roster.length > 0 && (
                <Alert variant="warning">
                  <AlertTriangle size={15} />
                  <AlertDescription>
                    No supervisor is set, so nobody is told when this team's work goes
                    unallocated. Tag at least one.
                  </AlertDescription>
                </Alert>
              )}

              {/* One warning per clearance policy with nobody cleared for it. */}
              {handlerPolicies
                .filter((p) => !(handlers[p.handlerTag!] ?? []).length)
                .map((p) => (
                  <Alert key={p.code} variant="warning">
                    <AlertTriangle size={15} />
                    <AlertDescription>
                      Nobody is cleared for {p.label.toLowerCase()}, so items over{" "}
                      {(settingFor(p.code)?.number ?? p.defaultNumber ?? 0).toLocaleString()}
                      {p.unit ? ` ${p.unit}` : ""} will not be assigned.
                    </AlertDescription>
                  </Alert>
                ))}

              <div className="rounded-lg border border-slate-200 p-4 dark:border-dark-border">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Team capacity is derived, never set directly:
                </p>
                <p className="mt-1 text-sm font-medium text-slate-900 dark:text-dark-text">
                  {derivedCapacity.toLocaleString()} items/day across {roster.length}{" "}
                  {roster.length === 1 ? "member" : "members"}
                </p>
                {memberships > roster.length && (
                  <p className="mt-1 text-[11px] text-slate-500">
                    {memberships} group memberships de-duplicate to {roster.length} people, so
                    nobody is counted twice.
                  </p>
                )}
              </div>
            </>
          )}

          {/* ── 4. Review ────────────────────────────────────────────── */}
          {step === 4 && (
            <>
              <div className="rounded-lg border border-slate-200 p-4 dark:border-dark-border">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-dark-text">
                  {name || "Untitled team"}
                </h3>
                {description && (
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    {description}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {criteria
                    .filter((c) => c.operator === "ANY" || c.values.length)
                    .map((c) => (
                      <Badge key={c.dimension} variant="default">
                        {c.operator === "NOT_IN" ? "Not " : ""}
                        {c.operator === "ANY"
                          ? "any"
                          : `${c.values.slice(0, 3).join(", ")}${c.values.length > 3 ? ` +${c.values.length - 3}` : ""}`}
                      </Badge>
                    ))}
                  {criteria.length === 0 && (
                    <span className="text-xs italic text-slate-400">No filters, takes everything</span>
                  )}
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-y-2 text-xs">
                  {[
                    ["Groups", String(groups.length)],
                    ["Members", `${roster.length} (${memberships} memberships)`],
                    [
                      "Policies",
                      applicable.length
                        ? applicable
                            .map((p) => {
                              const v = settingFor(p.code, p.scope === "FAMILY" ? activeFamilies[0]?.code : null);
                              return p.valueType === "NUMBER"
                                ? `${p.label} ${v?.number ?? p.defaultNumber}${p.unit ? ` ${p.unit}` : ""}`
                                : `${p.label} ${v?.flag ? "on" : "off"}`;
                            })
                            .join(", ")
                        : "none apply",
                    ],
                    ["Capacity total", `${derivedCapacity.toLocaleString()} / day`],
                    ["Supervisors", supervisorIds.length ? String(supervisorIds.length) : "none"],
                    ["Status", active ? "Active" : "Inactive"],
                  ].map(([k, v]) => (
                    <div key={k as string} className="flex gap-2">
                      <dt className="w-28 shrink-0 text-slate-500">{k}</dt>
                      <dd className="font-medium text-slate-900 dark:text-dark-text">{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              <div className="rounded-lg border border-slate-200 p-4 dark:border-dark-border">
                <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <Layers size={13} /> Groups
                </div>
                <div className="space-y-1.5">
                  {groups.map((g) => (
                    <div key={g.id} className="flex items-center gap-2 text-xs">
                      <span className="w-48 truncate font-medium text-slate-900 dark:text-dark-text">
                        {g.name}
                      </span>
                      <span className="flex-1 truncate text-slate-500">
                        {g.criteria
                          .filter((c) => c.operator === "ANY" || c.values.length)
                          .map((c) =>
                            c.operator === "ANY"
                              ? `${c.dimension.toLowerCase()}: any`
                              : `${c.values.length} ${c.dimension.toLowerCase()}`,
                          )
                          .join(" · ") || "no filters"}
                      </span>
                      <Badge variant={g.members.length ? "success" : "error"}>
                        {g.members.length} members
                      </Badge>
                    </div>
                  ))}
                  {!groups.length && <p className="text-xs text-slate-500">No groups.</p>}
                </div>
              </div>

              {/*
               * No dry run here. Reviewing an allocation is a supervisor's daily
               * question, so it lives on the dashboard; this step is only "what
               * am I about to save".
               */}
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Saving changes what tonight's run will do. To dry-run it against a
                day's arrivals, open Review allocation on the Dashboard tab.
              </p>
            </>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 px-6 py-3 dark:border-dark-border dark:bg-dark-surface">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-500">Step {step} of 4</span>
            {step > 1 && (
              <Button variant="outline" onClick={() => setStep(step - 1)}>
                Back
              </Button>
            )}
            {step < 4 ? (
              <Button disabled={!canNext} onClick={() => setStep(step + 1)}>
                Next
              </Button>
            ) : (
              <Button disabled={saving || nameError} onClick={save}>
                {saving ? "Saving…" : creating ? "Create team" : "Save changes"}
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
