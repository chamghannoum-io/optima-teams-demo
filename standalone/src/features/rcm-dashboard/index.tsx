import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useSiteSettings } from "@optima/shared";
import {
  CortexKPICard as KPICard,
  PageContent,
  PageTabs,
  PageTabsList,
  PageTabsTrigger,
  PageTabsContent,
  Skeleton,
  cn,
} from "@/components/enhanced";
import { User, DollarSign, CheckCircle, XCircle, Users } from "lucide-react";
import {
  useGetTeamFinancialKpisQuery,
  useGetDenialStatsQuery,
  useGetDashboardActivityQuery,
} from "@/__generated__/graphql";
import { useGetPriorAuthStatsQuery } from "@optima/module-authorization";

// My Day tab components
import { MyWorkQueue } from "@/features/dashboard/components/my-work-queue";
import { QuickActions } from "@/features/dashboard/components/quick-actions";
import { SLATracker } from "@/features/dashboard/components/sla-tracker";
import { DenialTracker } from "@/features/dashboard/components/denial-tracker";
import { RecentActivity } from "@/features/dashboard/components/recent-activity";

// My Team tab — new queue dashboard widgets
import {
  QueueDashboardFilterProvider,
  useQueueDashboardFilter,
  showsClaims,
  showsAuthorizations,
} from "./queue-dashboard-filter-context";
import { QueueDashboardFilterBar } from "./components/queue-dashboard-filter-bar";
import { TopCountsPanel } from "./components/top-counts-panel";
import { AssignmentOverviewChart } from "./components/assignment-overview-chart";
import { FinancialBreakdownChart } from "./components/financial-breakdown-chart";
import { OverduePendingCard } from "./components/overdue-pending-card";
import { AgingChart } from "./components/aging-chart";
import { TeamPerformanceUtilization } from "./components/team-performance-utilization";
import { UnassignedInsights } from "./components/unassigned-insights";
import { UnassignedWithAssign } from "./components/unassigned-with-assign";

function SecondaryKpiStrip() {
  const { t } = useTranslation("provider");
  const { defaultCurrency } = useSiteSettings();
  const { filter } = useQueueDashboardFilter();
  const allowClaims = showsClaims(filter.workItemTypes);
  const allowAuths = showsAuthorizations(filter.workItemTypes);

  const { data: financialData, loading: financialLoading } = useGetTeamFinancialKpisQuery();
  const { data: authData, loading: authLoading } = useGetPriorAuthStatsQuery({
    skip: !allowAuths,
  });
  const { data: denialData, loading: denialLoading } = useGetDenialStatsQuery({
    skip: !allowClaims,
  });

  const financialTotals = financialData?.teamFinancialKpis?.totals;

  const approved = authData?.approved?.totalCount ?? 0;
  const rejected = authData?.rejected?.totalCount ?? 0;
  const partially = authData?.partially?.totalCount ?? 0;
  const totalDecided = approved + rejected + partially;
  const approvalRate =
    totalDecided > 0 ? ((approved / totalDecided) * 100).toFixed(1) : "0.0";

  const rejectedClaims = denialData?.rejectedClaims?.totalCount ?? 0;
  const totalClaims = denialData?.totalClaims?.totalCount ?? 0;
  const denialRate =
    totalClaims > 0 ? ((rejectedClaims / totalClaims) * 100).toFixed(1) : "0.0";

  // Visible KPI count drives the grid column count so it stays balanced.
  const visibleCount = 1 + (allowAuths ? 1 : 0) + (allowClaims ? 1 : 0);

  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-4",
        visibleCount === 3 ? "sm:grid-cols-3" : visibleCount === 2 ? "sm:grid-cols-2" : ""
      )}
    >
      <KPICard
        label={t("rcmDashboard.totalRevenue")}
        value={
          financialLoading ? (
            <Skeleton className="h-7 w-20" />
          ) : (
            `${(Number(financialTotals?.grandTotalAmount ?? 0) / 1000).toFixed(1)}K`
          )
        }
        subValue={defaultCurrency}
        color="primary"
        icon={DollarSign}
      />
      {allowAuths && (
        <KPICard
          label={t("rcmDashboard.approvalRate")}
          value={authLoading ? <Skeleton className="h-7 w-16" /> : `${approvalRate}%`}
          color="green"
          icon={CheckCircle}
        />
      )}
      {allowClaims && (
        <KPICard
          label={t("rcmDashboard.denialRate")}
          value={denialLoading ? <Skeleton className="h-7 w-16" /> : `${denialRate}%`}
          color="red"
          icon={XCircle}
        />
      )}
    </div>
  );
}

