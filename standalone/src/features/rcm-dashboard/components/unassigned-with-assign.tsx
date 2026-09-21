import { useMemo, useState, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Button,
  EmptyState,
  TablePagination,
  Tabs,
  TabsList,
  TabsTrigger,
  useFilterableTable,
} from "@/components/enhanced";
import { Copy, Check } from "lucide-react";
import { Permission, usePermission } from "@optima/auth";
import { ClaimDetailsDrawer } from "@optima/module-active-claims";
import { SubmissionAuthDrawer } from "@optima/module-authorization";
import { SelectionDock } from "../../active-claims/components/selection-dock";
import { AssigneePicker } from "../../active-claims/components/assignee-picker";
import { AutoAssignDialog } from "./auto-assign-dialog";
import {
  useSelfAssignValidationRequestMutation,
  useAssignWorkItemsMutation,
  useGetCurrentUserQuery,
  useGetRcmUsersQuery,
  WorkItemType,
  VendorUserTypes,
} from "@/__generated__/graphql";
import { useUnassignedRequests } from "../hooks/use-unassigned-requests.js";
import { useUnassignedAuthorizations } from "../hooks/use-unassigned-authorizations.js";

type ActiveTab = "claims" | "authorizations";

interface NormalizedRow {
  id: string;
  patientName: string | null | undefined;
  billNumber: string | null | undefined;
  type: string | null | undefined;
  priority: string | null | undefined;
  department: string | null | undefined;
  ageDays: number;
  billDate: string | null | undefined;
}

const PRIORITY_STYLES: Record<string, string> = {
  HIGH: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  MEDIUM: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  LOW: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
};

const MAX_BILL_DISPLAY = 12;

function AgeCell({
  ageDays,
  billDate,
  daysLabel,
}: {
  ageDays: number;
  billDate: string | null | undefined;
  daysLabel: string;
}) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number } | null>(null);
  const spanRef = useRef<HTMLSpanElement>(null);

  const colorClass =
    ageDays >= 7
      ? "text-red-600 dark:text-red-400"
      : ageDays >= 3
        ? "text-amber-600 dark:text-amber-400"
        : "text-slate-700 dark:text-slate-300";

  const showTooltip = () => {
    if (!billDate || !spanRef.current) return;
    const rect = spanRef.current.getBoundingClientRect();
    setTooltip({ x: rect.left + rect.width / 2, y: rect.top });
  };

  return (
    <span
      ref={spanRef}
      className={`relative cursor-default ${colorClass}`}
      onMouseEnter={showTooltip}
      onMouseLeave={() => setTooltip(null)}
    >
      {ageDays} {daysLabel}
      {tooltip && billDate && (
        <span
          className="pointer-events-none fixed z-[9999] whitespace-nowrap rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 shadow-lg dark:border-dark-border dark:bg-dark-surface dark:text-slate-200"
          style={{ left: tooltip.x, top: tooltip.y - 8, transform: "translate(-50%, -100%)" }}
        >
          {format(new Date(billDate), "dd MMM yyyy")}
        </span>
      )}
    </span>
  );
}

function BillNumberCell({ value }: { value: string | null | undefined }) {
  const [copied, setCopied] = useState(false);
  const [tooltip, setTooltip] = useState<{ x: number; y: number } | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const spanRef = useRef<HTMLSpanElement>(null);

  if (!value) return <span className="text-slate-400 dark:text-slate-500">-</span>;

  const isLong = value.length > MAX_BILL_DISPLAY;
  const display = isLong ? value.slice(0, MAX_BILL_DISPLAY) + "…" : value;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setCopied(false), 1500);
  };

  const showTooltip = () => {
    if (!isLong || !spanRef.current) return;
    const rect = spanRef.current.getBoundingClientRect();
    setTooltip({ x: rect.left, y: rect.top });
  };

  return (
    <span className="inline-flex items-center gap-1">
      <span
        ref={spanRef}
        className={isLong ? "cursor-help underline decoration-dotted" : ""}
        onMouseEnter={showTooltip}
        onMouseLeave={() => setTooltip(null)}
      >
        {display}
      </span>
      <button
        type="button"
        onClick={() => void handleCopy()}
        className="inline-flex h-5 w-5 items-center justify-center rounded text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-dark-hover dark:hover:text-slate-300"
        aria-label="Copy bill number"
      >
        {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
      </button>
      {tooltip && (
        <span
          className="fixed z-[9999] whitespace-nowrap rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs shadow-lg dark:border-dark-border dark:bg-dark-surface dark:text-slate-200"
          style={{ left: tooltip.x, top: tooltip.y - 8, transform: "translateY(-100%)" }}
        >
          {value}
        </span>
      )}
    </span>
  );
}

