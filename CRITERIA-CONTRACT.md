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
enum CriterionOperator { IN NOT_IN ANY GREATER_THAN }
enum CriterionLevel    { TEAM GROUP BOTH }

type Criterion {
  dimension: String!            # AllocationDimension.code
  operator:  CriterionOperator!
  values:    [String!]!         # empty when operator is ANY
  locked:    Boolean!           # team criteria only, see The lock below
}

type AllocationDimension {
  code:            String!
  label:           String!
  level:           CriterionLevel!      # the FLOOR for where it may be constrained
  operators:       [CriterionOperator!]!
  valueSource:     String!              # backs dimensionOptions()
  itemField:       String!              # field on a work item this tests
  coverageChecked: Boolean!             # report values no group covers
  matchMode:       MatchMode!           # EXACT | NORMALISED
  valueStyle:      ValueStyle!          # CODE | ENUM | NAME, display only
  aliases:         [DimensionAlias!]    # synonyms, see Comparison
  numeric:         Boolean!             # compared with an operator, not picked
  unit:            String               # e.g. AED, for labels
  numericOptions:  [Float!]!            # the amounts it may be set to
  appliesToTypes:  [String!]!           # empty means every work item type
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
| `GREATER_THAN`, item value numeric and `> values[0]` | Accepts |
| `GREATER_THAN`, item value numeric and `<= values[0]` | Rejects. The boundary is exclusive. |
| `GREATER_THAN`, item value missing, empty or not a number | **Rejects.** Same rule as `IN`. |

The asymmetry on a missing value is deliberate. `IN` and `GREATER_THAN` are
positive claims and need evidence; `NOT_IN` is an exclusion and a missing value
is not evidence of membership.

`GREATER_THAN` carries exactly one value, the threshold, as a string. It is
only valid on a dimension whose registry row says `numeric: true`, and today
that is `CLAIM_VALUE` and nothing else. Rejecting a non-numeric item value is
what keeps authorisation work, which carries no money, out of a high-cost
group rather than flooding it.

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
                NOT_IN       -> 1
                IN           -> floor(100 / values.length)
                GREATER_THAN -> 100 (it carries one value)
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
  both constrain the same dimension the group's clause wins, unless the team
  locked that dimension. See [The lock](#the-lock-and-what-a-team-leaves-to-its-groups).
- `widensBeyond(team, group)` returns the dimensions where the group breaks the
  invariant. A non-empty result is a validation error, not a warning.

This is what lets a team say "OP" once and every group inherit it, and it is the
generalised form of v2's rule that an OP team rejects an IP group.

## The lock, and what a team leaves to its groups

Normative. A team criterion carries `locked`. Group criteria never do; the
backend drops the flag, and drops the whole clause on a dimension the team
locked, so what is stored is always what runs.

Between `locked` and simply not filtering, a team has exactly three things it
can say about any one dimension, and nothing else is expressible:

| Team's clause | Mode | What a group may do | Effective rule |
|---|---|---|---|
| present, `locked: true` | **Locked** | nothing; the dimension is not offered | the team's clause |
| present, `locked: false` | **Choice** | pick a subset of the team's values | the group's clause, or the team's when the group picks none |
| absent | **Open** | filter freely over every value the dimension has, or not at all | the group's clause, or unconstrained |

Read in business terms: *locked* is "every group here does claim validation and
claim submission"; *choice* is "we cover Ajman, Sharjah and RAK, and each group
takes one of them"; *open* is "we have not decided, the groups route themselves".

### Consequences

- `mergeCriteria(team, group)` takes the group's clause on a shared dimension,
  **except** where the team's is locked, where it takes the team's.
- A group's clause on a locked dimension is **ignored, not a non-match**. Locking
  a dimension on a team whose groups already constrain it must narrow the night's
  run, not empty it. The backend removes such clauses on write, so this path
  exists only for data written before the lock.
- `widensBeyond` does not check locked dimensions. A group has no say there, so
  there is nothing to widen.
- **The lock is the only thing that withholds a dimension from a group.**
  `AllocationDimension.level` says what a **team** may filter on and nothing
  else; it is not consulted on the group side. A team that names three
  facilities and unlocks them gets a group picking from those three; a team
  that says nothing about facility gets a group picking from all sixteen.
  `groupEditableDimensions(dims, teamCriteria)` is the rule, and it reduces to
  "every dimension the team has not locked".

  Reading `level` as a group-side restriction too was a bug: a team with no
  facility filter then had groups that could not route by facility either, so
  the dimension was unreachable from both ends and the work went wherever.
- Locking changes no matching semantics. The table above resolves *which* clause
  applies; `criterionAccepts` then runs on it unchanged.

### The estate's lock state is derived, not authored

The captured seed is v1-shaped and has no idea a filter can be locked, so
`migrateSeedTeam` reads the mode off what the v1 data already says:

| Clause | Mode | Why |
|---|---|---|
| `FACILITY` | **Locked** | every v1 team names one facility and no group varies from it |
| `ENCOUNTER_TYPE` | **Locked** where present | the migration only writes a group-level encounter clause where the group differs from its team, and across all eleven teams none does. A team scoped `BOTH` gets no clause at all, i.e. Open |
| `WORK_ITEM_TYPE` | **Choice** | the team's list is the union of its groups' and each group takes a slice, which is what Choice means |

Nothing here is invented for the demo. Asserted by `smoke-v3.mjs` section 9b.

## High cost

Normative. High cost is a **group criterion**, not a team policy and not a
clearance on a person.

```
group.criteria += { dimension: "CLAIM_VALUE", operator: "GREATER_THAN", values: ["10000"] }
```

A group carrying it takes only the claims above that amount. Everything
follows from the ordinary rules:

- **Routing.** It constrains one dimension more than the equivalent group
  without it, so `specificity` sends the expensive claim to the high-cost
  group and the cheap one to the department group. No second mechanism.
- **Explanation.** `rejectingCriterion` names it like any other clause, so
  "why did this not go there" answers itself.
- **Scope.** `appliesToTypes` on the dimension keeps it off authorisation work,
  which carries no money. This is the property the old team-level `HIGH_COST`
  policy carried, moved down a level.
- **The amount is chosen, not typed.** `numericOptions` on the dimension is the
  list, it is tenant-wide, and only an RCM supervisor may change it
  (`allocationDimensionOptionsSet`). Removing an amount does not disturb a
  group already set to it: the criterion holds the number, the list only
  governs what can be chosen next.

**Known tie.** A group naming exactly one value on some dimension and a
high-cost group naming only the amount are equally specific, and the tie falls
to group id. Scoring money specially is exactly the special case this design
exists to avoid, so it is left alone; it matters only where a team has both a
single-value group and a high-cost group on the same work.

### What it replaced

The team carried a `HIGH_COST` policy (one threshold for the whole team) and
each member carried a `HIGH_COST` clearance tag. That answered "who may touch
an expensive claim" but not "which group do expensive claims go to", and the
second is the question the business asks. Both are gone. `AllocationPolicy`
keeps `handlerTag` and `User.handlerTags` keeps its shape, because they are
published, but no policy row uses them today.

`User.handlesHighCost` is now derived from membership of a group that filters
on claim value, which is the only honest answer once the tag is unused.

## Who supervises a team

Normative. Supervising is a relationship between a **person and a team**:
`RcmTeamV2.supervisorIds`.

`User.isSupervisor` is a property of the person and means only "supervises
something, somewhere". Reading it as "supervises this team" is wrong as soon
as anyone works on two teams, and it was: the supervisor of one team appeared
as a supervisor on another team's screen, and saving that other team wrote the
flag back to false and demoted them where they really did supervise.

- The team's list is what `supervisorsOf` reads, what readiness attributes
  issues to, and what the wizard shows on step 1.
- Saving a team sets that team's list, then recomputes `isSupervisor` across
  every team, so a save can never silently change another team's answer.
- A supervisor is put into every active group of their team, which is why the
  duplicate-group check below skips them.

## Duplicate groups

Normative. Two active groups are a fault when **both** hold:

1. their effective rules are identical, compared order-independently and after
   merging the team's clauses (`criteriaSignature`); and
2. at least one person who is not a supervisor of the team is in both.

Either alone is fine. Identical rules with different people is a shift split.
Overlap without identity is what narrowest-wins is for, and flagging it put an
amber line on nearly every card in the estate, which reads as noise.

The report names the **person**, because they are what has to change: the same
work can reach them through either group, so their share silently doubles.
`duplicateRuleConflicts` is the reference implementation; readiness raises it
as `DUPLICATE_GROUP_RULE`.

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
