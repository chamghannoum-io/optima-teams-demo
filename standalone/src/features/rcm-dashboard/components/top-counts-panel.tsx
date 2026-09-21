import { useTranslation } from "react-i18next";
import { FileText, Shield, LayoutGrid } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn, Skeleton } from "@/components/enhanced";
import { useQueueDashboardTopCountsQuery } from "@/__generated__/graphql";
import {
  useQueueDashboardFilter,
  showsClaims,
  showsAuthorizations,
} from "../queue-dashboard-filter-context";

type Accent = "primary" | "blue" | "violet";

interface CountsBlockProps {
  label: string;
  icon: LucideIcon;
  accent: Accent;
  total: number;
  assigned: number;
  unassigned: number;
  overdue: number;
  pending: number;
  loading: boolean;
}

const ACCENT_GRADIENT: Record<Accent, string> = {
  primary: "to-primary/10 dark:to-primary/5",
  blue: "to-blue-100/60 dark:to-blue-900/20",
  violet: "to-violet-100/60 dark:to-violet-900/20",
};

const ACCENT_ICON: Record<Accent, string> = {
  primary: "text-primary dark:text-primary-300",
  blue: "text-blue-600 dark:text-blue-400",
  violet: "text-violet-600 dark:text-violet-400",
};

function CountsBlock({
  label,
  icon: Icon,
  accent,
  total,
  assigned,
  unassigned,
  overdue,
  pending,
  loading,
}: CountsBlockProps) {
  const { t } = useTranslation("provider");

  return (
    <div
      className={cn(
        "p-5 rounded-xl bg-white dark:bg-dark-surface bg-gradient-to-br from-white dark:from-dark-surface via-white dark:via-dark-surface shadow-custom flex flex-col gap-3",
        ACCENT_GRADIENT[accent]
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon size={18} className={ACCENT_ICON[accent]} />
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{label}</h3>
        </div>
        {loading ? (
          <Skeleton className="h-8 w-20" />
        ) : (
          <p className="text-3xl font-bold text-slate-900 dark:text-dark-text">
            {Number(total).toLocaleString()}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label={t("rcmDashboard.assigned")} value={assigned} loading={loading} />
        <Stat label={t("rcmDashboard.unassigned")} value={unassigned} loading={loading} />
        <Stat
          label={t("rcmDashboard.overdueLabel", { defaultValue: "Overdue" })}
          value={overdue}
          loading={loading}
          tone="red"
        />
        <Stat
          label={t("rcmDashboard.pendingLabel", { defaultValue: "Pending" })}
          value={pending}
          loading={loading}
          tone="amber"
        />
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  loading,
  tone,
}: {
  label: string;
  value: number;
  loading: boolean;
  tone?: "red" | "amber";
}) {
  const toneClass =
    tone === "red"
      ? "text-red-600 dark:text-red-400"
      : tone === "amber"
        ? "text-amber-600 dark:text-amber-400"
        : "text-slate-700 dark:text-slate-300";

  return (
    <div className="flex flex-col gap-0.5 rounded-lg bg-white/60 px-2 py-1.5 dark:bg-dark-card/40">
      <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </span>
      {loading ? (
        <Skeleton className="h-4 w-12" />
      ) : (
        <span className={cn("text-base font-bold", toneClass)}>
          {Number(value).toLocaleString()}
        </span>
      )}
    </div>
  );
}

export function TopCountsPanel() {
  const { t } = useTranslation("provider");
  const { graphqlFilter, filter } = useQueueDashboardFilter();

  const { data, loading } = useQueueDashboardTopCountsQuery({
    variables: { filter: graphqlFilter },
  });

  const counts = data?.queueDashboardTopCounts;
  const claims = counts?.claims;
  const auths = counts?.authorizations;

  // Spec: hide a panel entirely when its block is null OR when the team's
  // workItemTypes scope excludes that category (claims-only / auth-only team).
  const allowedClaims = showsClaims(filter.workItemTypes);
  const allowedAuths = showsAuthorizations(filter.workItemTypes);
  const showClaims = allowedClaims && (!data || claims != null);
  const showAuths = allowedAuths && (!data || auths != null);

  // Combined "Total Workload" across the two visible categories
  const totalAll = (Number(claims?.total ?? 0)) + (Number(auths?.total ?? 0));
  const assignedAll = (Number(claims?.assigned ?? 0)) + (Number(auths?.assigned ?? 0));
  const unassignedAll = (Number(claims?.unassigned ?? 0)) + (Number(auths?.unassigned ?? 0));
  const overdueAll = (Number(claims?.overdue ?? 0)) + (Number(auths?.overdue ?? 0));
  const pendingAll = (Number(claims?.pending ?? 0)) + (Number(auths?.pending ?? 0));
  const showCombined = showClaims && showAuths;

  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-4",
        showCombined ? "lg:grid-cols-3" : "lg:grid-cols-2"
      )}
    >
        {showCombined && (
          <CountsBlock
            label={t("rcmDashboard.totalWorkload")}
            icon={LayoutGrid}
            accent="primary"
            total={totalAll}
            assigned={assignedAll}
            unassigned={unassignedAll}
            overdue={overdueAll}
            pending={pendingAll}
            loading={loading}
          />
        )}
        {showClaims && (
          <CountsBlock
            label={t("rcmDashboard.claims")}
            icon={FileText}
            accent="blue"
            total={Number(claims?.total ?? 0)}
            assigned={Number(claims?.assigned ?? 0)}
            unassigned={Number(claims?.unassigned ?? 0)}
            overdue={Number(claims?.overdue ?? 0)}
            pending={Number(claims?.pending ?? 0)}
            loading={loading}
          />
        )}
        {showAuths && (
          <CountsBlock
            label={t("rcmDashboard.authorizations")}
            icon={Shield}
            accent="violet"
            total={Number(auths?.total ?? 0)}
            assigned={Number(auths?.assigned ?? 0)}
            unassigned={Number(auths?.unassigned ?? 0)}
            overdue={Number(auths?.overdue ?? 0)}
            pending={Number(auths?.pending ?? 0)}
            loading={loading}
          />
        )}
    </div>
  );
}
