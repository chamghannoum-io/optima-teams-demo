# Worklog

Running log of the v3 allocation work: what was decided, what changed, and what
is still open. Newest session first.

---

## 2026-09-21, Track A step 1: registry-driven matcher

### Decisions taken

| Decision | Choice | Why |
|---|---|---|
| Matching model | **Group-first with capacity fallback** | Narrowest group wins so specialisation still means something, but an item is no longer stranded when the winning group is full. Pure user-first dilutes specialist pools. |
| Selection within a pool | **Least-loaded, not random** | v2 already does this and it beats random-without-replacement: it seeds from T-0003, so it counts work assigned before this run, not just draws within it. |
| Randomness | **Tie-break only** | `sort` is stable, so equally loaded members currently lose to the same person every night. |
| Load measure | **Utilisation (`used/cap`)**, not raw count | Raw count under-uses high-capacity members. Implemented. |
| Does Optima run allocation? | **No.** Configure and observe only | n8n stays the sole executor, so the matcher lives once. |
| Where we build | `standalone/` | Only place the whole loop runs end to end, and it is the deployable public demo. |
| Workflow versioning | **Extend the v2 JSON** | It has replay and fixture modes; a third file loses that regression cover. |
| Target upstream ref | `release.3.3.0` | Updated 2026-09-20, the live line. Teams and rcm-dashboard unchanged since the extraction. |

### Changed

| File | Status | What |
|---|---|---|
| `CRITERIA-CONTRACT.md` | new | The wire format for routing rules: types, normative matching semantics, specificity, narrowing invariant, two-phase migration, open items. |
| `standalone/workflow/match-groups.js` | new | The `Match Groups` node body as a real file. Registry-driven matcher replacing the hardcoded `logicAxis === 'PAYER'` branch. |
| `standalone/workflow/match-groups.test.mjs` | new | 43 rows: the contract's semantics table, normalisation, aliases, specificity, the v2 adapter, the facility gate. |
| `standalone/workflow/distribute.js` | new | The `Distribute` node body. Utilisation ordering, capacity fallback, multi-team cap reconciliation. |
| `standalone/workflow/distribute.test.mjs` | new | 18 rows: utilisation vs raw count, fallback depth, lowest-cap-wins, per-family capacity. |
| `standalone/workflow/registry-parity.test.mjs` | new | 25 rows. Fails if the workflow's embedded registry drifts from the one the schema serves. |
| `standalone/workflow/capture-fixtures.mjs` | new | Builds a phase-2 n8n fixture payload from the local gateway, then replays it through the workflow's own nodes to prove it works. |
| `standalone/server.mjs` | modified | T-0002 now serves the phase-2 shape: criteria, effectiveCriteria, specificity, and the dimension registry with aliases. |
| `standalone/src/mocks/allocation-model.ts` | modified | `DEPARTMENT_ALIASES` + `normValue`, so the app matches the way the workflow does. |
| `standalone/src/mocks/schema-v2.ts` | modified | `AllocationDimension` gains `matchMode` and `aliases`. Neither was served before, so the workflow could not learn either from the registry. |
| `docs/n8n-fixture-payload-v3.json` | new | Captured phase-2 payload, 276 KB. Built from the pseudonymized seed, no real identities. |
| `standalone/workflow/patch-workflow.mjs` | new | Writes `workflow/*.js` into the workflow JSON. The only thing that edits that blob. |
| `docs/RCM Auto-Assignment v2.json` | modified | `Match Groups` and `Distribute` bodies replaced via the patch script. Formatting preserved (1-space, CRLF) so the diff stays 2 lines, not 1,586. |
| `.gitignore` | modified | Added `standalone/docs/`, the n8n execution traces (real staff names and emails). |

### What the new matcher does differently

1. **Criteria, not axes.** `criterionAccepts` / `specificityOf` / `mergeCriteria`
   ported from `allocation-model.ts`. The department/payer special-casing is
   gone. Adding a routing axis is now a registry row.
2. **Dual input.** Groups carrying `criteria` use them; groups still in the v2
   shape are adapted into criteria by `criteriaFromLegacy`, so there is one
   matcher rather than two code paths, and no flag day when T-0002 changes.
