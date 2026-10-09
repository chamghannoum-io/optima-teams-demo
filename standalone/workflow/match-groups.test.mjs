/**
 * The matching semantics in CRITERIA-CONTRACT.md, as executable rows.
 *
 * The production replay cannot cover these: its 541 items have zero unmapped
 * encounters and no group constrains claim status, so the missing-value paths
 * are never reached. They are exactly the paths that changed, hence this.
 *
 *   node workflow/match-groups.test.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(here, 'match-groups.js'), 'utf8');

/* Lift the pure helpers out of the node body. It has no exports because n8n
   Code nodes cannot have any, so the test evaluates the source with the n8n
   globals stubbed and reaches in for the functions. */
const harness = new Function(
  '$',
  `${src.replace(/^return \[\{[\s\S]*$/m, '')}
   return { criterionAccepts, criteriaAccept, specificityOf, mergeCriteria, criteriaFromLegacy, servesFacility, normKey, normValue, availableMembers };`
);
const stub$ = () => ({ first: () => ({ json: { items: [] } }) });
const M = harness(stub$);

let pass = 0;
let fail = 0;
const check = (name, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) pass += 1;
  else {
    fail += 1;
    console.log(`  FAIL  ${name}\n        expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
};

/* ── the contract's semantics table ────────────────────────────────────── */
console.log('matching semantics');

const IN = { dimension: 'CLAIM_STATUS', operator: 'IN', values: ['OPEN', 'CHECKED'] };
const NOT_IN = { dimension: 'CLAIM_STATUS', operator: 'NOT_IN', values: ['OPEN'] };
const ANY = { dimension: 'CLAIM_STATUS', operator: 'ANY', values: [] };

check('ANY accepts anything', M.criterionAccepts(ANY, { claimStatus: 'WHATEVER' }), true);
check('ANY accepts a missing value', M.criterionAccepts(ANY, {}), true);
check('IN accepts a listed value', M.criterionAccepts(IN, { claimStatus: 'OPEN' }), true);
check('IN rejects an unlisted value', M.criterionAccepts(IN, { claimStatus: 'VALIDATED' }), false);
check('IN rejects a missing value', M.criterionAccepts(IN, {}), false);
check('IN rejects an empty value', M.criterionAccepts(IN, { claimStatus: '' }), false);
check('NOT_IN rejects a listed value', M.criterionAccepts(NOT_IN, { claimStatus: 'OPEN' }), false);
check('NOT_IN accepts an unlisted value', M.criterionAccepts(NOT_IN, { claimStatus: 'VALIDATED' }), true);
check('NOT_IN accepts a missing value', M.criterionAccepts(NOT_IN, {}), true);
check('an absent criterion is unconstrained', M.criteriaAccept([], { anything: 1 }), true);
check('criteria AND together', M.criteriaAccept(
  [{ dimension: 'WORK_ITEM_TYPE', operator: 'IN', values: ['CLAIM_SUBMISSION'] }, IN],
  { workItemType: 'CLAIM_SUBMISSION', claimStatus: 'VALIDATED' },
), false);

/* ── normalisation ─────────────────────────────────────────────────────── */
console.log('normalisation');

const DEPT = { dimension: 'DEPARTMENT', operator: 'IN', values: ['department-emergency'] };
check('normalised match ignores punctuation and case',
  M.criterionAccepts({ ...DEPT, values: ['E. N. T.'] }, { department: 'ent' }), true);
check('the real queue-vs-config spelling matches',
  M.criterionAccepts(DEPT, { department: 'Emergency' }), true);
check('all three live department spellings agree',
  [M.normValue({code:'DEPARTMENT',matchMode:'NORMALISED'},'department-emergency'),
   M.normValue({code:'DEPARTMENT',matchMode:'NORMALISED'},'Emergency')].join('|'), 'emergency|emergency');
check('a genuinely different department still rejects',
  M.criterionAccepts(DEPT, { department: 'Cardiology' }), false);
check('exact dimensions do not normalise',
  M.criterionAccepts({ dimension: 'PAYER', operator: 'IN', values: ['INS-012'] }, { payer: 'ins012' }), false);

/* ── aliases, the v1 deptTagMap regression ─────────────────────────────── */
console.log('aliases');

const D = { code: 'DEPARTMENT', matchMode: 'NORMALISED', aliases: {
  cardiologyservices: 'cardiology', dermatology: 'dermatalogy', hematology: 'oncology',
  intensivecareuniticu: 'icu', pediatrics: 'pediatricsneonatology' } };
const CARD = { dimension: 'DEPARTMENT', operator: 'IN', values: ['cardiology'] };

check('a synonym resolves to its canonical department',
  M.normValue(D, 'Cardiology Services'), 'cardiology');
check('a misspelling resolves, which normalisation alone cannot do',
  M.normValue(D, 'Dermatology'), 'dermatalogy');
check('the canonical misspelling stays put',
  M.normValue(D, 'dermatalogy'), 'dermatalogy');
check('aliases apply after the prefix is stripped',
  M.normValue(D, 'department-Cardiology Services'), 'cardiology');
check('an alias and its canonical form match the same criterion',
  [M.criterionAccepts(CARD, { department: 'Cardiology Services' }),
   M.criterionAccepts(CARD, { department: 'Cardiology' })], [true, true]);
check('a non-alias department is untouched',
  M.normValue(D, 'Urology'), 'urology');
check('the real 15-item production case matches',
  M.criterionAccepts(CARD, { department: 'Cardiology Services' }), true);

/* ── specificity ───────────────────────────────────────────────────────── */
console.log('specificity');

const spec = M.specificityOf;
const oneDept = [{ dimension: 'DEPARTMENT', operator: 'IN', values: ['ENT'] }];
const sixDepts = [{ dimension: 'DEPARTMENT', operator: 'IN', values: ['a', 'b', 'c', 'd', 'e', 'f'] }];
const twoDims = [...oneDept, { dimension: 'WORK_ITEM_TYPE', operator: 'IN', values: ['CLAIM_SUBMISSION'] }];

check('naming one value beats naming six', spec(oneDept) > spec(sixDepts), true);
check('constraining two dimensions beats one, however narrow',
  spec(twoDims) > spec(oneDept), true);
check('ANY does not count as constrained', spec([ANY]), 0);
check('an empty value list does not count as constrained',
  spec([{ dimension: 'DEPARTMENT', operator: 'IN', values: [] }]), 0);
check('NOT_IN barely narrows', spec([NOT_IN]) < spec(oneDept), true);
check('a broad group never outranks a narrow one on value count alone',
  spec(sixDepts) < spec(oneDept), true);

/* ── high cost ─────────────────────────────────────────────────────────── */
console.log('high cost');

const OVER = { dimension: 'ITEM_VALUE', operator: 'GREATER_THAN', values: ['5000'] };

check('over the amount is admitted', M.criterionAccepts(OVER, { net: 7400 }), true);
check('under it is not', M.criterionAccepts(OVER, { net: 1200 }), false);
check('exactly it is not', M.criterionAccepts(OVER, { net: 5000 }), false);
// An item whose value never arrived falls to a group not filtering on value
// rather than counting as cheap, the same asymmetry IN has.
check('a missing value is not admitted', M.criterionAccepts(OVER, {}), false);
check('a null value is not admitted', M.criterionAccepts(OVER, { net: null }), false);
check('a numeric string still compares', M.criterionAccepts(OVER, { net: '7400' }), true);
// This is the whole point of storing it as a criterion rather than a flag.
check('a high-cost group outranks the plain one',
  spec([...oneDept, OVER]) > spec(oneDept), true);

/* ── team to group merge ───────────────────────────────────────────────── */
console.log('narrowing');

const team = [{ dimension: 'ENCOUNTER_TYPE', operator: 'IN', values: ['OP'] }];
const group = [{ dimension: 'DEPARTMENT', operator: 'IN', values: ['ENT'] }];
check('a group inherits its team rule', M.mergeCriteria(team, group).length, 2);
check('the group wins on a shared dimension',
  M.mergeCriteria(team, [{ dimension: 'ENCOUNTER_TYPE', operator: 'IN', values: ['IP'] }])[0].values, ['IP']);

/* ── locked criteria ───────────────────────────────────────────────────── */
console.log('locked team criteria');

const lockedTeam = [
  { dimension: 'WORK_ITEM_TYPE', operator: 'IN', values: ['CLAIM_VALIDATION'], locked: true },
  { dimension: 'FACILITY', operator: 'IN', values: ['SGH- Ajman', 'SGH- Sharjah'], locked: false },
];
check('a locked dimension beats the group that restates it',
  M.mergeCriteria(lockedTeam, [
    { dimension: 'WORK_ITEM_TYPE', operator: 'IN', values: ['CLAIM_RESUBMISSION'] },
  ]).find((c) => c.dimension === 'WORK_ITEM_TYPE').values, ['CLAIM_VALIDATION']);
check('an unlocked dimension still lets the group narrow it',
  M.mergeCriteria(lockedTeam, [
    { dimension: 'FACILITY', operator: 'IN', values: ['SGH- Ajman'] },
  ]).find((c) => c.dimension === 'FACILITY').values, ['SGH- Ajman']);
check('a group that says nothing inherits the whole unlocked menu',
  M.mergeCriteria(lockedTeam, []).find((c) => c.dimension === 'FACILITY').values,
  ['SGH- Ajman', 'SGH- Sharjah']);
// Locking a dimension on a team whose groups already constrain it must narrow
// the run, not empty it: the team's clause applies and the group's is dropped.
check('locking never leaves a group matching nothing',
  M.criteriaAccept(
    M.mergeCriteria(lockedTeam, [
      { dimension: 'WORK_ITEM_TYPE', operator: 'IN', values: ['CLAIM_RESUBMISSION'] },
    ]),
    { workItemType: 'CLAIM_VALIDATION', facilityId: 'SGH- Ajman' },
  ), true);
check('a team with no criteria at all leaves the group rule untouched',
  M.mergeCriteria([], [{ dimension: 'PAYER', operator: 'IN', values: ['INS020'] }]).length, 1);

/* ── the v2 shape adapter ──────────────────────────────────────────────── */
console.log('v2 adapter');

const deptTeam = { logicAxis: 'DEPARTMENT', encounterScope: 'OP' };
const adapted = M.criteriaFromLegacy(deptTeam, {
  workItemTypes: ['AUTHORIZATION_SUBMISSION'], encounterScope: 'OP',
  departments: ['dental-and-maxillofacial'], payers: [], payerCatchAll: false, claimStatuses: [],
});
check('a v2 group becomes three criteria', adapted.map((c) => c.dimension),
  ['WORK_ITEM_TYPE', 'ENCOUNTER_TYPE', 'DEPARTMENT']);
check('BOTH scope adds no encounter criterion',
  M.criteriaFromLegacy(deptTeam, { workItemTypes: ['X'], encounterScope: 'BOTH', departments: ['d'] })
    .some((c) => c.dimension === 'ENCOUNTER_TYPE'), false);
check('a payer catch-all becomes ANY, not a value list',
  M.criteriaFromLegacy({ logicAxis: 'PAYER' }, { workItemTypes: ['X'], payerCatchAll: true, payers: [] })
    .find((c) => c.dimension === 'PAYER').operator, 'ANY');
check('a catch-all scores zero, so a named payer always wins',
  spec(M.criteriaFromLegacy({ logicAxis: 'PAYER' }, { payerCatchAll: true, payers: [] }))
  < spec(M.criteriaFromLegacy({ logicAxis: 'PAYER' }, { payers: ['INS012'] })), true);
check('a DEPARTMENT team ignores payers entirely',
  M.criteriaFromLegacy(deptTeam, { departments: ['d'], payers: ['INS012'] })
    .some((c) => c.dimension === 'PAYER'), false);

/* ── facility gate, OPTIMA-4657 ────────────────────────────────────────── */
console.log('facility gate');

check('a single licence still matches',
  M.servesFacility({ branches: [{ healthLicense: 'DXB' }] }, { facilityId: 'DXB' }), true);
check('a branch with several licences matches on any of them',
  M.servesFacility({ branches: [{ healthLicenses: ['DXB', 'MOH-F-1000464'] }] },
    { facilityId: 'MOH-F-1000464' }), true);
check('an unrelated facility does not match',
  M.servesFacility({ branches: [{ healthLicense: 'DXB' }] }, { facilityId: 'SHJ' }), false);
check('a team with no branches serves everything',
  M.servesFacility({ branches: [] }, { facilityId: 'ANYTHING' }), true);

/* ── member availability ──────────────────────────────────────────────── */
console.log('availability');

const M1 = { id: 'u1' };
const M2 = { id: 'u2', unavailableToday: true };
const M3 = { id: 'u3', unavailableToday: false };

check('someone away today is dropped from the pool',
  M.availableMembers({ members: [M1, M2, M3] }).map((m) => m.id), ['u1', 'u3']);
check('an absent flag means available, so an older T-0002 does not empty every pool',
  M.availableMembers({ members: [M1] }).map((m) => m.id), ['u1']);
check('a group with no members is still empty, not an error',
  M.availableMembers({}).length, 0);
check('a group where everyone is away yields nothing',
  M.availableMembers({ members: [M2, { id: 'u4', unavailableToday: true }] }).length, 0);

/* ── the regressions that bit before ───────────────────────────────────── */
console.log('known regressions');

check('an OP-only group rejects an item whose encounter never mapped',
  M.criterionAccepts({ dimension: 'ENCOUNTER_TYPE', operator: 'IN', values: ['OP'] },
    { encounterType: null }), false);
check('a status-scoped group rejects a null-status item',
  M.criterionAccepts(IN, { claimStatus: null }), false);
check('a group with no status filter still accepts a null-status item',
  M.criteriaAccept(M.criteriaFromLegacy(deptTeam,
    { workItemTypes: ['AUTHORIZATION_SUBMISSION'], encounterScope: 'OP', departments: ['ENT'], claimStatuses: [] }),
  { workItemType: 'AUTHORIZATION_SUBMISSION', encounterType: 'OP', department: 'ENT', claimStatus: null }), true);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
