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
import {
  useQueueDashboardAuthorizationAgingQuery,
  useQueueDashboardClaimsAgingQuery,
  type QueueDashboardAgingRangeInput,
} from "@/__generated__/graphql";
import { useQueueDashboardFilter } from "../queue-dashboard-filter-context";

// BA-approved authorization aging ranges
const AUTH_RANGES: QueueDashboardAgingRangeInput[] = [
  { fromDays: 0, toDays: 7 },
  { fromDays: 8, toDays: 15 },
  { fromDays: 16, toDays: 30 },
  { fromDays: 31, toDays: 60 },
  { fromDays: 61, toDays: null },
];

const BAR_COLORS = ["#82ca9d", "#a3e4a1", "#ffc658", "#ff7300", "#FF8042"];

interface Props {
  variant: "auth" | "claims";
}

export function AgingChart({ variant }: Props) {
  const { t } = useTranslation("provider");
  const { graphqlFilter } = useQueueDashboardFilter();

  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains("dark"));

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains("dark"));
    });
    observer.observe(document.documentElement, { attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const auth = useQueueDashboardAuthorizationAgingQuery({
    variables: { filter: graphqlFilter, ranges: AUTH_RANGES },
    skip: variant !== "auth",
  });
  const claims = useQueueDashboardClaimsAgingQuery({
    variables: { filter: graphqlFilter },
    skip: variant !== "claims",
  });

  const loading = variant === "auth" ? auth.loading : claims.loading;
  const buckets =
    variant === "auth"
      ? (auth.data?.queueDashboardAuthorizationAging ?? [])
      : (claims.data?.queueDashboardClaimsAging ?? []);

  const hasData = buckets.some((b) => Number(b.count ?? 0) > 0);

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
        data: buckets.map((b) => b.label),
        axisLabel: { color: labelColor, fontSize: 12 },
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
          data: buckets.map((b, i) => ({
            value: Number(b.count ?? 0),
            itemStyle: { color: BAR_COLORS[i % BAR_COLORS.length] },
          })),
          barWidth: "50%",
          label: { show: true, position: "top", color: barLabelColor, fontWeight: "bold" },
        },
      ],
    }),
    [buckets, isDark, labelColor, axisLineColor, splitLineColor, barLabelColor]
  );

  const titleKey =
    variant === "auth"
      ? "rcmDashboard.authAgingTitle"
      : "rcmDashboard.claimsAgingTitle";
  const titleDefault =
    variant === "auth" ? "Authorizations Aging" : "Claims Aging";

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle>{t(titleKey, { defaultValue: titleDefault })}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-[280px] items-end gap-3 px-4 pb-6">
            {[40, 70, 55, 85, 30].map((h, i) => (
              <Skeleton key={i} className="flex-1 rounded-md" style={{ height: `${h}%` }} />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!hasData) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle>{t(titleKey, { defaultValue: titleDefault })}</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState title={t("common.noData")} className="py-8" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>{t(titleKey, { defaultValue: titleDefault })}</CardTitle>
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
