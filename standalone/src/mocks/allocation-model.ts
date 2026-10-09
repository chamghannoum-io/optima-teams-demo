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

export type CriterionOperator = "IN" | "NOT_IN" | "ANY" | "GREATER_THAN";
export type CriterionLevel = "TEAM" | "GROUP" | "BOTH";

export interface Criterion {
  dimension: string;
  operator: CriterionOperator;
  values: string[];
  /**
   * Team criteria only. Locked means the team decided this dimension for every
   * group and no group may restate it; unlocked means the team's values are a
   * menu its groups choose from. See `filterModeOf`.
   */
  locked?: boolean;
}

/**
 * What a team's filter on one dimension does to its groups. Three states, and
 * they are the whole of the team/group relationship on that dimension:
 *
 *   LOCKED  the team filtered and locked it. Every group inherits it exactly
 *           and cannot edit it. "All our groups do claim validation and claim
 *           submission, and that is not negotiable."
 *   CHOICE  the team filtered but left it open. The team's values are the menu;
 *           each group picks a subset of them, and a group that picks nothing
 *           inherits the lot. "We cover Ajman, Sharjah and RAK; group 1 takes
 *           Ajman, group 2 Sharjah, group 3 RAK."
 *   OPEN    the team did not filter. Groups may filter on anything the estate
 *           offers, or not at all.
 *
 * OPEN and CHOICE were already the behaviour; LOCKED is what is new, and it is
 * the only state where a group criterion on the dimension is ignored rather
 * than honoured.
 */
export type TeamFilterMode = "LOCKED" | "CHOICE" | "OPEN";

export function filterModeOf(
  teamCriteria: Criterion[] | undefined,
  code: string,
): TeamFilterMode {
  const c = criterionFor(teamCriteria, code);
  if (!c) return "OPEN";
  return c.locked ? "LOCKED" : "CHOICE";
}

/** Dimensions the team locked, so no group may restate them. */
export const lockedDimensions = (teamCriteria: Criterion[] | undefined): string[] =>
  (teamCriteria ?? []).filter((c) => c.locked).map((c) => c.dimension);

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
  /**
   * A number compared with an operator, not a value picked from a list.
   *
   * The generic criteria builder is a value picker, so it cannot edit one of
   * these and skips it; the dimension brings its own control instead. This is
   * what lets "claims over AED 5,000" be an ordinary criterion, matched,
   * scored and explained by the same code as every other clause, while still
   * being a switch and a dropdown on screen.
   */
  numeric?: boolean;
  /** What the number is denominated in, for labels. */
  unit?: string;
  /**
   * The amounts a numeric dimension may be set to. A dropdown, never free
   * text: the figure is a business decision a supervisor owns, and typing
   * 500 where 5,000 was meant silently reroutes a day's expensive claims.
   * Mutable at runtime, which is the supervisor's half of that.
   */
  numericOptions?: number[];
  /**
   * Work item types this dimension can say anything about. Absent means all.
   * Authorisation work carries no money, so claim value is not offered on it,
   * the same way the high-cost policy was not before it moved here.
   */
  appliesToTypes?: string[];
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
  /**
   * High cost, as a dimension rather than a policy.
   *
   * It used to be a team policy: one threshold for the team, plus a tick-box
   * per member saying who was cleared for the work it flagged. That answered
   * "who may touch an expensive claim" but not "which group does expensive
   * claims go to", and the second is the question the business actually asks.
   *
   * As a criterion it is the first answer, for free. A group with it on reads
   * "cardiology AND over AED 10,000", which constrains one dimension more than
   * the plain cardiology group, so `specificityOf` already sends the expensive
   * claim to it and the cheap one to the other. No new routing concept, no
   * second matcher, and "why did this go here" explains itself through
   * `rejectingCriterion` like every other clause.
   */
  {
    code: "CLAIM_VALUE",
    label: "Claim value",
    level: "GROUP",
    operators: ["GREATER_THAN"],
    valueSource: "claimValueOptions",
    itemField: "net",
    coverageChecked: false,
    matchMode: "EXACT",
    valueStyle: "CODE",
    numeric: true,
    unit: "AED",
    numericOptions: [1000, 3000, 5000, 10000, 25000, 50000, 100000],
    // Authorisation work carries no money, so it is never offered there.
    appliesToTypes: [
      "CLAIM_VALIDATION",
      "CLAIM_SUBMISSION",
      "CLAIM_RESUBMISSION",
      "RECONCILIATION",
    ],
    sortOrder: 70,
  },
];

