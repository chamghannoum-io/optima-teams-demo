# Teams v2 — backend design

New allocation model: **a team is a container, groups carry the tags and the members.**
This document covers the backend, which is the first of three deliverables
(backend → frontend → n8n workflow).

Ranking of work items is **unchanged** from v1 (`priority/value + ageDays × 0.7`).

## The shape

```
Team: Dubai × AUTH × OP          ← container: facility × division × encounter
  logicAxis: DEPARTMENT           ← declared once, inherited by every group
  capacity: DERIVED (not stored)
  │
  ├── Group: AUTH_RESUBMISSION — ENT, ICU, GYN          members: [u1,u2,u3]
  ├── Group: AUTH_RESUBMISSION — Cardio, Emergency, Dental  members: [u3,u4]
  ├── Group: AUTH_SUBMISSION                            members: [u1,u5]
  └── Group: AUTH_SUBMISSION + AUTH_RESUBMISSION        members: [u2,u5]

  Team roster = de-duplicated union = {u1..u5} = 5 members
```

## Decisions

| Decision | Choice |
|---|---|
| Membership | On **groups**. Team roster is the de-duplicated union. |
| Capacity | **Derived**, never stored — summed capacity of the de-duplicated roster. |
| Rotation | Moves **members between groups**; assigned work stays with the member. |
| Group match | **Narrowest group wins**, remaining capacity breaks ties. |
| Catch-all groups | **None.** Every department is named explicitly. |
| Coverage gaps | **Hard block on activation** for DEPARTMENT teams; PAYER teams exempt. |
| Logic axis | On the **team**, inherited by groups. DEPARTMENT ⇒ payers implicitly all. |
| AUTH/CLAIM mixing | **Hard rejected** by the backend. |
| Payer + department in one group | **Hard rejected.** |
| Multi-team membership | Allowed; mutation returns advisory warnings. |

## Specificity — why narrowness, not count

When several groups match an item the narrowest must win, so a group naming ENT beats
one naming six departments. Scoring by *how many values a dimension admits* rather than
by *how many it lists*:

```
score(dimension) = 0            if unconstrained (wildcard)
                 = 100 / size   otherwise
```

An unconstrained dimension scores 0, so it never out-ranks a group that constrains it.
Against the Team 1 example:

| Group | Score |
|---|---|
| `AUTH_RESUBMISSION — ENT, ICU, GYN` | **233** |
| `AUTH_RESUBMISSION — Cardio, Emergency, Dental` | **233** |
| `AUTH_SUBMISSION` (6 depts) | 216 |
| `AUTH_SUBMISSION + AUTH_RESUBMISSION` (6 depts) | 166 |

Summing counts instead would invert this and let the broadest group win — a bug caught
by the matcher tests before it reached the resolver.

## Files

| Path | Role |
|---|---|
| `domain/RcmTeamV2.java` | Team container; facility, division, scope, axis, rotation |
| `domain/RcmTeamGroup.java` | Group: typed criteria + `specificity()` |
| `domain/RcmTeamGroupMember.java` | Membership with immutable `homeGroupId` |
| `enumeration/RcmTeamDivision.java` | AUTH / CLAIM |
| `enumeration/RcmTeamEncounterScope.java` | OP / IP / BOTH, with `covers()` |
| `enumeration/RcmTeamLogicAxis.java` | DEPARTMENT / PAYER |
| `service/impl/RcmTeamV2Validator.java` | The hard blocks |
| `service/impl/RcmTeamGroupMatcher.java` | Narrowest-wins matching, coverage |
| `service/impl/RcmTeamRotationService.java` | Group rotation + reset to home |
| `service/dto/RcmTeamCapacity.java` | Derived capacity, incl. duplicate count |
| `service/dto/RcmTeamMemberWarning.java` | Multi-team advisory warning |
| `service/dto/RcmTeamCoverageReport.java` | Uncovered depts / types / empty groups |
| `repository/RcmTeamV2Repository.java` | Specifications, matching v1 style |
| `repository/RcmTeamGroupRepository.java` | Groups by team, in rotation order |
| `repository/RcmTeamGroupMemberRepository.java` | Distinct roster, other-team lookup |
| `service/impl/RcmTeamV2ServiceImpl.java` | Team/group/member CRUD, vendor scoping |
| `service/impl/RcmTeamCapacityService.java` | Derived capacity over the de-dup'd roster |
| `service/impl/RcmTeamCoverageService.java` | Coverage analysis, hard block, suggestions |
| `service/impl/RcmTeamV1ToV2Migrator.java` | v1 tag strings → typed groups |
| `web/graphql/RcmTeamV2Resource.java` | DGS resolver: 5 queries, 10 mutations |
| `resources/config/liquibase/.../20260903120000_rcm_team_v2.xml` | 8 tables, 7 FKs, 14 indexes |
| `resources/schema/teams-v2.graphqls` | GraphQL contract (validated, parses) |

