# RCM Auto-Assignment v2 — workflow

`RCM Auto-Assignment v2.json` — import into n8n. **16 nodes, down from v1's 38.**

Group matching removed the whole v1 apparatus of `deptTagMap` lookups, `priority-*`
team ranking, and the separate auth/claims distributors.

## Flow

```
Webhook → extractInfo → T-0001 Unassigned → Rank Items → Any items?
                                                            ├─ no → Nothing To Do → Respond
                                                            └─ yes → T-0002 Teams
                                                                     → Match Groups
                                                                     → T-0003 Counts
                                                                     → T-004 Capacities
                                                                     → Distribute
                                                                     → Commit? ─ dry → Summarise
                                                                                └ live → T-0005 Assign → Summarise
                                                                     → Respond
```

Same five gateway tools as v1, so auth and URL conventions are unchanged:

| Tool | Operation |
|---|---|
| T-0001 | `assignmentUnassignedEntities` |
| T-0002 | `optimaTeams` (no `tag` filter — v2 matches on groups) |
| T-0003 | `usersWorkTypeAssignedCounts` |
| T-004 | `effectiveAssignmentSettings` |
| T-0005 | `assignWorkItems` |

## What changed from v1

**Matching.** v1 parsed a comma-separated `tag` string per team, mapped department
display names through a 42-alias table, then ranked teams by a `priority-*` tag. v2 asks
each *group* whether it accepts the item — work item type, encounter scope, department or
payer, claim status — and takes the **narrowest** accepting group. Narrowness is scored
`100/size` per dimension, so a group naming one department beats one naming six.

**Distribution.** v1 had two distributors (dept-based round-robin for auth, equal split
for claims). v2 has one: within the winning group, the item goes to the least-loaded
member with capacity left, taking `maxAuth` or `maxClaim` per the item's type.

**Ranking is unchanged** — `priority/value + ageDays × 0.7`, with the claim-value
ceiling still the run's p95 over a ≥5 sample.

## Dry run

`POST body.dryRun = true` runs everything except T-0005 and returns the same summary.
That is the preview the Review step in the UI shows.

## Verified run

`node _run_v2_workflow.mjs [--commit]` executes the workflow's own Code nodes — lifted
from the JSON, not reimplemented — against the 11 v2 teams:

```
440 items ranked · 293 matched · 147 unmatched · 0 overflow
22 assignee batches, 41 members involved

  56  Coders — DXB          (DXB · CLAIM · IP)
  46  Coders — RAK          (RAK · CLAIM · OP)
  29  Submission & Resub    (DXB · AUTH · OP)
```

### The 147 unmatched are real, not a bug

Every CLAIM team is missing a `RECONCILIATION` group, so reconciliation work matches
nothing and is reported rather than mis-assigned. v1 would have absorbed these into a
broad team. Fix by adding a reconciliation group per CLAIM team.

Also worth noting: each `Resubmission` group carries no claim-status filter, so it
accepts any status. That is legitimate but broad — the narrowness score means a
status-specific group still wins when both match.

## Before running in n8n

- The workflow is `active: false`. Import, check the tool component codes resolve for
  your org, then enable.
- The nightly trigger (`RCM Auto Assign - Midnight Trigger.json`) still points at the v1
  agent and has a **hardcoded X-API-Key** — rotate it and repoint at the v2 webhook path
  `assignmentAutoAssignV2`.
- `optimaTeams` must return `groups` with `members`; that field does not exist in the v1
  backend, so this needs the v2 resolver deployed first.

## Running it against the local stand-in

`standalone/server.mjs` serves the same schema the UI uses, over HTTP, behind a
gateway-shaped `/api/tool/{code}` wrapper. So the workflow can run end to end with no
production access.

```bash
cd standalone && node server.mjs        # http://localhost:4000
```

| Endpoint | |
|---|---|
| `POST /graphql` | the schema directly |
| `POST /api/tool/T-0001` | `assignmentUnassignedEntities` |
| `POST /api/tool/T-0002` | `optimaTeams` (with `groups` + `members`) |
| `POST /api/tool/T-0003` | `usersWorkTypeAssignedCounts` |
| `POST /api/tool/T-004` | `effectiveAssignmentSettings` |
| `POST /api/tool/T-0005` | `assignWorkItems` |

### If n8n reports ECONNREFUSED ::1:4000

