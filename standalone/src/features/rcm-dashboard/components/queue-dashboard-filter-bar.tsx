/**
 * Page-level filter bar for the RCM supervisor dashboard.
 *
 * Hosts Team / Branch / Date Range / Work Item Type filters in a single row
 * above the dashboard tabs. Mirrors the old UI's "filters at the top" layout.
 *
 * Notes:
 *   - Team and Branch filters map to `teamIds` / `branches` on
 *     QueueDashboardFilterInput. UI is single-select; the context wraps the
 *     selection into a 1-element array on the way to the BE filter.
 *   - Work Item Type chips render below the row and only become enabled once
 *     a team is selected.
 */
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  format,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfQuarter,
  endOfQuarter,
  startOfYear,
  endOfYear,
} from "date-fns";
import { Building2, Users, Filter, X } from "lucide-react";
import { Button, Modal, DatePicker, cn } from "@/components/enhanced";
import { WorkItemType } from "@/__generated__/graphql";
import { useQueueDashboardFilter } from "../queue-dashboard-filter-context";
import { ApiAutocomplete } from "@/shared/autocomplete/index.js";
import { autocompleteQueriesMapper } from "@/autocompletes/mapper.js";
import type { IBaseOption } from "@optima/shared";

// ── Date presets — same shape as Query Management ────────────────────────
type Preset = "today" | "this_week" | "this_month" | "this_quarter" | "this_year";

const PRESETS: { key: Preset; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "this_week", label: "This week" },
  { key: "this_month", label: "This month" },
  { key: "this_quarter", label: "This quarter" },
  { key: "this_year", label: "This year" },
];

function getPresetRange(preset: Preset): { from: Date; to: Date } {
  const now = new Date();
  switch (preset) {
    case "today":
      return { from: startOfDay(now), to: endOfDay(now) };
    case "this_week":
      return { from: startOfWeek(now), to: endOfWeek(now) };
    case "this_month":
      return { from: startOfMonth(now), to: endOfMonth(now) };
    case "this_quarter":
      return { from: startOfQuarter(now), to: endOfQuarter(now) };
    case "this_year":
      return { from: startOfYear(now), to: endOfYear(now) };
  }
}

function detectActivePreset(values: {
  createdDateFrom?: Date;
  createdDateTo?: Date;
}): Preset | null {
  for (const { key } of PRESETS) {
    const range = getPresetRange(key);
    if (
      values.createdDateFrom instanceof Date &&
      values.createdDateTo instanceof Date &&
      values.createdDateFrom.getTime() === range.from.getTime() &&
      values.createdDateTo.getTime() === range.to.getTime()
    ) {
      return key;
    }
  }
  return null;
}

// Team capacity (maxClaim / maxAuth) drives which work-item chips are
// enabled and which categories the team can take on. It now lives on the
// filter context so other widgets (e.g. the member-detail drawer) can read
// the same values without re-querying.

const CLAIM_TYPES: WorkItemType[] = [
  WorkItemType.ClaimSubmission,
  WorkItemType.ClaimResubmission,
  WorkItemType.ClaimValidation,
];
const AUTH_TYPES: WorkItemType[] = [
  WorkItemType.AuthorizationSubmission,
  WorkItemType.AuthorizationResubmission,
];

// ── Work-item type chip catalogue ───────────────────────────────────────
const WORK_ITEM_TYPES: { value: WorkItemType; labelKey: string; defaultLabel: string }[] = [
  {
    value: WorkItemType.ClaimSubmission,
    labelKey: "rcmDashboard.workType.claimSubmission",
    defaultLabel: "Claim Submission",
  },
  {
    value: WorkItemType.ClaimResubmission,
    labelKey: "rcmDashboard.workType.claimResubmission",
    defaultLabel: "Claim Resubmission",
  },
  {
    value: WorkItemType.ClaimValidation,
    labelKey: "rcmDashboard.workType.claimValidation",
    defaultLabel: "Claim Validation",
  },
  {
    value: WorkItemType.AuthorizationSubmission,
    labelKey: "rcmDashboard.workType.authSubmission",
    defaultLabel: "Authorization",
  },
  {
    value: WorkItemType.AuthorizationResubmission,
    labelKey: "rcmDashboard.workType.authResubmission",
    defaultLabel: "Auth Resubmission",
  },
];

