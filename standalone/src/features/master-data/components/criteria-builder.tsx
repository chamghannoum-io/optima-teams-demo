/**
 * The routing-rule editor, and the only place criteria are edited.
 *
 * One field per dimension the registry reports for this level, laid out like
 * every other field in the wizard: label, control, helper line.
 *
 *   Department
 *   [ Cardiology × ] [ Emergency × ]
 *
 * There is no operator control. Every filter means "is any of", and leaving a
 * dimension out already means "anything", which is what the section says. The
 * contract still carries NOT_IN and ANY for anything that needs them.
 *
 * Values come from `ApiAutocomplete` bound to the `dimensionOptions` source, so
 * a department here is picked from the same paginated, searchable, server-backed
 * list Optima uses everywhere else. The dimension is passed as a filter variable,
 * which is what lets one picker serve every dimension the registry declares.
 */
import { useMemo, useState } from "react";
import { gql, useApolloClient, useQuery } from "@apollo/client";
import { Lock, Plus, X } from "lucide-react";

import { Badge, Button, Label, cn } from "@optima/ui";
import { ApiAutocomplete, autocompleteQueriesMapper } from "@/shared/autocomplete/index.js";
import type { IBaseOption } from "@optima/shared";

export const DIMENSIONS_QUERY = gql`
  query AllocationDimensions {
    allocationDimensions {
      code
      label
      level
      operators
      valueSource
      itemField
      coverageChecked
      valueStyle
      sortOrder
      values {
        value
        label
      }
    }
  }
`;

/**
 * Every value a dimension admits for this team.
 *
 * Deliberately not `allocationDimensions.values`, which is estate-wide: a team
 * at one facility should not be able to select departments that facility does
 * not run. This is the same source and scoping the picker itself uses.
 */
const DIMENSION_VALUES = gql`
  query CriteriaDimensionValues($dimension: String!, $teamId: ID) {
    dimensionValues(dimension: $dimension, teamId: $teamId) {
      value
      label
    }
  }
`;

export type CriterionOperator = "IN" | "NOT_IN" | "ANY";

export interface Criterion {
  dimension: string;
  operator: CriterionOperator;
  values: string[];
}

export interface Dimension {
  code: string;
  label: string;
  level: "TEAM" | "GROUP" | "BOTH";
  operators: CriterionOperator[];
  valueSource: string;
  itemField: string;
  coverageChecked: boolean;
  valueStyle: string;
  sortOrder: number;
  values?: { value: string; label: string }[];
}


/** Dimensions editable at a level. BOTH shows up on teams and on groups. */
export const dimensionsFor = (dims: Dimension[], level: "TEAM" | "GROUP") =>
  dims.filter((d) => d.level === level || d.level === "BOTH");

export interface CriteriaBuilderProps {
  criteria: Criterion[];
  onChange: (next: Criterion[]) => void;
  level: "TEAM" | "GROUP";
  /** Scopes value lists to the team being edited. */
  teamId?: string | null;
  /**
   * The team's rule, when editing a group. Shown as inherited context and used
   * to flag a group that tries to widen past it.
   */
  inherited?: Criterion[];
  className?: string;
}

