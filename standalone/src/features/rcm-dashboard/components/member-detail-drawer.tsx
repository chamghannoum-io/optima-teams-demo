import { useMemo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import {
  Users,
  FileText,
  ShieldCheck,
  SlidersHorizontal,
  Layers,
  Calendar,
  Building2,
  ListChecks,
} from "lucide-react";
import { useSiteSettings } from "@optima/shared";
import {
  Sheet,
  SheetContent,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Badge,
  EmptyState,
  Skeleton,
  cn,
} from "@/components/enhanced";
import {
  useQueueDashboardMemberViewQuery,
  useGetMemberAssignedClaimsQuery,
  useGetMemberAssignedClaimSubmissionsQuery,
  useGetMemberAssignedAuthsQuery,
  useGetMemberWorkProgressCountsQuery,
  WorkItemType,
  type QueueDashboardMemberRow,
  type QueueDashboardMemberViewQuery,
} from "@/__generated__/graphql";
import {
  useQueueDashboardFilter,
  showsAuthorizations,
  showsPreClaims,
  showsClaimSubmissions,
  showsResubmissions,
} from "../queue-dashboard-filter-context";
import { getClaimsAssigned, getResubmissionsAssigned } from "./team-performance-helpers";

type Insight = QueueDashboardMemberViewQuery["queueDashboardMemberView"]["insights"][number];

type TranslateFn = (key: string, options?: { defaultValue?: string }) => string;

interface MemberDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string | null;
  userName: string;
  /** Grid row this drawer was opened from — provides per-type counts immediately. */
  row?: QueueDashboardMemberRow | null;
}

// ── Avatar helpers ─────────────────────────────────────────────────────
const AVATAR_COLORS = [
  "bg-blue-500",
  "bg-green-500",
  "bg-purple-500",
  "bg-amber-500",
  "bg-teal-500",
  "bg-red-500",
  "bg-indigo-500",
  "bg-pink-500",
];

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// ── Formatters ─────────────────────────────────────────────────────────
function formatDuration(seconds: number | null | undefined, t: TranslateFn) {
  if (seconds == null) return t("rcmDashboard.notAvailable", { defaultValue: "—" });
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = seconds / 60;
  if (minutes < 60) return `${minutes.toFixed(1)}m`;
  const hours = minutes / 60;
  if (hours < 24) return `${hours.toFixed(1)}h`;
  const days = hours / 24;
  return `${days.toFixed(1)}d`;
}

function formatRelative(value: string | number | null | undefined): string {
  if (value == null) return "";
  const ms = typeof value === "string" ? new Date(value).getTime() : Number(value);
  if (!Number.isFinite(ms)) return "";
  const diff = Date.now() - ms;
  const sec = Math.round(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.round(hr / 24);
  return `${d}d ago`;
}

function formatCurrency(amount: number | null | undefined, currency: string) {
  if (amount == null) return `0 ${currency}`;
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M ${currency}`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(1)}K ${currency}`;
  return `${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${currency}`;
}

function workItemTypeLabel(type: WorkItemType, t: TranslateFn): string {
  switch (type) {
    case WorkItemType.ClaimSubmission:
      return t("rcmDashboard.workType.claimSubmission", { defaultValue: "Claim Submissions" });
    case WorkItemType.ClaimResubmission:
      return t("rcmDashboard.workType.claimResubmission", {
        defaultValue: "Claim Resubmissions",
      });
    case WorkItemType.ClaimValidation:
      return t("rcmDashboard.workType.claimValidation", { defaultValue: "Claim Validations" });
    case WorkItemType.AuthorizationSubmission:
      return t("rcmDashboard.workType.authSubmission", { defaultValue: "Authorizations" });
    case WorkItemType.AuthorizationResubmission:
      return t("rcmDashboard.workType.authResubmission", {
        defaultValue: "Auth Resubmissions",
      });
    default:
      return String(type);
  }
}

// ── Drawer section divider ────────────────────────────────────────────
// Visually splits the drawer body into "filter-scoped" vs "full workload"
// data, so viewers immediately know which numbers respond to the dashboard
// filters and which reflect this user's entire assigned queue.
function DrawerSection({
  icon,
  title,
  subtitle,
  scopeLabel,
  scopeTone,
  pills,
  children,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  scopeLabel: string;
  scopeTone: "filtered" | "all";
  /** Optional chip row rendered under the subtitle (e.g. active filter values). */
  pills?: ReactNode;
  children: ReactNode;
}) {
  const scopeClasses =
    scopeTone === "filtered"
      ? "bg-blue-50 text-blue-700 ring-blue-200/60 dark:bg-blue-950/40 dark:text-blue-300 dark:ring-blue-900/40"
      : "bg-violet-50 text-violet-700 ring-violet-200/60 dark:bg-violet-950/40 dark:text-violet-300 dark:ring-violet-900/40";
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-start gap-2.5">
        <div className="mt-0.5 shrink-0 rounded-md bg-slate-100 p-1.5 text-slate-600 dark:bg-dark-card dark:text-slate-300">
          {icon}
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
              {title}
            </h3>
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ring-1 ring-inset",
                scopeClasses
              )}
            >
              {scopeLabel}
            </span>
          </div>
          <p className="mt-0.5 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
            {subtitle}
          </p>
          {pills && <div className="mt-2 flex flex-wrap gap-1.5">{pills}</div>}
        </div>
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

