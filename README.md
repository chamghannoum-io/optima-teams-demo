# OPTIMA — Teams Module (Master Data)

The **Teams** module (Master Data → Teams) extracted from the OPTIMA application, in
two parts:

- **`standalone/`** — a runnable Teams page. `npm install && npm run dev`, no backend
  or database needed, seeded with **real data pulled from production**.
- **`backend/` + `frontend/`** — the verbatim upstream source, paths preserved, for
  reading and diffing against the real repos.

## Source

Both source repos had local uncommitted work and were sitting on older branches, so
the extraction was taken from the latest release refs rather than the working trees.

| | Repo on disk | Ref extracted | Head commit |
|---|---|---|---|
| Backend | `~/Desktop/optima-3.1.6` | `origin/optima.release.3.3.0` | Spring Boot + Netflix DGS |
| Frontend | `~/Desktop/OptimaUI` | `origin/optima/release.3.3.0` | React + TanStack Router + Apollo |

`3.3.0` was the newest release line on both remotes as of 2026-09-02. Note the refs
differ in punctuation between the repos — backend uses `optima.release.3.3.0`, frontend
uses `optima/release.3.3.0`.

File paths below are preserved exactly as they appear in the source repos, so anything
here can be diffed or traced straight back upstream.

## What Teams does

An RCM (Revenue Cycle Management) team groups users for work allocation. A team carries:

- **Identity** — name, Arabic name, description, active flag, owning vendor
- **Tags** — flat tags plus nested tag *groups* combined with AND/OR (`OptimaTagOperation`),
  used to match work items to the team
- **Branch allocation** — the branches a team covers, with a sort order
- **Rotation** — optional DAILY/WEEKLY/MONTHLY rotation with a pointer marking whose turn
  is next; the allocation workflow calls `optimaTeamRotationComplete` after each run
- **Members and availability** — members can be marked unavailable for a date range, with
  action `UNASSIGN` (push their active work back to the unassigned bucket) or
  `REDISTRIBUTE` (record the window only, supervisor reassigns manually)

## Layout

```
standalone/                 Runnable Teams page (Vite + React + Apollo, local schema)
backend/                    Java — entities, GraphQL resolver, service, migrations
frontend/                   React — page, drawers, dialogs, components, hooks, tests
scripts/pull-teams.sh       Refresh the real data from the gateway
docs/                       Query + raw API response (gitignored); n8n workflows
```

### Backend — `backend/src/main/java/com/i3hub/optima/`

| Path | Role |
|---|---|
| `web/graphql/RcmTeamResource.java` | DGS resolver — 2 queries, 7 mutations |
| `service/RcmTeamService.java` + `service/impl/RcmTeamServiceImpl.java` | Business logic (~357 lines) |
| `domain/RcmTeam.java` | JPA entity |
| `domain/RcmTeamTag.java` | Tag / tag-group entity (self-nesting) |
| `domain/RcmTeamUserUnavailability.java` | Unavailability window |
| `repository/RcmTeamRepository.java` | Spring Data repository |
| `repository/RcmTeamUserUnavailabilityRepository.java` | Spring Data repository |
| `graphql/input/*.java` | `RcmTeamInput`, `RcmTeamTagInput`, `RcmTeamUserUnavailabilityInput` |
| `graphql/input/filter/RcmTeamFilterInput.java` | List filter |
| `graphql/type/Type*.java` | GraphQL output types |
| `enumeration/RcmTeamUnavailabilityAction.java` | `UNASSIGN` / `REDISTRIBUTE` |

Liquibase migrations in `backend/src/main/resources/config/liquibase/changelog/` (9 files,
`20260304` → `20260804`) trace the schema's evolution: base table → tags → branches →
vendor scoping → rotation → unavailability → branch sort order.

### Frontend — `frontend/provider-app/apps/provider/src/features/master-data/`

