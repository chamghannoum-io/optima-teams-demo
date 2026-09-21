import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle, Skeleton } from "@/components/enhanced";
import {
  useQueueDashboardAuthOverduePendingQuery,
  useQueueDashboardClaimsOverduePendingQuery,
  type QueueDashboardOverduePending,
} from "@/__generated__/graphql";
import { useQueueDashboardFilter } from "../queue-dashboard-filter-context";

const ENCOUNTER_LABELS: Record<string, string> = {
  IP: "Inpatient",
  OP: "Outpatient",
  EMERGENCY: "Emergency",
  UNKNOWN: "Unknown",
};

interface Props {
  variant: "auth" | "claims";
}

interface SummaryProps {
  overdue: number;
  expiring: number;
  pending: number;
  loading: boolean;
}

function Summary({ overdue, expiring, pending, loading }: SummaryProps) {
  const { t } = useTranslation("provider");
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/30">
        <p className="text-xs font-medium text-red-600 dark:text-red-400">
          {t("rcmDashboard.overdueLast48h", { defaultValue: "Overdue (last 48h)" })}
        </p>
        {loading ? (
          <Skeleton className="mt-1 h-8 w-20 bg-red-200/60 dark:bg-red-900/40" />
        ) : (
          <p className="mt-1 text-3xl font-bold text-red-700 dark:text-red-300">
            {overdue.toLocaleString()}
          </p>
        )}
      </div>
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
        <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
          {t("rcmDashboard.expiringIn24h", { defaultValue: "Expiring in 24h" })}
        </p>
        {loading ? (
          <Skeleton className="mt-1 h-8 w-20 bg-amber-200/60 dark:bg-amber-900/40" />
        ) : (
          <p className="mt-1 text-3xl font-bold text-amber-700 dark:text-amber-300">
            {expiring.toLocaleString()}
          </p>
        )}
      </div>
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/30">
        <p className="text-xs font-medium text-blue-600 dark:text-blue-400">
          {t("rcmDashboard.totalPending", { defaultValue: "Total Pending" })}
        </p>
        {loading ? (
          <Skeleton className="mt-1 h-8 w-20 bg-blue-200/60 dark:bg-blue-900/40" />
        ) : (
          <p className="mt-1 text-3xl font-bold text-blue-700 dark:text-blue-300">
            {pending.toLocaleString()}
          </p>
        )}
      </div>
    </div>
  );
}

function EncounterBreakdown({
  buckets,
  loading,
}: {
  buckets: QueueDashboardOverduePending["byEncounterType"];
  loading: boolean;
}) {
  const { t } = useTranslation("provider");

  if (loading) {
    return (
      <div className="flex flex-col gap-2 py-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 flex-1" />
            <Skeleton className="h-3 w-10" />
          </div>
        ))}
      </div>
    );
  }

  if (!buckets || buckets.length === 0) {
    return (
      <div className="flex h-[100px] items-center justify-center text-xs text-slate-500 dark:text-slate-400">
        {t("rcmDashboard.noEncounterBreakdown", {
          defaultValue: "No encounter-type breakdown",
        })}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-dark-border dark:text-slate-400">
            <th className="py-2 pr-3">
              {t("rcmDashboard.encounterType", { defaultValue: "Encounter Type" })}
            </th>
            <th className="py-2 pr-3 text-right">
              {t("rcmDashboard.overdueLast48h", { defaultValue: "Overdue (48h)" })}
            </th>
            <th className="py-2 text-right">
              {t("rcmDashboard.expiringIn24h", { defaultValue: "Expiring (24h)" })}
            </th>
          </tr>
        </thead>
        <tbody>
          {buckets.map((b) => {
            const label =
              t(`rcmDashboard.encounter.${b.category.toLowerCase()}`, {
                defaultValue: ENCOUNTER_LABELS[b.category] ?? b.category,
              });
            return (
              <tr
                key={b.category}
                className="border-b border-slate-100 last:border-b-0 dark:border-dark-border/40"
              >
                <td className="py-2 pr-3 font-medium text-slate-900 dark:text-dark-text">
                  {label}
                </td>
                <td className="py-2 pr-3 text-right text-red-600 dark:text-red-400">
                  {Number(b.overdueLast48h ?? 0).toLocaleString()}
                </td>
                <td className="py-2 text-right text-amber-600 dark:text-amber-400">
                  {Number(b.expiringNext24h ?? 0).toLocaleString()}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function OverduePendingCard({ variant }: Props) {
  const { t } = useTranslation("provider");
  const { graphqlFilter } = useQueueDashboardFilter();

  const auth = useQueueDashboardAuthOverduePendingQuery({
    variables: { filter: graphqlFilter },
    skip: variant !== "auth",
  });
  const claims = useQueueDashboardClaimsOverduePendingQuery({
    variables: { filter: graphqlFilter },
    skip: variant !== "claims",
  });

  const loading = variant === "auth" ? auth.loading : claims.loading;
  const result =
    variant === "auth"
      ? auth.data?.queueDashboardAuthOverduePending
      : claims.data?.queueDashboardClaimsOverduePending;

  const titleKey =
    variant === "auth"
      ? "rcmDashboard.authOverduePendingTitle"
      : "rcmDashboard.claimsOverduePendingTitle";
  const titleDefault =
    variant === "auth" ? "Authorizations: Overdue & Pending" : "Claims: Overdue & Pending";

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>{t(titleKey, { defaultValue: titleDefault })}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex flex-col gap-4">
          <Summary
            overdue={Number(result?.overdueLast48h ?? 0)}
            expiring={Number(result?.expiringNext24h ?? 0)}
            pending={Number(result?.totalPending ?? 0)}
            loading={loading}
          />
          <div>
            <p className="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">
              {t("rcmDashboard.byEncounterType", {
                defaultValue: "Breakdown by encounter type",
              })}
            </p>
            <EncounterBreakdown buckets={result?.byEncounterType ?? []} loading={loading} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
