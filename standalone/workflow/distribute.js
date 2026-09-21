// Spread each group's matched items across that group's members.
//
// Three rules, in order:
//   1. Highest-ranked item first.
//   2. To the least *utilised* eligible member, not the least loaded. A member
//      capped at 200 and one capped at 50 both sitting on 20 items are not
//      equally busy, and sorting on the raw count starves the bigger cap.
//   3. When the winning group has no capacity left, fall through to the next
//      narrowest group that also accepted the item, rather than stranding work
//      next to idle people. Match Groups supplies those in `groupFallbacks`.

const matched = $('Match Groups').first().json;
const kpiRaw = $('Step 2 - Assigned Counts').first().json;
const capRaw = $('Step 3 - Capacities').first().json;

const counts = kpiRaw.data?.usersWorkTypeAssignedCounts ?? kpiRaw.usersWorkTypeAssignedCounts ?? [];
const caps = capRaw.data?.effectiveAssignmentSettings ?? capRaw.effectiveAssignmentSettings ?? [];

const AUTH = ['AUTHORIZATION_SUBMISSION', 'AUTHORIZATION_RESUBMISSION'];

const assignedBy = {};
for (const c of counts) {
  const uid = String(c.userId);
  assignedBy[uid] = (assignedBy[uid] ?? 0) + (c.assigned ?? 0);
}

/**
 * Capacities come back one row per (user, team) when teamId is null, so a
 * member of several teams appears more than once. Take the LOWEST cap: the
 * caps are per-team commitments and honouring the smallest is the only choice
 * that cannot overcommit someone. Keyed assignment would silently let row
 * order decide.
 */
const state = {};
for (const c of caps) {
  const uid = String(c.userId);
  const maxAuth = c.maxAuth ?? 0;
  const maxClaim = c.maxClaim ?? 0;
  if (!state[uid]) {
    state[uid] = { maxAuth, maxClaim, used: assignedBy[uid] ?? 0, teams: 1 };
  } else {
    state[uid].maxAuth = Math.min(state[uid].maxAuth, maxAuth);
    state[uid].maxClaim = Math.min(state[uid].maxClaim, maxClaim);
    state[uid].teams += 1;
  }
}

const capOf = (uid, wit) => {
  const r = state[uid];
  if (!r) return 0;
  return AUTH.includes(wit) ? r.maxAuth : r.maxClaim;
};
const capLeft = (uid, wit) => Math.max(0, capOf(uid, wit) - (state[uid]?.used ?? 0));

/** Fraction of this member's cap already consumed. Unknown cap sorts last. */
const utilisation = (uid, wit) => {
  const cap = capOf(uid, wit);
  if (!cap) return Infinity;
  return (state[uid]?.used ?? 0) / cap;
};

/** Eligible members of one group, least utilised first. */
function poolFor(memberIds, wit) {
  return (memberIds ?? [])
    .filter((uid) => capLeft(uid, wit) > 0)
    .sort((a, b) => utilisation(a, wit) - utilisation(b, wit) || String(a).localeCompare(String(b)));
}

const perAssignee = {};
const overflow = [];
const fallbackUsed = [];

for (const item of matched.assignments) {
  // The winning group first, then every other group that accepted, narrowest
  // first. Identical to the old behaviour whenever the winner has room.
  const tiers = [
    { groupId: item.groupId, groupName: item.groupName, teamId: item.teamId, members: item.groupMembers },
    ...(item.groupFallbacks ?? []),
  ];

  let placed = null;
  for (let i = 0; i < tiers.length; i += 1) {
    const pool = poolFor(tiers[i].members, item.workItemType);
    if (!pool.length) continue;
    placed = { tier: tiers[i], uid: pool[0], depth: i };
    break;
  }

  if (!placed) {
    overflow.push({
      id: item.id,
      groupName: item.groupName,
      triedGroups: tiers.length,
      reason: (item.groupMembers ?? []).length
        ? `No capacity in ${tiers.length} accepting group(s)`
        : 'Group has no members',
    });
    continue;
  }

  const { tier, uid, depth } = placed;
  state[uid].used += 1;
  if (depth > 0) {
    fallbackUsed.push({ id: item.id, from: item.groupName, to: tier.groupName, depth });
  }

  const key = `${uid}|${item.workItemType}`;
  if (!perAssignee[key]) {
    perAssignee[key] = {
      assigneeId: uid,
      workItemType: item.workItemType,
      teamId: tier.teamId,
      groupName: tier.groupName,
      workItemIds: [],
    };
  }
  perAssignee[key].workItemIds.push(item.id);
}

const batches = Object.values(perAssignee);
const dryRun = $('extractInfo').first().json.dryRun;
const multiTeam = Object.values(state).filter((r) => r.teams > 1).length;

if (!batches.length) {
  return [{ json: {
    skipped: true,
    reason: 'No capacity anywhere',
    overflowCount: overflow.length,
    overflow,
    dryRun,
    workItemIds: [],
    assigneeId: null,
  } }];
}

return batches.map((b) => ({ json: {
  ...b,
  itemCount: b.workItemIds.length,
  overflowCount: overflow.length,
  fallbackCount: fallbackUsed.length,
  multiTeamMembers: multiTeam,
  dryRun,
} }));