| Path | Role |
|---|---|
| `teams.tsx` | The Teams page — filterable, paginated data table |
| `create-team-drawer.tsx` / `edit-team-drawer.tsx` | Multi-step create / edit drawers |
| `team-form-dialog.tsx` | Team detail form |
| `team-members-dialog.tsx` | Member management |
| `team-tags-autocomplete.tsx` | Tag picker backed by code-system concepts |
| `components/team-branch-allocation.tsx` | Branch assignment with drag reorder |
| `components/team-rotation-settings.tsx` | Rotation frequency and pointer |
| `components/team-tag-groups.tsx` + `components/tag-group-card.tsx` | Nested AND/OR tag groups |
| `components/member-unavailability-{dialog,list,indicator}.tsx` | Availability UI |
| `hooks/use-team-tag-suggestions.ts` | Tag suggestion fetching |
| `hooks/use-member-unavailability.ts` | Unavailability mutations |
| `hooks/use-drag-reorder.ts` | Shared drag-reorder helper |
| `__tests__/*.test.ts` | Hook unit tests (3 files) |

`.stories.tsx` files are included alongside their components.

## The GraphQL contract

Two files were **assembled** rather than copied verbatim, because upstream the Teams
definitions are interleaved with every other feature in shared files. Both carry a header
noting their origin.

- **`backend/src/main/resources/schema/teams.graphqls`** — Teams slices lifted from the
  shared `types`, `input`, `enum`, `queries`, and `mutations` `.graphqls` files. Queries and
  mutations are wrapped in `extend type` blocks, which is a change from upstream where they
  are fields on the single root `Query` / `Mutation`.
- **`frontend/.../graphql/teams.graphql`** — the 11 Teams operations extracted from
  `master-data.graphql` (which holds 39 operations total), plus the two code-system queries
  the tag autocomplete depends on.

`frontend/.../app/teams.route.tsx` likewise holds just the Teams route block carved out of
the app-wide `routes.tsx`.

### Operations

| Type | Operation | Permission |
|---|---|---|
| Query | `optimaTeam(id)` | `VIEW_RCM_TEAM` or `MANAGE_RCM_TEAM` |
| Query | `optimaTeams(filter)` | `VIEW_RCM_TEAM` or `MANAGE_RCM_TEAM` |
| Mutation | `optimaTeamCreate` | `MANAGE_RCM_TEAM` |
| Mutation | `optimaTeamUpdate` | `MANAGE_RCM_TEAM` |
| Mutation | `optimaTeamUserAdd` | `MANAGE_RCM_TEAM` |
| Mutation | `optimaTeamUserRemove` | `MANAGE_RCM_TEAM` |
| Mutation | `optimaTeamRotationComplete` | `MANAGE_RCM_TEAM` |
| Mutation | `optimaTeamUserUnavailabilitySet` | `MANAGE_RCM_TEAM` |
| Mutation | `optimaTeamUserUnavailabilityCancel` | `MANAGE_RCM_TEAM` |

Note the naming split: the API and UI say **`OptimaTeam`**, while the Java layer and
database say **`RcmTeam`**. Same thing.

The frontend route guards on `ViewRcmTeam`, `ManageProgramTeams`, or `ViewProgramTeams`,
and `teams.tsx` additionally treats an RCM Supervisor as able to manage teams regardless
of permission flags.

## Running the Teams page

```bash
cd standalone
npm install
npm run dev        # → http://localhost:5173
```

No backend, no database, no codegen. Apollo talks to a local executable schema
(`standalone/src/mocks/schema.ts`) built from the same type definitions as the real
backend, serving real data.

**What works:** the filterable/paginated team list; AND/OR tag groups; branch coverage;
rotation settings; the members dialog with real staff, availability, `availableOnly`
filtering, unavailability windows (UNASSIGN / REDISTRIBUTE) and cancellation; create,
edit and active-toggle. Mutations write to the in-memory store and persist until reload.

**Seed data:** `standalone/src/mocks/teams-real.json` — 16 real teams, 69 distinct users,
16 branches, pulled from production on 2026-09-02. **It contains real staff names and
email addresses** and is gitignored, as is `docs/teams-raw.json`.

### Refreshing the data

