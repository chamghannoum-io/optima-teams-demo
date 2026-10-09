// v3 matching: routing rules are criteria, not hardcoded axes.
//
// A group accepts an item when every criterion on its effective rule admits it.
// When several accept, the NARROWEST wins, scored by how few values each
// dimension admits. See CRITERIA-CONTRACT.md for the normative semantics; the
// functions below mirror allocation-model.ts and must agree with it row for row.
//
// Dual input by design. Groups carrying `criteria` use them directly; groups
// still in the v2 shape (workItemTypes/departments/payers/...) are adapted into
// criteria first, so this node runs against today's T-0002 and against the
// updated gateway component without a flag day.

/* ── registry ──────────────────────────────────────────────────────────────
   Defaults mirror DIMENSIONS in allocation-model.ts. When T-0002 starts
   returning allocationDimensions, the payload wins and this becomes a
   fallback, which is what makes a new axis a row rather than an edit. */
/**
 * Aliases, normalised on both sides, carried by the dimension rather than by
 * the matcher. Derived from v1's 42-entry deptTagMap: 30 of those entries are
 * pure punctuation and case, which normalisation already handles, leaving
 * these 12 genuine synonyms. Dropping them was a silent regression from v1,
 * because normalisation cannot unify a misspelling with its correct spelling.
 *
 * "dermatology" maps to the misspelled "dermatalogy" deliberately: that is the
 * spelling the production team tags use, so it is the canonical one.
 */
const DEPARTMENT_ALIASES = {
  cardiologyservices: 'cardiology',
  dermatology: 'dermatalogy',
  nutrition: 'dieticiannutrition',
  dietician: 'dieticiannutrition',
  gihconcology: 'oncology',
  hematology: 'oncology',
  intensivecareuniticu: 'icu',
  dramrelshawarbineurosurgerycenter: 'neurosurgery',
  obstetricsgynaeivf: 'obstetricsgyneivf',
  optics: 'optimetry',
  pediatrics: 'pediatricsneonatology',
  podiatrics: 'podiatry',
};

/**
 * Facility aliases. A work item carries a health licence and one facility can
 * hold several, so every licence resolves onto the facility's name, which is
 * what a team's rule stores. The old three-letter site codes are here too, so
 * a team configured before the real list landed still matches.
 *
 * Generated from src/mocks/facilities.ts; registry-parity.test.mjs fails if
 * the two drift.
 */
const FACILITY_ALIASES = {
  '6927': 'sghsharjah',
  '7510': 'sghajman',
  dhaf0046775: 'saudigermanhospital',
  dxb: 'saudigermanhospital',
  mohf1000464: 'sghajman',
  ajm: 'sghajman',
  hf2026000943: 'sghsharjah',
  mohf1000150: 'sghsharjah',
  shj: 'sghsharjah',
  dhaf3518383: 'saudigermanclinicsjumeirah',
  dhaf7809244: 'saudigermanclinicsdamachills',
  dhaf0101003: 'saudigermanclinicsakoya',
  dhaf1988803: 'saudigermanclinicssouthvillage',
  dhaf7137145: 'saudigermanclinicssportscity',
  hf2026001388: 'alsuyoh',
  mohf1000908: 'alsuyoh',
  mohap1001672025: 'rakclinic',
  mohf1000945: 'rakclinic',
  rak: 'rakclinic',
};