3. **Contract semantics on missing values.** `IN` now rejects an item missing
   the field it filters on; `NOT_IN` accepts it. The v2 node let a missing
   encounter or claim status pass.
4. **Deterministic tie-break.** Equal specificity resolves on group id. Was
   database insertion order, which stops being harmless once fallback exists.
5. **`groupFallbacks`** on every assignment, all accepting groups narrowest
   first, so `Distribute` can fall through on capacity. Their members are added
   to `userIds` so T-0003 and T-004 actually fetch their capacity.
6. **`rejectedOn`** on every unmatched item, naming the dimension the nearest
   group rejected on.
7. **Multi-licence facility gate**, for `OPTIMA-4657`. Was `b.healthLicense ===
   item.facilityId`, now a membership test over a list.
8. **Registry over the wire.** Reads `allocationDimensions` from T-0002 when
   present, falling back to its own copy otherwise. `registry-parity.test.mjs`
   fails if the two drift.

### Two items closed as already done

- **`Step 3 - Capacities` now sends `teamId: null`**, with the reason recorded
  as a node note so it survives an n8n round-trip. `Distribute` reconciles the
  one-row-per-(user,team) result.
- **`priority-*` / `teamRank` needed no work.** The only hit anywhere outside
  the v1 workflow was a comment. The v2 rewrite had already dropped them and
  the seeds carry none.

### What Distribute does differently

1. **Utilisation, not raw count.** Sorting on `used/cap` instead of `used`. A
   member capped at 200 sitting on 20 items and one capped at 50 sitting on 10
   are not equally busy; the old sort picked the second and starved the first.
2. **Capacity fallback.** When the winning group has no room, the item walks
   `groupFallbacks` narrowest-first instead of overflowing. v2 dropped it with
   `reason: 'Group at capacity'` while eligible members sat idle in a slightly
   broader group.
3. **Lowest cap wins for multi-team members.** `teamId: null` returns one row
   per (user, team); the old uid-keyed map let row order decide silently.
4. **Reporting.** `fallbackCount`, `multiTeamMembers`, and `triedGroups` on
   each overflow.

### Aliases, a silent regression from v1

v1 carried a 42-entry `deptTagMap`. Normalisation covers 30 of those entries
(punctuation and case); the other **12 are genuine synonyms** that
`matchMode: NORMALISED` cannot reach, because no amount of normalising unifies
a misspelling with its correct spelling. v2 and v3 had dropped all of them.

Restored as a **dimension property** (`aliases`), not matcher logic, so it stays
a registry concern and a new client's synonyms are data.

Measured on the captured production day: **20 items** were alias-resolvable,
of which 13 also satisfied the other dimensions and now match.

| Queue spelling | Config spelling | Items |
|---|---|---|
| `Cardiology Services` | `cardiology` | 15 |
| `Dermatology` | `dermatalogy` | 5 |

`dermatology -> dermatalogy` maps onto the misspelling deliberately: that is
what the production team tags use, so it is canonical.

### Department is missing on a third of the queue

Measured across the traced 21,648-item execution:

| Work item type | Items | Carry a department |
|---|---|---|
| `CLAIM_VALIDATION` | 9,453 | all, 25 spellings |
| `AUTHORIZATION_SUBMISSION` | 5,159 | all, 24 spellings |
| `AUTHORIZATION_RESUBMISSION` | 131 | **none** |
| `CLAIM_SUBMISSION` | 6,905 | **none** |

So **7,036 items, 32.5% of the queue, carry no department at all**, and the
split is per work item type rather than per division. Under the contract's
`IN` rule a DEPARTMENT-constrained group rejects every one of them, and v1
already failed them too (`missing_department_on_dept_based_facility`). This is
a structural fact about the data, not a misconfiguration: a DEPARTMENT-axis
team currently cannot route resubmissions or claim submissions at all.

Needs a backend change to carry `department` on those two types. Until then the
alternative is routing them on a dimension they do have.

