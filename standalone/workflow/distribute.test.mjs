/**
 * Distribute: utilisation ordering, capacity fallback, multi-team caps.
 *
 * The node reads n8n globals rather than taking arguments, so each case builds
 * a fake $() over a scenario and runs the real node body.
 *
 *   node workflow/distribute.test.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(here, 'distribute.js'), 'utf8');
const node = new Function('$', src);

/** Run the real Distribute body against one scenario. */
function distribute({ assignments, counts = [], caps, dryRun = true }) {
  const store = {
    'Match Groups': { assignments },
    'Step 2 - Assigned Counts': { data: { usersWorkTypeAssignedCounts: counts } },
    'Step 3 - Capacities': { data: { effectiveAssignmentSettings: caps } },
    extractInfo: { dryRun },
  };
  const $ = (n) => ({ first: () => ({ json: store[n] }) });
  return node($).map((r) => r.json);
}

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

const AUTH = 'AUTHORIZATION_SUBMISSION';
const item = (id, over = {}) => ({
  id, workItemType: AUTH, teamId: 't1', groupId: 'g1', groupName: 'G1',
  groupMembers: ['u1', 'u2'], groupFallbacks: [], ...over,
});
const cap = (userId, maxAuth, over = {}) => ({ userId, maxAuth, maxClaim: 0, teamId: 't1', ...over });
const whoGot = (out) => Object.fromEntries(out.map((b) => [b.assigneeId, b.itemCount]));

/* ── utilisation, not raw count ────────────────────────────────────────── */
console.log('utilisation ordering');

// u1 cap 200 with 20 done is 10% used; u2 cap 50 with 10 done is 20% used.
// Sorting on the raw count would pick u2 (10 < 20) and starve the big cap.
let out = distribute({
  assignments: [item('a')],
  counts: [{ userId: 'u1', assigned: 20, workItemType: AUTH }, { userId: 'u2', assigned: 10, workItemType: AUTH }],
  caps: [cap('u1', 200), cap('u2', 50)],
});
check('the least utilised member wins, not the least loaded', whoGot(out), { u1: 1 });

out = distribute({
  assignments: [item('a'), item('b'), item('c'), item('d')],
  caps: [cap('u1', 100), cap('u2', 100)],
});
check('equal caps and no history spread evenly', whoGot(out), { u1: 2, u2: 2 });

out = distribute({
  assignments: Array.from({ length: 6 }, (_, i) => item(`i${i}`)),
  caps: [cap('u1', 300), cap('u2', 100)],
});
check('a 3:1 cap ratio splits roughly 3:1', whoGot(out), { u1: 4, u2: 2 });

check('an equal-utilisation tie is deterministic',
  whoGot(distribute({ assignments: [item('a')], caps: [cap('u2', 100), cap('u1', 100)] })), { u1: 1 });

/* ── capacity fallback ─────────────────────────────────────────────────── */
console.log('capacity fallback');

const withFallback = (id) => item(id, {
  groupMembers: ['u1'],
  groupFallbacks: [{ groupId: 'g2', groupName: 'G2', teamId: 't1', members: ['u2'] }],
});

out = distribute({
  assignments: [withFallback('a')],
  caps: [cap('u1', 10), cap('u2', 10)],
});
check('the winning group is still preferred when it has room', whoGot(out), { u1: 1 });
check('no fallback is recorded when the winner takes it', out[0].fallbackCount, 0);

out = distribute({
  assignments: [withFallback('a')],
  counts: [{ userId: 'u1', assigned: 10, workItemType: AUTH }],
  caps: [cap('u1', 10), cap('u2', 10)],
});
check('a full winning group falls through to the next group', whoGot(out), { u2: 1 });
check('the fallback is reported', out[0].fallbackCount, 1);
check('the batch carries the group that actually took it', out[0].groupName, 'G2');

// This is the case v2 dropped: work stranded beside an idle member.
out = distribute({
  assignments: [withFallback('a')],
  counts: [{ userId: 'u1', assigned: 10, workItemType: AUTH }],
  caps: [cap('u1', 10), cap('u2', 0)],
});
check('everything full still overflows rather than overcommitting', out[0].skipped, true);
check('overflow says how many groups were tried', out[0].overflow[0].triedGroups, 2);

/* ── multi-team capacity ───────────────────────────────────────────────── */
console.log('multi-team capacity');

// teamId: null returns one row per (user, team). Row order must not decide.
out = distribute({
  assignments: [item('a', { groupMembers: ['u1'] })],
  caps: [cap('u1', 200, { teamId: 't1' }), cap('u1', 50, { teamId: 't2' })],
});
check('a multi-team member is flagged', out[0].multiTeamMembers, 1);

const overCap = distribute({
  assignments: Array.from({ length: 80 }, (_, i) => item(`i${i}`, { groupMembers: ['u1'] })),
  caps: [cap('u1', 200, { teamId: 't1' }), cap('u1', 50, { teamId: 't2' })],
});
check('the lowest cap wins, so the larger one cannot overcommit',
  overCap[0].itemCount, 50);

const reversed = distribute({
  assignments: Array.from({ length: 80 }, (_, i) => item(`i${i}`, { groupMembers: ['u1'] })),
  caps: [cap('u1', 50, { teamId: 't2' }), cap('u1', 200, { teamId: 't1' })],
});
check('row order does not change the answer', reversed[0].itemCount, 50);

/* ── capacity is still respected ───────────────────────────────────────── */
console.log('capacity');

out = distribute({
  assignments: Array.from({ length: 5 }, (_, i) => item(`i${i}`, { groupMembers: ['u1'] })),
  caps: [cap('u1', 3)],
});
check('a member is never given more than their cap', out[0].itemCount, 3);
check('the excess is reported as overflow', out[0].overflowCount, 2);

out = distribute({
  assignments: [item('a', { groupMembers: [] })],
  caps: [],
});
check('a group with no members says so', out[0].overflow[0].reason, 'Group has no members');

out = distribute({
  assignments: [item('a', { groupMembers: ['u1'] })],
  caps: [cap('u1', 200, { maxAuth: 0, maxClaim: 150 })],
});
check('an auth item cannot consume claim capacity', out[0].skipped, true);

/* -- why work was not placed ------------------------------------------- */
console.log('overflow reasons');

out = distribute({ assignments: [item('a', { groupMembers: [], groupRoster: 0 })], caps: [] });
check('an empty group says so', out[0].overflow[0].reason, 'Group has no members');

out = distribute({ assignments: [item('a', { groupMembers: [], groupRoster: 3 })], caps: [] });
check('a group whose members are all away says that instead',
  out[0].overflow[0].reason, 'All 3 member(s) of the group are unavailable today');

out = distribute({
  assignments: [item('a', { groupMembers: ['u1'], groupRoster: 1 })],
  counts: [{ userId: 'u1', assigned: 10, workItemType: AUTH }],
  caps: [cap('u1', 10)],
});
check('a genuinely full group is neither of those',
  out[0].overflow[0].reason, 'No capacity in 1 accepting group(s)');

// The reasons used to be dropped whenever anything at all was assigned, so a
// run reported a count with nothing behind it.
out = distribute({
  assignments: [
    item('ok', { groupMembers: ['u1'], groupRoster: 1 }),
    item('bad', { groupMembers: [], groupRoster: 2 }),
  ],
  caps: [cap('u1', 10)],
});
check('detail survives a run that placed most of its work',
  [out[0].overflowCount, out[0].overflow.length], [1, 1]);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
