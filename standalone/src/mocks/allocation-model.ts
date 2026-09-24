/**
 * The allocation model, with the routing axes taken out of the schema.
 *
 * v2 hardcoded four of them , facilityId, division, encounterScope and a
 * logicAxis enum of DEPARTMENT | PAYER. That carried SGH fine but meant a client
 * who splits work any other way could not be represented without a schema change,
 * a matcher change and a new wizard step.
 *
 * Here a routing rule is a list of {dimension, operator, values} criteria, and the
 * dimensions themselves are registry rows. Adding "claim value band" for the next
 * client is a row plus a value source; the matcher, the schema and the UI are
 * untouched. The registry is served over GraphQL from the start, so making it
 * admin-editable later is a CRUD screen over rows that already exist, not a rewrite.
 */

import { FACILITY_ALIASES } from "./facilities.js";

export type CriterionOperator = "IN" | "NOT_IN" | "ANY";
export type CriterionLevel = "TEAM" | "GROUP" | "BOTH";

export interface Criterion {
  dimension: string;
  operator: CriterionOperator;
  values: string[];
}

export interface AllocationDimension {
  code: string;
  label: string;
  /** Where an admin may constrain it. Teams prefilter, groups refine. */
  level: CriterionLevel;
  operators: CriterionOperator[];
  /** Query the UI calls for this dimension's pickable values. */
  valueSource: string;
  /** Field on a work item this dimension tests. The whole matcher is this line. */
  itemField: string;
  /** Whether readiness reports values no group covers. */
  coverageChecked: boolean;
  /** Source data spells departments many ways; payers and codes are exact. */
  matchMode: "EXACT" | "NORMALISED";
  /**
   * Synonyms this dimension accepts, normalised alias to normalised canonical.
   * Normalisation handles punctuation and case; nothing derivable unifies a
   * misspelling with its correct spelling, so those have to be data.
   */
  aliases?: Record<string, string>;
  /**
   * How a value should be shown. CODE values are identifiers the business reads
   * as-is (DXB, OP, INS020); ENUM values are ours and read better as prose
   * ("Claim validation"); NAME values are already human.
   */
  valueStyle: "CODE" | "ENUM" | "NAME";
  sortOrder: number;
}

/**
 * Department synonyms, normalised on both sides.
 *
 * v1 carried a 42-entry deptTagMap. Thirty of those are punctuation and case,
 * which normKey already handles; these twelve are the genuine synonyms it
 * cannot reach. Dropping them in v2 was a silent regression worth 20 items on
 * the captured production day, 15 of them "Cardiology Services".
 *
 * "dermatology" maps onto the misspelled "dermatalogy" deliberately: that is
 * the spelling the production team tags use, so it is the canonical one.
 */
export const DEPARTMENT_ALIASES: Record<string, string> = {
  cardiologyservices: "cardiology",
  dermatology: "dermatalogy",
  nutrition: "dieticiannutrition",
  dietician: "dieticiannutrition",
  gihconcology: "oncology",
  hematology: "oncology",
  intensivecareuniticu: "icu",
  dramrelshawarbineurosurgerycenter: "neurosurgery",
  obstetricsgynaeivf: "obstetricsgyneivf",
  optics: "optimetry",
  pediatrics: "pediatricsneonatology",
  podiatrics: "podiatry",
};

/**
 * The SGH template. Everything specific to this client lives in this array and
 * the families below, which is the point , it is configuration, not schema.
 */
