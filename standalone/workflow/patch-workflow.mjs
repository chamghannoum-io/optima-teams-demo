/**
 * Writes the Code node sources in workflow/*.js back into the workflow JSON.
 *
 * Editing a 28 KB JSON blob by hand is how the encounterMapping regression got
 * in last time, so the node bodies live as real files that can be linted, and
 * this is the only thing that touches the JSON.
 *
 *   node workflow/patch-workflow.mjs [--check]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const WF = path.join(here, '..', '..', 'docs', 'RCM Auto-Assignment v2.json');

/** file in workflow/ -> node name in the workflow */
const NODES = {
  'match-groups.js': 'Match Groups',
  'distribute.js': 'Distribute',
};

const check = process.argv.includes('--check');
const wf = JSON.parse(fs.readFileSync(WF, 'utf8'));
let changed = 0;

for (const [file, nodeName] of Object.entries(NODES)) {
  const node = wf.nodes.find((n) => n.name === nodeName);
  if (!node) throw new Error(`node not found in workflow: ${nodeName}`);
  const src = fs.readFileSync(path.join(here, file), 'utf8');
  if (node.parameters.jsCode === src) {
    console.log(`  = ${nodeName} (unchanged)`);
    continue;
  }
  if (check) {
    console.log(`  ! ${nodeName} DIFFERS from ${file}`);
    changed += 1;
    continue;
  }
  node.parameters.jsCode = src;
  console.log(`  > ${nodeName} <- ${file} (${src.length} bytes)`);
  changed += 1;
}

if (check) {
  console.log(changed ? `\n${changed} node(s) out of sync` : '\nworkflow is in sync');
  process.exit(changed ? 1 : 0);
}

if (changed) {
  // Match the file as n8n exports it: one-space indent, CRLF, no trailing
  // newline. Otherwise a one-node edit reformats all 1,586 lines and the diff
  // is unreviewable.
  fs.writeFileSync(WF, JSON.stringify(wf, null, 1).replace(/\n/g, '\r\n'));
  console.log(`\nwrote ${path.basename(WF)}`);
} else {
  console.log('\nnothing to write');
}
