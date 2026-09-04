"""Generates the v2 n8n workflow.

v2 replaces v1's tag-string parsing with group matching: teams are containers,
groups carry the criteria and the members. Ranking is unchanged. Uses the same
five gateway tools as v1 (T-0001..T-0005), so auth and URL conventions carry over.
"""
import json, io

GW = "https://api.uae.iohealth.com/cortex-component-gateway/api/tool/"


def tool(code):
    return ("=" + GW + "{{ $('Webhook').item.json.body.components[0].components"
            ".find(c => c.componentCode.includes('" + code + "'))?.componentCode ?? null }}")


HDR = {"parameters": [{"name": "X-API-Key",
                       "value": "={{ $('Webhook').item.json.headers['x-organization-api-key'] }}"}]}


def http(name, code, body, pos):
    return {"parameters": {"method": "POST", "url": tool(code), "sendHeaders": True,
                           "headerParameters": HDR, "sendBody": True, "specifyBody": "json",
                           "jsonBody": body, "options": {}},
            "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.2, "position": pos,
            "id": name.lower().replace(' ', '-'), "name": name}


def code_node(name, js, pos):
    return {"parameters": {"jsCode": js}, "type": "n8n-nodes-base.code",
            "typeVersion": 2, "position": pos,
            "id": name.lower().replace(' ', '-'), "name": name}


Q = chr(39)   # single quote, kept out of the literals below
nodes = []

nodes.append({"parameters": {"httpMethod": "POST", "path": "assignmentAutoAssignV2",
                             "responseMode": "responseNode", "options": {}},
              "type": "n8n-nodes-base.webhook", "typeVersion": 2, "position": [-1600, 0],
              "id": "webhook-v2", "name": "Webhook", "webhookId": "rcm-auto-assign-v2"})

nodes.append(code_node("extractInfo", """// Gateway context and the run window, off the webhook.
const w = $('Webhook').first().json;
const h = w.headers || {};
const b = w.body || {};
const payload = { fromDate: b.fromDate, toDate: b.toDate };
if (Array.isArray(b.branchIds) && b.branchIds.length) payload.branchIds = b.branchIds;
if (Array.isArray(b.workItemTypes) && b.workItemTypes.length) payload.workItemTypes = b.workItemTypes;
return { json: {
  correlationId: h['x-correlation-id'] ?? null,
  callbackUrl: h['x-callback-url'] ?? null,
  dryRun: b.dryRun === true,
  payload
} };""", [-1400, 0]))

nodes.append(http("Step 0 - Unassigned Items", "T-0001",
                  '={ "input": {{ JSON.stringify($json.payload) }} }', [-1200, 0]))

nodes.append(code_node("Rank Items", """// Flatten the queue and rank it. Ranking is UNCHANGED from v1:
//   auth   -> priority(1-3) + ageDays * 0.7
//   claims -> valueScore(1-3) + ageDays * 0.7, value scaled to the run's p95
const PRIORITY = { HIGH: 3, MEDIUM: 2, LOW: 1 };
const CLAIM_TYPES = ['CLAIM_VALIDATION','CLAIM_SUBMISSION','CLAIM_RESUBMISSION','RECONCILIATION'];
const now = new Date();

const entities = [];
for (const item of $input.all()) {
  const d = item.json.data?.assignmentUnassignedEntities ?? item.json.assignmentUnassignedEntities ?? [];
  for (const e of d) entities.push(e);
}

const nets = [];
for (const e of entities) {
  if (!CLAIM_TYPES.includes(e.workItemType)) continue;
  for (const w of (e.workItems || [])) nets.push(typeof w.net === 'number' ? w.net : 0);
}
nets.sort((a, b) => a - b);
let ceiling = 1;
if (nets.length >= 5) {
  const c = nets[Math.min(nets.length - 1, Math.floor(nets.length * 0.95))];
  if (c > 0) ceiling = c;
}
const valueScore = (net) =>
  1 + 2 * Math.max(0, Math.min(1, (typeof net === 'number' ? net : 0) / ceiling));

const items = [];
for (const e of entities) {
  const isClaim = CLAIM_TYPES.includes(e.workItemType);
  for (const w of (e.workItems || [])) {
    const start = w.startDate ? new Date(w.startDate) : now;
    const ageDays = Math.max(0, (now - start) / 86400000);
    const base = isClaim ? valueScore(w.net)
                         : (PRIORITY[String(w.priority || '').toUpperCase()] ?? 1);
    items.push({
      id: String(w.id),
      workItemType: e.workItemType,
      branchId: e.branchId,
      facilityId: e.facilityId,
      department: w.department ?? null,
      payer: w.insurancePayer ?? null,
      claimStatus: w.claimStatus ?? null,
      encounterType: w.encounterType ?? null,
      priority: w.priority ?? null,
      ageDays: Math.round(ageDays * 10) / 10,
      rank: Math.round((base + ageDays * 0.7) * 100) / 100
    });
  }
}
items.sort((a, b) => b.rank - a.rank);
return [{ json: { items, branchIds: [...new Set(items.map(i => i.branchId).filter(Boolean))] } }];""",
                       [-1000, 0]))

