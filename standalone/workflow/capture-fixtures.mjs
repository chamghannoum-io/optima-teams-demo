/**
 * Builds an n8n fixture payload by calling the local gateway.
 *
 * This is how the new workflow gets simulated without touching production. A
 * remote n8n cannot reach localhost:4000 on your laptop, so instead of a
 * tunnel the workflow carries its own data: every tool step is gated, and when
 * `body.fixtures` is present the HTTP call is skipped and the fixture returned.
 *
 * The result is a single POST that exercises the real Code nodes, the real
 * phase-2 T-0002 shape (criteria, effectiveCriteria, specificity and the
 * dimension registry) and the real ranking, with no gateway credentials and
 * nothing written anywhere.
 *
 *   node server.mjs &                        # in one shell
 *   node workflow/capture-fixtures.mjs       # in another
 *   -> docs/n8n-fixture-payload-v3.json
 *
 * Then POST that file to the webhook. `dryRun` is true in the payload, so
 * T-0005 never fires even if the workflow is pointed at a live gateway.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(here, '..', '..', 'docs', 'n8n-fixture-payload-v3.json');
const BASE = process.env.GATEWAY ?? 'http://127.0.0.1:4000/api/tool';

const FROM = process.env.FROM ?? '2026-09-14';
const TO = process.env.TO ?? '2026-09-22';

async function tool(code, body) {
  const r = await fetch(`${BASE}/${code}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${code} -> HTTP ${r.status}`);
  const j = await r.json();
  if (j.errors) throw new Error(`${code} -> ${j.errors.map((e) => e.message).join('; ')}`);
  return j.data ?? j;
}

console.log(`capturing from ${BASE}\n`);

const t1 = await tool('T-0001', { input: { fromDate: FROM, toDate: TO } });
const entities = t1.assignmentUnassignedEntities ?? [];
const itemCount = entities.reduce((n, e) => n + (e.workItems?.length ?? 0), 0);
console.log(`T-0001  ${itemCount} work items across ${entities.length} entities`);

const t2 = await tool('T-0002', { filter: { active: true } });
const teams = t2.optimaTeams ?? [];
const dimensions = t2.allocationDimensions ?? [];
const groups = teams.reduce((n, t) => n + (t.groups?.length ?? 0), 0);
const withCriteria = teams.flatMap((t) => t.groups ?? []).filter((g) => (g.effectiveCriteria ?? []).length).length;
console.log(`T-0002  ${teams.length} teams, ${groups} groups (${withCriteria} carrying criteria)`);
console.log(`        ${dimensions.length} dimensions, ${dimensions.reduce((n, d) => n + (d.aliases?.length ?? 0), 0)} aliases`);

if (!withCriteria) {
  console.log('\n  WARNING: no group returned effectiveCriteria, so the capture only');
  console.log('  exercises the legacy adapter. Check the T-0002 query in server.mjs.');
}

const userIds = [...new Set(teams.flatMap((t) => (t.groups ?? []).flatMap((g) => (g.members ?? []).map((m) => String(m.id)))))];
const workItemTypes = [...new Set(entities.map((e) => e.workItemType))];

const t3 = await tool('T-0003', { userIds, workItemTypes, fromDate: FROM, toDate: TO });
console.log(`T-0003  ${(t3.usersWorkTypeAssignedCounts ?? []).length} count rows for ${userIds.length} users`);

// teamId null on purpose: with a team it applies that team's caps to every
// user without checking membership. Mirrors what the workflow now sends.
const t4 = await tool('T-004', { teamId: null, userIds });
const caps = t4.effectiveAssignmentSettings ?? [];
const perUser = {};
for (const c of caps) perUser[String(c.userId)] = (perUser[String(c.userId)] ?? 0) + 1;
const multi = Object.values(perUser).filter((n) => n > 1).length;
console.log(`T-004   ${caps.length} capacity rows, ${multi} user(s) in more than one team`);

const payload = {
  gatewayBaseUrl: BASE,
  fromDate: FROM,
  toDate: TO,
  branchIds: [],
  workItemTypes,
  dryRun: true,
  fixtures: {
    assignmentUnassignedEntities: entities,
    optimaTeams: teams,
    allocationDimensions: dimensions,
    usersWorkTypeAssignedCounts: t3.usersWorkTypeAssignedCounts ?? [],
    effectiveAssignmentSettings: caps,
  },
};

fs.writeFileSync(OUT, JSON.stringify(payload, null, 1));
const kb = Math.round(fs.statSync(OUT).size / 1024);
console.log(`\nwrote docs/${path.basename(OUT)} (${kb} KB)`);

/* ── verify the payload actually drives the workflow ───────────────────────
   A capture nobody ran is just a file. This replays it through the workflow's
   own Code nodes, exactly as n8n will, so a broken fixture fails here rather
   than in front of somebody. */
console.log('\nverifying in fixture mode');

const wf = JSON.parse(fs.readFileSync(path.join(here, '..', '..', 'docs', 'RCM Auto-Assignment v2.json'), 'utf8'));
const codeOf = (n) => wf.nodes.find((x) => x.name === n).parameters.jsCode;
const store = {};
function run(name, input) {
  const $input = { all: () => input };
  const $ = (n) => ({ first: () => store[n]?.[0], all: () => store[n] ?? [], item: store[n]?.[0] });
  const d = new Date();
  const pad = (x) => String(x).padStart(2, '0');
  const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const $today = { format: () => stamp, plus: () => ({ format: () => stamp }) };
  const out = new Function('$input', '$', '$today', codeOf(name))($input, $, $today);
  store[name] = Array.isArray(out) ? out : [out];
  return store[name];
}

store.Webhook = [{ json: { headers: {}, body: payload } }];
run('extractInfo', store.Webhook);
run('FX Step 0 - Unassigned Items', store.extractInfo);
store['Step 0 - Unassigned Items'] = store['FX Step 0 - Unassigned Items'];
run('Rank Items', store['Step 0 - Unassigned Items']);
run('FX Step 1 - Get Teams', store.extractInfo);
store['Step 1 - Get Teams'] = store['FX Step 1 - Get Teams'];

// Proves the registry travelled with the fixture instead of the node quietly
// falling back to its own defaults.
const served = store['Step 1 - Get Teams'][0].json.data.allocationDimensions;
console.log(`  registry in fixture: ${served ? `${served.length} dimensions` : 'MISSING, node will use its defaults'}`);

run('Match Groups', store['Rank Items']);
const m = store['Match Groups'][0].json;
console.log(`  Match Groups       ${m.assignments.length} matched · ${m.unmatched.length} unmatched`);

run('FX Step 2 - Assigned Counts', store.extractInfo);
store['Step 2 - Assigned Counts'] = store['FX Step 2 - Assigned Counts'];
run('FX Step 3 - Capacities', store.extractInfo);
store['Step 3 - Capacities'] = store['FX Step 3 - Capacities'];

const batches = run('Distribute', store['Step 3 - Capacities']).filter((b) => !b.json.skipped);
const placed = batches.reduce((n, b) => n + b.json.itemCount, 0);
const fb = batches[0]?.json.fallbackCount ?? 0;
console.log(`  Distribute         ${batches.length} batches · ${placed} placed · ${fb} via fallback`);

const ok = m.assignments.length > 0 && batches.length > 0 && !!served;
console.log(ok
  ? '\nOK. POST this file to the webhook; dryRun is true so T-0005 never fires.'
  : '\nFAILED: the payload does not drive the workflow, do not use it.');
process.exit(ok ? 0 : 1);