```bash
cp .env.example .env      # fill in OPTIMA_CLIENT_SECRET
bash scripts/pull-teams.sh
```

Uses a `client_credentials` grant to mint a token per run, so the 5-minute token lifetime
is not a factor. Writes `docs/teams-raw.json`; copy the `data.optimaTeams` array into
`standalone/src/mocks/teams-real.json` to reseed. The secret lives only in `.env`
(gitignored) and is never echoed or logged.

### Pointing at the real API instead

Swap `SchemaLink` for an `HttpLink` in `standalone/src/apollo.ts` — the operation
documents in `standalone/src/graphql.ts` are the real ones and need no changes.
Note that a token with only `view_rcm_team` will get 403s on the mutations;
`manage_rcm_team` is required for those.

## How `standalone/` relates to the extracted source

The standalone app is a **faithful reimplementation, not the upstream files running
as-is.** The upstream page cannot execute outside the monorepo: it imports `@optima/ui`,
`@optima/auth`, `@optima/shared`, `@/components/enhanced` (118 files), and
`@/__generated__/graphql` — codegen output that is not committed. Vendoring all of that
would mean copying a large slice of the frontend monorepo.

So `standalone/` keeps the contract identical and rebuilds the presentation:

| Upstream | Standalone |
|---|---|
| `@/__generated__/graphql` hooks | `src/graphql.ts` — same operations, hand-written hooks |
| `@optima/ui`, `@/components/enhanced` | `src/features/*` + `src/styles.css` |
| `@optima/auth` permission guards | omitted — no auth layer locally |
| DGS backend | `src/mocks/schema.ts` executable schema |

### Styling — Cortex Design System

The page uses the **real** design tokens, ported verbatim from
`provider-app/packages/ui/src/styles.css` into `standalone/src/styles.css`:

| Token | Value |
|---|---|
| `--color-primary` | `#2d3670` (deep navy) |
| `--color-app-bg` | `#f5f7fd` |
| `--font-sans` | Inter |
| `--radius-lg` / `--radius-button` | 12px / 8px |
| `--shadow-custom` | `0 0 12px rgba(0,0,0,.06)` |
| Badge families | success, danger, warning, info, orange, neutral |

Component conventions are mirrored from `packages/ui`: buttons `h-40px rounded-lg`
with `active:scale-[0.98]`, inputs `h-40px rounded-md` with a `ring-primary/10` focus
ring, badges `rounded-full px-2 py-[3px] text-[11px] font-semibold` with borders.

Upstream those tokens drive **Tailwind v4 utilities and Radix primitives**; here they are
consumed by plain CSS, so the look matches without the monorepo's component library.
Dark mode tokens exist upstream and are not ported.

The GraphQL **operations, schema, filter semantics and mutation behaviour match upstream**;
the React components are equivalents, not copies. For the real component code, read
`frontend/` — that is byte-identical to the repo.

## The upstream copy (`backend/` + `frontend/`)

These are the untouched extracted files and do **not** build on their own — they still
import from the applications they came from.

**Backend** expects the surrounding Spring Boot app — `Permission`, `User`, `Vendor`,
`Branch`, the `@Authenticated` / `@HasPermission` annotations, base entity classes, the DGS
runtime, and the rest of the Liquibase master changelog.

**Frontend** imports the workspace packages and generated code listed in the table above.

## Re-syncing from upstream

```bash
# Backend
cd ~/Desktop/optima-3.1.6 && git fetch origin
git show origin/optima.release.3.3.0:src/main/java/com/i3hub/optima/service/impl/RcmTeamServiceImpl.java

# Frontend
cd ~/Desktop/OptimaUI && git fetch origin
git show origin/optima/release.3.3.0:provider-app/apps/provider/src/features/master-data/teams.tsx
```

Since paths are preserved, any file here maps to `<ref>:<same path minus the
backend/ or frontend/ prefix>` upstream. The three assembled files
(`teams.graphqls`, `teams.graphql`, `teams.route.tsx`) are the exception — they have no
single upstream counterpart.