export function CriteriaBuilder({
  criteria,
  onChange,
  level,
  teamId,
  inherited,
  className,
}: CriteriaBuilderProps) {
  const { data } = useQuery(DIMENSIONS_QUERY);
  const [adding, setAdding] = useState(false);
  const client = useApolloClient();
  /** Dimensions whose select-all is in flight, so the control can say so. */
  const [loadingAll, setLoadingAll] = useState<string | null>(null);

  const allDims: Dimension[] = data?.allocationDimensions ?? [];
  const dims = useMemo(() => dimensionsFor(allDims, level), [allDims, level]);

  /** What the team already decided on this dimension, when editing a group. */
  const inheritedOn = (code: string) => (inherited ?? []).find((c) => c.dimension === code);

  /**
   * Dimensions worth offering on a group.
   *
   * A group can only narrow its team, so a dimension the team pinned to a
   * single value has nothing left to choose: repeating it just invites someone
   * to set it to something that can never match. Those are dropped, and the
   * inherited row above already says what they are.
   */
  const offerable = useMemo(
    () =>
      dims.filter((d) => {
        if (level !== "GROUP") return true;
        const t = inheritedOn(d.code);
        return !(t && t.operator === "IN" && t.values.length === 1);
      }),
    [dims, level, inherited],
  );

  /**
   * Values a group may pick on a dimension. When the team constrained it, the
   * group chooses from that set and no wider, so the picker cannot offer a
   * value the team already excluded.
   */
  const allowedValues = (code: string): string[] | undefined => {
    if (level !== "GROUP") return undefined;
    const t = inheritedOn(code);
    return t && t.operator === "IN" && t.values.length ? t.values : undefined;
  };

  const find = (code: string) => criteria.find((c) => c.dimension === code);

  const put = (code: string, patch: Partial<Criterion>) => {
    const existing = find(code);
    const next: Criterion = {
      dimension: code,
      operator: "IN" as CriterionOperator,
      values: existing?.values ?? [],
      ...patch,
    };
    onChange([...criteria.filter((c) => c.dimension !== code), next]);
  };

  const drop = (code: string) => onChange(criteria.filter((c) => c.dimension !== code));

  /**
   * Select everything this dimension admits.
   *
   * Departments and payers run to dozens of values, and picking them one at a
   * time through a search box to say "all of them" is the kind of thing that
   * makes people give up and leave the filter off, which means the team
   * silently takes everything anyway. Narrowed to the team's own set when
   * editing a group, so this can never widen past what the team allows.
   */
  const selectAll = async (code: string) => {
    const narrowed = allowedValues(code);
    if (narrowed) {
      put(code, { values: narrowed });
      return;
    }
    setLoadingAll(code);
    try {
      const { data } = await client.query({
        query: DIMENSION_VALUES,
        variables: { dimension: code, teamId: teamId ?? null },
        fetchPolicy: "cache-first",
      });
      put(code, { values: (data?.dimensionValues ?? []).map((v: any) => String(v.value)) });
    } finally {
      setLoadingAll(null);
    }
  };

  const shown = offerable.filter((d) => find(d.code));
  const addable = offerable.filter((d) => !find(d.code));

  return (
    <div className={cn("space-y-2", className)}>
      {inherited && inherited.length > 0 && <InheritedRow inherited={inherited} dims={allDims} />}

      {shown.length === 0 && (
        <p className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-500 dark:border-dark-border dark:text-slate-400">
          No filters yet. Without any, this {level === "TEAM" ? "team" : "group"} takes
          everything that reaches it.
        </p>
      )}

      {shown.map((d) => {
        const c = find(d.code)!;
        const conflict = widened(d.code, c, inherited);
        return (
          /*
           * Laid out like Name and Description above: label, control, helper
           * line. The operator picker is gone. Every filter is "is any of",
           * because that is what every real team configuration uses, and
           * leaving a dimension out already means "anything", which the
           * section's own help text says. The contract still carries NOT_IN
           * and ANY for anything that needs them.
           */
          <div key={d.code} className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label>{d.label}</Label>
              <div className="flex items-center gap-2">
                {/*
                  * Only where there is a list worth selecting. A dimension the
                  * team narrowed to two values already renders as toggles, so
                  * "select all" there would be a link next to two buttons.
                  */}
                {(allowedValues(d.code)?.length ?? d.values?.length ?? 0) > 6 && (
                  <button
                    type="button"
                    onClick={() =>
                      c.values.length ? put(d.code, { values: [] }) : selectAll(d.code)
                    }
                    disabled={loadingAll === d.code}
                    className="text-[11px] font-medium text-primary underline underline-offset-2 disabled:opacity-50 dark:text-primary-300"
                  >
                    {loadingAll === d.code
                      ? "Selecting…"
                      : c.values.length
                        ? "Clear"
                        : "Select all"}
                  </button>
                )}
                <button
                  type="button"
                  aria-label={`Remove the ${d.label} filter`}
                  onClick={() => drop(d.code)}
                  className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-dark-hover dark:hover:text-slate-200"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Ring on a wrapper, so ApiAutocomplete stays the upstream one. */}
            <div className={cn(conflict && "rounded-md ring-1 ring-red-400")}>
              <DimensionPicker
                dimension={d}
                teamId={teamId}
                values={c.values}
                onChange={(values) => put(d.code, { values })}
                allowed={allowedValues(d.code)}
              />
            </div>

            {conflict ? (
              <p className="text-[11px] text-red-600 dark:text-red-400">
                Wider than the team allows, so this group would never match. A group can only
                narrow its team.
              </p>
            ) : c.values.length === 0 ? (
              <p className="text-[11px] text-amber-700 dark:text-amber-400">
                No values picked yet, so nothing matches this filter.
              </p>
            ) : null}
          </div>
        );
      })}

      {addable.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {adding ? (
            <>
              <span className="text-xs text-slate-500 dark:text-slate-400">Filter on</span>
              {addable.map((d) => (
                <Button
                  key={d.code}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    put(d.code, { operator: "IN", values: [] });
                    setAdding(false);
                  }}
                >
                  {d.label}
                </Button>
              ))}
              <Button type="button" variant="tertiary" size="sm" onClick={() => setAdding(false)}>
                Cancel
              </Button>
            </>
          ) : (
            <Button type="button" variant="tertiary" size="sm" onClick={() => setAdding(true)}>
              <Plus size={13} /> Add a filter
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * One dimension's value picker.
 *
 * `dimensionOptions` is a single paginated source; which dimension it lists is a
 * filter variable. So every dimension in the registry gets a real Optima picker,
 * with search and infinite scroll, and none of them needed wiring of their own.
 */
function DimensionPicker({
  dimension,
  teamId,
  values,
  onChange,
  allowed,
}: {
  dimension: Dimension;
  teamId?: string | null;
  values: string[];
  onChange: (values: string[]) => void;
  /**
   * When the team constrained this dimension, the only values a group may
   * choose. Given a single-value team rule the builder drops the field
   * entirely, so this is for the several-values case: the team allows OP and
   * IP, and the group picks one of those two rather than anything at all.
   */
  allowed?: string[];
}) {
  const labelOf = useMemo(() => {
    const map = new Map((dimension.values ?? []).map((v) => [v.value, v.label]));
    return (value: string) => map.get(value) ?? value;
  }, [dimension.values]);

  const selected: IBaseOption[] = values.map((v) => ({
    key: v,
    label: labelOf(v),
    value: { id: v, name: labelOf(v) },
  }));

  const filter = useMemo(
    () => ({ dimension: dimension.code, teamId: teamId ?? null }),
    [dimension.code, teamId],
  );

  /*
   * A short allowed set is a plain choice, not a search problem. Rendering it
   * as toggles means the group's options are visible without opening anything,
   * which is the point: the team already narrowed this to two or three values.
   */
  if (allowed && allowed.length && allowed.length <= 6) {
    const toggle = (v: string) =>
      onChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v]);
    return (
      <div className="flex flex-wrap gap-1.5">
        {allowed.map((v) => {
          const on = values.includes(v);
          return (
            <button
              key={v}
              type="button"
              onClick={() => toggle(v)}
              aria-pressed={on}
              className={cn(
                "rounded-full border px-3 py-1 text-xs transition",
                on
                  ? "border-primary bg-primary text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-dark-border dark:bg-dark-card dark:text-slate-300",
              )}
            >
              {pretty(v)}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <ApiAutocomplete
      config={autocompleteQueriesMapper.dimensionOptions.queryConfig}
      filter={filter}
      value={selected}
      onChange={(val) =>
        onChange(((val as IBaseOption[]) ?? []).map((o) => String(o.key)))
      }
      multiple
      showMultipleAsTags
      maxVisibleTags={4}
      placeholder={`Select ${dimension.label.toLowerCase()}…`}
    />
  );
}

/**
 * SCREAMING_CASE reads as prose. A business code like INS012 is left alone,
 * because nobody calls it anything else.
 */
const pretty = (v: string) =>
  /^[A-Z0-9_]+$/.test(v) && v.includes("_")
    ? v.replace(/_/g, " ").toLowerCase().replace(/^./, (ch) => ch.toUpperCase())
    : v;

/** Is this group criterion wider than the team's on the same dimension? */
function widened(code: string, c?: Criterion, inherited?: Criterion[]): boolean {
  if (!c || !inherited) return false;
  const t = inherited.find((x) => x.dimension === code);
  if (!t || t.operator !== "IN") return false;
  if (c.operator === "ANY") return true;
  if (c.operator !== "IN") return false;
  const allowed = new Set(t.values);
  return c.values.some((v) => !allowed.has(v));
}

/** What the team already decided, shown so a group's rule reads in context. */
function InheritedRow({ inherited, dims }: { inherited: Criterion[]; dims: Dimension[] }) {
  const label = (code: string) => dims.find((d) => d.code === code)?.label ?? code;
  const shown = inherited.filter((c) => c.operator === "ANY" || c.values.length);
  if (!shown.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-lg bg-slate-50 px-3 py-2 dark:bg-dark-surface">
      <Lock size={11} className="text-slate-400" />
      <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
        From the team
      </span>
      {shown.map((c) => (
        <Badge key={c.dimension} variant="default">
          {label(c.dimension)}
          {c.operator === "ANY"
            ? ": any"
            : `: ${c.values.slice(0, 2).map(pretty).join(", ")}${c.values.length > 2 ? ` +${c.values.length - 2}` : ""}`}
        </Badge>
      ))}
    </div>
  );
}