export const DIMENSIONS: AllocationDimension[] = [
  {
    code: "FACILITY",
    label: "Facility",
    level: "TEAM",
    operators: ["IN", "NOT_IN", "ANY"],
    valueSource: "facilityOptions",
    itemField: "facilityId",
    coverageChecked: false,
    // A work item carries a health licence, and one facility can hold several,
    // so the licences alias onto the facility's name. That way the picker
    // offers one row per place rather than one per regulatory number, and
    // picking SGH-Sharjah matches all three of its licences.
    matchMode: "NORMALISED",
    aliases: FACILITY_ALIASES,
    valueStyle: "NAME",
    sortOrder: 10,
  },
  {
    code: "WORK_ITEM_TYPE",
    label: "Work item type",
    level: "BOTH",
    operators: ["IN", "NOT_IN", "ANY"],
    valueSource: "workItemTypeOptions",
    itemField: "workItemType",
    coverageChecked: true,
    matchMode: "EXACT",
    valueStyle: "ENUM",
    sortOrder: 20,
  },
  {
    code: "ENCOUNTER_TYPE",
    label: "Encounter",
    level: "BOTH",
    operators: ["IN", "NOT_IN", "ANY"],
    valueSource: "encounterTypeOptions",
    itemField: "encounterType",
    coverageChecked: false,
    matchMode: "EXACT",
    valueStyle: "CODE",
    sortOrder: 30,
  },
  {
    code: "DEPARTMENT",
    label: "Department",
    level: "GROUP",
    operators: ["IN", "NOT_IN", "ANY"],
    valueSource: "departmentOptions",
    itemField: "department",
    coverageChecked: true,
    matchMode: "NORMALISED",
    aliases: DEPARTMENT_ALIASES,
    valueStyle: "NAME",
    sortOrder: 40,
  },
  {
    code: "PAYER",
    label: "Insurance payer",
    level: "GROUP",
    operators: ["IN", "NOT_IN", "ANY"],
    valueSource: "payerOptions",
    itemField: "payer",
    coverageChecked: true,
    matchMode: "EXACT",
    valueStyle: "CODE",
    sortOrder: 50,
  },
  {
    code: "CLAIM_STATUS",
    label: "Claim status",
    level: "GROUP",
    operators: ["IN", "NOT_IN", "ANY"],
    valueSource: "claimStatusOptions",
    itemField: "claimStatus",
    coverageChecked: false,
    matchMode: "EXACT",
    valueStyle: "ENUM",
    sortOrder: 60,
  },
];

/**
 * What replaces `division`. A family groups work item types that share a daily
 * cap and an overflow rule, so capacity is declared per family rather than by
 * two fixed maxAuth / maxClaim columns. SGH declares two; a client with one
 * queue declares one, and one wanting per-type caps declares six.
 */
export interface CapacityFamily {
  code: string;
  label: string;
  workItemTypes: string[];
  defaultLimit: number;
  /** AUTH keeps allocating past the cap; CLAIM defers. Now a family property. */
  allowExceedByDefault: boolean;
}

export const CAPACITY_FAMILIES: CapacityFamily[] = [
  {
    code: "AUTH",
    label: "Authorisation",
    workItemTypes: ["AUTHORIZATION_SUBMISSION", "AUTHORIZATION_RESUBMISSION"],
    defaultLimit: 150,
    allowExceedByDefault: true,
  },
  {
    code: "CLAIM",
    label: "Claim",
    workItemTypes: [
      "CLAIM_VALIDATION",
      "CLAIM_SUBMISSION",
      "CLAIM_RESUBMISSION",
      "RECONCILIATION",
    ],
    defaultLimit: 150,
    allowExceedByDefault: false,
  },
];


/**
 * Policies: the rules that decide what happens to work once a group has claimed
 * it, as registry rows rather than schema columns.
 *
 * The first cut of this hardcoded `highCostThreshold`, `maxAuth`, `maxClaim` and
 * `allowExceedCapacity` on the team. That is wrong for the same reason the fixed
 * routing axes were: a high-cost threshold is meaningless on an authorisation
 * team, and the thing that IS meaningful there (an authorisation ageing past its
 * turnaround) had nowhere to live.
 *
 * So a policy declares which work it applies to. A team is only ever asked about
 * the policies its own work makes relevant, and a client who needs a different
 * rule adds a row here.
 */
export type PolicyValueType = "NUMBER" | "FLAG";
export type PolicyScope = "TEAM" | "FAMILY";

export interface AllocationPolicy {
  code: string;
  label: string;
  /** Shown under the control, so the admin knows what turning it does. */
  description: string;
  valueType: PolicyValueType;
  /** TEAM: one value for the team. FAMILY: one value per capacity family. */
  scope: PolicyScope;
  /** Only offered when the team handles one of these work item types. */
  appliesToTypes: string[];
  defaultValue: number | boolean;
  unit?: string;
  /**
   * When set, an item this policy flags may only go to a member carrying the
   * tag. This is what generalises "high-cost handler" into something any
   * policy can use.
   */
  handlerTag?: string;
  /** Item field the threshold is compared against, for NUMBER policies. */
  itemField?: string;
  /** How to compare. Only greater-than is needed so far. */
  test?: "GREATER_THAN";
  sortOrder: number;
}

const AUTH_TYPES = ["AUTHORIZATION_SUBMISSION", "AUTHORIZATION_RESUBMISSION"];
const CLAIM_TYPES = [
  "CLAIM_VALIDATION",
  "CLAIM_SUBMISSION",
  "CLAIM_RESUBMISSION",
  "RECONCILIATION",
];
const ALL_TYPES = [...AUTH_TYPES, ...CLAIM_TYPES];

