import { useMemo, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import {
  getClaimsAssigned,
  getResubmissionsAssigned,
  resolveMemberName,
  type MemberRow,
} from "./team-performance-helpers";

interface Props {
  rows: MemberRow[];
  onSelectMember: (row: MemberRow) => void;
  showClaimsCol: boolean;
  showAuthsCol: boolean;
  showResubsCol: boolean;
}

/**
 * ECharts heatmap matrix — legacy visualisation reskinned with Phase 1 data.
 *
 * Y-axis (metrics): Overall % / Claims % / Auths % / Resubs %
 * X-axis (members): one column per row
 * Cell value = share of team workload for that metric (member.X / sum(team.X))
 *
 * Phase 1 has no `maxClaim`/`maxAuth`, so "share of team" is the meaningful
 * percentage we can compute from the grid query.
 */
export function TeamPerformanceHeatmapView({
  rows,
  onSelectMember,
  showClaimsCol,
  showAuthsCol,
  showResubsCol,
}: Props) {
  const { t } = useTranslation("provider");

  const [isDark, setIsDark] = useState(() =>
    typeof document !== "undefined" ? document.documentElement.classList.contains("dark") : false
  );
  useEffect(() => {
    if (typeof document === "undefined") return;
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains("dark"));
    });
    observer.observe(document.documentElement, { attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  // ── Build axes + cell data ──────────────────────────────────────────
  const { yLabels, xLabels, data } = useMemo(() => {
    const totalAll = rows.reduce((s, r) => s + Number(r.totalAssigned ?? 0), 0);
    const totalClaims = rows.reduce((s, r) => s + getClaimsAssigned(r), 0);
    const totalAuths = rows.reduce((s, r) => s + Number(r.authorizationsAssigned ?? 0), 0);
    const totalResubs = rows.reduce((s, r) => s + (getResubmissionsAssigned(r) ?? 0), 0);

    const metrics: { label: string; pickPct: (r: MemberRow) => number }[] = [
      {
        label: t("rcmDashboard.heatmapOverall", { defaultValue: "Overall %" }),
        pickPct: (r) => (totalAll > 0 ? (Number(r.totalAssigned ?? 0) / totalAll) * 100 : 0),
      },
    ];
    if (showAuthsCol) {
      metrics.push({
        label: t("rcmDashboard.heatmapAuths", { defaultValue: "Auths %" }),
        pickPct: (r) =>
          totalAuths > 0 ? (Number(r.authorizationsAssigned ?? 0) / totalAuths) * 100 : 0,
      });
    }
    if (showClaimsCol) {
      metrics.push({
        label: t("rcmDashboard.heatmapClaims", { defaultValue: "Claims %" }),
        pickPct: (r) => (totalClaims > 0 ? (getClaimsAssigned(r) / totalClaims) * 100 : 0),
      });
    }
    if (showResubsCol) {
      metrics.push({
        label: t("rcmDashboard.heatmapResubs", { defaultValue: "Resubs %" }),
        pickPct: (r) =>
          totalResubs > 0 ? ((getResubmissionsAssigned(r) ?? 0) / totalResubs) * 100 : 0,
      });
    }

    const yLabels = metrics.map((m) => m.label);
    const xLabels = rows.map((r) => resolveMemberName(r));

    // ECharts heatmap data: [xIndex, yIndex, value]
    const data: [number, number, number][] = [];
    rows.forEach((row, xi) => {
      metrics.forEach((m, yi) => {
        data.push([xi, yi, Math.round(m.pickPct(row) * 10) / 10]);
      });
    });

    return { yLabels, xLabels, data };
  }, [rows, showClaimsCol, showAuthsCol, showResubsCol, t]);

  // ── Theme tokens ────────────────────────────────────────────────────
  const labelColor = isDark ? "#94a3b8" : "#6b7280";
  const tooltipBg = isDark ? "#111827" : "#ffffff";
  const tooltipBorder = isDark ? "#2a3141" : "#e5e7eb";
  const tooltipText = isDark ? "#e2e8f0" : "#374151";

  const option: EChartsOption = useMemo(
    () => ({
      tooltip: {
        position: "top",
        backgroundColor: tooltipBg,
        borderColor: tooltipBorder,
        textStyle: { color: tooltipText },
        formatter: (params) => {
          const p = Array.isArray(params) ? params[0] : params;
          const [xi, yi, v] = (p?.value as [number, number, number]) ?? [0, 0, 0];
          const member = xLabels[xi] ?? "";
          const metric = yLabels[yi] ?? "";
          return `<div style="font-size:11px"><b>${member}</b><br/>${metric}: <b>${v}%</b></div>`;
        },
      },
      grid: { left: 90, right: 24, top: 16, bottom: 90, containLabel: false },
      xAxis: {
        type: "category",
        data: xLabels,
        splitArea: { show: true },
        axisLabel: {
          color: labelColor,
          fontSize: 10,
          rotate: xLabels.length > 6 ? 30 : 0,
          formatter: (val: string) => (val.length > 16 ? `${val.slice(0, 14)}…` : val),
        },
        axisTick: { show: false },
      },
      yAxis: {
        type: "category",
        data: yLabels,
        splitArea: { show: true },
        axisLabel: { color: labelColor, fontSize: 11 },
        axisTick: { show: false },
      },
      visualMap: {
        min: 0,
        max: 100,
        calculable: true,
        orient: "horizontal",
        left: "center",
        bottom: 8,
        itemWidth: 12,
        itemHeight: 140,
        text: ["100", "0"],
        textStyle: { color: labelColor, fontSize: 10 },
        inRange: {
          color: [
            "#34d399", // 0  — green
            "#a3e635",
            "#facc15", // ~50% yellow
            "#fb923c",
            "#ef4444", // 100 — red
          ],
        },
      },
      series: [
        {
          type: "heatmap",
          data,
          label: {
            show: true,
            formatter: (p) => {
              const v = (p?.value as [number, number, number])?.[2] ?? 0;
              return `${v}%`;
            },
            color: tooltipText,
            fontSize: 11,
          },
          emphasis: {
            itemStyle: {
              shadowBlur: 8,
              shadowColor: isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.2)",
            },
          },
        },
      ],
    }),
    [data, xLabels, yLabels, isDark, labelColor, tooltipBg, tooltipBorder, tooltipText]
  );

  // Dynamic height: 60px per metric row + 140px chrome
  const chartHeight = Math.max(220, yLabels.length * 60 + 140);

  if (rows.length === 0) return null;

  return (
    <ReactECharts
      option={option}
      style={{ width: "100%", height: chartHeight }}
      opts={{ renderer: "canvas" }}
      onEvents={{
        click: (params: { value?: [number, number, number] }) => {
          const xi = params?.value?.[0];
          if (typeof xi === "number" && rows[xi]) onSelectMember(rows[xi]);
        },
      }}
    />
  );
}
