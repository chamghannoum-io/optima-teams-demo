/**
 * The chart conventions the RCM Supervisor Dashboard uses, in one place.
 *
 * Upstream every chart in features/rcm-dashboard repeats the same tooltip,
 * axis and theme setup and differs only in its series. Copying that repetition
 * here would mean five chances to drift from it, so the shared part lives here
 * and each panel supplies a series.
 *
 * Colours, axis styling and the dark palette are taken from upstream's
 * aging-chart.tsx and assignment-overview-chart.tsx verbatim, so a chart here
 * reads as the same chart rather than a lookalike.
 */
import { useEffect, useMemo, useState } from "react";
import ReactEChartsCore from "echarts-for-react/lib/core";
import * as echarts from "echarts/core";
import { BarChart } from "echarts/charts";
import { GridComponent, LegendComponent, TooltipComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { EChartsOption } from "echarts";

/**
 * Register only what these panels draw. The default `echarts` entry point
 * pulls in every chart type and renderer, which cost 1.2 MB of the bundle for
 * a page that draws bars. This is a public demo, so that matters.
 */
echarts.use([BarChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);

import { Card, CardContent, CardHeader, CardTitle, EmptyState, Skeleton } from "@optima/ui";

/**
 * Upstream's aging-chart palette. Green through to orange encodes "further
 * right is worse", which is true of aging buckets and of nothing else, so it
 * is opt-in via palette="gradient" rather than the default. Applied to a
 * breakdown it invents a severity ranking that is not there.
 */
export const BAR_COLORS = ["#82ca9d", "#a3e4a1", "#ffc658", "#ff7300", "#FF8042"];

/** One colour for categorical bars, matching upstream's primary series. */
export const SINGLE_COLOR = "#3b82f6";

/** Upstream's assignment-overview series colours, by position. */
export const SERIES_COLORS = ["#3b82f6", "#06b6d4", "#10b981", "#8b5cf6", "#ec4899"];

/**
 * Tracks the `.dark` class rather than prefers-color-scheme, because that is
 * what the app toggles and what Tailwind is configured against here.
 */
export function useIsDark(): boolean {
  const [isDark, setIsDark] = useState(
    () => typeof document !== "undefined" && document.documentElement.classList.contains("dark"),
  );
  useEffect(() => {
    const el = document.documentElement;
    const sync = () => setIsDark(el.classList.contains("dark"));
    const obs = new MutationObserver(sync);
    obs.observe(el, { attributes: true, attributeFilter: ["class"] });
    sync();
    return () => obs.disconnect();
  }, []);
  return isDark;
}

export interface ChartCardProps {
  title: string;
  /** Right-hand side of the header, for a total or a filter. */
  action?: React.ReactNode;
  categories: string[];
  series: { name?: string; data: number[]; colors?: string[] }[];
  loading?: boolean;
  height?: number;
  /** Rotate x labels once there are enough to collide. Upstream uses 20deg. */
  rotateLabels?: boolean;
  /** Bars side by side instead of one series. */
  horizontal?: boolean;
  /**
   * "gradient" only where position carries meaning, i.e. aging buckets.
   * Categorical breakdowns get one colour.
   */
  palette?: "single" | "gradient";
  emptyMessage?: string;
}

export function ChartCard({
  title,
  action,
  categories,
  series,
  loading = false,
  height = 280,
  rotateLabels,
  horizontal = false,
  palette = "single",
  emptyMessage = "No data",
}: ChartCardProps) {
  const isDark = useIsDark();

  const labelColor = isDark ? "#94a3b8" : "#6b7280";
  const axisLineColor = isDark ? "#2a3141" : "#d1d5db";
  const splitLineColor = isDark ? "#1e2636" : "#e5e7eb";
  const barLabelColor = isDark ? "#e2e8f0" : "#374151";

  const hasData = categories.length > 0 && series.some((s) => s.data.some((v) => v > 0));

  const option: EChartsOption = useMemo(() => {
    const categoryAxis = {
      type: "category" as const,
      data: categories,
      axisLabel: {
        color: labelColor,
        fontSize: horizontal ? 12 : 11,
        interval: 0,
        rotate: !horizontal && (rotateLabels ?? categories.length > 3) ? 20 : 0,
      },
      axisLine: { lineStyle: { color: axisLineColor } },
    };
    const valueAxis = {
      type: "value" as const,
      axisLabel: { color: labelColor, fontSize: 12 },
      splitLine: { lineStyle: { color: splitLineColor, type: "dashed" as const } },
    };

    return {
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        backgroundColor: isDark ? "#111827" : "#ffffff",
        borderColor: isDark ? "#2a3141" : "#e5e7eb",
        textStyle: { color: isDark ? "#e2e8f0" : "#374151" },
      },
      legend:
        series.length > 1
          ? { show: true, top: 0, textStyle: { color: labelColor, fontSize: 11 } }
          : undefined,
      grid: {
        left: "3%",
        right: "4%",
        bottom: "3%",
        top: series.length > 1 ? "34px" : "16px",
        containLabel: true,
      },
      xAxis: horizontal ? valueAxis : categoryAxis,
      yAxis: horizontal ? categoryAxis : valueAxis,
      series: series.map((s, si) => {
        // Several series: one colour each, told apart by the legend. One
        // series: one colour throughout, unless the axis is ordered.
        const colors =
          s.colors ??
          (series.length > 1 ? SERIES_COLORS : palette === "gradient" ? BAR_COLORS : [SINGLE_COLOR]);
        return {
        name: s.name,
        type: "bar" as const,
        data: s.data.map((value, i) => ({
          value,
          itemStyle: { color: colors[(series.length > 1 ? si : i) % colors.length] },
        })),
        barWidth: series.length > 1 ? undefined : "50%",
        label:
          series.length > 1
            ? { show: false }
            : { show: true, position: horizontal ? "right" : "top", color: barLabelColor, fontWeight: "bold" },
        };
      }),
    };
  }, [categories, series, isDark, labelColor, axisLineColor, splitLineColor, barLabelColor, rotateLabels, horizontal, palette]);

  return (
    <Card className="flex w-full flex-col">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle>{title}</CardTitle>
        {action}
      </CardHeader>
      <CardContent className="flex-1">
        {loading ? (
          <div className="flex items-end gap-3 px-4 pb-6" style={{ height }}>
            {[40, 70, 55, 85, 30].map((h, i) => (
              <Skeleton key={i} className="flex-1 rounded-md" style={{ height: `${h}%` }} />
            ))}
          </div>
        ) : !hasData ? (
          <EmptyState title={emptyMessage} className="py-8" />
        ) : (
          <ReactEChartsCore
            echarts={echarts}
            option={option}
            style={{ height, width: "100%" }}
            notMerge
            lazyUpdate
            // Without this the chart keeps the previous theme's colours when
            // the class flips, because ECharts caches the rendered canvas.
            key={isDark ? "dark" : "light"}
          />
        )}
      </CardContent>
    </Card>
  );
}