export const POLICIES: AllocationPolicy[] = [
  {
    code: "DAILY_LIMIT",
    label: "Daily limit per person",
    description: "How many items one member can hold in a day before they are considered full.",
    valueType: "NUMBER",
    scope: "FAMILY",
    appliesToTypes: ALL_TYPES,
    defaultValue: 150,
    unit: "items/day",
    sortOrder: 10,
  },
  {
    code: "ALLOW_EXCEED",
    label: "Keep allocating past the limit",
    description:
      "On, work above the limit still goes to the least-loaded person. Off, it is held back for the next run.",
    valueType: "FLAG",
    scope: "FAMILY",
    appliesToTypes: ALL_TYPES,
    defaultValue: false,
    sortOrder: 20,
  },
  {
    code: "HIGH_COST",
    label: "High-cost threshold",
    description:
      "Claims worth more than this go only to members cleared for high-cost work, where a mistake is expensive.",
    valueType: "NUMBER",
    scope: "TEAM",
    // Claim work carries a net value; authorisation work does not. That is the
    // whole reason this policy can apply to one and not the other.
    appliesToTypes: CLAIM_TYPES,
    defaultValue: 3000,
    unit: "AED",
    handlerTag: "HIGH_COST",
    itemField: "net",
    test: "GREATER_THAN",
    sortOrder: 30,
  },
];

export const policyByCode = (code: string): AllocationPolicy | undefined =>
  POLICIES.find((p) => p.code === code);

/** Policies worth asking about, given the work item types a team handles. */
export const policiesFor = (types: string[]): AllocationPolicy[] =>
  POLICIES.filter((p) => types.some((t) => p.appliesToTypes.includes(t))).sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );

/** Does this policy flag this item at this setting? */
export function policyFlags(
  policy: AllocationPolicy,
  value: number | boolean | undefined,
  item: Record<string, unknown>,
): boolean {
  if (policy.valueType !== "NUMBER" || !policy.itemField) return false;
  if (!policy.appliesToTypes.includes(String(item.workItemType))) return false;
  const threshold = typeof value === "number" ? value : Number(policy.defaultValue);
  const raw = item[policy.itemField];
  if (typeof raw !== "number") return false;
  return raw > threshold;
}

export const dimensionByCode = (code: string): AllocationDimension | undefined =>
  DIMENSIONS.find((d) => d.code === code);

export const familyOfWorkItemType = (wit: string): CapacityFamily | undefined =>
  CAPACITY_FAMILIES.find((f) => f.workItemTypes.includes(wit));

/** Lowercase alphanumerics. "E. N. T.", "e.n.t" and "ENT" all agree. */
export const normKey = (s: unknown): string =>
  String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Normalise, drop a leading dimension-code prefix, then resolve synonyms. All
 * three spellings are live: config slugs, prefixed slugs, and the display
 * names the work queue sends. Must stay in step with the matcher in
 * standalone/workflow/match-groups.js.
 */
export function normValue(dim: AllocationDimension | undefined, v: unknown): string {
  const k = normKey(v);
  const prefix = normKey(dim?.code);
  const stripped =
    prefix && k.startsWith(prefix) && k.length > prefix.length ? k.slice(prefix.length) : k;
  return dim?.aliases?.[stripped] ?? stripped;
}

const keyFor = (dim: AllocationDimension | undefined, v: unknown): string =>
  dim?.matchMode === "NORMALISED" ? normValue(dim, v) : String(v ?? "");

/** The criterion for a dimension, or undefined when unconstrained. */
export const criterionFor = (
  criteria: Criterion[] | undefined,
  code: string,
): Criterion | undefined => (criteria ?? []).find((c) => c.dimension === code);

/**
 * Does one criterion admit this item? An absent criterion and an explicit ANY
 * are the same thing , ANY is how an admin says "deliberately everything here",
 * which is what used to be the payer catch-all toggle.
 */
export function criterionAccepts(c: Criterion, item: Record<string, unknown>): boolean {
  if (c.operator === "ANY") return true;
  const dim = dimensionByCode(c.dimension);
  if (!dim) return true;
  const raw = item[dim.itemField];
  const present = raw != null && String(raw) !== "";
  const set = new Set((c.values ?? []).map((v) => keyFor(dim, v)));

  if (c.operator === "NOT_IN") {
    // An item with no value cannot be proven excluded, so it passes.
    return !present || !set.has(keyFor(dim, raw));
  }
  // IN. An item missing the value it is being filtered on cannot match.
  if (!present) return false;
  return set.has(keyFor(dim, raw));
}