const DEFAULT_DIMENSIONS = [
  { code: 'FACILITY',       itemField: 'facilityId',     matchMode: 'NORMALISED', sortOrder: 10,
    aliases: FACILITY_ALIASES },
  { code: 'WORK_ITEM_TYPE', itemField: 'workItemType',   matchMode: 'EXACT',      sortOrder: 20 },
  { code: 'ENCOUNTER_TYPE', itemField: 'encounterType',  matchMode: 'EXACT',      sortOrder: 30 },
  { code: 'DEPARTMENT',     itemField: 'department',     matchMode: 'NORMALISED', sortOrder: 40,
    aliases: DEPARTMENT_ALIASES },
  { code: 'PAYER',          itemField: 'payer',          matchMode: 'EXACT',      sortOrder: 50 },
  { code: 'CLAIM_STATUS',   itemField: 'claimStatus',    matchMode: 'EXACT',      sortOrder: 60 },
  // High cost. A group with this clause takes only the claims above its
  // amount, which is why it needs no handler tag and no second mechanism.
  { code: 'CLAIM_VALUE',    itemField: 'net',            matchMode: 'EXACT',      sortOrder: 70 },
];

/**
 * Read a tool's response from whichever branch actually ran.
 *
 * Every tool step is gated: with `fixtures` in the body the FX node runs and
 * the HTTP node does not, and referencing a node that did not execute returns
 * null or throws. Naming only the HTTP node meant fixture mode failed on the
 * first Code node that needed a tool response.
 */
const toolData = (live, fx) => {
  for (const name of [live, fx]) {
    try {
      const v = $(name)?.first?.();
      if (v && v.json) return v.json;
    } catch {
      // n8n throws when the node did not run on this branch; try the other.
    }
  }
  return {};
};

const ranked = $('Rank Items').first().json.items;
const raw = toolData('Step 1 - Get Teams', 'FX Step 1 - Get Teams');
const teams = raw.data?.optimaTeams ?? raw.optimaTeams ?? [];
const servedDimensions = raw.data?.allocationDimensions ?? raw.allocationDimensions;

/** GraphQL serves aliases as {from,to} rows; the matcher indexes a map. */
const asAliasMap = (a) =>
  Array.isArray(a) ? Object.fromEntries(a.map((r) => [r.from, r.to])) : (a ?? {});

const dimensions = (servedDimensions ?? DEFAULT_DIMENSIONS).map((d) => ({
  ...d,
  aliases: asAliasMap(d.aliases),
}));
const dimByCode = Object.fromEntries(dimensions.map((d) => [d.code, d]));

/* ── matcher, ported from allocation-model.ts ──────────────────────────── */

/** Lowercase alphanumerics. "E. N. T.", "e.n.t" and "ENT" all agree. */
const normKey = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Normalised comparison also drops a leading dimension-code prefix, because
 * three spellings of the same department are all live right now: v1 team tags
 * say "department-emergency", the v2 fixtures say "dental-and-maxillofacial",
 * and the work queue says "Emergency". Stripping the prefix makes all three
 * agree instead of forcing a data migration before anything matches.
 * Only stripped when something is left over, so a department actually named
 * after its dimension does not normalise away to nothing.
 */
function normValue(dim, v) {
  const k = normKey(v);
  const prefix = normKey(dim?.code);
  const stripped = prefix && k.startsWith(prefix) && k.length > prefix.length ? k.slice(prefix.length) : k;
  // Synonyms last, so an alias written either with or without the prefix
  // resolves the same way.
  return dim?.aliases?.[stripped] ?? stripped;
}

const keyFor = (dim, v) => (dim?.matchMode === 'NORMALISED' ? normValue(dim, v) : String(v ?? ''));

/**
 * Does one criterion admit this item?
 *
 * The asymmetry on a missing value is deliberate and is the one place this
 * differs from the v2 node: IN is a positive claim and needs evidence, so a
 * missing value rejects; NOT_IN is an exclusion and absence cannot prove
 * membership, so a missing value passes.
 */