/** The numeric dimension a group's high-cost switch writes to. */
export const HIGH_COST_DIMENSION = "CLAIM_VALUE";

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
  /*
   * High cost used to be the third row here, as a team-wide threshold plus a
   * per-member clearance tick-box. It is a group criterion now , the
   * CLAIM_VALUE dimension above , because the business decides high cost per
   * group ("this group does the expensive resubmissions"), not per team, and
   * routing it is the matcher's job rather than a second mechanism bolted
   * beside it. `handlerTag` and the clearance plumbing stay in the contract
   * below because they are part of the published shape, but no row uses them.
   */
];

export const policyByCode = (code: string): AllocationPolicy | undefined =>
  POLICIES.find((p) => p.code === code);

/** Policies worth asking about, given the work item types a team handles. */
export const policiesFor = (types: string[]): AllocationPolicy[] =>
  POLICIES.filter((p) => types.some((t) => p.appliesToTypes.includes(t))).sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );

/**
 * The high-cost threshold on a rule, or null when it has none.
 *
 * One accessor for both halves of the switch, so nothing else has to know the
 * toggle is stored as a criterion rather than as a pair of fields.
 */
export function highCostOf(criteria: Criterion[] | undefined): number | null {
  const c = criterionFor(criteria, HIGH_COST_DIMENSION);
  if (!c || c.operator !== "GREATER_THAN") return null;
  const n = Number((c.values ?? [])[0]);
  return Number.isFinite(n) ? n : null;
}

/** Turn the switch on at an amount, or off with null. Order is preserved. */
export function withHighCost(
  criteria: Criterion[] | undefined,
  threshold: number | null,
): Criterion[] {
  const rest = (criteria ?? []).filter((c) => c.dimension !== HIGH_COST_DIMENSION);
  if (threshold == null) return rest;
  return [
    ...rest,
    { dimension: HIGH_COST_DIMENSION, operator: "GREATER_THAN", values: [String(threshold)] },
  ];
}

/** Amounts the switch may be set to, as the supervisor currently has them. */
export const highCostAmounts = (): number[] =>
  dimensionByCode(HIGH_COST_DIMENSION)?.numericOptions ?? [];

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

  if (c.operator === "GREATER_THAN") {
    // A positive claim about a number, so it needs a number: an item with no
    // value on the field cannot be shown to be over the threshold and is
    // rejected, the same asymmetry IN has against a missing value. This is
    // what keeps authorisation work, which carries no money, out of a
    // high-cost group rather than flooding it.
    const n = Number(raw);
    const threshold = Number((c.values ?? [])[0]);
    if (!present || !Number.isFinite(n) || !Number.isFinite(threshold)) return false;
    return n > threshold;
  }

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
    // GREATER_THAN carries one value and so scores a full 100, which is the
    // answer we want anyway: a group that is "cardiology and over AED 10,000"
    // must beat the plain cardiology group for the expensive claim.
    narrowness += c.operator === "NOT_IN" ? 1 : Math.floor(100 / c.values.length);
  }
  return constrained * 1000 + narrowness;
}

/**
 * A rule's identity, independent of the order its clauses were written in.
 *
 * Two groups with the same signature route identically, which on its own is
 * allowed , two shifts covering the same work is a normal thing to configure.
 * It only becomes a fault when the same PERSON sits in both, because then the
 * narrowest-wins tie-break is picking between two pools that are partly the
 * same pool, and that person's share of the work doubles for no stated reason.
 * See `duplicateRuleConflicts`.
 */
export function criteriaSignature(criteria: Criterion[] | undefined): string {
  return [...(criteria ?? [])]
    .filter((c) => c.operator === "ANY" || (c.values ?? []).length)
    .map((c) => {
      const dim = dimensionByCode(c.dimension);
      const vals = [...(c.values ?? [])].map((v) => keyFor(dim, v)).sort();
      return `${c.dimension}:${c.operator}:${vals.join(",")}`;
    })
    .sort()
    .join("|");
}

/** One group whose rule is identical to another's, and the people in both. */
export interface DuplicateRuleConflict {
  signature: string;
  /** Ids of every group sharing the rule, in the order given. */
  groupIds: string[];
  groupNames: string[];
  /** The people who are in more than one of them. This is the actual fault. */
  members: { id: string; name: string; groupNames: string[] }[];
}

/**
 * Groups that route identically AND share a member.
 *
 * Deliberately narrower than "these two overlap". Partial overlap is how
 * narrowest-wins is meant to be used, and flagging it put an amber line on
 * most cards in the estate, which is the same as flagging nothing. An exact
 * duplicate with a shared member is specific, rare, and always a mistake
 * worth naming the person for.
 */