## Rotation semantics

Each cycle every member shifts one position along their team's group order, wrapping.
Work already assigned **stays with the member** — only new allocation follows the new
group. Two fields make this reproducible:

- `RcmTeamGroupMember.homeGroupId` — immutable, where the member started
- `RcmTeamV2.rotationOffset` — how many positions the team has shifted

`optimaTeamV2RotationReset` returns everyone home and zeroes the offset.

Because capacity is derived from the de-duplicated roster, **rotation does not change a
team's total capacity** — the same people are present, in different groups. Only
per-group capacity moves.

## Migration from v1

`RcmTeamV1ToV2Migrator` parses v1's comma-separated tag strings into typed groups.
The structural change: **v1 teams sharing a facility, division and encounter scope
become groups of one v2 team.**

Dry-run against the 16 production teams:

```
16 v1 teams  ->  10 v2 teams

Saudi German Hospital | AUTH | OP        6 groups
    10 memberships -> 5 distinct members (5 de-duplicated)
RAK CLINIC Pharmacy - RIAYATI | CLAIM | IP   2 groups
SGH- Sharjah | AUTH | BOTH                   1 group (14 depts)
... 7 more
```

The six identically named "Authorization Team OP (Dubai)" teams collapse into one team
with six groups — and their overlapping members de-duplicate from 10 to 5. That is the
derived-capacity case appearing naturally in real data.

**All 16 teams migrate cleanly** — none mixes AUTH and CLAIM, so the hard validation
rejects nothing that exists today. `migrate(dryRun)` reports what it would do without
writing; `priority-*` tags are dropped deliberately, since v2 replaces v1's team
ranking with group specificity.

## Still to do

- Wire `AssignmentSettingsSource` to `effectiveAssignmentSettings` (interface defined,
  shape confirmed: `maxAuth` / `maxClaim` per user, already takes a `teamId`)
- Wire `FacilityDepartmentSource` to observed claim departments
- Frontend, then the n8n workflow

## Departments — why an enum, not the `vendorDepartments` entity

`RcmDepartment` holds **28 canonical departments with 42 aliases**, generated from the
`deptTagMap` in the production allocation workflow.

The obvious alternative — resolving against the `vendorDepartments` entity that backs
the Departments tab — was measured and rejected:

| | Count |
|---|---|
| Department tags used by the 16 production teams | 24 |
| `vendorDepartments` rows (live, prod) | 14 |
| **Team tags with no matching `vendorDepartments` row** | **19 of 24** |

`vendorDepartments` is a per-branch administrative list covering 2 branches and
including non-clinical entries (`Outpatients`, `Laboratoties`, `Radiology`). Matching
allocation departments against it would break 19 of the 24 departments currently in use.

Aliases matter because source systems spell departments inconsistently:

