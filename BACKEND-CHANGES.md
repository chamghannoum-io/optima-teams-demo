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
    criteria { dimension operator values }
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
    aliases { from to }
  }
}
```

### Notes on it

- The v2 fields (`workItemTypes`, `departments`, `payers`, `payerCatchAll`,
  `claimStatuses`) are deliberately still selected. The workflow prefers
  `effectiveCriteria` and falls back to them, so the change needs no flag day
  and a rollback is a query edit rather than a deploy.
- `allocationDimensions` is a second root field on the same document, fetched
  once per run.
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