nodes.append({"parameters": {"conditions": {"options": {"caseSensitive": True, "version": 2},
                                            "conditions": [{"leftValue": "={{ $json.items.length }}",
                                                            "rightValue": 0,
                                                            "operator": {"type": "number", "operation": "gt"}}],
                                            "combinator": "and"}, "options": {}},
              "type": "n8n-nodes-base.if", "typeVersion": 2.2, "position": [-800, 0],
              "id": "any-items", "name": "Any items?"})

nodes.append(http("Step 1 - Get Teams", "T-0002",
                  '={ "filter": { "ids": null, "branchIds": {{ JSON.stringify($json.branchIds) }},'
                  ' "name": null, "active": true } }', [-600, -100]))

nodes.append(code_node("Match Groups", """// v2 matching: teams are containers, GROUPS carry the criteria.
// A group accepts an item when its work item type, encounter scope, axis value
// (department or payer) and claim status all admit it. When several accept, the
// NARROWEST wins - scored by how few values each dimension admits, so a group
// naming one department beats one naming six. Ties break on specificity order.
const ranked = $('Rank Items').first().json.items;
const raw = $('Step 1 - Get Teams').first().json;
const teams = raw.data?.optimaTeams ?? raw.optimaTeams ?? [];

const SCALE = 100;
const narrow = (n) => (n === 0 ? 0 : Math.floor(SCALE / n));
function specificity(g) {
  return narrow((g.workItemTypes || []).length)
       + narrow((g.departments || []).length)
       + (g.payerCatchAll ? 0 : narrow((g.payers || []).length))
       + narrow((g.claimStatuses || []).length)
       + (g.encounterScope && g.encounterScope !== 'BOTH' ? SCALE : 0);
}
function accepts(team, g, item) {
  if (g.active === false) return false;
  if (!(g.workItemTypes || []).includes(item.workItemType)) return false;
  const enc = (item.encounterType || '').toUpperCase();
  if (enc && g.encounterScope && g.encounterScope !== 'BOTH' && g.encounterScope !== enc) return false;
  if (team.logicAxis === 'PAYER') {
    const named = item.payer && (g.payers || []).includes(item.payer);
    if (!named && !g.payerCatchAll) return false;
  } else {
    if (!item.department || !(g.departments || []).includes(item.department)) return false;
  }
  const st = g.claimStatuses || [];
  if (st.length && item.claimStatus && !st.includes(item.claimStatus)) return false;
  return true;
}

const assignments = [];
const unmatched = [];
const memberIds = new Set();

for (const item of ranked) {
  const candidates = [];
  for (const t of teams) {
    const branches = t.branches || [];
    const serves = branches.some(b => b.healthLicense === item.facilityId)
                || String(t.branchId ?? '') === String(item.branchId);
    if (branches.length && !serves) continue;
    for (const g of (t.groups || [])) {
      if (accepts(t, g, item)) candidates.push({ team: t, group: g, spec: specificity(g) });
    }
  }
  if (!candidates.length) {
    unmatched.push({ id: item.id, workItemType: item.workItemType,
                     department: item.department, payer: item.payer,
                     reason: 'No group accepts this item' });
    continue;
  }
  candidates.sort((a, b) => b.spec - a.spec);
  const best = candidates[0];
  const members = (best.group.members || []).map(m => String(m.id ?? m.userId));
  members.forEach(m => memberIds.add(m));
  assignments.push({ ...item, teamId: best.team.id, teamName: best.team.name,
                     groupId: best.group.id, groupName: best.group.name,
                     groupMembers: members });
}

return [{ json: {
  assignments, unmatched,
  userIds: [...memberIds],
  teamId: assignments[0]?.teamId ?? null,
  workItemTypes: [...new Set(assignments.map(a => a.workItemType))]
} }];""", [-400, -100]))