/** Every criterion must admit the item. */
export const criteriaAccept = (
  criteria: Criterion[] | undefined,
  item: Record<string, unknown>,
): boolean => (criteria ?? []).every((c) => criterionAccepts(c, item));

/** The first criterion that rejects the item, for "why was this not allocated". */
export function rejectingCriterion(
  criteria: Criterion[] | undefined,
  item: Record<string, unknown>,
): Criterion | null {
  for (const c of criteria ?? []) if (!criterionAccepts(c, item)) return c;
  return null;
}

/**
 * How narrow a rule is. Constraining more dimensions always beats constraining
 * fewer, so the count leads; within that, naming one value beats naming six.
 * ANY and NOT_IN barely narrow anything and score accordingly.
 */
export function specificityOf(criteria: Criterion[] | undefined): number {
  let constrained = 0;
  let narrowness = 0;
  for (const c of criteria ?? []) {
    if (c.operator === "ANY" || !(c.values ?? []).length) continue;
    constrained += 1;
    narrowness += c.operator === "NOT_IN" ? 1 : Math.floor(100 / c.values.length);
  }
  return constrained * 1000 + narrowness;
}

/**
 * A group inherits its team's rule and narrows it. Same dimension on both, the
 * group wins, which is what lets a team say "OP" and a group say nothing.
 */
export function mergeCriteria(team: Criterion[] = [], group: Criterion[] = []): Criterion[] {
  const out = new Map<string, Criterion>();
  for (const c of team) out.set(c.dimension, c);
  for (const c of group) out.set(c.dimension, c);
  return [...out.values()];
}

/**
 * Does the group stay inside its team's rule? A group may only narrow, which is
 * the invariant that replaces the old fixed team/group hierarchy.
 */
export function widensBeyond(team: Criterion[] = [], group: Criterion[] = []): string[] {
  const broken: string[] = [];
  for (const g of group) {
    const t = team.find((c) => c.dimension === g.dimension);
    if (!t || t.operator !== "IN") continue;
    const dim = dimensionByCode(g.dimension);
    if (g.operator === "ANY") {
      broken.push(g.dimension);
      continue;
    }
    if (g.operator !== "IN") continue;
    const allowed = new Set(t.values.map((v) => keyFor(dim, v)));
    if (g.values.some((v) => !allowed.has(keyFor(dim, v)))) broken.push(g.dimension);
  }
  return broken;
}

/** Values of a dimension a rule admits, given the universe available. */
export function admittedValues(
  criteria: Criterion[] | undefined,
  code: string,
  universe: string[],
): string[] {
  const c = criterionFor(criteria, code);
  if (!c || c.operator === "ANY") return [...universe];
  const dim = dimensionByCode(code);
  const set = new Set(c.values.map((v) => keyFor(dim, v)));
  return c.operator === "NOT_IN"
    ? universe.filter((v) => !set.has(keyFor(dim, v)))
    : universe.filter((v) => set.has(keyFor(dim, v)));
}

/**
 * Chip text for one value. Only our own enums are reworded; codes the business
 * uses stay exactly as written, because "Dxb" is not a facility anybody knows.
 */
export const prettyValue = (v: string, dim?: AllocationDimension): string =>
  dim?.valueStyle === "ENUM"
    ? v.replace(/_/g, " ").toLowerCase().replace(/^./, (c) => c.toUpperCase())
    : v;

/** Chip text for a rule, in registry order. */
export function describeCriteria(criteria: Criterion[] | undefined): string[] {
  return [...(criteria ?? [])]
    .filter((c) => c.operator === "ANY" || (c.values ?? []).length)
    .sort(
      (a, b) =>
        (dimensionByCode(a.dimension)?.sortOrder ?? 999) -
        (dimensionByCode(b.dimension)?.sortOrder ?? 999),
    )
    .map((c) => {
      const label = dimensionByCode(c.dimension)?.label ?? c.dimension;
      if (c.operator === "ANY") return `${label}: any`;
      const dim = dimensionByCode(c.dimension);
      const head = c.values.slice(0, 2).map((v) => prettyValue(v, dim)).join(", ");
      const rest = c.values.length > 2 ? ` +${c.values.length - 2}` : "";
      return `${c.operator === "NOT_IN" ? "Not " : ""}${label}: ${head}${rest}`;
    });
}
