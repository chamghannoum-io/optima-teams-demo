import { useMemo, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Skeleton,
} from "@/components/enhanced";
import { useQueueDashboardAssignmentOverviewQuery, WorkItemType } from "@/__generated__/graphql";
import {
  useQueueDashboardFilter,
  showsClaims,
  showsAuthorizations,
} from "../queue-dashboard-filter-context";

export function AssignmentOverviewChart() {
  const { t } = useTranslation("provider");
  const { graphqlFilter, filter } = useQueueDashboardFilter();
  const allowedTypes = filter.workItemTypes;
  const allowClaims = showsClaims(allowedTypes);
  const allowAuths = showsAuthorizations(allowedTypes);
  const inScope = (type: WorkItemType) =>
    !allowedTypes || allowedTypes.length === 0 || allowedTypes.includes(type);

  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains("dark"));

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains("dark"));
    });
    observer.observe(document.documentElement, { attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const { data, loading } = useQueueDashboardAssignmentOverviewQuery({
    variables: { filter: graphqlFilter },
  });

  const overview = data?.queueDashboardAssignmentOverview;

  const categories = useMemo(() => {
    if (!overview) return [];
    const items: { label: string; count: number; color: string }[] = [];

    // Spec: null = excluded by filter — skip the column. Non-null fields render.
    // Plus: filter by the team's workItemTypes scope so claims-only / auth-only
    // teams don't see bars for categories they don't handle.
    if (overview.claimSubmissions != null && inScope(WorkItemType.ClaimSubmission)) {
      items.push({
        label: t("rcmDashboard.workType.claimSubmission", { defaultValue: "Claim Submissions" }),
        count: Number(overview.claimSubmissions),
        color: "#3b82f6",
      });
    }
    if (overview.claimResubmissions != null && inScope(WorkItemType.ClaimResubmission)) {
      items.push({
        label: t("rcmDashboard.workType.claimResubmission", {
          defaultValue: "Claim Resubmissions",
        }),
        count: Number(overview.claimResubmissions),
        color: "#06b6d4",
      });
    }
    if (overview.claimValidations != null && inScope(WorkItemType.ClaimValidation)) {
      items.push({
        label: t("rcmDashboard.workType.claimValidation", { defaultValue: "Claim Validations" }),
        count: Number(overview.claimValidations),
        color: "#10b981",
      });
    }
    if (
      overview.authorizationSubmissions != null &&
      inScope(WorkItemType.AuthorizationSubmission)
    ) {
      items.push({
        label: t("rcmDashboard.workType.authSubmission", { defaultValue: "Authorizations" }),
        count: Number(overview.authorizationSubmissions),
        color: "#8b5cf6",
      });
    }
    if (
      overview.authorizationResubmissions != null &&
      inScope(WorkItemType.AuthorizationResubmission)
    ) {
      items.push({
        label: t("rcmDashboard.workType.authResubmission", {
          defaultValue: "Auth Resubmissions",
        }),
        count: Number(overview.authorizationResubmissions),
        color: "#ec4899",
      });
    }
    return items;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overview, t, allowClaims, allowAuths, allowedTypes]);

  const hasData = categories.some((c) => c.count > 0);

  const labelColor = isDark ? "#94a3b8" : "#6b7280";
  const axisLineColor = isDark ? "#2a3141" : "#d1d5db";
  const splitLineColor = isDark ? "#1e2636" : "#e5e7eb";
  const barLabelColor = isDark ? "#e2e8f0" : "#374151";

  const option: EChartsOption = useMemo(
    () => ({
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        backgroundColor: isDark ? "#111827" : "#ffffff",
        borderColor: isDark ? "#2a3141" : "#e5e7eb",
        textStyle: { color: isDark ? "#e2e8f0" : "#374151" },
      },
      grid: { left: "3%", right: "4%", bottom: "3%", top: "16px", containLabel: true },
      xAxis: {
        type: "category",
        data: categories.map((c) => c.label),
        axisLabel: { color: labelColor, fontSize: 11, interval: 0, rotate: categories.length > 3 ? 20 : 0 },
        axisLine: { lineStyle: { color: axisLineColor } },
      },
      yAxis: {
        type: "value",
        axisLabel: { color: labelColor, fontSize: 12 },
        splitLine: { lineStyle: { color: splitLineColor, type: "dashed" } },
      },
      series: [
        {
          type: "bar",
          data: categories.map((c) => ({
            value: c.count,
            itemStyle: { color: c.color },
          })),
          barWidth: "45%",
          label: {
            show: true,
            position: "top",
            color: barLabelColor,
            fontWeight: "bold",
          },
        },
      ],
    }),
    [categories, isDark, labelColor, axisLineColor, splitLineColor, barLabelColor]
  );

  if (loading) {
    return (
      <Card className="flex h-full w-full flex-col">
        <CardHeader className="pb-2">
          <CardTitle>{t("rcmDashboard.assignmentOverview")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-[280px] items-end gap-3 px-4 pb-6">
            {[55, 80, 35, 65, 90].map((h, i) => (
              <Skeleton key={i} className="flex-1 rounded-md" style={{ height: `${h}%` }} />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (categories.length === 0 || !hasData) {
    return (
      <Card className="flex h-full w-full flex-col">
        <CardHeader className="pb-2">
          <CardTitle>{t("rcmDashboard.assignmentOverview")}</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState title={t("common.noData")} className="py-8" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="flex h-full w-full flex-col">
      <CardHeader className="pb-2">
        <CardTitle>{t("rcmDashboard.assignmentOverview")}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <ReactECharts
          option={option}
          style={{ height: "280px", width: "100%" }}
          opts={{ renderer: "canvas" }}
        />
      </CardContent>
    </Card>
  );
}
