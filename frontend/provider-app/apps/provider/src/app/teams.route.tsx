// Teams route registration — extracted from provider-app/apps/provider/src/app/routes.tsx
// Source: OptimaUI @ origin/optima/release.3.3.0 (lines 526-546)
//
// In the full app this block lives inside routes.tsx alongside every other route,
// and masterDataTeamsRoute is added to the route tree array (line ~935).

const LazyTeams = lazyRouteComponent(() => import("@/features/master-data/teams.js"));
const masterDataTeamsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/master-data/teams",
  component: () =>
    withErrorBoundary(
      <PermissionGuard
        permissions={[
          Permission.ViewRcmTeam,
          Permission.ManageProgramTeams,
          Permission.ViewProgramTeams,
        ]}
      >
        <LazyTeams />
      </PermissionGuard>
    ),
});

const LazyQueryTemplates = lazyRouteComponent(
  () => import("@/features/master-data/query-templates.js")
);

// Added to the route tree:
//   masterDataTeamsRoute,