function criterionAccepts(c, item) {
  if (c.operator === 'ANY') return true;
  const dim = dimByCode[c.dimension];
  if (!dim) return true;
  const rawVal = item[dim.itemField];
  const present = rawVal != null && String(rawVal) !== '';

  // GREATER_THAN is a positive claim about a number, so it follows IN: no
  // number on the item means it cannot be shown to be over the threshold.
  // That is what keeps authorisation work, which carries no net value, out
  // of a high-cost group instead of flooding it.
  if (c.operator === 'GREATER_THAN') {
    const n = Number(rawVal);
    const threshold = Number((c.values ?? [])[0]);
    if (!present || !Number.isFinite(n) || !Number.isFinite(threshold)) return false;
    return n > threshold;
  }

  const set = new Set((c.values ?? []).map((v) => keyFor(dim, v)));

  if (c.operator === 'NOT_IN') return !present || !set.has(keyFor(dim, rawVal));
  if (!present) return false;
  return set.has(keyFor(dim, rawVal));
}

const criteriaAccept = (criteria, item) => (criteria ?? []).every((c) => criterionAccepts(c, item));

/** The first criterion that rejects, so "why was this not allocated" is answerable. */
function rejectingCriterion(criteria, item) {
  for (const c of criteria ?? []) if (!criterionAccepts(c, item)) return c;
  return null;
}

/**
 * How narrow a rule is. Constraining more dimensions always beats constraining
 * fewer, so the count leads; within that, naming one value beats naming six.
 */
function specificityOf(criteria) {
  let constrained = 0;
  let narrowness = 0;
  for (const c of criteria ?? []) {
    if (c.operator === 'ANY' || !(c.values ?? []).length) continue;
    constrained += 1;
    // GREATER_THAN carries one value and so scores a full 100, which is what
    // sends an expensive claim to the high-cost group over the general one.
    narrowness += c.operator === 'NOT_IN' ? 1 : Math.floor(100 / c.values.length);
  }
  return constrained * 1000 + narrowness;
}

/**
 * A group inherits its team's rule and narrows it. Same dimension, group wins,
 * unless the team locked that dimension: a locked criterion applies to every
 * group as written and the group's own clause on it is ignored.
 *
 * Ignored rather than treated as a non-match, so locking a dimension on a team
 * whose groups were already configured on it narrows the run instead of
 * emptying it.
 */
function mergeCriteria(team = [], group = []) {
  const locked = new Set(team.filter((c) => c.locked).map((c) => c.dimension));
  const out = new Map();
  for (const c of team) out.set(c.dimension, c);
  for (const c of group) if (!locked.has(c.dimension)) out.set(c.dimension, c);
  return [...out.values()];
}

/* ── v2 shape adapter ──────────────────────────────────────────────────────
   Turns the legacy named fields into criteria so there is exactly one matcher
   rather than two code paths. Drops out entirely once T-0002 returns criteria. */
function criteriaFromLegacy(team, g) {
  const out = [];
  const push = (dimension, operator, values) => out.push({ dimension, operator, values });

  if ((g.workItemTypes ?? []).length) push('WORK_ITEM_TYPE', 'IN', g.workItemTypes);

  const scope = g.encounterScope ?? team.encounterScope;
  if (scope && scope !== 'BOTH') push('ENCOUNTER_TYPE', 'IN', [scope]);

  if (team.logicAxis === 'PAYER') {
    if (g.payerCatchAll) push('PAYER', 'ANY', []);
    else if ((g.payers ?? []).length) push('PAYER', 'IN', g.payers.map(String));
  } else if ((g.departments ?? []).length) {
    push('DEPARTMENT', 'IN', g.departments);
  }

  if ((g.claimStatuses ?? []).length) push('CLAIM_STATUS', 'IN', g.claimStatuses);
  return out;
}

/** The rule the matcher actually runs for this group. */
function effectiveCriteriaOf(team, g) {
  if ((g.effectiveCriteria ?? []).length) return g.effectiveCriteria;
  if ((g.criteria ?? []).length || (team.criteria ?? []).length) {
    return mergeCriteria(team.criteria, g.criteria);
  }
  return criteriaFromLegacy(team, g);
}

/**
 * Facility gate. A branch may carry several health licences since OPTIMA-4657,
 * so this is a membership test over a list, not an equality check.
 */