Queue values are display names (`Emergency`, `E. N. T.`, `Oncology/ Hematology`)
with **zero** carrying a `department-` prefix, so the prefix only ever appears
on the config side. A canonical picker list fixes config; the item side still
needs normalisation and aliases.

### Validation

| Harness | Before | After |
|---|---|---|
| `replay.mjs`, captured production day | 541 ranked, 66 matched, 475 unmatched, 3 batches | 541 ranked, **79** matched, 462 unmatched, 3 batches |
| `_run_v2_workflow.mjs`, generated data | 440 ranked, 293 matched, 147 unmatched, 22 batches | **identical** |
| `workflow/match-groups.test.mjs` | did not exist | 43 passed, 0 failed |
| `workflow/distribute.test.mjs` | did not exist | 18 passed, 0 failed |

The port itself was parity on both harnesses. The +13 on the replay came later,
from restoring the alias table, and is a regression fixed rather than a
behaviour change. See below.

**The replay does not exercise the semantic change**, which is why the unit
tests exist. Measured on the 541-item fixture: zero items have an unmapped
encounter, and all 541 have `claimStatus: null` while zero groups constrain
claim status. Both changed paths are unreachable in that data. The claim-status
case is a live landmine rather than a non-issue: the first group that names
claim statuses will reject every null-status item under the new rule.

### Found while doing it

**Department prefix mismatch.** A test row failed and was right to.
`normKey('department-emergency')` is `departmentemergency`,
`normKey('Emergency')` is `emergency`, so normalisation alone does not bridge
them. Three spellings are live at once: v1 team tags carry the `department-`
prefix, `prod-teams-v2.json` has it stripped, and the work queue sends the
display name. The replay only passed because its fixture happens to use the
stripped form. `normValue` now drops a leading dimension-code prefix, so all
three agree without a data migration. Still needs a canonical form named in the
contract.

**Tie-break was undefined.** Surfaced while writing the contract. Harmless
today because the losing group is simply unused; not harmless under capacity
fallback, where tie order decides which group is tried second. Now resolves on
group id.

### Simulating the new calls without touching production

The point of this is to configure the new workflow in n8n and watch the real
calls, with nothing pointed at prod.

```bash
cd standalone
node server.mjs                      # gateway-shaped, http://localhost:4000
node workflow/capture-fixtures.mjs   # -> docs/n8n-fixture-payload-v3.json
```

Two ways to drive it, both with `dryRun: true`, so T-0005 never fires even
against a live gateway:

| | How | Use when |
|---|---|---|
| Live local calls | `gatewayBaseUrl: "http://127.0.0.1:4000/api/tool"` | n8n runs on this machine. Real HTTP, editable data. |
| Fixture mode | POST `n8n-fixture-payload-v3.json` | n8n is remote and cannot reach your laptop. Workflow carries its own data, no tunnel. |

Both now exercise the **phase-2** shape. `FX Step 1 - Get Teams` was only
returning `optimaTeams`, so fixture mode quietly fell back to the node's
embedded registry and proved nothing about the served one; it now passes
`allocationDimensions` through. `capture-fixtures.mjs` replays its own output
through the workflow's Code nodes before declaring success, so a broken
fixture fails at capture rather than in front of an audience.

Verified this run:

```
T-0002  11 teams, 33 groups (33 carrying criteria)
        6 dimensions, 12 aliases
registry in fixture: 6 dimensions
Match Groups       465 matched · 195 unmatched
Distribute         23 batches · 465 placed · 0 via fallback
```

`_run_v2_http.mjs` over real HTTP gives 465/195 too, against a documented v2
baseline of 433/227. The +32 is the alias restoration.

### Next

1. Backend: carry `department` on `AUTHORIZATION_RESUBMISSION` and
   `CLAIM_SUBMISSION` items. 32.5% of the queue, the largest coverage blocker.
2. Track C: the rcm-dashboard semi-match.
3. Phase 2 proper: get the T-0002 gateway component updated to what
   `server.mjs` now serves.

### Still open

- **Department on resubmissions and claim submissions.** 32.5% of the queue,
  see above. Backend change, and the largest single blocker to coverage.
- **Canonical department value form.** The matcher tolerates slug, prefixed
  slug and display name. The picker should still write one form.