// ── Component ───────────────────────────────────────────────────────────
export function QueueDashboardFilterBar() {
  const { t } = useTranslation("provider");
  const {
    filter,
    setFromDate,
    setToDate,
    setWorkItemTypes,
    setTeam,
    setBranch,
  } = useQueueDashboardFilter();

  // Mirror the context selection back into IBaseOption shape so the
  // ApiAutocomplete can render its selected-value chip. Context is the
  // source of truth — these are derived, not independent state.
  const teamOption = useMemo<IBaseOption<unknown> | null>(
    () =>
      filter.teamId
        ? { key: filter.teamId, label: filter.teamName ?? filter.teamId, value: null }
        : null,
    [filter.teamId, filter.teamName]
  );
  const branchOption = useMemo<IBaseOption<unknown> | null>(
    () =>
      filter.branchId
        ? { key: filter.branchId, label: filter.branchName ?? filter.branchId, value: null }
        : null,
    [filter.branchId, filter.branchName]
  );

  const activePreset = detectActivePreset({
    createdDateFrom: filter.fromDate,
    createdDateTo: filter.toDate,
  });
  const presetLabel = activePreset
    ? PRESETS.find((p) => p.key === activePreset)?.label
    : null;
  const customRangeLabel =
    !activePreset && filter.fromDate && filter.toDate
      ? `${format(filter.fromDate, "dd MMM yyyy")} → ${format(filter.toDate, "dd MMM yyyy")}`
      : null;

  const teamSelected = filter.teamId != null;

  // ── Team capacity (from filter context) → allowed work-item types ─────
  const settingLoading = filter.teamCapacityLoading;
  const supportsClaims = (filter.teamMaxClaim ?? 0) > 0;
  const supportsAuths = (filter.teamMaxAuth ?? 0) > 0;

  const allowedTypes = useMemo<WorkItemType[]>(() => {
    if (!teamSelected || settingLoading) return [];
    const out: WorkItemType[] = [];
    if (supportsClaims) out.push(...CLAIM_TYPES);
    if (supportsAuths) out.push(...AUTH_TYPES);
    return out;
  }, [teamSelected, settingLoading, supportsClaims, supportsAuths]);

  // Whenever the team changes (or its assignment setting resolves), rewrite
  // workItemTypes so downstream widgets scope to the team's capacity. We key
  // the effect on `settingLoading` (not derived allowedTypes) so that the
  // post-load update always fires, even when two consecutive teams share the
  // same capacity boolean values.
  const teamId = filter.teamId;
  useEffect(() => {
    if (!teamId) {
      setWorkItemTypes(null);
      return;
    }
    if (settingLoading) return;
    if (supportsClaims && supportsAuths) {
      setWorkItemTypes([...CLAIM_TYPES, ...AUTH_TYPES]);
    } else if (supportsClaims) {
      setWorkItemTypes([...CLAIM_TYPES]);
    } else if (supportsAuths) {
      setWorkItemTypes([...AUTH_TYPES]);
    } else {
      // Team has no claim/auth capacity configured — fall back to "show all"
      // by clearing the filter, matching the no-team-selected default.
      setWorkItemTypes(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId, settingLoading, supportsClaims, supportsAuths]);

  const active = filter.workItemTypes;

  // ── Filters button + active-chip strip ─────────────────────────────────
  const [open, setOpen] = useState(false);

  // Active = any non-default selection (team, branch, custom date, partial work-item types).
  const dateIsCustom = !activePreset || activePreset !== "today";
  const partialTypes =
    teamSelected &&
    allowedTypes.length > 0 &&
    !!active &&
    active.length > 0 &&
    !allowedTypes.every((tt) => active.includes(tt));
  const activeCount =
    (teamSelected ? 1 : 0) +
    (filter.branchId ? 1 : 0) +
    (dateIsCustom ? 1 : 0) +
    (partialTypes ? 1 : 0);

  // ── Staged filter state ────────────────────────────────────────────────
  // The modal edits a local copy; nothing flows to the context (and therefore
  // no queries fire) until the user clicks "Done". This stops the dashboard
  // from cancelling in-flight queries on every individual filter tweak.
  const [stagedTeam, setStagedTeam] = useState<{ id: string; name: string } | null>(null);
  const [stagedBranch, setStagedBranch] = useState<{ id: string; name: string } | null>(null);
  const [stagedFromDate, setStagedFromDate] = useState<Date>(filter.fromDate);
  const [stagedToDate, setStagedToDate] = useState<Date>(filter.toDate);
  const [stagedWorkItemTypes, setStagedWorkItemTypes] = useState<WorkItemType[] | null>(
    filter.workItemTypes
  );

  // Snapshot the committed filter into staged state each time the modal opens.
  useEffect(() => {
    if (!open) return;
    setStagedTeam(filter.teamId ? { id: filter.teamId, name: filter.teamName ?? "" } : null);
    setStagedBranch(filter.branchId ? { id: filter.branchId, name: filter.branchName ?? "" } : null);
    setStagedFromDate(filter.fromDate);
    setStagedToDate(filter.toDate);
    setStagedWorkItemTypes(filter.workItemTypes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const stagedTeamOption = useMemo<IBaseOption<unknown> | null>(
    () => (stagedTeam ? { key: stagedTeam.id, label: stagedTeam.name, value: null } : null),
    [stagedTeam]
  );
  const stagedBranchOption = useMemo<IBaseOption<unknown> | null>(
    () => (stagedBranch ? { key: stagedBranch.id, label: stagedBranch.name, value: null } : null),
    [stagedBranch]
  );
  const stagedActivePreset = detectActivePreset({
    createdDateFrom: stagedFromDate,
    createdDateTo: stagedToDate,
  });
  const stagedPresetLabel = stagedActivePreset
    ? PRESETS.find((p) => p.key === stagedActivePreset)?.label
    : null;
  const stagedCustomRangeLabel =
    !stagedActivePreset && stagedFromDate && stagedToDate
      ? `${format(stagedFromDate, "dd MMM yyyy")} → ${format(stagedToDate, "dd MMM yyyy")}`
      : null;

  const toggleStagedType = (type: WorkItemType) => {
    setStagedWorkItemTypes((prev) => {
      const set = new Set(prev ?? []);
      if (set.has(type)) set.delete(type);
      else set.add(type);
      return Array.from(set);
    });
  };

  // Reset the staged state to defaults — user still needs to click Done to
  // actually clear the dashboard's filters.
  const resetStaged = () => {
    setStagedTeam(null);
    setStagedBranch(null);
    setStagedFromDate(startOfDay(new Date()));
    setStagedToDate(endOfDay(new Date()));
    setStagedWorkItemTypes(null);
  };

  // Commit all staged values to the context in one batch — React batches the
  // state updates so the downstream queries fire once instead of cascading.
  const applyStaged = () => {
    setTeam(stagedTeam?.id ?? null, stagedTeam?.name ?? null);
    setBranch(stagedBranch?.id ?? null, stagedBranch?.name ?? null);
    setFromDate(stagedFromDate);
    setToDate(stagedToDate);
    setWorkItemTypes(stagedWorkItemTypes);
    setOpen(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Active filter pills (read-only, summarising chosen filters) */}
      {teamSelected && teamOption?.label && (
        <ActivePill
          icon={<Users size={12} />}
          label={t("rcmDashboard.team", { defaultValue: "Team" })}
          value={teamOption.label}
          onClear={() => setTeam(null, null)}
        />
      )}
      {filter.branchId && branchOption?.label && (
        <ActivePill
          icon={<Building2 size={12} />}
          label={t("rcmDashboard.branch", { defaultValue: "Branch" })}
          value={branchOption.label}
          onClear={() => setBranch(null, null)}
        />
      )}
      {(presetLabel || customRangeLabel) && (
        <ActivePill
          label={t("rcmDashboard.dateRange", { defaultValue: "Date" })}
          value={presetLabel ?? customRangeLabel ?? ""}
        />
      )}
      {partialTypes && (
        <ActivePill
          label={t("rcmDashboard.workItemTypes", { defaultValue: "Types" })}
          value={`${active!.length}/${allowedTypes.length}`}
        />
      )}

      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <Filter size={14} />
        {t("common.filters", { defaultValue: "Filters" })}
        {activeCount > 0 && (
          <span className="ms-1 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-primary px-1 text-xs font-semibold text-white">
            {activeCount}
          </span>
        )}
      </Button>

      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        title={t("rcmDashboard.filters", { defaultValue: "Filters" })}
        subtitle={t("rcmDashboard.filtersSubtitle", {
          defaultValue: "Scope the supervisor dashboard to a team, branch, date range, or work item type",
        })}
        size="lg"
        footer={
          <div className="flex w-full items-center justify-between">
            <button
              type="button"
              onClick={resetStaged}
              className="text-[10px] font-bold uppercase tracking-widest text-primary transition-colors hover:underline dark:text-primary-300"
            >
              {t("common.resetAll", { defaultValue: "Reset All" })}
            </button>
            <Button size="sm" onClick={applyStaged}>
              {t("common.done", { defaultValue: "Done" })}
            </Button>
          </div>
        }
      >
        <div className="space-y-6 px-6 py-5">
          {/* ── Row 1: Team / Branch / Date ────────────────────────── */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Team — server-side autocomplete (adapter wraps non-paginated optimaTeams) */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <Users size={11} className="me-1 inline" />
                {t("rcmDashboard.team", { defaultValue: "Team" })}
              </label>
              <ApiAutocomplete
                config={autocompleteQueriesMapper.team.queryConfig}
                value={stagedTeamOption as never}
                onChange={(val) => {
                  const opt = Array.isArray(val) ? (val[0] ?? null) : val;
                  setStagedTeam(opt ? { id: String(opt.key), name: opt.label ?? "" } : null);
                }}
                placeholder={t("rcmDashboard.selectTeam", { defaultValue: "Select team" })}
                className="h-9 w-full"
              />
            </div>

            {/* Branch — server-side autocomplete, mapped to `branches: [id]` on the BE filter */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <Building2 size={11} className="me-1 inline" />
                {t("rcmDashboard.branch", { defaultValue: "Branch" })}
              </label>
              <ApiAutocomplete
                config={autocompleteQueriesMapper.branch.queryConfig}
                value={stagedBranchOption as never}
                onChange={(val) => {
                  const opt = Array.isArray(val) ? (val[0] ?? null) : val;
                  setStagedBranch(opt ? { id: String(opt.key), name: opt.label ?? "" } : null);
                }}
                placeholder={t("rcmDashboard.selectBranch", { defaultValue: "Select branch" })}
                className="h-9 w-full"
              />
            </div>

            {/* Date filter — inline (no nested modal) */}
            <div className="flex flex-col gap-2 sm:col-span-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {t("rcmDashboard.dateRange", { defaultValue: "Date range" })}
              </label>

              {/* Preset chips */}
              <div className="flex flex-wrap items-center gap-2">
                {PRESETS.map(({ key, label }) => {
                  const isActive = stagedActivePreset === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        const range = getPresetRange(key);
                        setStagedFromDate(range.from);
                        setStagedToDate(range.to);
                      }}
                      aria-pressed={isActive}
                      className={cn(
                        "rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all",
                        isActive
                          ? "border-primary bg-primary text-white shadow-sm"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-dark-border dark:bg-dark-surface dark:text-slate-300"
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
                {(stagedPresetLabel || stagedCustomRangeLabel) && (
                  <span className="ms-auto text-xs text-slate-500 dark:text-slate-400">
                    {stagedPresetLabel ?? stagedCustomRangeLabel}
                  </span>
                )}
              </div>

              {/* Custom from/to */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label className="px-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {t("common.from", { defaultValue: "From" })}
                  </label>
                  <DatePicker
                    date={stagedFromDate}
                    onDateChange={(d) => {
                      if (d) setStagedFromDate(d);
                    }}
                    placeholder={t("rcmDashboard.fromDate", { defaultValue: "Start date" })}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="px-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {t("common.to", { defaultValue: "To" })}
                  </label>
                  <DatePicker
                    date={stagedToDate}
                    onDateChange={(d) => {
                      if (d) setStagedToDate(d);
                    }}
                    placeholder={t("rcmDashboard.toDate", { defaultValue: "End date" })}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ── Row 2: Work item type chips (depend on team) ─────────────── */}
          <div className="border-t border-slate-100 pt-4 dark:border-dark-border/40">
        <div className="mb-2 flex items-baseline justify-between">
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {t("rcmDashboard.workItemTypes", { defaultValue: "Work item types" })}
          </label>
          {teamSelected && settingLoading ? (
            <span className="text-[10px] text-slate-400 dark:text-slate-500">
              {t("common.loading", { defaultValue: "Loading…" })}
            </span>
          ) : teamSelected && allowedTypes.length === 0 ? (
            <span className="text-[10px] text-amber-600 dark:text-amber-400">
              {t("rcmDashboard.teamHasNoCapacity", {
                defaultValue: "Team has no claims or auth capacity set",
              })}
            </span>
          ) : teamSelected ? (
            <span className="text-[10px] text-slate-400 dark:text-slate-500">
              {supportsClaims && supportsAuths
                ? t("rcmDashboard.teamSupportsBoth", {
                    defaultValue: "Team handles claims & authorizations",
                  })
                : supportsClaims
                  ? t("rcmDashboard.teamSupportsClaims", { defaultValue: "Claims-only team" })
                  : t("rcmDashboard.teamSupportsAuths", { defaultValue: "Authorizations-only team" })}
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {WORK_ITEM_TYPES.map(({ value, labelKey, defaultLabel }) => {
            const on = (stagedWorkItemTypes ?? []).includes(value);
            return (
              <button
                key={value}
                type="button"
                onClick={() => toggleStagedType(value)}
                aria-pressed={on}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-semibold transition-all",
                  on
                    ? "border-primary bg-primary text-white shadow-sm"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-dark-border dark:bg-dark-surface dark:text-slate-300"
                )}
              >
                {t(labelKey, { defaultValue: defaultLabel })}
              </button>
            );
          })}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ── Active filter pill (read-only summary chip beside the Filters button) ─
function ActivePill({
  icon,
  label,
  value,
  onClear,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  onClear?: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700 dark:border-dark-border dark:bg-dark-surface dark:text-slate-300">
      {icon}
      <span className="font-bold text-slate-500 dark:text-slate-400">{label}:</span>
      <span className="max-w-[160px] truncate">{value}</span>
      {onClear && (
        <button
          type="button"
          onClick={onClear}
          aria-label={`Remove ${label}`}
          className="text-slate-400 transition-colors hover:text-red-500 dark:text-slate-500"
        >
          <X size={12} />
        </button>
      )}
    </span>
  );
}