nodes.append(http("Step 2 - Assigned Counts", "T-0003",
                  '={ "userIds": {{ JSON.stringify($json.userIds) }},\n'
                  '   "workItemTypes": {{ JSON.stringify($json.workItemTypes) }},\n'
                  '   "fromDate": "{{ $today.format(' + Q + 'yyyy-MM-dd' + Q + ') }}",\n'
                  '   "toDate": "{{ $today.plus(1,' + Q + 'days' + Q + ').format(' + Q + 'yyyy-MM-dd' + Q + ') }}" }',
                  [-200, -100]))

nodes.append(http("Step 3 - Capacities", "T-004",
                  '={ "teamId": "{{ $(' + Q + 'Match Groups' + Q + ').item.json.teamId }}",\n'
                  '   "userIds": {{ JSON.stringify($(' + Q + 'Match Groups' + Q + ').item.json.userIds) }} }',
                  [0, -100]))

nodes.append(code_node("Distribute", """// Spread each group's matched items across that group's members, respecting
// remaining capacity (cap - already assigned today). Highest-ranked item first,
// always to the least-loaded eligible member.
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

const state = {};
for (const c of caps) {
  const uid = String(c.userId);
  state[uid] = { maxAuth: c.maxAuth ?? 0, maxClaim: c.maxClaim ?? 0, used: assignedBy[uid] ?? 0 };
}
const capLeft = (uid, wit) => {
  const r = state[uid];
  if (!r) return 0;
  return Math.max(0, (AUTH.includes(wit) ? r.maxAuth : r.maxClaim) - r.used);
};

const perAssignee = {};
const overflow = [];

for (const item of matched.assignments) {
  const pool = (item.groupMembers || [])
    .filter(uid => capLeft(uid, item.workItemType) > 0)
    .sort((a, b) => (state[a]?.used ?? 0) - (state[b]?.used ?? 0));
  if (!pool.length) {
    overflow.push({ id: item.id, groupName: item.groupName,
                    reason: (item.groupMembers || []).length ? 'Group at capacity' : 'Group has no members' });
    continue;
  }
  const uid = pool[0];
  state[uid].used += 1;
  const key = uid + '|' + item.workItemType;
  if (!perAssignee[key]) {
    perAssignee[key] = { assigneeId: uid, workItemType: item.workItemType,
                         teamId: item.teamId, groupName: item.groupName, workItemIds: [] };
  }
  perAssignee[key].workItemIds.push(item.id);
}

const batches = Object.values(perAssignee);
const dryRun = $('extractInfo').first().json.dryRun;
if (!batches.length) {
  return [{ json: { skipped: true, reason: 'No capacity anywhere',
                    overflowCount: overflow.length, overflow, dryRun,
                    workItemIds: [], assigneeId: null } }];
}
return batches.map(b => ({ json: { ...b,
  itemCount: b.workItemIds.length,
  overflowCount: overflow.length,
  dryRun } }));""", [200, -100]))

nodes.append({"parameters": {"conditions": {"options": {"caseSensitive": True, "version": 2},
                                            "conditions": [{"leftValue": "={{ $json.dryRun }}",
                                                            "rightValue": "",
                                                            "operator": {"type": "boolean", "operation": "false", "singleValue": True}}],
                                            "combinator": "and"}, "options": {}},
              "type": "n8n-nodes-base.if", "typeVersion": 2.2, "position": [400, -100],
              "id": "commit-gate", "name": "Commit?"})

nodes.append(http("Step 4 - Assign", "T-0005",
                  '={ "input": { "assigneeId": "{{ $json.assigneeId }}",\n'
                  '   "workItemIds": {{ JSON.stringify($json.workItemIds) }},\n'
                  '   "workItemType": "{{ $json.workItemType }}" } }', [600, -220]))