- **Coverage on `NOT_IN`.** A `NOT_IN` group technically covers everything else,
  which makes the coverage report weaker than it looks.
- **Who owns the T-0002 gateway component.** It gates phase 2, and
  `branches[].healthLicense` is federated in from the platform service rather
  than defined in Optima's schema.

---

## 2026-09-21d, running it in a real n8n

Webhook: `https://neurix.opt-test.iohealth.com/api/webhook/assignmentautoassignv3`.
Both modes now work against it.

| Mode | Payload | Tool calls | Use when |
|---|---|---|---|
| fixture | 192 KB | none | n8n cannot reach this machine |
| live | 0 KB | real, via tunnel | you want the actual calls exercised |

```bash
node server.mjs                                    # gateway on :4000
ngrok http 4000                                    # localtunnel is not usable, see below
node workflow/post-to-n8n.mjs <webhook>   --live --gateway https://<id>.ngrok-free.dev/api/tool
```

Verified live: HTTP 200, and one run added exactly one call each to T-0001,
T-0002, T-0003 and T-004 in the gateway log, and none to T-0005 because
`dryRun` was on. 660 ranked, 465 matched, 195 unmatched, 0 overflow, the same
figures the local harness produces.

### Four defects, each found only by doing it for real

**Fixture mode had never worked.** `Match Groups` named
`$('Step 1 - Get Teams')` and `Distribute` named the counts and capacities
steps, all HTTP nodes. Every tool step is gated, so in fixture mode those
nodes never execute and the reference is null. They now read whichever branch
actually ran.

**The harness was the reason it was not caught, which is worse than the bug.**
`capture-fixtures.mjs` copied each FX node's output into the HTTP node's slot,
which n8n will never do, and its `$()` stub returned undefined for a node that
had not run where n8n throws. It reported a clean fixture run against a
workflow that could not survive first contact. Both fixed: no aliasing, and
the stub throws.

**`--commit` in fixture mode would have written to production.** The four read
tools are gated; `Step 4 - Assign` is not, and fixture mode drops
`gatewayBaseUrl`, so the URL fell back to the node's production default. The
poster now refuses `--commit` unless `--live --gateway` is given.

**Live mode 404'd.** Tool URLs resolve their code from
`body.components[0].components.find(...)`, which production sends and a local
run does not, so the path built as `/api/tool/null`. Optional-chained, with
the plain tool code as the fallback.

### Tunnels

`localtunnel` issues a URL then serves 502/503 within a minute, matching what
`RCM-v2-workflow.md` already recorded. It also needs a `bypass-tunnel-reminder`
header that n8n's HTTP nodes will not send. **Use ngrok**: 200 on every
attempt, no headers, all five tools exercised through it including T-0005.

The ngrok URL is ephemeral. Do not save it into the workflow.

### Capacity moved onto the team query

Capacity is a team setting, so asking `effectiveAssignmentSettings` for it was
a second source for a question the team already answers, and that source is
the one with the membership bug. T-0002 now returns `uniformCapacity`,
`capacities { family limit allowExceed }` and `capacityOverride` per member.

Resolution order in `Distribute`: the member's override when the team is not on
uniform capacity, then the team's limit for that work item type's family, then
T-004. T-004 stays wired as a fallback for a gateway that has not been updated.

Proven by emptying `effectiveAssignmentSettings` from the fixture entirely:
465 items still placed across 23 batches, 0 overflow.

---

## 2026-09-21c, member unavailability restored

`953d901`. v1 had unavailability windows and v2 dropped the concept. It
surfaced as three invalid documents in `validate-queries`, but the query shape
was the smaller half: **an unavailable member stayed in the allocation pool and
kept being handed work while they were away**, in the app and in the workflow
both.

### What was restored

- `OptimaTeamUserUnavailability`, the input, and the UNASSIGN / REDISTRIBUTE
  enum, following v1's shape exactly.
- Validation follows v1 because the rules are not arbitrary: an inverted range
  is a typo, a non-member is the wrong team picked, and overlapping windows make
  "is this person away" ambiguous for the allocator.
