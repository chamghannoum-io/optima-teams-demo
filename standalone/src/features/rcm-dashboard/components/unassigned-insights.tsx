import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import { Clock, BarChart3 } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/enhanced";
import { useUnassignedRequests } from "../hooks/use-unassigned-requests.js";

const STATUS_COLORS: Record<string, string> = {
  APPROVED: "#22c55e",
  PARTIALLY_APPROVED: "#f59e0b",
  REJECTED: "#ef4444",
  PENDING: "#3b82f6",
  NOT_SUBMITTED: "#9ca3af",
};

interface UnassignedInsightsProps {
  fromDate?: string;
  toDate?: string;
}

export function UnassignedInsights({ fromDate, toDate }: UnassignedInsightsProps = {}) {
  const { t } = useTranslation("provider");

  const {
    items,
    loading,
    totalCount: serverTotalCount,
  } = useUnassignedRequests({ fromDate, toDate, first: 100 });

  // Timestamp snapshot per mount — keeps the memo pure; bucket granularity
  // (hours/days) makes a per-mount snapshot indistinguishable in the UI.
  const [now] = useState(() => Date.now());

  // ── Aging buckets ────────────────────────────────────────────────────
  const agingBuckets = useMemo(() => {
    const counts = { "0-24h": 0, "1-3d": 0, "3-7d": 0, "7d+": 0 };

    for (const item of items) {
      if (!item.createdDate) continue;
      const ageHours = (now - new Date(item.createdDate).getTime()) / (1000 * 60 * 60);

      if (ageHours <= 24) counts["0-24h"]++;
      else if (ageHours <= 72) counts["1-3d"]++;
      else if (ageHours <= 168) counts["3-7d"]++;
      else counts["7d+"]++;
    }

    return [
      { label: t("rcmDashboard.aging0to24h"), count: counts["0-24h"], color: "#22c55e" },
      { label: t("rcmDashboard.aging1to3d"), count: counts["1-3d"], color: "#f59e0b" },
      { label: t("rcmDashboard.aging3to7d"), count: counts["3-7d"], color: "#f97316" },
      { label: t("rcmDashboard.aging7dPlus"), count: counts["7d+"], color: "#ef4444" },
    ];
  }, [items, t, now]);

  // ── Status groups ────────────────────────────────────────────────────
  const statusGroups = useMemo(() => {
    const groups: Record<string, number> = {};
    for (const item of items) {
      const status = item.approvalStatus ?? "UNKNOWN";
      groups[status] = (groups[status] ?? 0) + 1;
    }
    return Object.entries(groups).map(([name, value]) => ({
      name: name.replace(/_/g, " "),
      value,
      itemStyle: { color: STATUS_COLORS[name] ?? "#6b7280" },
    }));
  }, [items]);

  const totalCount = serverTotalCount || agingBuckets.reduce((sum, b) => sum + b.count, 0);
  const hasStatusData = statusGroups.length > 0;

  // ── Aging chart option ───────────────────────────────────────────────
  const agingOption: EChartsOption = useMemo(
    () => ({
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
      grid: { left: "3%", right: "4%", bottom: "3%", top: "12px", containLabel: true },
      xAxis: {
        type: "category",
        data: agingBuckets.map((b) => b.label),
        axisLabel: { color: "#6b7280", fontSize: 12 },
        axisLine: { lineStyle: { color: "#d1d5db" } },
      },
      yAxis: {
        type: "value",
        axisLabel: { color: "#6b7280", fontSize: 12 },
        splitLine: { lineStyle: { color: "#e5e7eb", type: "dashed" } },
      },
      series: [
        {
          type: "bar",
          data: agingBuckets.map((b) => ({ value: b.count, itemStyle: { color: b.color } })),
          barWidth: "50%",
          label: { show: true, position: "top", color: "#374151", fontWeight: "bold" },
        },
      ],
    }),
    [agingBuckets]
  );

  // ── Status chart option ──────────────────────────────────────────────
  const statusOption: EChartsOption = useMemo(
    () => ({
      tooltip: { trigger: "item", formatter: "{b}: {c} ({d}%)" },
      legend: { bottom: 0, textStyle: { color: "#6b7280", fontSize: 11 } },
      series: [
        {
          type: "pie",
          radius: ["0%", "65%"],
          center: ["50%", "45%"],
          data: statusGroups,
          label: { show: true, formatter: "{b}\n{d}%", fontSize: 11 },
          emphasis: {
            itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: "rgba(0, 0, 0, 0.2)" },
          },
        },
      ],
    }),
    [statusGroups]
  );

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle>{t("rcmDashboard.unassignedInsights")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-[280px] items-center justify-center">
            <p className="text-slate-500 dark:text-slate-400">{t("common.loading")}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>{t("rcmDashboard.unassignedInsights")}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <Tabs defaultValue="aging">
          <TabsList className="mb-4">
            <TabsTrigger value="aging">
              <Clock size={14} />
              {t("rcmDashboard.agingTab")}
            </TabsTrigger>
            <TabsTrigger value="status">
              <BarChart3 size={14} />
              {t("rcmDashboard.statusTab")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="aging">
            {totalCount === 0 ? (
              <EmptyState title={t("common.noData")} className="py-8" />
            ) : (
              <ReactECharts
                option={agingOption}
                style={{ height: "260px", width: "100%" }}
                opts={{ renderer: "canvas" }}
              />
            )}
          </TabsContent>

          <TabsContent value="status">
            {!hasStatusData ? (
              <EmptyState title={t("common.noData")} className="py-8" />
            ) : (
              <ReactECharts
                option={statusOption}
                style={{ height: "260px", width: "100%" }}
                opts={{ renderer: "canvas" }}
              />
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