`localhost` resolves to IPv6 `::1` first on Windows, and a server bound to `0.0.0.0`
only answers IPv4 — so the connection is refused before it reaches anything. The server
now binds `::` (dual-stack), which answers both. If you see this again, check with:

```bash
curl http://127.0.0.1:4000/health     # IPv4
curl http://[::1]:4000/health         # IPv6 — must also return 200
```

Using `http://127.0.0.1:4000/api/tool` in the payload sidesteps it entirely.

### Pointing n8n at it

Every HTTP node reads `body.gatewayBaseUrl`, falling back to the live gateway. So the
same workflow runs either way — POST to the webhook with:

```json
{
  "gatewayBaseUrl": "http://localhost:4000/api/tool",
  "fromDate": "2026-08-27", "toDate": "2026-09-04",
  "branchIds": [], "dryRun": true
}
```

### Verified end-to-end run

`node _run_v2_http.mjs [--commit]` executes the workflow's own Code nodes while making
real HTTP calls to the five tools:

```
660 items ranked · 433 matched · 227 unmatched · 0 overflow
18 assignee batches · 18/18 assign calls succeeded
  {"success":true,"message":"Assigned 42 items to VXNlcjo5NDk=","totalCount":42}
```

### A bug this caught

The in-process runner passed while the HTTP run matched **zero** items. Cause: the
workflow gates facilities on `branches[].healthLicense` (per the reference query), but
the schema only exposed `branches[].name`. Adding `healthLicense` fixed it — exactly the
kind of contract mismatch that only shows up once the calls are real.

## Replaying the captured production run

`Walkthough.md` is a full v1 production run (541 work items, 8 teams, all five tool
responses). Two scripts turn it into a v2 test:

```bash
cd standalone && node replay.mjs [--commit]
```

It feeds the real tool payloads to the v2 workflow's own Code nodes — no gateway
access needed, and the comparison is like-for-like on the same day's work.

### Two integration bugs it caught

Both were invisible against generated data:

1. **Encounter type.** The queue reports bed/ER codes (`NO_BED_ER`, `INPATIENT_BED_NO_ER`);
   groups are configured `OP`/`IP`. v1 mapped these via `encounterMapping`; the v2
   workflow had dropped it, so every item failed the scope check.
2. **Department spelling.** The queue says `"Emergency"`, group config stores
   `department-emergency`. Zero exact overlap across all 21 departments. Matching now
   compares on a normalised key (lowercase, alphanumerics only), the same rule
   `RcmDepartment` uses.

Before: **0 of 541 matched**. After: matching works.

### What the replay actually shows

```
541 ranked · 66 matched · 475 unmatched
```

The 475 are **not** a workflow fault — the captured teams only cover one facility:

| | Items | Share |
|---|---|---|
| `DHA-F-0046775` (has teams) | 128 | 24% |
| `7510`, `MOH-F-1000464`, +9 others | 413 | 76% |

So 76% of that day's work belonged to facilities with no team configured at all, and a
further 63 items hit departments no group names (41 of them with `department: null`).

v1 would have absorbed much of this into broadly-tagged teams. v2 reports it instead —
which is the intended behaviour, but it means **the real gap is team coverage, not the
algorithm**. Configure teams for the other facilities and the same run allocates far more.

## Running from a REMOTE n8n

A remote n8n cannot reach `localhost:4000` on your laptop — `127.0.0.1` there means
*that server*, not your machine. No server binding fixes this. Two options:

### Option A — fixture mode (no network at all)

The workflow carries its own data. Every tool step is gated: if `body.fixtures` is
present the HTTP call is skipped and the fixture is returned instead.

POST `docs/n8n-fixture-payload.json` (96 KB) to the webhook. It contains the real
captured production run — 541 work items, 8 teams, real capacities — so the workflow
executes fully inside n8n with nothing to configure.

```
541 ranked · 66 matched · 475 unmatched · 3 assignee batches
```

Same numbers as the local replay, which is the point: it is the same data.

### Option B — expose the local API

Only if you want live editing to feed the workflow. Needs a tunnel:

```bash
npx localtunnel --port 4000      # or: ngrok http 4000
```

Then set `gatewayBaseUrl` to the public URL + `/api/tool`. Note both tools proved
flaky in this environment — localtunnel issued a URL but dropped the connection, and
the npm ngrok shim would not execute under Git Bash. Fixture mode avoids the problem
entirely.