- Cancelled, never deleted, so a window stays auditable.

**Availability is a property of the person, not of a group membership.** The
team id is recorded for provenance and permissions only. That matches v1, whose
own comment is explicit about why: UNASSIGN acts across every team, because an
assignment carries no team dimension.

### The correctness half

| Where | Change |
|---|---|
| `allocationPreview` | Capacity map is built from available members only, so someone away cannot be drawn and their capacity is not counted as available today |
| `Match Groups` | Filters before forming `groupMembers`, which also keeps them out of `userIds` so T-0003 and T-004 are not asked for the capacity of people who are not there |
| Overflow reason | A group whose members are all away now says so, instead of reporting the same "Group at capacity" as a genuinely full one |

An absent `unavailableToday` means available, so an older T-0002 that does not
select the field cannot silently empty every pool.

### Serving the v1 documents without breaking v2

v2 flattened `members` to `[User!]!` where v1 wrapped each member in an object,
so the v1 documents could not validate. Changing the return type would break
every v2 caller, so instead a member answers the wrapper's field names: `userId`
is its id and `user` is itself. `availableOnly` is accepted on both team and
group members.

### UNASSIGN is recorded, not executed

Upstream it calls `assignmentService.unassignAllActiveForCoder`. Standalone
simulates allocation per run rather than persisting assignments, so there is
nothing here to unassign, and pretending otherwise would have the demo claim an
effect it does not have. Either way the person leaves tonight's pool, which is
the part that changes what gets allocated.

### Verified

`validate-queries` goes from **3 invalid to 0**. `availability.test.mjs` adds 19
rows, and the one that matters was mutation-tested: reverting just the pool
filter fails `an unavailable member is given no work` and nothing else, so the
test is load-bearing rather than decorative.

`npm test` now also runs the schema smoke and query validation:

```
47 matcher · 18 distribute · 35 parity · 25 registry · 19 availability
smoke: all checks passed · 25 documents, 0 invalid · workflow in sync
```

Build clean, no console errors at 1440px or 900px.

### Next

1. **Department on `AUTHORIZATION_RESUBMISSION` and `CLAIM_SUBMISSION`**,
   32.5% of the queue, still the largest coverage blocker. Backend.
2. **T-0002 gateway component** updated to what `server.mjs` now serves
   (criteria, the registry, and `unavailableToday`), which is what phase 2
   waits on.
3. Unavailability UI: the dialog, list and indicator components exist in
   `standalone/src/features/master-data/components/` and are not yet wired to
   the restored mutations.
4. Dark theme pass over the new dashboard panels.

---

## 2026-09-21b, Track B and C: run history and the dashboard

### Committed

```
054474d  Allocation run history, and the dashboard panels to read it
fde037d  Workflow v3 matching: criteria, capacity fallback, offline simulation
6b99751  Teams v3: dimension registry, criteria builder, allocation dashboard
```

Secret scan before each: gitleaks found four hits in the working tree
(`.env`, `docs/Walkthough.md`, `docs/RCM Auto-Assignment (1).json`,
`standalone/dist/`), all gitignored and untracked, so none could be staged.
`gitleaks protect --staged` clean on every commit.

### Track B, the observability gap

`assignment_auto_assign_request_response_log` already holds every run's
request, response and failure flag, indexed on `created_date` and `is_failed`,
and no GraphQL field reads it. Closing that is the cheapest high-value thing
on the whole list, so it went first.

`AllocationRun` is the shape that table should be read through. Upstream parses
`responsePayload` into it; here it is produced by running the existing preview
engine across every team, so the shape is exercised against real behaviour
rather than a fixture that agrees with itself.

**Unmatched and overflow are now counted apart.** They arrive in the same array
from the preview engine and they are different failures: nothing accepted the
item (coverage, a configuration problem) against a group accepted it and had no
capacity (staffing). Counting them together makes a coverage gap look like a
staffing gap, which sends a supervisor to hire instead of to the group editor.

`rejectionReason` became `rejectionDetail`, returning the dimension and value
next to the sentence. It already computed both and discarded them, which is why
"why did this fall through" could only ever be rendered as prose.