function MyTeamTab() {
  const { filter } = useQueueDashboardFilter();
  const showClaims = showsClaims(filter.workItemTypes);
  const showAuths = showsAuthorizations(filter.workItemTypes);

  return (
    <div className="flex flex-col gap-3 -mt-4">
      <div className="flex justify-end">
        <QueueDashboardFilterBar />
      </div>

      <TopCountsPanel />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 items-stretch">
        <div className="lg:col-span-2 flex">
          <AssignmentOverviewChart />
        </div>
        <div className="flex">
          <FinancialBreakdownChart />
        </div>
      </div>

      {showAuths && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <OverduePendingCard variant="auth" />
          <AgingChart variant="auth" />
        </div>
      )}

      {showClaims && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <OverduePendingCard variant="claims" />
          <AgingChart variant="claims" />
        </div>
      )}

      <TeamPerformanceUtilization />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <UnassignedInsights />
        <UnassignedWithAssign />
      </div>
    </div>
  );
}

export default function RcmDashboardPage() {
  const { t } = useTranslation("provider");

  const { data: activityData, loading: activityLoading } = useGetDashboardActivityQuery({
    variables: { first: 10 },
  });

  const activities = useMemo(() => {
    if (!activityData?.claimSubmissions?.edges) return [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (activityData.claimSubmissions.edges as any[])
      .map((edge) => edge?.node)
      .filter((node) => node != null);
  }, [activityData]);

  return (
    <QueueDashboardFilterProvider>
      {/* ── Page-level KPI strip (shared across both tabs) ────────── */}
      <PageContent className="pb-0">
        <SecondaryKpiStrip />
      </PageContent>

      <PageTabs defaultValue="my-day">
        <PageTabsList className="mx-8 mt-6 flex h-[55px] w-[calc(100%-4rem)] items-center gap-2 rounded-xl border-b border-slate-100 bg-slate-50 px-8 dark:border-dark-border/50 dark:bg-dark-card">
          <PageTabsTrigger value="my-day">
            <User size={14} />
            {t("rcmDashboard.myDay")}
          </PageTabsTrigger>
          <PageTabsTrigger value="my-team">
            <Users size={14} />
            {t("rcmDashboard.myTeam")}
          </PageTabsTrigger>
        </PageTabsList>

        <PageContent>
          <PageTabsContent value="my-day" className="flex-none overflow-y-visible">
            <div className="flex flex-col gap-6">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2">
                  <MyWorkQueue />
                </div>
                <div>
                  <QuickActions />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <SLATracker />
                <DenialTracker />
              </div>

              <div>
                {activityLoading ? (
                  <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-dark-border dark:bg-dark-bg">
                    <Skeleton className="mb-4 h-4 w-32" />
                    <div className="flex flex-col gap-3">
                      {[0, 1, 2, 3].map((i) => (
                        <div key={i} className="flex items-center gap-3">
                          <Skeleton className="h-8 w-8 rounded-full" />
                          <div className="flex flex-1 flex-col gap-1.5">
                            <Skeleton className="h-3 w-48" />
                            <Skeleton className="h-2.5 w-32" />
                          </div>
                          <Skeleton className="h-3 w-16" />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <RecentActivity activities={activities} />
                )}
              </div>
            </div>
          </PageTabsContent>

          <PageTabsContent value="my-team" className="flex-none overflow-y-visible">
            <MyTeamTab />
          </PageTabsContent>
        </PageContent>
      </PageTabs>
    </QueueDashboardFilterProvider>
  );
}