```
"E. N. T." / "e.n.t." / "ENT"                    -> E_N_T
"Intensive Care Unit - ICU" / "ICU"              -> ICU
"GIHC Oncology" / "Hematology" / "Oncology"      -> ONCOLOGY
"Dr. Amr El Shawarbi  Neurosurgery Center"       -> NEUROSURGERY
```

`RcmDepartment.fromDisplayName` applies the same normalisation as the workflow
(lowercase, strip non-alphanumerics). **Verified: all 24 department tags in production
resolve, zero failures.** An unmapped name resolves to empty and the item is reported
uncovered rather than mis-assigned.

Groups store `List<RcmDepartment>`, so a misspelled department is rejected at save
instead of silently never matching.

## The two axes are asymmetric

This is the core routing rule, and the two axes deliberately behave differently:

**PAYER team — department is not a factor.**
A claim for ENT from Sukoon routes on the payer alone; the department is never
consulted. An item with no department at all still routes fine.

```
Team: Dubai × CLAIM × OP   logicAxis: PAYER
  ├── Group: Sukoon          ← ENT+Sukoon lands here
  └── Group: Daman, ADNIC       Oncology+Sukoon lands here too
```

**DEPARTMENT team — payers are implicitly all, and coverage is mandatory.**
Every department the facility handles must be assigned to some group before the team
can be activated. 18 departments over 3 groups means all 18 must be distributed.

```
requireCompleteCoverage() throws:
  "Team 'Dubai × AUTH × OP' splits by DEPARTMENT so every department must be
   assigned to a group before it can be active. 3 of 18 uncovered:
   [department-ophthalmology, department-orthopedics, department-surgery]"
```

An **inactive** team may be saved incomplete, so a team can be built up over several
edits and only has to be whole at the moment it goes live.

### Suggested distribution

`optimaTeamV2SuggestDepartments` proposes an even split so the requirement is easy to
satisfy. Departments already assigned stay put; the rest are dealt to the emptiest
group. 18 departments over 3 empty groups → **6 / 6 / 6**. Verified 18/18 in tests,
including that the suggestion always satisfies the block.

## Payer catch-all, and volume-driven recommendations

Departments and payers have very different shapes, so they get different rules.

**Payers have a long tail.** Measured across every site in `workitem_profile.xlsx`:
56–69 payers per site, of which **10–15 carry ~85–90% of volume** and 20–32 sit below
one item a day. Naming all of them is impractical, and a payer seen for the first time
would match nothing.

So a group may set `payerCatchAll` — it accepts any payer no group names explicitly.
Several groups normally share catch-all duty, so the tail is split rather than dumped
on one group. A catch-all scores **zero** on the payer dimension in `specificity()`, so
a group naming the payer always wins over one merely accepting anything.

### Recommendations are volume-driven, not count-driven

`RcmTeamDistributionAdvisor` packs by observed daily volume (heaviest item into the
lightest group), because an even *count* is not an even *workload*. At the busiest site
(28 departments, real volumes, 4 groups):

```
volume-packed:   307.1 / 307.2 / 306.7 / 307.1 per day    max/min 1.00
naive 7/7/7/7:   493   / 294   / 229   / 212              max/min 2.32
```

The naive split gives one group **2.3× the work** of another — Internal Medicine alone
is 297/day at that site while the tail is under 1/day. Groups end up with 3, 6, 12 and 7
departments respectively; that asymmetry is the point.

Payers, 59 over 4 groups: 15 named and packed, 44 tail payers (136/day) shared —
**max/min 1.04**.

### Overflow warnings

`optimaTeamV2DistributionAdvice` projects each group's load against its capacity and
reports what will not hold, in order of cost:

| Severity | Condition |
|---|---|
| **BLOCKER** | group has volume but no members — work cannot be assigned |
| **BLOCKER** | mean > capacity — overflows every day, not just at peak |
| **BLOCKER** | PAYER team with unnamed payers and no catch-all |
| **WARNING** | peak > capacity — busy days overflow (peak = mean × P90/P50) |
| **WARNING** | busiest group ≥ 2× the quietest |

