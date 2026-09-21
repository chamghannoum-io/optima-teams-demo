/**
 * The routing-rule editor, and the only place criteria are edited.
 *
 * One row per dimension the registry reports for this level. The row is
 * deliberately the shape of a filter, because that is what it is:
 *
 *   [Department]  [is any of ▾]  [ Cardiology × ] [ Emergency × ]  ▾
 *
 * Values come from `ApiAutocomplete` bound to the `dimensionOptions` source, so
 * a department here is picked from the same paginated, searchable, server-backed
 * list Optima uses everywhere else. The dimension is passed as a filter variable,
 * which is what lets one picker serve every dimension the registry declares.
 */
import { useMemo, useState } from "react";
import { gql, useQuery } from "@apollo/client";
import { Lock, Plus, X } from "lucide-react";

import {
  Badge,
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  cn,
} from "@optima/ui";
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

const OPERATOR_LABEL: Record<CriterionOperator, string> = {
  IN: "is any of",
  NOT_IN: "is none of",
  ANY: "anything",
};

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

  const allDims: Dimension[] = data?.allocationDimensions ?? [];
  const dims = useMemo(() => dimensionsFor(allDims, level), [allDims, level]);

  const find = (code: string) => criteria.find((c) => c.dimension === code);

  const put = (code: string, patch: Partial<Criterion>) => {
    const existing = find(code);
    const next: Criterion = {
      dimension: code,
      operator: existing?.operator ?? "IN",
      values: existing?.values ?? [],
      ...patch,
    };
    if (next.operator === "ANY") next.values = [];
    onChange([...criteria.filter((c) => c.dimension !== code), next]);
  };

  const drop = (code: string) => onChange(criteria.filter((c) => c.dimension !== code));

  const shown = dims.filter((d) => find(d.code));
  const addable = dims.filter((d) => !find(d.code));

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
          <div
            key={d.code}
            className={cn(
              "rounded-lg border bg-white px-3 py-2.5 dark:bg-dark-card",
              conflict
                ? "border-red-300 dark:border-red-900"
                : "border-slate-200 dark:border-dark-border",
            )}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-32 shrink-0 text-xs font-semibold text-slate-700 dark:text-slate-300">
                {d.label}
              </span>

              <Select
                value={c.operator}
                onValueChange={(v: string) => put(d.code, { operator: v as CriterionOperator })}
              >
                <SelectTrigger className="h-10 w-[130px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {d.operators.map((op) => (
                    <SelectItem key={op} value={op}>
                      {OPERATOR_LABEL[op]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="min-w-0 flex-1">
                {c.operator === "ANY" ? (
                  <span className="text-xs italic text-slate-500 dark:text-slate-400">
                    every value, deliberately
                  </span>
                ) : (
                  <DimensionPicker
                    dimension={d}
                    teamId={teamId}
                    values={c.values}
                    onChange={(values) => put(d.code, { values })}
                  />
                )}
              </div>

              <button
                type="button"
                aria-label={`Remove the ${d.label} filter`}
                onClick={() => drop(d.code)}
                className="shrink-0 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-dark-hover dark:hover:text-slate-200"
              >
                <X size={14} />
              </button>
            </div>

            {conflict && (
              <p className="mt-1.5 text-[11px] text-red-600 dark:text-red-400">
                This is wider than the team allows on {d.label.toLowerCase()}, so the group
                would never match. A group can only narrow its team.
              </p>
            )}
            {c.operator === "IN" && c.values.length === 0 && (
              <p className="mt-1.5 text-[11px] text-amber-700 dark:text-amber-400">
                No values picked yet, so nothing matches this filter.
              </p>
            )}
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
}: {
  dimension: Dimension;
  teamId?: string | null;
  values: string[];
  onChange: (values: string[]) => void;
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
            : `: ${c.values.slice(0, 2).join(", ")}${c.values.length > 2 ? ` +${c.values.length - 2}` : ""}`}
        </Badge>
      ))}
    </div>
  );
}