// ── Read-only filter chip (used in the filtered-section header) ───────
function FilterChip({
  icon,
  label,
  value,
}: {
  icon?: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-700 ring-1 ring-inset ring-slate-200/70 dark:bg-dark-card dark:text-slate-200 dark:ring-dark-border">
      {icon && <span className="text-slate-400 dark:text-slate-500">{icon}</span>}
      <span className="font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {label}
      </span>
      <span className="max-w-[160px] truncate">{value}</span>
    </span>
  );
}

const WORK_ITEM_TYPE_LABEL: Record<WorkItemType, string> = {
  [WorkItemType.ClaimSubmission]: "Claim Sub",
  [WorkItemType.ClaimResubmission]: "Claim Resub",
  [WorkItemType.ClaimValidation]: "Validation",
  [WorkItemType.AuthorizationSubmission]: "Auth Sub",
  [WorkItemType.AuthorizationResubmission]: "Auth Resub",
  [WorkItemType.Reconciliation]: "Reconciliation",
};

// ── KPI tile (top 4 pastel boxes) ─────────────────────────────────────
function KpiTile({
  label,
  value,
  tone,
  loading,
}: {
  label: string;
  value: string | number;
  tone: "blue" | "green" | "violet" | "red";
  loading?: boolean;
}) {
  const map = {
    blue: "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300",
    green: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300",
    violet: "bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-300",
    red: "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300",
  }[tone];

  return (
    <div className={cn("flex flex-col items-center justify-center rounded-xl py-3 px-2", map)}>
      {loading ? (
        <Skeleton className="h-7 w-12 bg-current/20" />
      ) : (
        <span className="text-2xl font-bold leading-tight">
          {typeof value === "number" ? value.toLocaleString() : value}
        </span>
      )}
      <span className="mt-1 text-[11px] font-medium opacity-80">{label}</span>
    </div>
  );
}

// ── Workload progress bar (proportional, not capacity-based) ──────────
function WorkloadBar({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-xs">
        <span className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-300">
          <span className={cn("h-2 w-2 rounded-full", color)} />
          {label}
        </span>
        <span className="font-semibold text-slate-700 dark:text-slate-200">
          {count.toLocaleString()}
          {total > 0 && (
            <span className="ms-1 text-slate-500 dark:text-slate-400">
              ({pct.toFixed(1)}%)
            </span>
          )}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-dark-card/60">
        <div
          className={cn("h-full rounded-full", color)}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  );
}

// ── Performance Insights card (per work-item type) ────────────────────
function MiniStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "green" | "red" | "amber" | "violet" | "neutral";
}) {
  const map = {
    green: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300",
    red: "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300",
    amber: "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300",
    violet: "bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-300",
    neutral: "bg-slate-50 text-slate-700 dark:bg-dark-card/40 dark:text-slate-200",
  }[tone ?? "neutral"];

  return (
    <div className={cn("flex flex-col items-center justify-center rounded-lg py-2.5 px-2", map)}>
      <span className="text-lg font-bold leading-tight">{value}</span>
      <span className="mt-0.5 text-[10px] font-medium opacity-80">{label}</span>
    </div>
  );
}

function InsightCard({ insight }: { insight: Insight }) {
  const { t } = useTranslation("provider");

  const compliance = Number(insight.slaCompliance ?? 0);
  const breaches = Number(insight.slaBreaches ?? 0);
  const total = compliance + breaches;
  const compliancePct = total > 0 ? (compliance / total) * 100 : null;
  const overdue = Number(insight.overdue ?? 0);

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-dark-border dark:bg-dark-surface">
      <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {workItemTypeLabel(insight.workItemType, t)}
      </h4>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <MiniStat
          label={t("rcmDashboard.completedLabel", { defaultValue: "Completed" })}
          value={Number(insight.completed ?? 0).toLocaleString()}
          tone="green"
        />
        <MiniStat
          label={t("rcmDashboard.overdueLabel", { defaultValue: "Overdue" })}
          value={overdue.toLocaleString()}
          tone={overdue > 0 ? "red" : "neutral"}
        />
        <MiniStat
          label={t("rcmDashboard.avgTat", { defaultValue: "Avg. TAT" })}
          value={formatDuration(insight.avgTatSeconds, t)}
          tone="violet"
        />
        <MiniStat
          label={t("rcmDashboard.slaCompliance", { defaultValue: "SLA Compliance" })}
          value={compliancePct != null ? `${compliancePct.toFixed(0)}%` : compliance.toLocaleString()}
          tone="green"
        />
        <MiniStat
          label={t("rcmDashboard.slaBreaches", { defaultValue: "SLA Breaches" })}
          value={breaches.toLocaleString()}
          tone={breaches > 0 ? "amber" : "neutral"}
        />
      </div>
    </section>
  );
}