The burst factor is real: P90/P50 runs **1.16–4.66** by site, because claims batch and
auth does not. A group sized to the median will overflow. Example output:

```
WARNING  'Coders A' fits on average (297) but peaks at 621 vs capacity 400
BLOCKER  'Coders B' projected 139/day vs capacity 100 — overflows daily
BLOCKER  'Coders C' projected 80/day but has no members
WARNING  uneven: 297 vs 60 (5.0x)
```

Verified 10/10 against real SGH volumes.

## Payers — validated against the master list

Pulled live: **138 payers, 137 active, no duplicate licence numbers**
(`docs/payers-reference.json`, gitignored). Sukoon Insurance is `id=2`, `INS012`.

Groups referencing payers are validated through `RcmTeamV2Validator.PayerValidator`:
unknown ids and inactive payers are rejected at save, because a bad payer id otherwise
means "matches nothing" and only shows up as unallocated work at 2am.

Note `optimaPayers` (the vendor-scoped lookup) returns **0 rows** for the integration
client — the master list comes from the `payers` root query instead.

## Encounter split — both layouts supported

A facility can be set up either way, enforced by `RcmTeamEncounterScope.covers()`:

**One team covering both** — `encounterScope: BOTH`, with either encounter-specific
groups or BOTH groups:

```
Team: SHJ × AUTH × BOTH
  ├── Group OP — ENT, Cardiology     ← OP items land here
  └── Group IP — ENT, Cardiology     ← IP items land here
```

**Two teams split by encounter:**

```
Team: Dubai × AUTH × OP   (only OP items match)
Team: Dubai × AUTH × IP   (only IP items match)
```

A group can never widen its team's scope: an OP team rejects an IP group *and* a BOTH
group at validation. 14/14 tests cover both layouts and the rejection cases.

## Open questions for review

1. ~~Departments as free text~~ — **resolved**: typed `RcmDepartment` enum (above).
2. ~~v1 coexistence~~ — **resolved**: parallel, confirmed.
3. **`facilityId` is a health licence string**, matching v1's
   `branches.healthLicense === facilityId`. Worth making it a real FK?
4. **Per-user capacity source.** Derived capacity needs `maxAuth` from
   `effectiveAssignmentSettings`, which lives outside this service — confirm the
   intended interface.
5. ~~Facility department list~~ — **resolved**: derive from observed claim data.
   See below.

## Facility department list — derived from claims

`docs/departments-observed.csv` (real query output, 1,010 claims) is the source for
"which departments does this facility actually handle", answering what
`vendorDepartments` could not.

Checked against `RcmDepartment`: **30 of 31 observed spellings resolve.** All 24
production team tags still resolve. Two aliases were added from this data:

| Observed spelling | Maps to | Why |
|---|---|---|
| `Intensive Care Unit` (no suffix) | `ICU` | v1 only aliased `intensive care unit - icu` |
| `Oncology/ Hematology` | `ONCOLOGY` | v1 aliased `hematology` but not this combined form |

### One unmapped value — needs a decision

`Plastic/Briatric Surgery` (4 claims, 0.4%) has no mapping and is **not** in v1's
`deptTagMap` either, so it is already falling through in production today. Mapping it
to `SURGERY` is a clinical judgement, not a spelling fix, so it is left unmapped
rather than guessed. Options: add it to `SURGERY`, or give it its own department.
(Note the source spelling misspells "Bariatric".)

### A merge conflict to confirm

The CSV merges `Clinical Psychiatry` → `Psychiatry`, but the enum keeps
`department-clinical-psychiatry` and `department-psychiatry` as **separate**
departments — and production teams tag them separately. The enum currently wins, so
the two stay distinct. If they should be one department, that changes team
configuration, not just the mapping.
