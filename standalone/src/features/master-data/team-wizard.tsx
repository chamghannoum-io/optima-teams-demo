/**
 * Team wizard for the v2 allocation model — used for both create and edit.
 *
 * The v1 wizard had a team-level Members step, which contradicts v2: members belong
 * to *groups*, and the team roster is the de-duplicated union of them. So members are
 * picked inside each group, and the team header just reports the resulting roster.
 *
 *   1 Team Info  — identity, and the three choices that define the container:
 *                  facility, division (AUTH|CLAIM), encounter scope, logic axis
 *   2 Groups     — the criteria and the people, per group
 *   3 Capacity   — per-person daily limits
 *   4 Review     — summary plus a dry run of the allocation engine
 */
import { useEffect, useMemo, useState } from "react";
import { gql, useMutation, useQuery } from "@apollo/client";
import { useTranslation } from "react-i18next";
import { Check, Users, AlertTriangle, Layers, Building2 } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  Button,
  Input,
  Label,
  Badge,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Alert,
  AlertDescription,
  cn,
} from "@optima/ui";

import { TeamGroups, type TeamGroup } from "./components/team-groups.js";
import { AllocationPreview } from "./components/allocation-preview.js";

const SAVE_TEAM = gql`
  mutation SaveTeamV2($id: ID, $input: TeamV2Input!) {
    optimaTeamV2Save(id: $id, input: $input) {
      id
      name
    }
  }
`;

