/**
 * The app's matcher and the workflow's must agree, row for row.
 *
 * There are two implementations of the same rules on purpose: the workflow
 * cannot import from src/, and the app cannot run an n8n Code node. The
 * contract says they agree; this is what makes that true rather than intended.
 * A divergence here means the Review screen promises one allocation and the
 * nightly run does another, which is the worst failure this system has.
 *
 *   node workflow/matcher-parity.test.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');

/* the app's matcher */
const outfile = path.join(root, '.matcher-parity-bundle.mjs');
await build({
  entryPoints: [path.join(root, 'src/mocks/allocation-model.ts')],
  bundle: true, format: 'esm', platform: 'node', outfile, logLevel: 'silent',
});
const app = await import(`${new URL(`file://${outfile.replace(/\\/g, '/')}`)}?t=${Date.now()}`);

/* the workflow's matcher */
const src = fs.readFileSync(path.join(here, 'match-groups.js'), 'utf8');
const wf = new Function(
  '$',
  `${src.replace(/^return \[\{[\s\S]*$/m, '')}
   return { criterionAccepts, specificityOf };`
)(() => ({ first: () => ({ json: { items: [] } }) }));

const D = (dimension, operator, values = []) => ({ dimension, operator, values });

/* Every row is (criterion, item). Both implementations must return the same
   verdict; what that verdict is belongs to match-groups.test.mjs. */
const CASES = [
  [D('CLAIM_STATUS', 'IN', ['OPEN']), { claimStatus: 'OPEN' }],
  [D('CLAIM_STATUS', 'IN', ['OPEN']), { claimStatus: 'VALIDATED' }],
  [D('CLAIM_STATUS', 'IN', ['OPEN']), {}],
  [D('CLAIM_STATUS', 'IN', ['OPEN']), { claimStatus: '' }],
  [D('CLAIM_STATUS', 'IN', ['OPEN']), { claimStatus: null }],
  [D('CLAIM_STATUS', 'NOT_IN', ['OPEN']), { claimStatus: 'OPEN' }],
  [D('CLAIM_STATUS', 'NOT_IN', ['OPEN']), { claimStatus: 'VALIDATED' }],
  [D('CLAIM_STATUS', 'NOT_IN', ['OPEN']), {}],
  [D('CLAIM_STATUS', 'ANY'), { claimStatus: 'ANYTHING' }],
  [D('CLAIM_STATUS', 'ANY'), {}],
  [D('ENCOUNTER_TYPE', 'IN', ['OP']), { encounterType: 'OP' }],
  [D('ENCOUNTER_TYPE', 'IN', ['OP']), { encounterType: 'IP' }],
  [D('ENCOUNTER_TYPE', 'IN', ['OP']), { encounterType: null }],
  [D('DEPARTMENT', 'IN', ['cardiology']), { department: 'Cardiology Services' }],
  [D('DEPARTMENT', 'IN', ['cardiology']), { department: 'Cardiology' }],
  [D('DEPARTMENT', 'IN', ['cardiology']), { department: 'department-cardiology' }],
  [D('DEPARTMENT', 'IN', ['cardiology']), { department: 'Urology' }],
  [D('DEPARTMENT', 'IN', ['dermatalogy']), { department: 'Dermatology' }],
  [D('DEPARTMENT', 'IN', ['icu']), { department: 'Intensive Care Unit - ICU' }],
  [D('DEPARTMENT', 'IN', ['oncology']), { department: 'Oncology/ Hematology' }],
  [D('DEPARTMENT', 'IN', ['E. N. T.']), { department: 'ent' }],
  [D('DEPARTMENT', 'NOT_IN', ['cardiology']), { department: 'Cardiology Services' }],
  [D('DEPARTMENT', 'IN', ['emergency']), { department: 'Emergency' }],
  [D('PAYER', 'IN', ['INS012']), { payer: 'INS012' }],
  [D('PAYER', 'IN', ['INS012']), { payer: 'ins012' }],
  [D('PAYER', 'IN', ['INS012']), { payer: null }],
  [D('WORK_ITEM_TYPE', 'IN', ['CLAIM_SUBMISSION']), { workItemType: 'CLAIM_SUBMISSION' }],
  [D('WORK_ITEM_TYPE', 'IN', ['CLAIM_SUBMISSION']), { workItemType: 'RECONCILIATION' }],
];

const RULES = [
  [D('DEPARTMENT', 'IN', ['ENT'])],
  [D('DEPARTMENT', 'IN', ['a', 'b', 'c', 'd', 'e', 'f'])],
  [D('DEPARTMENT', 'IN', ['ENT']), D('WORK_ITEM_TYPE', 'IN', ['CLAIM_SUBMISSION'])],
  [D('PAYER', 'ANY')],
  [D('PAYER', 'NOT_IN', ['INS012'])],
  [D('DEPARTMENT', 'IN', [])],
  [],
];

let pass = 0;
let fail = 0;

console.log('criterionAccepts');
for (const [c, item] of CASES) {
  const a = app.criterionAccepts(c, item);
  const b = wf.criterionAccepts(c, item);
  if (a === b) pass += 1;
  else {
    fail += 1;
    console.log(`  DIVERGES  ${c.dimension} ${c.operator} [${c.values}] vs ${JSON.stringify(item)}`);
    console.log(`            app ${a}, workflow ${b}`);
  }
}

console.log('specificityOf');
for (const r of RULES) {
  const a = app.specificityOf(r);
  const b = wf.specificityOf(r);
  if (a === b) pass += 1;
  else {
    fail += 1;
    console.log(`  DIVERGES  ${JSON.stringify(r)}\n            app ${a}, workflow ${b}`);
  }
}

fs.rmSync(outfile, { force: true });
console.log(`\n${pass} agreed, ${fail} diverged`);
process.exit(fail ? 1 : 0);