interface UnassignedWithAssignProps {
  fromDate?: string;
  toDate?: string;
}

export function UnassignedWithAssign({ fromDate, toDate }: UnassignedWithAssignProps = {}) {
  const { t } = useTranslation("provider");
  const [activeTab, setActiveTab] = useState<ActiveTab>("claims");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [openClaimDrawerId, setOpenClaimDrawerId] = useState<string | null>(null);
  const [openAuthDrawerId, setOpenAuthDrawerId] = useState<string | null>(null);
  const [autoAssignOpen, setAutoAssignOpen] = useState(false);

  const canAssign = usePermission([Permission.ManageAssignments, Permission.AssignmentCoder]);
  const canManageAssignments = usePermission(Permission.ManageAssignments);

  const claimsTable = useFilterableTable({
    defaultSort: { field: "CREATED", direction: "DESC" },
    defaultPageSize: 10,
  });
  const authsTable = useFilterableTable({
    defaultSort: { field: "CREATED_AT", direction: "DESC" },
    defaultPageSize: 10,
  });
  const table = activeTab === "claims" ? claimsTable : authsTable;

  const claimsQuery = useUnassignedRequests({
    fromDate,
    toDate,
    first: claimsTable.paginationFirst,
    last: claimsTable.paginationLast,
    after: claimsTable.currentAfter,
    before: claimsTable.currentBefore,
  });
  const authsQuery = useUnassignedAuthorizations({
    fromDate,
    toDate,
    first: authsTable.paginationFirst,
    last: authsTable.paginationLast,
    after: authsTable.currentAfter,
    before: authsTable.currentBefore,
  });

  const rows: NormalizedRow[] = useMemo(() => {
    if (activeTab === "claims") {
      return claimsQuery.items.map((item) => ({
        id: item.id,
        patientName: item.patientName,
        billNumber: item.billNumber,
        type: item.requestType,
        priority: item.priority,
        department: item.departmentName,
        ageDays: item.ageDays,
        billDate: item.billDate,
      }));
    }
    return authsQuery.items.map((item) => ({
      id: item.id,
      patientName: item.patientName,
      billNumber: item.billNumber,
      type: item.type,
      priority: item.priority,
      department: item.department,
      ageDays: item.ageDays,
      billDate: item.createdAt,
    }));
  }, [activeTab, claimsQuery.items, authsQuery.items]);

  const loading = activeTab === "claims" ? claimsQuery.loading : authsQuery.loading;
  const pageInfo = activeTab === "claims" ? claimsQuery.pageInfo : authsQuery.pageInfo;
  const totalCount = activeTab === "claims" ? claimsQuery.totalCount : authsQuery.totalCount;

  const refetch = useCallback(async () => {
    if (activeTab === "claims") {
      await claimsQuery.refetch();
    } else {
      await authsQuery.refetch();
    }
  }, [activeTab, claimsQuery, authsQuery]);

  const workItemType =
    activeTab === "claims" ? WorkItemType.ClaimValidation : WorkItemType.AuthorizationSubmission;

  const { data: currentUserData } = useGetCurrentUserQuery();
  const currentUserId = currentUserData?.me?.id;

  const { data: rcmUsersData } = useGetRcmUsersQuery({
    variables: {
      first: 100,
      filter: {
        status: "ACTIVE" as never,
        vendorUserType: [VendorUserTypes.Rcm],
      },
    },
  });

  const rcmUsers = useMemo(() => {
    return (
      rcmUsersData?.users?.edges
        ?.filter((edge) => edge?.node != null)
        .map((edge) => ({
          id: edge.node.id,
          name:
            `${edge.node.firstName ?? ""} ${edge.node.lastName ?? ""}`.trim() ||
            edge.node.email ||
            edge.node.id,
        })) ?? []
    );
  }, [rcmUsersData]);

  const [selfAssign, { loading: selfAssignLoading }] = useSelfAssignValidationRequestMutation();
  const [assignWorkItems, { loading: assignLoading }] = useAssignWorkItemsMutation();

  const isMutating = selfAssignLoading || assignLoading;

  const allSelected = rows.length > 0 && selectedIds.size === rows.length;

  const toggleSelectAll = useCallback(() => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(rows.map((row) => row.id)));
    }
  }, [allSelected, rows]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleTabChange = useCallback((value: string) => {
    setActiveTab(value as ActiveTab);
    setSelectedIds(new Set());
  }, []);

  const handleSelfAssign = useCallback(
    async (ids: string[]) => {
      if (ids.length === 0) return;
      try {
        const result = await selfAssign({
          variables: {
            input: {
              workItemIds: ids,
              workItemType,
            },
          },
        });
        if (result.data?.selfAssignWorkItems?.success) {
          setSelectedIds(new Set());
          await refetch();
        }
      } catch {
        // Error handled by Apollo
      }
    },
    [selfAssign, refetch, workItemType]
  );

  const handleAssign = useCallback(
    async (ids: string[], userId: string) => {
      if (ids.length === 0) return;
      try {
        const result = await assignWorkItems({
          variables: {
            input: {
              assigneeId: userId,
              workItemIds: ids,
              workItemType,
            },
          },
        });
        if (result.data?.assignWorkItems?.success) {
          setSelectedIds(new Set());
          await refetch();
        }
      } catch {
        // Error handled by Apollo
      }
    },
    [assignWorkItems, refetch, workItemType]
  );

  const openRowDrawer = useCallback(
    (id: string) => {
      if (activeTab === "claims") {
        setOpenClaimDrawerId(id);
      } else {
        setOpenAuthDrawerId(id);
      }
    },
    [activeTab]
  );

  const getPriorityLabel = (priority: string | null | undefined) => {
    if (!priority) return t("rcmDashboard.normal");
    const key = priority.toLowerCase();
    if (key === "high") return t("rcmDashboard.high");
    if (key === "medium") return t("rcmDashboard.medium");
    if (key === "low") return t("rcmDashboard.low");
    return priority;
  };

  const tabsNode = (
    <Tabs value={activeTab} onValueChange={handleTabChange}>
      <TabsList>
        <TabsTrigger value="claims">
          {t("rcmDashboard.claims", { defaultValue: "Claims" })}
          <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-blue-500 px-1.5 py-0.5 text-xs font-semibold text-white">
            {claimsQuery.totalCount}
          </span>
        </TabsTrigger>
        <TabsTrigger value="authorizations">
          {t("rcmDashboard.authorizations", { defaultValue: "Authorizations" })}
          <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-purple-500 px-1.5 py-0.5 text-xs font-semibold text-white">
            {authsQuery.totalCount}
          </span>
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );

  const header = (
    <CardHeader className="pb-2">
      <div className="flex items-center justify-between gap-3">
        <CardTitle>{t("rcmDashboard.unassignedItems")}</CardTitle>
        {canAssign && (
          <Button size="sm" onClick={() => setAutoAssignOpen(true)}>
            {t("rcmDashboard.autoAssign")}
          </Button>
        )}
      </div>
      <div className="pt-2">{tabsNode}</div>
    </CardHeader>
  );

  return (
    <div className="min-w-0">
      <Card className="overflow-hidden">
        {header}
        <CardContent className="pt-0">
          {loading ? (
            <div className="flex h-[280px] items-center justify-center">
              <p className="text-slate-500 dark:text-slate-400">{t("common.loading")}</p>
            </div>
          ) : rows.length === 0 ? (
            <EmptyState title={t("rcmDashboard.noItems")} className="py-8" />
          ) : (
            <div className="overflow-hidden">
              <table className="w-full table-fixed text-sm">
                <colgroup>
                  <col className="w-10" />
                  <col />
                  <col className="w-24" />
                  <col className="w-32" />
                  <col className="w-20" />
                  {canAssign && <col className="w-28" />}
                </colgroup>
                <thead>
                  <tr className="border-b border-slate-200 dark:border-dark-border">
                    <th className="px-3 py-2 text-left">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleSelectAll}
                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-dark-border dark:bg-dark-surface"
                        aria-label={t("rcmDashboard.selectAll")}
                      />
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-slate-500 dark:text-slate-400">
                      {t("rcmDashboard.request", { defaultValue: "Request" })}
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-slate-500 dark:text-slate-400">
                      {t("rcmDashboard.priority")}
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-slate-500 dark:text-slate-400">
                      {t("rcmDashboard.department", { defaultValue: "Department" })}
                    </th>
                    <th className="px-3 py-2 text-right font-medium text-slate-500 dark:text-slate-400">
                      {t("rcmDashboard.age")}
                    </th>
                    {canAssign && (
                      <th className="px-3 py-2 text-center font-medium text-slate-500 dark:text-slate-400">
                        {t("rcmDashboard.assignee", { defaultValue: "Assignee" })}
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.id}
                      onClick={() => openRowDrawer(row.id)}
                      className={`cursor-pointer border-b border-slate-100 dark:border-dark-border hover:bg-slate-50 dark:bg-dark-card dark:hover:bg-slate-800/50 ${
                        selectedIds.has(row.id) ? "bg-blue-50 dark:bg-blue-900/20" : ""
                      }`}
                    >
                      <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(row.id)}
                          onChange={() => toggleSelect(row.id)}
                          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-dark-border dark:bg-dark-surface"
                        />
                      </td>
                      <td className="px-3 py-2 overflow-hidden">
                        <div className="flex min-w-0 flex-col gap-0.5">
                          <span className="truncate font-medium text-slate-900 dark:text-dark-text">
                            {row.patientName ?? "-"}
                          </span>
                          <Badge
                            variant="default"
                            className="self-start text-[10px] px-1.5 py-0"
                          >
                            {row.type ?? "-"}
                          </Badge>
                          <span
                            className="text-xs text-slate-500 dark:text-slate-400"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <BillNumberCell value={row.billNumber} />
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        {row.priority ? (
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                              PRIORITY_STYLES[row.priority] ??
                              "bg-slate-100 text-slate-700 dark:bg-dark-surface dark:text-slate-300"
                            }`}
                          >
                            {getPriorityLabel(row.priority)}
                          </span>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500">-</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-slate-700 dark:text-slate-300">
                        <div className="truncate" title={row.department ?? undefined}>
                          {row.department ?? "-"}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <AgeCell
                          ageDays={row.ageDays}
                          billDate={row.billDate}
                          daysLabel={t("rcmDashboard.days")}
                        />
                      </td>
                      {canAssign && (
                        <td
                          className="px-3 py-2 text-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <AssigneePicker
                            currentAssigneeId={null}
                            currentAssigneeName={null}
                            users={rcmUsers}
                            currentUserId={currentUserId}
                            onAssign={(userId) => void handleAssign([row.id], userId)}
                            onSelfAssign={() => void handleSelfAssign([row.id])}
                            canManageAssignments={canManageAssignments}
                            canSelfAssign={!!row.billNumber?.trim()}
                            disabled={isMutating}
                          />
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
        {rows.length > 0 && (
          <TablePagination {...table.getPaginationProps(totalCount, pageInfo)} />
        )}
      </Card>

      <SelectionDock
        selectedCount={selectedIds.size}
        onClearSelection={() => setSelectedIds(new Set())}
        itemLabel="Item"
        onSelfAssign={canAssign ? () => void handleSelfAssign(Array.from(selectedIds)) : undefined}
        onAssign={
          canAssign
            ? (userId) => void handleAssign(Array.from(selectedIds), userId)
            : undefined
        }
        users={rcmUsers}
        currentUserId={currentUserId}
        canManageAssignments={canAssign && canManageAssignments}
        isProcessing={isMutating}
      />

      <AutoAssignDialog
        open={autoAssignOpen}
        onOpenChange={setAutoAssignOpen}
        onSuccess={() => void refetch()}
      />

      {openClaimDrawerId && (
        <ClaimDetailsDrawer
          id={openClaimDrawerId}
          defaultOpen
          onClose={() => setOpenClaimDrawerId(null)}
          rcmUsers={rcmUsers}
          currentUserId={currentUserId}
          canAssign={canAssign}
          canManageAssignments={canManageAssignments}
          isMutating={isMutating}
          onAssign={(ids, userId) => handleAssign(ids, userId)}
          onSelfAssign={(ids) => handleSelfAssign(ids)}
          renderAssigneePicker={(props) => <AssigneePicker {...props} />}
        />
      )}

      {openAuthDrawerId && (
        <SubmissionAuthDrawer
          key={openAuthDrawerId}
          submissionId={openAuthDrawerId}
          defaultOpen
          onClose={() => setOpenAuthDrawerId(null)}
          onStatusChanged={() => void refetch()}
          assignmentProps={
            canAssign
              ? {
                  users: rcmUsers,
                  currentUserId,
                  canUnassign: () => false,
                  onAssign: async (submissionId, userId) => {
                    await handleAssign([submissionId], userId);
                  },
                  onSelfAssign: async (submissionId) => {
                    await handleSelfAssign([submissionId]);
                  },
                  onUnassign: () => {
                    // No-op: items in this list are unassigned by definition.
                  },
                }
              : undefined
          }
        />
      )}
    </div>
  );
}