### Track C, the dashboard

Laid out to match upstream `features/rcm-dashboard`'s `MyTeamTab`: counts strip,
then chart paired with breakdown, then a second pair.

`dashboard-chart.tsx` holds the conventions once. Upstream repeats the same
tooltip, axis and dark-theme setup in every chart and differs only in the
series; copying that repetition would have been five chances to drift. Colours
and axis styling are taken verbatim from `aging-chart.tsx` and
`assignment-overview-chart.tsx`, so a chart here reads as the same chart.

Two things the first screenshot caught, both real:

- **The gradient was lying.** `BAR_COLORS` runs green to orange, which encodes
  "further right is worse". True of aging buckets, false of a group breakdown.
  Now opt-in via `palette="gradient"`.
- **The x-axis was unreadable.** Eight bars labelled Submission, Coders,
  Submission, Resubmission. Group names repeat across teams, so the bare name
  is not a label; ambiguous ones are now qualified by team.

And one bug: the label `useMemo` went in below the early returns, so the hook
order changed between renders and the panel threw. Caught by the screenshot
run, not by the build.

**Bundle.** echarts via its default entry cost 607 KB (201 KB gzipped) for a
page that draws bars. Registering `BarChart`, `Grid`, `Tooltip`, `Legend` and
`CanvasRenderer` per-component gets that back. Matters because this deploys
publicly.

### Verified

| | |
|---|---|
| `npm test` | 43 matcher, 18 distribute, 35 parity, 25 registry, workflow in sync |
| `smoke-v3.mjs` | all checks passed |
| `validate-queries.mjs` | 25 documents, new `AllocationRuns` valid |
| `npm run build` | clean, 1,867 KB / 567 KB gzipped |
| `shots.mjs` | no console errors at 1440px or 900px |

### A pre-existing failure, not introduced here

`validate-queries.mjs` reports 3 invalid documents, all v1 unavailability
operations in `vendor/app/generated.ts`:
`GetOptimaTeamMembers` (`availableOnly`, `userId`, `unavailableToday`),
`SetOptimaTeamUserUnavailability`, `CancelOptimaTeamUserUnavailability`.

Confirmed pre-existing by stashing this session's work and re-running: 3 invalid
before, 3 invalid after. The v2 schema never implemented member unavailability,
which v1 has and the extraction carried over. Worth closing, since availability
is a real input to allocation: an unavailable member should drop out of the
pool before the draw, and today nothing removes them.

### Next

1. **Member unavailability in the v2 schema**, above. It is also an allocation
   correctness gap, not only a broken query.
2. **Department on resubmissions and claim submissions**, 32.5% of the queue,
   still the largest coverage blocker. Backend.
3. **T-0002 gateway component** updated to what `server.mjs` now serves, which
   is what phase 2 waits on.
4. Dark theme pass over the new panels. The tokens and `.dark` variant exist
   and the charts follow the class, but nothing has been reviewed side by side
   against the real dashboard yet.

---

## Background established before this session

- Prod runs **v1** of the workflow. 43 batches (facility x work item type),
  21,648 items in the traced execution, looped **sequentially** by
  `splitInBatches` (default size 1), not in parallel.
- v1's auth distributor is already a round-robin (`i % teamPool.length`), but
  the cursor **resets per department**, so the highest-capacity member takes the
  first item of every department. That is the bias randomness was proposed to
  fix; a persistent cursor or least-loaded fixes it properly.
- `teamRank` is `99` on every team in prod. The `priority-*` ranking is inert.
- `effectiveAssignmentSettings` with a non-null `teamId` applies that team's caps
  to **every** user in the list without checking membership. Caps are per-team
  and per-division (`maxClaim: 0, maxAuth: 200`), so a wrong `teamId` reads as
  zero capacity rather than erroring.
- Live prod has **seven** teams named "Authorization Team OP (Dubai)", ids 8-14,
  same branch, one or two members each. `TEAMS-V2.md` predicted six. This is the
  container model's argument making itself out of production data.
- The real bottleneck is **coverage, not the algorithm**: in the replay, 76% of
  the day's work sat at facilities with no team configured at all.
