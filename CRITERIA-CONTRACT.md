# The criteria contract

One wire format for routing rules, shared by three consumers. This is the thing
Track A (n8n), Track B (Optima backend) and Track C (UI) are all built against,
so it is written down once here rather than re-derived in each.

Status: implemented in `standalone/src/mocks/schema-v2.ts` and
`standalone/src/mocks/allocation-model.ts`. Not yet in upstream Optima, and not
yet read by the n8n workflow. See [Migration](#migration-two-phase).

## Why a contract and not just a schema

v2 hardcoded four routing axes: `facilityId`, `division`, `encounterScope`, and a
`logicAxis` enum of `DEPARTMENT | PAYER`. That carried SGH but meant a client who
splits work any other way needed a schema change, a matcher change and a new
wizard step.

v3 makes the axes registry rows. A routing rule becomes a list of
`{dimension, operator, values}`. Adding "claim value band" for the next client is
a row plus a value source, and the matcher, the schema and the UI are untouched.

That only holds if every consumer agrees on the shape *and* on the matching
semantics. A registry read three slightly different ways is worse than a
hardcoded axis, because the disagreement shows up as unallocated work at 2am
rather than as a compile error.

## The three consumers

| Consumer | Reads | Uses it for |
|---|---|---|
| Teams UI, `criteria-builder.tsx` | `allocationDimensions`, `dimensionOptions` | rendering the editor, no per-dimension wiring |
| Optima backend | `criteria` on team and group | validation, coverage, storage |
| n8n, `Match Groups` | `effectiveCriteria` + `allocationDimensions` | deciding which group takes an item |

The backend is the only writer. The UI proposes, the backend validates, n8n only
ever reads.

## Types

```graphql
enum CriterionOperator { IN NOT_IN ANY }
enum CriterionLevel    { TEAM GROUP BOTH }

type Criterion {
  dimension: String!            # AllocationDimension.code
  operator:  CriterionOperator!
  values:    [String!]!         # empty when operator is ANY
}

type AllocationDimension {
  code:            String!
  label:           String!
  level:           CriterionLevel!      # where an admin may constrain it
  operators:       [CriterionOperator!]!
  valueSource:     String!              # backs dimensionOptions()
  itemField:       String!              # field on a work item this tests
  coverageChecked: Boolean!             # report values no group covers
  matchMode:       MatchMode!           # EXACT | NORMALISED
  valueStyle:      ValueStyle!          # CODE | ENUM | NAME, display only
  aliases:         [DimensionAlias!]    # synonyms, see Comparison
  sortOrder:       Int!
}
```

`itemField` is the whole matcher. A dimension tests exactly one field on a work
item, named by the registry, which is why adding a dimension needs no code.

## Matching semantics

Normative. Reference implementation is `criterionAccepts` in
`allocation-model.ts`; any reimplementation must agree with it on every row.

| Case | Result |
|---|---|
| Criterion absent for a dimension | Accepts. Unconstrained. |
| `operator: ANY` | Accepts. Deliberately everything, and it is what the old payer catch-all became. |
| `IN`, item value present and in `values` | Accepts |
| `IN`, item value present and not in `values` | Rejects |
| `IN`, item value missing or empty | **Rejects.** An item missing the field it is filtered on cannot match. |
| `NOT_IN`, item value present and in `values` | Rejects |
| `NOT_IN`, item value present and not in `values` | Accepts |
| `NOT_IN`, item value missing or empty | **Accepts.** Absence cannot prove exclusion. |

The asymmetry on a missing value is deliberate. `IN` is a positive claim and
needs evidence; `NOT_IN` is an exclusion and a missing value is not evidence of
membership.

A rule accepts an item when **every** criterion accepts it. Criteria AND
together; there is no OR at this level. Use several groups instead.

### Comparison

`matchMode: NORMALISED` lowercases and strips non-alphanumerics on both sides,
then drops a leading dimension-code prefix, then resolves synonyms through the
dimension's `aliases` map. `DEPARTMENT` is the only NORMALISED dimension today,
because source systems spell departments inconsistently while payers and codes
are exact.

All three steps are load-bearing, and each answers a spelling that is live in
production right now:

| Step | Bridges | Example |
|---|---|---|
| lowercase, strip non-alphanumerics | punctuation and case | `"E. N. T."` = `"ENT"` |
| strip dimension-code prefix | config slug vs display name | `department-emergency` = `Emergency` |
| `aliases` lookup | synonyms and misspellings | `Cardiology Services` = `cardiology` |

The third cannot be derived, so it is data. `aliases` is a map of normalised
alias to normalised canonical value, carried by the dimension:

`DimensionAlias` is `{ from, to }`, both normalised.

v1 carried a 42-entry `deptTagMap`. Thirty of those entries are punctuation and
case, which the first step handles; the remaining **12 are genuine synonyms**
that no amount of normalising reaches, because a misspelling never normalises
to its correct spelling. Dropping them was a silent regression: on the captured
production day it cost 20 items, 15 of them `Cardiology Services`.

Note `dermatology -> dermatalogy` maps onto the misspelling on purpose. That is
the spelling the production team tags use, so it is the canonical one.

None of this is cosmetic. Before normalisation the captured production replay
matched **0 of 541** items, because the queue says `"Emergency"` where config
stores `department-emergency` and there was zero exact overlap across all 21
departments.

## Specificity

When several groups accept an item the narrowest wins.

```
specificity = (dimensions constrained) x 1000
            + sum over constrained dimensions of:
                NOT_IN -> 1
                IN     -> floor(100 / values.length)
```

Constraining more dimensions always beats constraining fewer, so the count
leads. Within that, naming one value beats naming six. `ANY` and an empty
`values` do not count as constrained, so they never out-rank a real constraint,
and `NOT_IN` scores 1 because excluding three payers barely narrows anything.

Summing per-value counts instead inverts this and lets the broadest group win.
That was a real bug, caught by the matcher tests before it reached the resolver.

**Ties resolve on group id, ascending.** Specificity alone left equally narrow
groups resolving by array order, which is database insertion order. That was
invisible while the losing group was simply unused, but under capacity fallback
tie order decides which group is tried second, so the same input could allocate
differently night to night. Any deterministic, stable rule would do; group id
is the one implemented.

## The narrowing invariant

A group inherits its team's rule and may only narrow it, never widen it.

- `effectiveCriteria = mergeCriteria(team.criteria, group.criteria)`, and where
  both constrain the same dimension the group's clause wins.
- `widensBeyond(team, group)` returns the dimensions where the group breaks the
  invariant. A non-empty result is a validation error, not a warning.

This is what lets a team say "OP" once and every group inherit it, and it is the
generalised form of v2's rule that an OP team rejects an IP group.

## Migration, two phase

`RcmTeamGroup` serves both shapes at once:

```graphql
criteria:          [Criterion!]!   # the contract
effectiveCriteria: [Criterion!]!   # team + group, what the matcher runs
criteriaSummary:   [String!]!      # chip text for the UI

# Derived from criteria. Kept so v1-shaped callers keep working.
workItemTypes:  [RcmWorkItemType!]!
encounterScope: RcmTeamEncounterScope!
departments:    [String!]!
payers:         [ID!]!
payerCatchAll:  Boolean!
claimStatuses:  [String!]!
```

So:

- **Phase 1.** The existing v2 `Match Groups` node keeps reading the derived
  fields and keeps working, unchanged, with no coordinated release.
- **Phase 2.** `Match Groups` switches to `effectiveCriteria` +
  `allocationDimensions`, lifting `criterionAccepts` and `specificityOf` from
  `allocation-model.ts` rather than reimplementing them. The hardcoded
  `logicAxis === 'PAYER'` branch and the department/payer special-casing go.

The derived fields stay until nothing reads them.

## What T-0002 has to add

T-0002 is a Cortex component gateway tool, not a query the workflow owns: the
workflow sends only `{filter}` and the GraphQL body is defined server side. The
live response carries nine fields today (`branches, createdDate, description,
name, nameAr, tag, usersDetails, active, id`).

Phase 2 needs the component updated to also return, per group:
`criteria`, `effectiveCriteria`, `specificity`, `members`, plus
`allocationDimensions` once per run.

This is a separate piece of work with a different owner, and it gates Phase 2.
Note also that `branches[].healthLicense` is federated in from the platform
service via `GraphQlBackendService`, not defined in Optima's own schema.

## Open items

1. **Multi-licence branches.** `OPTIMA-4657` added support for multiple health
   licences per regulator. The facility gate is
   `branches.some(b => b.healthLicense === item.facilityId)`, which assumes one
   licence per branch. Needs to become a list membership test.
2. **Department is absent from a third of the queue.** Measured over the traced
   21,648-item run: `AUTHORIZATION_RESUBMISSION` (131) and `CLAIM_SUBMISSION`
   (6,905) carry no department at all, 32.5% of the queue. Under the `IN` rule
   a DEPARTMENT-constrained group rejects every one of them. v1 failed them too,
   so this is not a regression, but it does mean a DEPARTMENT-axis team cannot
   route those two types until the backend carries the field.
3. **Coverage on NOT_IN.** `coverageChecked` dimensions report values no group
   covers. A `NOT_IN` group technically covers everything else, which makes the
   coverage report weaker than it looks. Decide whether `NOT_IN` counts as
   coverage.
4. **Canonical department value form.** The matcher now tolerates slug,
   prefixed slug and display name. The contract should still name one form for
   the picker to write, so new config converges even though old config keeps
   working.
