/**
 * The workflow's embedded registry must agree with the one the schema serves.
 *
 * match-groups.js carries DEFAULT_DIMENSIONS so it still runs when T-0002 has
 * not been updated yet. That fallback is only safe while it matches the real
 * registry; if the two drift, the workflow routes on one set of rules and the
 * UI shows another, and nothing tells anybody. Hence this.
 *
 *   node workflow/registry-parity.test.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { graphql } from 'graphql';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');

/* the schema's registry */
const outfile = path.join(root, '.registry-bundle.mjs');
await build({
  entryPoints: [path.join(root, 'src/mocks/schema-v2.ts')],
  bundle: true, format: 'esm', platform: 'node', outfile,
  loader: { '.json': 'json' }, external: ['graphql', '@graphql-tools/schema'],
  logLevel: 'silent',
});
const { schemaV2 } = await import(`${new URL(`file://${outfile.replace(/\\/g, '/')}`)}?t=${Date.now()}`);
const res = await graphql({
  schema: schemaV2,
  source: '{ allocationDimensions { code itemField matchMode sortOrder aliases { from to } } }',
});
if (res.errors) {
  console.log('schema errors:', res.errors.map((e) => e.message).join(' | '));
  process.exit(1);
}
const served = res.data.allocationDimensions;

/* the workflow's fallback */
const src = fs.readFileSync(path.join(here, 'match-groups.js'), 'utf8');
const embedded = new Function(
  '$',
  `${src.replace(/^const ranked = [\s\S]*$/m, '')} return DEFAULT_DIMENSIONS;`
)(() => ({ first: () => ({ json: { items: [] } }) }));

let pass = 0;
let fail = 0;
const check = (name, a, b) => {
  if (JSON.stringify(a) === JSON.stringify(b)) pass += 1;
  else {
    fail += 1;
    console.log(`  FAIL  ${name}\n        schema   ${JSON.stringify(a)}\n        workflow ${JSON.stringify(b)}`);
  }
};

console.log('registry parity, schema vs workflow fallback');

check('same dimension codes, in the same order',
  served.map((d) => d.code), embedded.map((d) => d.code));

for (const s of served) {
  const e = embedded.find((d) => d.code === s.code);
  if (!e) continue;
  check(`${s.code}.itemField`, s.itemField, e.itemField);
  check(`${s.code}.matchMode`, s.matchMode, e.matchMode);
  check(`${s.code}.sortOrder`, s.sortOrder, e.sortOrder);
  check(`${s.code}.aliases`,
    Object.fromEntries(s.aliases.map((a) => [a.from, a.to])), e.aliases ?? {});
}

fs.rmSync(outfile, { force: true });
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