nodes.append(code_node("Summarise", """// Roll the run into one allocation summary.
let batches = [];
try { batches = $('Distribute').all().map(i => i.json).filter(b => !b.skipped); } catch (e) {}
let results = [];
try { results = $('Step 4 - Assign').all().map(i => i.json); } catch (e) {}

const matched = $('Match Groups').first().json;
const dryRun = $('extractInfo').first().json.dryRun;

const byGroup = {};
for (const a of (matched.assignments || [])) {
  if (!byGroup[a.groupName]) byGroup[a.groupName] = { group: a.groupName, team: a.teamName, matched: 0 };
  byGroup[a.groupName].matched += 1;
}
const assigned = batches.reduce((n, b) => n + (b.workItemIds?.length ?? 0), 0);

return [{ json: {
  correlationId: $('extractInfo').first().json.correlationId,
  model: 'v2-groups',
  dryRun,
  totals: {
    ranked: $('Rank Items').first().json.items.length,
    matched: (matched.assignments || []).length,
    assigned,
    unmatched: (matched.unmatched || []).length,
    overflow: batches[0]?.overflowCount ?? 0
  },
  byGroup: Object.values(byGroup),
  byAssignee: batches.map(b => ({ assigneeId: b.assigneeId, group: b.groupName,
                                  workItemType: b.workItemType, count: b.workItemIds.length })),
  unmatchedSample: (matched.unmatched || []).slice(0, 20),
  apiResults: results.map(r => r.data?.assignWorkItems ?? r.assignWorkItems ?? r)
} }];""", [800, -100]))

nodes.append({"parameters": {"respondWith": "json", "responseBody": "={{ JSON.stringify($json) }}",
                             "options": {}},
              "type": "n8n-nodes-base.respondToWebhook", "typeVersion": 1.1,
              "position": [1000, -100], "id": "respond", "name": "Respond"})

nodes.append(code_node("Nothing To Do", """return [{ json: {
  correlationId: $('extractInfo').first().json.correlationId,
  model: 'v2-groups',
  totals: { ranked: 0, matched: 0, assigned: 0, unmatched: 0, overflow: 0 },
  message: 'No unassigned work in the requested window'
} }];""", [-600, 140]))

nodes.append({"parameters": {"respondWith": "json", "responseBody": "={{ JSON.stringify($json) }}",
                             "options": {}},
              "type": "n8n-nodes-base.respondToWebhook", "typeVersion": 1.1,
              "position": [-400, 140], "id": "respond-empty", "name": "Respond Empty"})

conn = {
    "Webhook": {"main": [[{"node": "extractInfo", "type": "main", "index": 0}]]},
    "extractInfo": {"main": [[{"node": "Step 0 - Unassigned Items", "type": "main", "index": 0}]]},
    "Step 0 - Unassigned Items": {"main": [[{"node": "Rank Items", "type": "main", "index": 0}]]},
    "Rank Items": {"main": [[{"node": "Any items?", "type": "main", "index": 0}]]},
    "Any items?": {"main": [[{"node": "Step 1 - Get Teams", "type": "main", "index": 0}],
                            [{"node": "Nothing To Do", "type": "main", "index": 0}]]},
    "Step 1 - Get Teams": {"main": [[{"node": "Match Groups", "type": "main", "index": 0}]]},
    "Match Groups": {"main": [[{"node": "Step 2 - Assigned Counts", "type": "main", "index": 0}]]},
    "Step 2 - Assigned Counts": {"main": [[{"node": "Step 3 - Capacities", "type": "main", "index": 0}]]},
    "Step 3 - Capacities": {"main": [[{"node": "Distribute", "type": "main", "index": 0}]]},
    "Distribute": {"main": [[{"node": "Commit?", "type": "main", "index": 0}]]},
    "Commit?": {"main": [[{"node": "Step 4 - Assign", "type": "main", "index": 0}],
                         [{"node": "Summarise", "type": "main", "index": 0}]]},
    "Step 4 - Assign": {"main": [[{"node": "Summarise", "type": "main", "index": 0}]]},
    "Summarise": {"main": [[{"node": "Respond", "type": "main", "index": 0}]]},
    "Nothing To Do": {"main": [[{"node": "Respond Empty", "type": "main", "index": 0}]]},
}

wf = {"name": "RCM Auto-Assignment v2 (groups)", "nodes": nodes, "connections": conn,
      "settings": {"executionOrder": "v1"}, "active": False,
      "meta": {"description":
               "v2 allocation: teams are containers; groups carry criteria and members. "
               "Matching is narrowest-group-wins. Ranking unchanged from v1. "
               "POST body.dryRun=true previews without assigning."}}

io.open('RCM Auto-Assignment v2.json', 'w', encoding='utf-8').write(
    json.dumps(wf, indent=1, ensure_ascii=False))
print('nodes:', len(nodes), '(v1 had 38)')
for n in nodes:
    print('  ', n['name'])