// ── Work Progress bar (Done / In Progress / Open) ─────────────────────
interface ProgressStats {
  done: number;
  inProgress: number;
  open: number;
}

function WorkProgressSection({
  title,
  stats,
  loading,
}: {
  title: string;
  stats: ProgressStats;
  loading: boolean;
}) {
  const { t } = useTranslation("provider");
  const total = stats.done + stats.inProgress + stats.open;
  const pct = (n: number) => (total > 0 ? (n / total) * 100 : 0);

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-dark-border dark:bg-dark-surface">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {title}
        </h4>
        {total > 0 && (
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
            {stats.done}/{total} {t("rcmDashboard.workDoneSuffix", { defaultValue: "done" })}
          </span>
        )}
      </div>
      {loading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-2 w-full rounded-full" />
          <div className="flex flex-wrap items-center gap-3">
            <Skeleton className="h-3 w-14 rounded-full" />
            <Skeleton className="h-3 w-20 rounded-full" />
            <Skeleton className="h-3 w-14 rounded-full" />
          </div>
        </div>
      ) : total === 0 ? (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {t("rcmDashboard.noWorkAssigned", { defaultValue: "No work assigned" })}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-dark-card/60">
            {stats.done > 0 && (
              <div className="bg-emerald-500" style={{ width: `${pct(stats.done)}%` }} />
            )}
            {stats.inProgress > 0 && (
              <div className="bg-amber-500" style={{ width: `${pct(stats.inProgress)}%` }} />
            )}
            {stats.open > 0 && (
              <div className="bg-blue-500" style={{ width: `${pct(stats.open)}%` }} />
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-600 dark:text-slate-300">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              {t("rcmDashboard.workDone", { defaultValue: "Done" })} {stats.done}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              {t("rcmDashboard.workInProgress", { defaultValue: "In progress" })} {stats.inProgress}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-blue-500" />
              {t("rcmDashboard.workOpen", { defaultValue: "Open" })} {stats.open}
            </span>
          </div>
        </div>
      )}
    </section>
  );
}