export function duplicateRuleConflicts(
  groups: {
    id: string;
    name: string;
    active?: boolean;
    criteria?: Criterion[];
    members?: { id: string; firstName?: string | null; lastName?: string | null }[];
  }[],
  teamCriteria?: Criterion[],
  /**
   * Who supervises this team. They sit in every group deliberately, so
   * counting them would fire this on every team that has one. A list rather
   * than a flag on the person, because supervising is per team.
   */
  supervisorIds: string[] = [],
): DuplicateRuleConflict[] {
  const supervises = new Set(supervisorIds.map(String));
  const bySignature = new Map<string, typeof groups>();
  for (const g of groups) {
    if (g.active === false) continue;
    const sig = criteriaSignature(mergeCriteria(teamCriteria ?? [], g.criteria ?? []));
    bySignature.set(sig, [...(bySignature.get(sig) ?? []), g]);
  }

  const out: DuplicateRuleConflict[] = [];
  for (const [signature, sharing] of bySignature) {
    if (sharing.length < 2) continue;
    const seen = new Map<string, { id: string; name: string; groupNames: string[] }>();
    for (const g of sharing) {
      for (const m of g.members ?? []) {
        // A supervisor is added to every group on purpose, so they are in both
        // of any pair by construction. Naming them here would fire on every
        // team that has one and say nothing about the duplicate.
        if (supervises.has(String(m.id))) continue;
        const name = [m.firstName, m.lastName].filter(Boolean).join(" ") || String(m.id);
        const cur = seen.get(String(m.id)) ?? { id: String(m.id), name, groupNames: [] };
        cur.groupNames.push(g.name);
        seen.set(String(m.id), cur);
      }
    }
    const members = [...seen.values()].filter((m) => m.groupNames.length > 1);
    if (!members.length) continue;
    out.push({
      signature,
      groupIds: sharing.map((g) => g.id),
      groupNames: sharing.map((g) => g.name),
      members,
    });
  }
  return out;
}

/**
 * A group inherits its team's rule and narrows it. Same dimension on both, the
 * group wins , which is what lets a team say "OP" and a group say nothing ,
 * unless the team locked that dimension, in which case the team wins and the
 * group's clause is ignored.
 *
 * Ignoring rather than erroring is deliberate: locking a dimension after groups
 * were already configured on it must not leave a team that allocates nothing
 * until someone goes and clears every group by hand. `overridesLocked` reports
 * the stale clauses so the UI can offer to drop them.
 */
export function mergeCriteria(team: Criterion[] = [], group: Criterion[] = []): Criterion[] {
  const locked = new Set(lockedDimensions(team));
  const out = new Map<string, Criterion>();
  for (const c of team) out.set(c.dimension, c);
  for (const c of group) if (!locked.has(c.dimension)) out.set(c.dimension, c);
  return [...out.values()];
}

/**
 * Does the group stay inside its team's rule? A group may only narrow, which is
 * the invariant that replaces the old fixed team/group hierarchy.
 *
 * Locked dimensions are not checked here. The group has no say on those, so a
 * clause left over on one is stale rather than wrong; `overridesLocked` has it.
 */
export function widensBeyond(team: Criterion[] = [], group: Criterion[] = []): string[] {
  const locked = new Set(lockedDimensions(team));
  const broken: string[] = [];
  for (const g of group) {
    if (locked.has(g.dimension)) continue;
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

/**
 * Dimensions a group may constrain, given its team's rule: everything its team
 * has not locked.
 *
 * The registry's `level` deliberately plays no part. It governs what a TEAM may
 * filter on and nothing else; on the group side the only thing that withholds a
 * dimension is the team having locked it. Anything weaker reintroduces the
 * problem locking exists to solve , a team that says nothing about facility and
 * whose groups then cannot route by facility either, so the dimension is simply
 * unreachable and the work goes wherever.
 *
 * So: locked, the team decided it. Unlocked, the group picks from the team's
 * values. Absent, the group picks from everything.
 */
export function groupEditableDimensions(
  dims: { code: string; level: CriterionLevel }[],
  teamCriteria: Criterion[] | undefined,
): string[] {
  return dims
    .filter((d) => filterModeOf(teamCriteria, d.code) !== "LOCKED")
    .map((d) => d.code);
}

/** Values of a dimension a rule admits, given the universe available. */
export function admittedValues(
  criteria: Criterion[] | undefined,
  code: string,
  universe: string[],
): string[] {
  const c = criterionFor(criteria, code);
  // A numeric clause narrows the items, not the value list, so it leaves the
  // universe whole. Coverage over a dimension nobody enumerates is meaningless.
  if (!c || c.operator === "ANY" || c.operator === "GREATER_THAN") return [...universe];
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
      if (c.operator === "GREATER_THAN") {
        return `${label}: over ${Number(c.values[0]).toLocaleString()}${dim?.unit ? ` ${dim.unit}` : ""}`;
      }
      const head = c.values.slice(0, 2).map((v) => prettyValue(v, dim)).join(", ");
      const rest = c.values.length > 2 ? ` +${c.values.length - 2}` : "";
      return `${c.operator === "NOT_IN" ? "Not " : ""}${label}: ${head}${rest}`;
    });
}
