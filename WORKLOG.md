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
