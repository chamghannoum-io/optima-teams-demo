# Changes needed outside this repo

Two things the v3 allocation work depends on that live in systems this repo
does not own. Both are small. Both are written out to the file and line so
whoever owns them can act without re-deriving the analysis.

Nothing here blocks the standalone demo, which already behaves as though both
are done. That is worth saying plainly: **the demo currently looks better than
production**, and the gap is item 1.

---

## 1. `department` is missing from four of the five work item types

**Owner:** Optima backend (`my-workforce/Optima`)
**Impact:** 32.5% of the nightly queue cannot be routed by a DEPARTMENT team.

### What was measured

Across the traced production run, 21,648 work items:

| Work item type | Items | Carries `department` |
|---|---|---|
| `CLAIM_VALIDATION` | 9,453 | yes, 25 spellings |
| `AUTHORIZATION_SUBMISSION` | 5,159 | yes, 24 spellings |
| `AUTHORIZATION_RESUBMISSION` | 131 | **none** |
| `CLAIM_SUBMISSION` | 6,905 | **none** |

7,036 items, 32.5% of the queue, arrive with no department at all. A team that
routes on DEPARTMENT therefore cannot place any of them, and they are reported
unmatched every night. v1 failed them too, as
`missing_department_on_dept_based_facility`, so this is long-standing rather
than a regression.

### Why it is not a data problem

`department` is a field on the same entities these queries already read. The
projections simply do not select it:

| Projection | Work item type | Selects `department` |
|---|---|---|
| `AuthorizationSubmissionRepository:109` | AUTHORIZATION_SUBMISSION | yes |
| `AuthorizationSubmissionRepository:128` | AUTHORIZATION_SUBMISSION | yes |
| `ClaimSubmissionRepository:147` | CLAIM_VALIDATION | yes |
| `ClaimSubmissionRepository:168` | CLAIM_VALIDATION | yes |
| `AuthorizationSubmissionRepository:163` | AUTHORIZATION_RESUBMISSION | **no** |
| `AuthorizationSubmissionRepository:181` | AUTHORIZATION_RESUBMISSION | **no** |
| `ClaimSubmissionRepository:54` | CLAIM_RESUBMISSION | **no** |
| `ClaimSubmissionRepository:77` | CLAIM_RESUBMISSION | **no** |
| `ClaimSubmissionRepository:102` | CLAIM_SUBMISSION | **no** |
| `ClaimSubmissionRepository:121` | CLAIM_SUBMISSION | **no** |

The four working projections prove the expression: `asub.department` and
`cs.department`, no join required.

### The change

1. Add `department` to the six projections above, in the same position the
   working queries use (after `branchId, createdAt`), and update the
   `// [id, facility, ...]` comment that documents each projection's order.
2. In `AssignmentAutoAssignService`, read it and pass it to the builder, in
   `getUnassignedAuthorizationResubmissions`, `getUnassignedClaimResubmissions`
   and `getUnassignedClaimSubmissions`. The two working paths do this already
   at lines 166 and 200, so copy the shape:

   ```java
   String department = row[6] != null ? row[6].toString() : null;
   // ...
   UnassignedWorkItem.builder()... .department(department) ...
   ```

   **Every subsequent `row[N]` index in those three methods shifts by one.**
   That is the only part with any risk in it, and it is the reason to do all
   three in one change rather than piecemeal.

3. `UnassignedWorkItem` already has the field. No GraphQL or DTO change.

### How to confirm it worked

`department` non-null on all five types in the T-0001 response, and the
workflow's unmatched count for `rejectedOn: "DEPARTMENT"` dropping. The
matcher already reports that dimension by name.

---

## 2. T-0002 must return criteria and the dimension registry

**Owner:** whoever maintains the Cortex component gateway
**Impact:** phase 2 of the matcher migration waits on this. Nothing breaks
without it: the workflow adapts the v2 shape and falls back to its own copy of
the registry, and `registry-parity.test.mjs` fails if that copy drifts.

### Why

Routing rules are criteria now, not fixed axes. The workflow can consume them
the moment T-0002 returns them, and the department/payer adapter retires.

Capacity is included for a separate reason: it is a team setting, written on
the team's Rules step, so reading it back from `effectiveAssignmentSettings`
asks a second source the same question, and that source applies one team's caps
to every user in the list without checking membership.

### The operation

This is what `standalone/server.mjs` serves today, verified against the local
schema. The gateway's stored operation for T-0002 should match it:

```graphql
query ($filter: OptimaTeamFilterInput) {
  optimaTeams(filter: $filter) {
    id name active division encounterScope logicAxis facilityId
    criteria { dimension operator values locked }
    branches { id name healthLicense }
    uniformCapacity
    capacities { family limit allowExceed }
    groups {
      id name active specificity
      criteria { dimension operator values }
      effectiveCriteria { dimension operator values }
      workItemTypes encounterScope
      departments payers payerCatchAll claimStatuses
      members { id firstName lastName unavailableToday capacityOverride }
    }
  }
  allocationDimensions {
    code itemField matchMode coverageChecked sortOrder
    numeric unit numericOptions appliesToTypes
    aliases { from to }
  }
}
```

### Notes on it

- `locked` is selected on the **team's** criteria only. It says whether a group
  may restate that dimension, and `mergeCriteria` takes the team's clause over
  the group's where it is set. A group's criteria never carry it. An older
  gateway that does not return the field reads as `false` everywhere, which is
  the behaviour before locking existed, so this too needs no flag day.
- The v2 fields (`workItemTypes`, `departments`, `payers`, `payerCatchAll`,
  `claimStatuses`) are deliberately still selected. The workflow prefers
  `effectiveCriteria` and falls back to them, so the change needs no flag day
  and a rollback is a query edit rather than a deploy.
- `allocationDimensions` is a second root field on the same document, fetched
  once per run.
- **`GREATER_THAN` is a new operator** on `CriterionOperator`, and it is how a
  group says "high cost". A group's criteria may now include
  `{dimension: "ITEM_VALUE", operator: "GREATER_THAN", values: ["10000"]}`,
  which admits an item only when its `net` is a number above that. The
  workflow's matcher already implements it; a gateway that does not know the
  enum value will fail to serialise the clause, which is the one part of this
  that is NOT backward compatible and has to land before any team is
  configured with it in production.
- `numeric`, `unit`, `numericOptions` and `appliesToTypes` on the registry row
  are for the UI, not the matcher: they say the dimension is edited by a
  switch and a dropdown rather than a value picker, what the dropdown offers,
  and which work it is offered on. An older gateway omitting them degrades to
  the dimension simply not being offered in the editor.
- `unavailableToday` matters for correctness, not display: the matcher drops
  those members before building the pool, so T-0003 and T-004 are not asked
  about people who are away. An absent field reads as available, so an older
  gateway degrades safely rather than emptying every pool.
- `branches[].healthLicense` is federated in from the platform service via
  `GraphQlBackendService`; it is not defined in Optima's own schema. Worth
  knowing if the field disappears.
- Since `OPTIMA-4657` a branch can hold several licences. The matcher already
  treats the facility gate as a list membership test, so a `healthLicenses`
  array would be consumed correctly if the platform starts returning one.

### Until then

The workflow runs against the current gateway unchanged. To exercise the
phase-2 shape without touching the gateway, point it at the local server:

```bash
cd standalone && node server.mjs      # serves exactly the operation above
```

## 3. Supervising is per team, not a flag on the person

**Owner:** Optima backend
**Impact:** correctness. A save on one team can currently demote a supervisor
on another.

### What is wrong

`User.isSupervisor` is a single boolean on the person, and the Teams screen
reads it as "supervises this team". Those are different statements the moment
anybody works on two teams, which in the live estate they do: the same coder
appears on a Dubai claims team and a Sharjah one.

Two things follow, both observed locally against the captured estate:

1. Somebody who supervises team A shows as a supervisor of team B, where they
   are an ordinary member.
2. Saving team B writes `isSupervisor = (is in B's supervisor list)` over the
   person, which sets it to **false** and silently removes them as supervisor
   of team A. Nothing in the UI says so, and the only visible effect is that
   A's readiness issues stop reaching anybody.

A second, quieter version of (1): the captured seed embeds a copy of each
member inside every team that holds them, so one person is several objects and
a flag set on one is invisible through the others. Any client that normalises
by id then shows whichever copy was serialised last.

### The change

1. Store the relationship on the team: `RcmTeamV2.supervisorIds: [ID!]!` and
   `supervisors: [User!]!`. `TeamV2Input.supervisorIds` already exists and is
   already what the wizard sends, so the write path needs no new input.
2. Keep `User.isSupervisor` as a property of the **person**, meaning "supervises
   something". Derive it; never write it from a single team's save.
3. Return one user record per person, not a copy per membership.

### How to confirm it worked

Put the same person on two teams, make them supervisor of one, save the other,
and re-read the first: they are still its supervisor. `smoke-v3.mjs` section 12
asserts exactly this against the local schema.
