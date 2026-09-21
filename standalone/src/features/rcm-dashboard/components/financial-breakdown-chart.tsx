import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useSiteSettings } from "@optima/shared";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Skeleton,
} from "@/components/enhanced";
import { useQueueDashboardFacilityFinancialBreakdownQuery } from "@/__generated__/graphql";
import { useQueueDashboardFilter, showsClaims, showsAuthorizations } from "../queue-dashboard-filter-context";

function formatAmount(amount: number, currency: string): string {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M ${currency}`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(1)}K ${currency}`;
  return `${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${currency}`;
}

export function FinancialBreakdownChart() {
  const { t } = useTranslation("provider");
  const { defaultCurrency } = useSiteSettings();
  const { graphqlFilter, filter } = useQueueDashboardFilter();

  const { data, loading } = useQueueDashboardFacilityFinancialBreakdownQuery({
    variables: { filter: graphqlFilter },
  });

  const rows = data?.queueDashboardFacilityFinancialBreakdown ?? [];

  const showClaims = showsClaims(filter.workItemTypes);
  const showAuths = showsAuthorizations(filter.workItemTypes);

  const grandTotalAmount = useMemo(
    () => rows.reduce((sum, r) => sum + Number(r.totalAmount ?? 0), 0),
    [rows]
  );

  if (loading) {
    return (
      <Card className="flex h-full w-full flex-col">
        <CardHeader className="pb-2">
          <CardTitle>{t("rcmDashboard.financialBreakdown")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 py-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-5 flex-1 rounded-md" />
                <Skeleton className="h-3 w-16" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (rows.length === 0) {
    return (
      <Card className="flex h-full w-full flex-col">
        <CardHeader className="pb-2">
          <CardTitle>{t("rcmDashboard.financialBreakdown")}</CardTitle>
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
        <div className="flex items-center justify-between gap-3">
          <CardTitle>{t("rcmDashboard.financialBreakdown")}</CardTitle>
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {t("rcmDashboard.total", { defaultValue: "Total" })}:{" "}
            <span className="font-bold text-slate-700 dark:text-slate-300">
              {formatAmount(grandTotalAmount, defaultCurrency)}
            </span>
          </span>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-dark-border dark:text-slate-400">
                <th className="py-2 pr-3">{t("rcmDashboard.facility", { defaultValue: "Facility" })}</th>
                {showClaims && (
                  <th className="py-2 pr-3 text-right">
                    {t("rcmDashboard.claims")}
                  </th>
                )}
                {showAuths && (
                  <th className="py-2 pr-3 text-right">
                    {t("rcmDashboard.authorizations")}
                  </th>
                )}
                <th className="py-2 pr-3 text-right">
                  {t("rcmDashboard.totalCount", { defaultValue: "Total Count" })}
                </th>
                {showClaims && (
                  <th className="py-2 pr-3 text-right">
                    {t("rcmDashboard.claimsAmount", { defaultValue: "Claims Amount" })}
                  </th>
                )}
                {showAuths && (
                  <th className="py-2 pr-3 text-right">
                    {t("rcmDashboard.authsAmount", { defaultValue: "Auths Amount" })}
                  </th>
                )}
                <th className="py-2 text-right">
                  {t("rcmDashboard.totalAmount", { defaultValue: "Total Amount" })}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.facility}
                  className="border-b border-slate-100 last:border-b-0 dark:border-dark-border/40"
                >
                  <td className="py-2 pr-3 font-medium text-slate-900 dark:text-dark-text">
                    {row.facility || t("common.unknown")}
                  </td>
                  {showClaims && (
                    <td className="py-2 pr-3 text-right text-slate-700 dark:text-slate-300">
                      {Number(row.claimsCount ?? 0).toLocaleString()}
                    </td>
                  )}
                  {showAuths && (
                    <td className="py-2 pr-3 text-right text-slate-700 dark:text-slate-300">
                      {Number(row.authorizationsCount ?? 0).toLocaleString()}
                    </td>
                  )}
                  <td className="py-2 pr-3 text-right font-semibold text-slate-900 dark:text-dark-text">
                    {Number(row.totalCount ?? 0).toLocaleString()}
                  </td>
                  {showClaims && (
                    <td className="py-2 pr-3 text-right text-slate-700 dark:text-slate-300">
                      {formatAmount(Number(row.claimsTotalAmount ?? 0), defaultCurrency)}
                    </td>
                  )}
                  {showAuths && (
                    <td className="py-2 pr-3 text-right text-slate-700 dark:text-slate-300">
                      {formatAmount(Number(row.authorizationsTotalAmount ?? 0), defaultCurrency)}
                    </td>
                  )}
                  <td className="py-2 text-right font-semibold text-slate-900 dark:text-dark-text">
                    {formatAmount(Number(row.totalAmount ?? 0), defaultCurrency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