const OPTIONS = gql`
  query WizardOptions($teamId: ID) {
    facilityOptions
    departmentOptionsFor(teamId: $teamId)
    payerOptionsFor(teamId: $teamId)
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
  { n: 3, label: "Capacity" },
  { n: 4, label: "Review" },
];

const DIVISIONS = ["AUTH", "CLAIM"];
const SCOPES = ["OP", "IP", "BOTH"];
const AXES = ["DEPARTMENT", "PAYER"];

export interface TeamWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Null to create. */
  team: any | null;
  onSuccess: () => void;
}

export function TeamWizard({ open, onOpenChange, team, onSuccess }: TeamWizardProps) {
  const { t } = useTranslation("provider");
  const creating = !team;
  const [step, setStep] = useState(1);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [facilityId, setFacilityId] = useState("");
  const [division, setDivision] = useState("AUTH");
  const [encounterScope, setEncounterScope] = useState("OP");
  const [logicAxis, setLogicAxis] = useState("DEPARTMENT");
  const [active, setActive] = useState(true);
  const [groups, setGroups] = useState<TeamGroup[]>([]);
  const [maxAuth, setMaxAuth] = useState(150);
  const [maxClaim, setMaxClaim] = useState(150);
  const [saving, setSaving] = useState(false);

  const { data: opts } = useQuery(OPTIONS, {
    variables: { teamId: team?.id ?? null },
    skip: !open,
  });
  const [saveTeam] = useMutation(SAVE_TEAM);

  // Hydrate on open. Creating starts from a sensible blank container.
  useEffect(() => {
    if (!open) return;
    setStep(1);
    if (team) {
      setName(team.name ?? "");
      setDescription(team.description ?? "");
      setFacilityId(team.facilityId ?? "");
      setDivision(team.division ?? "AUTH");
      setEncounterScope(team.encounterScope ?? "OP");
      setLogicAxis(team.logicAxis ?? "DEPARTMENT");
      setActive(team.active ?? true);
      setGroups(
        (team.groups ?? []).map((g: any) => ({
          ...g,
          members: g.members ?? [],
          departments: g.departments ?? [],
          payers: g.payers ?? [],
          workItemTypes: g.workItemTypes ?? [],
          claimStatuses: g.claimStatuses ?? [],
        }))
      );
    } else {
      setName("");
      setDescription("");
      setFacilityId(opts?.facilityOptions?.[0] ?? "");
      setDivision("AUTH");
      setEncounterScope("OP");
      setLogicAxis("DEPARTMENT");
      setActive(true);
      setGroups([]);
    }
  }, [open, team, opts]);

  // The division decides the axis default: claims split by payer, auth by department.
  useEffect(() => {
    if (creating) setLogicAxis(division === "CLAIM" ? "PAYER" : "DEPARTMENT");
  }, [division, creating]);

  /** Team roster = de-duplicated union of every group's members. */
  const roster = useMemo(() => {
    const seen = new Map<string, any>();
    for (const g of groups) for (const m of g.members ?? []) seen.set(m.id, m);
    return [...seen.values()];
  }, [groups]);

  const memberships = groups.reduce((n, g) => n + (g.members?.length ?? 0), 0);
  const emptyGroups = groups.filter((g) => !(g.members ?? []).length);

  const nameError = !name.trim();
  const canNext =
    step === 1 ? !nameError && !!facilityId : step === 2 ? groups.length > 0 : true;

  async function save() {
    setSaving(true);
    try {
      await saveTeam({
        variables: {
          id: team?.id ?? null,
          input: {
            name: name.trim(),
            description: description.trim() || null,
            facilityId,
            division,
            encounterScope,
            logicAxis,
            active,
            maxAuth,
            maxClaim,
            groups: groups.map((g) => ({
              id: String(g.id).length > 8 ? null : g.id, // new groups have uuid ids
              name: g.name,
              active: g.active,
              workItemTypes: g.workItemTypes,
              encounterScope: g.encounterScope,
              departments: g.departments,
              payers: g.payers,
              payerCatchAll: g.payerCatchAll,
              claimStatuses: g.claimStatuses,
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
            {creating ? t("masterData.teams.addTeam", "Add Team") : `Edit Team — ${team?.name}`}
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
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold transition",
                    done
                      ? "bg-emerald-500 text-white"
                      : current
                        ? "bg-primary text-white"
                        : "bg-slate-200 text-slate-500 dark:bg-dark-border dark:text-slate-400"
                  )}
                >
                  {done ? <Check size={13} /> : s.n}
                </button>
                <span
                  className={cn(
                    "whitespace-nowrap text-xs font-medium",
                    current
                      ? "text-primary dark:text-primary-300"
                      : "text-slate-500 dark:text-slate-400"
                  )}
                >
                  {s.label}
                </span>
                {i < STEPS.length - 1 && (
                  <div className="h-px flex-1 bg-slate-200 dark:bg-dark-border" />
                )}
              </div>
            );
          })}
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {/* ── 1. Team Info ─────────────────────────────────────────── */}
          {step === 1 && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className={field}>
                  <Label htmlFor="tw-name">Name *</Label>
                  <Input
                    id="tw-name"
                    value={name}
                    onChange={(e: any) => setName(e.target.value)}
                    placeholder="e.g. DXB · AUTH · OP"
                  />
                  {nameError && <p className="text-[11px] text-red-600">Name is required.</p>}
                </div>
                <div className={field}>
                  <Label htmlFor="tw-facility">Facility *</Label>
                  <Select value={facilityId} onValueChange={setFacilityId}>
                    <SelectTrigger id="tw-facility">
                      <SelectValue placeholder="Select facility" />
                    </SelectTrigger>
                    <SelectContent>
                      {(opts?.facilityOptions ?? []).map((f: string) => (
                        <SelectItem key={f} value={f}>
                          {f}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className={field}>
                <Label htmlFor="tw-desc">Description</Label>
                <Input
                  id="tw-desc"
                  value={description}
                  onChange={(e: any) => setDescription(e.target.value)}
                />
              </div>

              <div className="rounded-lg border border-slate-200 p-4 dark:border-dark-border">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Worklist scope
                </p>
                <p className="mb-3 text-[11px] text-slate-500 dark:text-slate-400">
                  A team is a container for one facility, one division and one encounter
                  scope. Its groups do the matching inside that.
                </p>
                <div className="grid grid-cols-3 gap-4">
                  <div className={field}>
                    <Label>Division *</Label>
                    <Select value={division} onValueChange={setDivision}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DIVISIONS.map((d) => (
                          <SelectItem key={d} value={d}>
                            {d}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-[11px] text-slate-500">Never both.</p>
                  </div>
                  <div className={field}>
                    <Label>Encounter *</Label>
                    <Select value={encounterScope} onValueChange={setEncounterScope}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SCOPES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-[11px] text-slate-500">
                      One team for both, or split OP/IP.
                    </p>
                  </div>
                  <div className={field}>
                    <Label>Split groups by *</Label>
                    <Select value={logicAxis} onValueChange={setLogicAxis}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {AXES.map((a) => (
                          <SelectItem key={a} value={a}>
                            {a}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-[11px] text-slate-500">
                      {logicAxis === "DEPARTMENT"
                        ? "All payers covered."
                        : "All departments covered."}
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ── 2. Groups ────────────────────────────────────────────── */}
          {step === 2 && (
            <>
              <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 dark:border-dark-border dark:bg-dark-surface">
                <span className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                  <Building2 size={13} /> {facilityId || "—"}
                </span>
                <Badge variant="default">{division}</Badge>
                <Badge variant="default">{encounterScope}</Badge>
                <Badge variant="info">by {logicAxis}</Badge>
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
                    members — work matched there cannot be assigned.
                  </AlertDescription>
                </Alert>
              )}

              <TeamGroups
                groups={groups}
                onChange={setGroups}
                division={division}
                logicAxis={logicAxis}
                departmentOptions={opts?.departmentOptionsFor ?? []}
                payerOptions={opts?.payerOptionsFor ?? []}
                memberOptions={opts?.allUsers ?? []}
                teamId={team?.id ?? null}
              />
            </>
          )}

          {step === 3 && (
            <>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Daily limit per person. Allocation stops adding work to someone once they
                reach it.
              </p>
              <div className="max-w-xs space-y-1.5">
                <Label htmlFor="tw-cap">
                  {division === "AUTH"
                    ? "Max authorizations / day"
                    : "Max claims / day"}
                </Label>
                <Input
                  id="tw-cap"
                  type="number"
                  value={division === "AUTH" ? maxAuth : maxClaim}
                  onChange={(e: any) =>
                    division === "AUTH"
                      ? setMaxAuth(Number(e.target.value))
                      : setMaxClaim(Number(e.target.value))
                  }
                />
                <p className="text-[11px] text-slate-500">
                  This is an {division} team, so only the {division === "AUTH" ? "authorization" : "claim"} limit applies.
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 p-4 dark:border-dark-border">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Team capacity is derived, never set directly:
                </p>
                <p className="mt-1 text-sm font-medium text-slate-900 dark:text-dark-text">
                  {roster.length} members × {division === "AUTH" ? maxAuth : maxClaim} ={" "}
                  {(roster.length * (division === "AUTH" ? maxAuth : maxClaim)).toLocaleString()}{" "}
                  items/day
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
                <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-dark-text">
                  {name || "Untitled team"}
                </h3>
                <dl className="grid grid-cols-2 gap-y-2 text-xs">
                  {[
                    ["Facility", facilityId || "—"],
                    ["Division", division],
                    ["Encounter", encounterScope],
                    ["Split by", logicAxis],
                    ["Groups", String(groups.length)],
                    ["Members", `${roster.length} (${memberships} memberships)`],
                    [
                      "Capacity",
                      `${(roster.length * (division === "AUTH" ? maxAuth : maxClaim)).toLocaleString()} / day`,
                    ],
                    ["Status", active ? "Active" : "Inactive"],
                  ].map(([k, v]) => (
                    <div key={k as string} className="flex gap-2">
                      <dt className="w-24 shrink-0 text-slate-500">{k}</dt>
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
                      <span className="text-slate-500">
                        {(logicAxis === "DEPARTMENT" ? g.departments : g.payers).length}{" "}
                        {logicAxis === "DEPARTMENT" ? "depts" : "payers"}
                        {g.payerCatchAll && " + catch-all"}
                      </span>
                      <Badge variant={g.members.length ? "success" : "error"}>
                        {g.members.length} members
                      </Badge>
                    </div>
                  ))}
                  {!groups.length && <p className="text-xs text-slate-500">No groups.</p>}
                </div>
              </div>

              {team?.id && (
                <div className="rounded-lg border border-slate-200 p-4 dark:border-dark-border">
                  <AllocationPreview teamId={String(team.id)} />
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 px-6 py-3 dark:border-dark-border dark:bg-dark-surface">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-500">Step {step} of 4</span>
            {step > 1 && (
              <Button variant="secondary" onClick={() => setStep(step - 1)}>
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
