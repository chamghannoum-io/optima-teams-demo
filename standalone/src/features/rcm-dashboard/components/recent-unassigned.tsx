import { useTranslation } from "react-i18next";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Skeleton,
} from "@/components/enhanced";
import { useUnassignedRequests } from "../hooks/use-unassigned-requests.js";

const PAGE_SIZE = 10;

export function RecentUnassigned() {
  const { t } = useTranslation("provider");

  const { items: claims, loading } = useUnassignedRequests({ first: PAGE_SIZE });

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle>{t("rcmDashboard.recentUnassigned")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="flex items-center gap-3 border-b border-slate-100 pb-2 dark:border-dark-border"
              >
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-3 w-24" />
                <Skeleton className="ms-auto h-3 w-16" />
                <Skeleton className="h-3 w-12" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (claims.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle>{t("rcmDashboard.recentUnassigned")}</CardTitle>
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
        <CardTitle>{t("rcmDashboard.recentUnassigned")}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-dark-border">
                <th className="px-3 py-2 text-left font-medium text-slate-500 dark:text-slate-400">
                  {t("rcmDashboard.patientName")}
                </th>
                <th className="px-3 py-2 text-left font-medium text-slate-500 dark:text-slate-400">
                  {t("rcmDashboard.payer")}
                </th>
                <th className="px-3 py-2 text-right font-medium text-slate-500 dark:text-slate-400">
                  {t("rcmDashboard.gross")}
                </th>
                <th className="px-3 py-2 text-right font-medium text-slate-500 dark:text-slate-400">
                  {t("rcmDashboard.age")}
                </th>
              </tr>
            </thead>
            <tbody>
              {claims.map((claim) => (
                <tr
                  key={claim.id}
                  className="border-b border-slate-100 dark:border-dark-border hover:bg-slate-50 dark:bg-dark-card dark:hover:bg-slate-800/50"
                >
                  <td className="px-3 py-2 font-medium text-slate-900 dark:text-dark-text">
                    {claim.patientName ?? "-"}
                  </td>
                  <td className="px-3 py-2 text-slate-700 dark:text-slate-300">
                    {claim.insurancePayer ?? "-"}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-700 dark:text-slate-300">
                    {claim.gross != null ? Number(claim.gross).toLocaleString() : "-"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <span
                      className={
                        claim.ageDays >= 7
                          ? "text-red-600 dark:text-red-400"
                          : claim.ageDays >= 3
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-slate-700 dark:text-slate-300"
                      }
                    >
                      {claim.ageDays} {t("rcmDashboard.days")}
                    </span>
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