// ── Claim/Auth cards (tab body) ───────────────────────────────────────
function ClaimCard({
  billNumber,
  patientName,
  payer,
  encounterType,
  net,
  gross,
  claimStatus,
  approvalStatus,
  createdDate,
  currency,
  kind,
}: {
  billNumber: string;
  patientName?: string | null;
  payer?: string | null;
  encounterType?: string | null;
  net?: number | null;
  gross?: number | null;
  claimStatus?: string | null;
  approvalStatus?: string | null;
  createdDate?: string | null;
  currency: string;
  kind?: "original" | "edited";
}) {
  const approvalUpper = (approvalStatus ?? "").toUpperCase();
  const isRejected = approvalUpper === "REJECTED";
  const isApproved = approvalUpper === "APPROVED";

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-dark-border dark:bg-dark-surface">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-mono text-xs font-semibold text-slate-900 dark:text-dark-text">
              {billNumber}
            </p>
            {kind && (
              <Badge
                variant="default"
                className={cn(
                  "shrink-0 text-[9px] uppercase tracking-wide",
                  kind === "original"
                    ? "bg-slate-100 text-slate-700 dark:bg-dark-card dark:text-slate-300"
                    : "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                )}
              >
                {kind === "original" ? "Original" : "Edited"}
              </Badge>
            )}
            {claimStatus && (
              <Badge variant="info" className="shrink-0 text-[9px]">
                {claimStatus}
              </Badge>
            )}
          </div>
          {(patientName || payer) && (
            <p className="mt-0.5 truncate text-xs text-slate-600 dark:text-slate-400">
              {patientName ?? "—"}
              {payer && <span className="mx-1 text-slate-400">·</span>}
              {payer}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          {isRejected && <Badge variant="error" className="text-[9px]">REJECTED</Badge>}
          {isApproved && <Badge variant="success" className="text-[9px]">APPROVED</Badge>}
          {createdDate && (
            <span className="text-[10px] text-slate-400 dark:text-slate-500">
              {formatRelative(createdDate)}
            </span>
          )}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
        {encounterType && (
          <Badge variant="default" className="text-[9px]">
            {encounterType}
          </Badge>
        )}
        <span className="text-slate-500 dark:text-slate-400">
          Net:{" "}
          <span className="font-semibold text-slate-700 dark:text-slate-200">
            {formatCurrency(net, currency)}
          </span>
        </span>
        <span className="text-slate-500 dark:text-slate-400">
          Gross:{" "}
          <span className="font-semibold text-slate-700 dark:text-slate-200">
            {gross == null ? "0" : gross.toLocaleString()}
          </span>
        </span>
      </div>
    </div>
  );
}

function AuthCard({
  authNumber,
  billNumber,
  patientName,
  payer,
  type,
  totalNet,
  status,
  createdAt,
  currency,
}: {
  authNumber?: string | null;
  billNumber?: string | null;
  patientName?: string | null;
  payer?: string | null;
  type?: string | null;
  totalNet?: number | null;
  status?: string | null;
  createdAt?: string | null;
  currency: string;
}) {
  const statusUpper = (status ?? "").toUpperCase();
  const variant: "success" | "error" | "warning" | "default" =
    statusUpper === "APPROVED"
      ? "success"
      : statusUpper === "REJECTED"
        ? "error"
        : statusUpper === "PARTIALLY"
          ? "warning"
          : "default";

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-dark-border dark:bg-dark-surface">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate font-mono text-xs font-semibold text-slate-900 dark:text-dark-text">
            {authNumber || billNumber || "—"}
          </p>
          {(patientName || payer) && (
            <p className="mt-0.5 truncate text-xs text-slate-600 dark:text-slate-400">
              {patientName ?? "—"}
              {payer && <span className="mx-1 text-slate-400">·</span>}
              {payer}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          {status && (
            <Badge variant={variant} className="text-[9px]">
              {statusUpper}
            </Badge>
          )}
          {createdAt && (
            <span className="text-[10px] text-slate-400 dark:text-slate-500">
              {formatRelative(createdAt)}
            </span>
          )}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
        {type && (
          <Badge variant="default" className="text-[9px]">
            {type}
          </Badge>
        )}
        <span className="text-slate-500 dark:text-slate-400">
          Net:{" "}
          <span className="font-semibold text-slate-700 dark:text-slate-200">
            {formatCurrency(totalNet, currency)}
          </span>
        </span>
      </div>
    </div>
  );
}

// ── Main drawer ───────────────────────────────────────────────────────
export function MemberDetailDrawer({
  open,
  onOpenChange,
  userId,
  userName,
  row,
}: MemberDetailDrawerProps) {
  const { t } = useTranslation("provider");
  const { defaultCurrency } = useSiteSettings();
  const { graphqlFilter, filter } = useQueueDashboardFilter();

  const showPreClaimsTab = showsPreClaims(filter.workItemTypes);
  const showClaimsTab = showsClaimSubmissions(filter.workItemTypes);
  const showAuthsTab = showsAuthorizations(filter.workItemTypes);

  // Performance Insights + top counts come from the member view
  const { data: viewData, loading: viewLoading } = useQueueDashboardMemberViewQuery({
    variables: { filter: graphqlFilter, userId: userId ?? "" },
    skip: !open || !userId,
  });

  // Assigned lists feed the tab cards. Pre-Claims = validation requests;
  // Claims = claimSubmissions (real claim records); Auths = authorization submissions.
  const preClaimsQuery = useGetMemberAssignedClaimsQuery({
    variables: { first: 50, filter: { assignmentAssignedTo: [userId ?? ""] } },
    skip: !open || !userId || !showPreClaimsTab,
  });
  const claimsQuery = useGetMemberAssignedClaimSubmissionsQuery({
    variables: { first: 50, filter: { assignmentAssignedTo: [userId ?? ""] } },
    skip: !open || !userId || !showClaimsTab,
  });
  const authsQuery = useGetMemberAssignedAuthsQuery({
    variables: { first: 50, filter: { assignmentAssignedTo: [userId ?? ""] } },
    skip: !open || !userId || !showAuthsTab,
  });

  // Work-progress bars use totalCount-per-status queries so they reflect the
  // full dataset, not just the first 50 items shown in the tab cards.
  const progressQuery = useGetMemberWorkProgressCountsQuery({
    variables: { assignedTo: [userId ?? ""] },
    skip: !open || !userId || (!showPreClaimsTab && !showClaimsTab && !showAuthsTab),
  });

  const view = viewData?.queueDashboardMemberView;
  const resolvedName = view?.userName?.trim() || userName?.trim() || userId || "";
  const displayName = resolvedName.length > 0 ? resolvedName : "—";
  const insights = (view?.insights ?? []).filter(
    (i) => i.workItemType !== WorkItemType.Reconciliation
  );

  // Top counts (BA: Unassigned + Amount + rcmDashboard.assignedPercentage all replaced)
  const totalAssigned = Number(view?.totalAssigned ?? row?.totalAssigned ?? 0);
  const totalCompleted = Number(view?.totalCompleted ?? row?.completed ?? 0);
  const totalOverdue = Number(view?.totalOverdue ?? row?.overdue ?? 0);

  const slaPct = useMemo(() => {
    const c = insights.reduce((s, i) => s + Number(i.slaCompliance ?? 0), 0);
    const b = insights.reduce((s, i) => s + Number(i.slaBreaches ?? 0), 0);
    const t = c + b;
    return t > 0 ? (c / t) * 100 : null;
  }, [insights]);

  // Per-type counts come from the grid row
  const claimsAssigned = row ? getClaimsAssigned(row) : 0;
  const authsAssigned = Number(row?.authorizationsAssigned ?? 0);
  const resubsAssigned = row ? getResubmissionsAssigned(row) : null;
  const showResubsBar = showsResubmissions(filter.workItemTypes) && resubsAssigned != null;
  const workloadTotal = claimsAssigned + authsAssigned + (resubsAssigned ?? 0);

  // Lists + counts for tabs and progress bars
  const preClaims = useMemo(() => {
    const edges = preClaimsQuery.data?.rcmOptimaValidationRequests?.edges ?? [];
    return edges.map((e) => e?.node).filter((n): n is NonNullable<typeof n> => n != null);
  }, [preClaimsQuery.data]);
  const claims = useMemo(() => {
    const edges = claimsQuery.data?.claimSubmissions?.edges ?? [];
    return edges.map((e) => e?.node).filter((n): n is NonNullable<typeof n> => n != null);
  }, [claimsQuery.data]);
  const auths = useMemo(() => {
    const edges = authsQuery.data?.authorizationSubmissions?.edges ?? [];
    return edges.map((e) => e?.node).filter((n): n is NonNullable<typeof n> => n != null);
  }, [authsQuery.data]);

  const preClaimsTotalCount = Number(
    preClaimsQuery.data?.rcmOptimaValidationRequests?.totalCount ?? preClaims.length
  );
  const claimsTotalCount = Number(
    claimsQuery.data?.claimSubmissions?.totalCount ?? claims.length
  );
  const authsTotalCount = Number(
    authsQuery.data?.authorizationSubmissions?.totalCount ?? auths.length
  );

  // Work progress buckets — totalCount from per-status filtered queries so
  // the bar reflects the assignee's full workload, not just the first 50
  // rows shown in the tab cards.
  const progress = progressQuery.data;
  const mergedClaimsProgress: ProgressStats = {
    done:
      Number(progress?.preClaimsDone?.totalCount ?? 0) +
      Number(progress?.claimsDone?.totalCount ?? 0),
    inProgress:
      Number(progress?.preClaimsInProgress?.totalCount ?? 0) +
      Number(progress?.claimsInProgress?.totalCount ?? 0),
    open:
      Number(progress?.preClaimsOpen?.totalCount ?? 0) +
      Number(progress?.claimsOpen?.totalCount ?? 0),
  };
  const authsProgress: ProgressStats = {
    done: Number(progress?.authsDone?.totalCount ?? 0),
    inProgress: Number(progress?.authsInProgress?.totalCount ?? 0),
    open: Number(progress?.authsOpen?.totalCount ?? 0),
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col p-0 sm:max-w-[860px]"
      >
        {/* ── Header (fixed; scroll lives inside the body below) ── */}
        <div className="relative z-20 shrink-0 border-b border-slate-200 bg-white/95 px-6 py-4 backdrop-blur dark:border-dark-border dark:bg-[#111827]/95">
          <div className="flex items-center gap-3 pe-12">
            <div
              className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white",
                getAvatarColor(displayName || "?")
              )}
            >
              {getInitials(displayName || "?")}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <Users size={14} className="shrink-0 text-slate-400 dark:text-slate-500" />
                <span className="truncate text-base font-bold text-slate-900 dark:text-dark-text">
                  {displayName || "—"}
                </span>
              </div>
              {row?.isOverlimit && (
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <Badge variant="error" className="text-[10px]">
                    {t("rcmDashboard.overlimit", { defaultValue: "Over limit" })}
                  </Badge>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-6 py-5">

          <DrawerSection
            icon={<SlidersHorizontal size={14} />}
            title={t("rcmDashboard.section.filteredTitle", {
              defaultValue: "Filtered performance",
            })}
            subtitle={t("rcmDashboard.section.filteredSubtitle", {
              defaultValue:
                "Scoped to the dashboard filters above — date range, work-item types, team, and branch.",
            })}
            scopeLabel={t("rcmDashboard.scope.filtered", { defaultValue: "Filtered" })}
            scopeTone="filtered"
            pills={
              <>
                <FilterChip
                  icon={<Calendar size={11} />}
                  label={t("rcmDashboard.dateRange", { defaultValue: "Date" })}
                  value={`${format(filter.fromDate, "dd MMM yyyy")} → ${format(filter.toDate, "dd MMM yyyy")}`}
                />
                {filter.workItemTypes && filter.workItemTypes.length > 0 && (
                  <FilterChip
                    icon={<ListChecks size={11} />}
                    label={t("rcmDashboard.workItemTypes", { defaultValue: "Types" })}
                    value={filter.workItemTypes.map((wt) => WORK_ITEM_TYPE_LABEL[wt]).join(", ")}
                  />
                )}
                {filter.teamId && (
                  <FilterChip
                    icon={<Users size={11} />}
                    label={t("rcmDashboard.team", { defaultValue: "Team" })}
                    value={filter.teamName ?? filter.teamId}
                  />
                )}
                {filter.teamId && filter.teamMaxClaim != null && filter.teamMaxClaim > 0 && (
                  <FilterChip
                    icon={<FileText size={11} />}
                    label={t("rcmDashboard.maxClaims", { defaultValue: "Max claims" })}
                    value={Number(filter.teamMaxClaim).toLocaleString()}
                  />
                )}
                {filter.teamId && filter.teamMaxAuth != null && filter.teamMaxAuth > 0 && (
                  <FilterChip
                    icon={<ShieldCheck size={11} />}
                    label={t("rcmDashboard.maxAuths", { defaultValue: "Max auths" })}
                    value={Number(filter.teamMaxAuth).toLocaleString()}
                  />
                )}
                {filter.branchId && (
                  <FilterChip
                    icon={<Building2 size={11} />}
                    label={t("rcmDashboard.branch", { defaultValue: "Branch" })}
                    value={filter.branchName ?? filter.branchId}
                  />
                )}
              </>
            }
          >

          {/* ── 4 top KPI tiles ─────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <KpiTile
              label={t("rcmDashboard.assigned", { defaultValue: "Assigned" })}
              value={totalAssigned}
              tone="blue"
              loading={viewLoading && !row}
            />
            <KpiTile
              label={t("rcmDashboard.completedLabel", { defaultValue: "Completed" })}
              value={totalCompleted}
              tone="green"
              loading={viewLoading && !row}
            />
            <KpiTile
              label={t("rcmDashboard.overdueLabel", { defaultValue: "Overdue" })}
              value={totalOverdue}
              tone="red"
              loading={viewLoading && !row}
            />
            <KpiTile
              label={t("rcmDashboard.slaCompliance", { defaultValue: "SLA" })}
              value={slaPct == null ? "—" : `${slaPct.toFixed(1)}%`}
              tone="violet"
              loading={viewLoading}
            />
          </div>

          {/* ── Workload bars + sub-counts ──────────────────────────── */}
          <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-dark-border dark:bg-dark-surface">
            <div className="flex flex-col gap-3">
              {showClaimsTab && (
                <WorkloadBar
                  label={t("rcmDashboard.claims", { defaultValue: "Claims" })}
                  count={claimsAssigned}
                  total={workloadTotal}
                  color="bg-blue-500"
                />
              )}
              {showAuthsTab && (
                <WorkloadBar
                  label={t("rcmDashboard.authorizations", { defaultValue: "Authorizations" })}
                  count={authsAssigned}
                  total={workloadTotal}
                  color="bg-violet-500"
                />
              )}
              {showResubsBar && (
                <WorkloadBar
                  label={t("rcmDashboard.resubmissions", { defaultValue: "Resubmissions" })}
                  count={resubsAssigned ?? 0}
                  total={workloadTotal}
                  color="bg-amber-500"
                />
              )}
            </div>

            <div className="mt-4 grid grid-cols-3 gap-3 border-t border-slate-100 pt-3 dark:border-dark-border/60">
              <div className="flex flex-col items-center">
                <span className="text-lg font-bold text-slate-900 dark:text-dark-text">
                  {claimsAssigned.toLocaleString()}
                </span>
                <span className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {t("rcmDashboard.claims", { defaultValue: "Claims" })}
                </span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-lg font-bold text-slate-900 dark:text-dark-text">
                  {authsAssigned.toLocaleString()}
                </span>
                <span className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {t("rcmDashboard.authorizations", { defaultValue: "Authorizations" })}
                </span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-lg font-bold text-slate-900 dark:text-dark-text">
                  {resubsAssigned == null ? "—" : resubsAssigned.toLocaleString()}
                </span>
                <span className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {t("rcmDashboard.resubmissions", { defaultValue: "Resubmissions" })}
                </span>
              </div>
            </div>
          </section>

          {/* ── Performance Insights (per work-item type) ───────────── */}
          <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-dark-border dark:bg-dark-surface">
            <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-dark-text">
              {t("rcmDashboard.performanceInsights", { defaultValue: "Performance Insights" })}
            </h3>
            {viewLoading ? (
              <div className="flex flex-col gap-3">
                {[0, 1].map((i) => (
                  <div
                    key={i}
                    className="flex flex-col gap-2 rounded-lg border border-slate-200 p-3 dark:border-dark-border"
                  >
                    <div className="flex items-center justify-between">
                      <Skeleton className="h-3 w-32" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      <Skeleton className="h-10 w-full rounded-lg" />
                      <Skeleton className="h-10 w-full rounded-lg" />
                      <Skeleton className="h-10 w-full rounded-lg" />
                      <Skeleton className="h-10 w-full rounded-lg" />
                    </div>
                  </div>
                ))}
              </div>
            ) : insights.length === 0 ? (
              <EmptyState
                title={t("rcmDashboard.noInsights", {
                  defaultValue: "No insights for the current filter",
                })}
                className="py-6"
              />
            ) : (
              <div className="flex flex-col gap-3">
                {insights.map((insight) => (
                  <InsightCard key={insight.workItemType} insight={insight} />
                ))}
              </div>
            )}
          </section>

          </DrawerSection>

          <DrawerSection
            icon={<Layers size={14} />}
            title={t("rcmDashboard.section.fullWorkloadTitle", {
              defaultValue: "Full assigned workload",
            })}
            subtitle={t("rcmDashboard.section.fullWorkloadSubtitle", {
              defaultValue:
                "All items currently assigned to this user — independent of the dashboard filters.",
            })}
            scopeLabel={t("rcmDashboard.scope.allData", { defaultValue: "All data" })}
            scopeTone="all"
          >

          {/* ── Work Progress bars (Claims + Authorizations) ────────── */}
          {(showPreClaimsTab || showClaimsTab) && (
            <WorkProgressSection
              title={t("rcmDashboard.claimsWorkProgress", { defaultValue: "Claims Work Progress" })}
              stats={mergedClaimsProgress}
              loading={progressQuery.loading}
            />
          )}
          {showAuthsTab && (
            <WorkProgressSection
              title={t("rcmDashboard.authsWorkProgress", {
                defaultValue: "Authorizations Work Progress",
              })}
              stats={authsProgress}
              loading={progressQuery.loading}
            />
          )}

          {/* ── Tabs with card lists ────────────────────────────────── */}
          <Tabs
            defaultValue={showPreClaimsTab || showClaimsTab ? "claims" : "auths"}
            className="!flex-none !overflow-visible block"
          >
            <TabsList className="!h-11 !justify-start !bg-transparent flex w-full items-end gap-1 border-b border-slate-200 dark:border-dark-border">
              {(showPreClaimsTab || showClaimsTab) && (
                <TabsTrigger
                  value="claims"
                  className={cn(
                    "group inline-flex items-center gap-2 px-4 py-2 text-[11px] font-bold uppercase tracking-wider",
                    "rounded-t-md transition-all",
                    "hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50/70 dark:hover:bg-dark-card/40",
                    "data-[state=active]:bg-primary/[0.06] dark:data-[state=active]:bg-primary-300/10"
                  )}
                >
                  <FileText size={14} className="shrink-0" />
                  {t("rcmDashboard.claims", { defaultValue: "Claims" })}
                  <span className="inline-flex min-w-[1.5rem] items-center justify-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 ring-1 ring-inset ring-slate-200/60 transition-all group-data-[state=active]:bg-primary group-data-[state=active]:text-white group-data-[state=active]:ring-primary group-data-[state=active]:shadow-sm dark:bg-dark-card dark:text-slate-300 dark:ring-dark-border dark:group-data-[state=active]:bg-primary-300 dark:group-data-[state=active]:text-[#111827] dark:group-data-[state=active]:ring-primary-300">
                    {(showPreClaimsTab ? preClaimsTotalCount : 0) +
                      (showClaimsTab ? claimsTotalCount : 0)}
                  </span>
                </TabsTrigger>
              )}
              {showAuthsTab && (
                <TabsTrigger
                  value="auths"
                  className={cn(
                    "group inline-flex items-center gap-2 px-4 py-2 text-[11px] font-bold uppercase tracking-wider",
                    "rounded-t-md transition-all",
                    "hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50/70 dark:hover:bg-dark-card/40",
                    "data-[state=active]:bg-primary/[0.06] dark:data-[state=active]:bg-primary-300/10"
                  )}
                >
                  <ShieldCheck size={14} className="shrink-0" />
                  {t("rcmDashboard.authorizations", { defaultValue: "Authorizations" })}
                  <span className="inline-flex min-w-[1.5rem] items-center justify-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 ring-1 ring-inset ring-slate-200/60 transition-all group-data-[state=active]:bg-primary group-data-[state=active]:text-white group-data-[state=active]:ring-primary group-data-[state=active]:shadow-sm dark:bg-dark-card dark:text-slate-300 dark:ring-dark-border dark:group-data-[state=active]:bg-primary-300 dark:group-data-[state=active]:text-[#111827] dark:group-data-[state=active]:ring-primary-300">
                    {authsTotalCount}
                  </span>
                </TabsTrigger>
              )}
            </TabsList>

            {(showPreClaimsTab || showClaimsTab) && (
              <TabsContent value="claims" className="!flex-none !overflow-visible mt-3">
                {(showPreClaimsTab && preClaimsQuery.loading) ||
                (showClaimsTab && claimsQuery.loading) ? (
                  <div className="flex flex-col gap-2">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className="rounded-lg border border-slate-200 bg-white p-3 dark:border-dark-border dark:bg-dark-surface"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                            <Skeleton className="h-3 w-24" />
                            <Skeleton className="h-2.5 w-40" />
                          </div>
                          <div className="flex flex-col items-end gap-1.5">
                            <Skeleton className="h-3 w-14 rounded-full" />
                            <Skeleton className="h-2.5 w-10" />
                          </div>
                        </div>
                        <div className="mt-2 flex items-center gap-3">
                          <Skeleton className="h-3 w-14 rounded-full" />
                          <Skeleton className="h-2.5 w-16" />
                          <Skeleton className="h-2.5 w-16" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (showPreClaimsTab ? preClaims.length : 0) +
                    (showClaimsTab ? claims.length : 0) ===
                  0 ? (
                  <EmptyState
                    title={t("rcmDashboard.noClaimsAssigned", { defaultValue: "No assigned claims" })}
                    className="py-8"
                  />
                ) : (
                  <div className="flex flex-col gap-2">
                    {showPreClaimsTab &&
                      preClaims.map((c) => (
                        <ClaimCard
                          key={`pre-${c.id}`}
                          billNumber={c.billNumber ?? c.requestId ?? c.id}
                          patientName={c.patientName}
                          payer={c.insurancePayer}
                          encounterType={c.requestType ? String(c.requestType) : null}
                          net={c.net}
                          gross={c.gross}
                          claimStatus={c.claimStatus ? String(c.claimStatus) : null}
                          approvalStatus={c.approvalStatus ? String(c.approvalStatus) : null}
                          createdDate={c.createdDate}
                          currency={defaultCurrency}
                          kind="original"
                        />
                      ))}
                    {showClaimsTab &&
                      claims.map((c) => (
                        <ClaimCard
                          key={`sub-${c.id}`}
                          billNumber={c.transactionId ?? c.claimId ?? c.id}
                          patientName={c.patientName}
                          payer={c.insurancePayer}
                          encounterType={c.encounterType}
                          net={c.totalNet}
                          gross={c.totalApprovedNet}
                          claimStatus={c.status ? String(c.status) : null}
                          approvalStatus={c.approvalStatus ? String(c.approvalStatus) : null}
                          createdDate={c.createdAt}
                          currency={defaultCurrency}
                          kind="edited"
                        />
                      ))}
                  </div>
                )}
              </TabsContent>
            )}

            {showAuthsTab && (
              <TabsContent value="auths" className="!flex-none !overflow-visible mt-3">
                {authsQuery.loading ? (
                  <div className="flex flex-col gap-2">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className="rounded-lg border border-slate-200 bg-white p-3 dark:border-dark-border dark:bg-dark-surface"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                            <Skeleton className="h-3 w-24" />
                            <Skeleton className="h-2.5 w-40" />
                          </div>
                          <div className="flex flex-col items-end gap-1.5">
                            <Skeleton className="h-3 w-14 rounded-full" />
                            <Skeleton className="h-2.5 w-10" />
                          </div>
                        </div>
                        <div className="mt-2 flex items-center gap-3">
                          <Skeleton className="h-3 w-14 rounded-full" />
                          <Skeleton className="h-2.5 w-16" />
                          <Skeleton className="h-2.5 w-16" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : auths.length === 0 ? (
                  <EmptyState
                    title={t("rcmDashboard.noAuthsAssigned", {
                      defaultValue: "No assigned authorizations",
                    })}
                    className="py-8"
                  />
                ) : (
                  <div className="flex flex-col gap-2">
                    {auths.map((a) => (
                      <AuthCard
                        key={a.id}
                        authNumber={a.authorizationNumber}
                        billNumber={a.billNumber}
                        patientName={a.patientName}
                        payer={a.insurancePayerName}
                        type={a.type ? String(a.type) : null}
                        totalNet={a.totalNet}
                        status={a.status ? String(a.status) : null}
                        createdAt={a.createdAt}
                        currency={defaultCurrency}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>
            )}
          </Tabs>

          </DrawerSection>
        </div>
      </SheetContent>
    </Sheet>
  );
}