function servesFacility(team, item) {
  const branches = team.branches ?? [];
  if (!branches.length) return true;
  return branches.some((b) => {
    const licences = b.healthLicenses ?? (b.healthLicense != null ? [b.healthLicense] : []);
    return licences.some((l) => String(l) === String(item.facilityId));
  }) || String(team.branchId ?? '') === String(item.branchId);
}

/**
 * Members who can actually be given work tonight.
 *
 * Somebody on leave is still a member of the group, so they come back from
 * T-0002; they just cannot take anything. Filtering here rather than in
 * Distribute keeps them out of `userIds` too, so T-0003 and T-004 are not
 * asked for the capacity of people who are away.
 *
 * Absent field means available: an older T-0002 that does not select
 * unavailableToday must not silently empty every pool.
 */
const availableMembers = (g) =>
  (g.members ?? []).filter((m) => m.unavailableToday !== true);

/* ── match ─────────────────────────────────────────────────────────────── */

const assignments = [];
const unmatched = [];
const memberIds = new Set();

for (const item of ranked) {
  const candidates = [];
  let nearest = null;

  for (const t of teams) {
    if (!servesFacility(t, item)) continue;
    for (const g of t.groups ?? []) {
      if (g.active === false) continue;
      const eff = effectiveCriteriaOf(t, g);
      if (criteriaAccept(eff, item)) {
        candidates.push({ team: t, group: g, eff, spec: specificityOf(eff) });
      } else if (!nearest) {
        const c = rejectingCriterion(eff, item);
        nearest = { group: g.name, dimension: c?.dimension ?? null };
      }
    }
  }

  if (!candidates.length) {
    unmatched.push({
      id: item.id,
      workItemType: item.workItemType,
      department: item.department,
      payer: item.payer,
      reason: nearest
        ? `No group accepts this item (nearest '${nearest.group}' rejected on ${nearest.dimension})`
        : 'No group accepts this item',
      rejectedOn: nearest?.dimension ?? null,
    });
    continue;
  }

  // Narrowest wins. Ties resolve on group id so a rerun of the same input
  // allocates the same way; array order is insertion order and is not stable.
  candidates.sort((a, b) => b.spec - a.spec || String(a.group.id).localeCompare(String(b.group.id)));
  const best = candidates[0];
  const members = availableMembers(best.group).map((m) => String(m.id ?? m.userId));
  members.forEach((m) => memberIds.add(m));

  assignments.push({
    ...item,
    teamId: best.team.id,
    teamName: best.team.name,
    groupId: best.group.id,
    groupName: best.group.name,
    groupMembers: members,
    // Total roster vs who can actually take work today. Distribute needs both
    // to tell "nobody is in this group" from "everybody in it is on leave",
    // which send a supervisor to two different places.
    groupRoster: (best.group.members ?? []).length,
    // Capacity rides with the team that won, because it is the team's own
    // setting. Per-member overrides come along on the member rows.
    capacityRules: best.team.capacities ?? [],
    uniformCapacity: best.team.uniformCapacity !== false,
    memberCaps: Object.fromEntries(
      availableMembers(best.group).map((m) => [
        String(m.id ?? m.userId),
        m.capacityOverride ?? null,
      ]),
    ),
    // Every group that accepted, narrowest first, so Distribute can fall
    // through to the next one when the winner has no capacity left.
    groupFallbacks: candidates.slice(1).map((c) => {
      const ids = availableMembers(c.group).map((m) => String(m.id ?? m.userId));
      // Fallback members need capacity fetched too, or Distribute reads them
      // as zero and the fallback can never fire.
      ids.forEach((m) => memberIds.add(m));
      return { groupId: c.group.id, groupName: c.group.name, teamId: c.team.id, members: ids };
    }),
  });
}

return [{
  json: {
    assignments,
    unmatched,
    userIds: [...memberIds],
    teamId: assignments[0]?.teamId ?? null,
    workItemTypes: [...new Set(assignments.map((a) => a.workItemType))],
  },
}];
