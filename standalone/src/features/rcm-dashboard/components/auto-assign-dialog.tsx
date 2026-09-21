import { useState, useMemo, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Zap } from "lucide-react";
import { Modal, CortexButton, DatePicker } from "@/components/enhanced";
import { useAssignmentAutoAssignMutation } from "@/__generated__/graphql";
import { ApiAutocomplete } from "@/shared/autocomplete/index.js";
import { autocompleteQueriesMapper } from "@/autocompletes/mapper.js";
import { useQueueDashboardFilter } from "../queue-dashboard-filter-context";
import {
  useWorkingBranch,
  type IBaseOption,
  toIsoDateString,
  fromIsoDateString,
} from "@optima/shared";

interface AutoAssignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function AutoAssignDialog({ open, onOpenChange, onSuccess }: AutoAssignDialogProps) {
  const { t } = useTranslation("provider");
  const workingBranch = useWorkingBranch();
  const { filter } = useQueueDashboardFilter();
  const defaultBranchOption = useMemo<IBaseOption[]>(
    () =>
      workingBranch
        ? [{ key: workingBranch.id, label: workingBranch.name, value: workingBranch }]
        : [],
    [workingBranch]
  );
  // Default the team select to whatever the user picked in the dashboard
  // filter bar (the "filters outside"). Null when no team is selected there.
  const defaultTeamOption = useMemo<IBaseOption | null>(
    () =>
      filter.teamId
        ? { key: filter.teamId, label: filter.teamName ?? filter.teamId, value: null }
        : null,
    [filter.teamId, filter.teamName]
  );
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selectedBranches, setSelectedBranches] = useState<IBaseOption[]>(defaultBranchOption);
  const [selectedTeam, setSelectedTeam] = useState<IBaseOption | null>(defaultTeamOption);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  // Snapshot the outside filter selection as the default each time the dialog
  // opens, so the team always reflects the user's current filter choice.
  useEffect(() => {
    if (open) {
      setSelectedTeam(defaultTeamOption);
      setSelectedBranches(defaultBranchOption);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const [autoAssign, { loading }] = useAssignmentAutoAssignMutation({
    refetchQueries: ["GetTeamAssignmentKpis", "GetUnassignedValidationRequests"],
  });

  const handleConfirm = async () => {
    setResult(null);
    try {
      const input: Record<string, unknown> = {};
      if (fromDate) input.fromDate = fromDate;
      if (toDate) input.toDate = toDate;
      if (selectedBranches.length > 0) input.branchIds = selectedBranches.map((b) => b.key);
      if (selectedTeam) input.teamId = selectedTeam.key;

      const { data } = await autoAssign({
        variables: { input: Object.keys(input).length > 0 ? input : undefined },
      });

      const success = data?.assignmentAutoAssign ?? false;
      if (success) {
        setResult({
          success: true,
          message: t("rcmDashboard.autoAssignSuccess"),
        });
        onSuccess?.();
        setTimeout(() => {
          onOpenChange(false);
          setResult(null);
          setFromDate("");
          setToDate("");
          setSelectedBranches(defaultBranchOption);
          setSelectedTeam(defaultTeamOption);
        }, 1500);
      } else {
        setResult({
          success: false,
          message: t("rcmDashboard.autoAssignError"),
        });
      }
    } catch {
      setResult({ success: false, message: t("rcmDashboard.autoAssignError") });
    }
  };

  return (
    <Modal
      isOpen={open}
      onClose={() => onOpenChange(false)}
      title={t("rcmDashboard.autoAssign")}
      subtitle={t("rcmDashboard.autoAssignDescription")}
      icon={<Zap className="text-primary" />}
      footer={
        <>
          <CortexButton
            variant="outline"
            size="S"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            {t("common.cancel")}
          </CortexButton>
          <CortexButton size="S" onClick={handleConfirm} disabled={loading} className="ml-auto">
            {loading ? t("common.loading") : t("rcmDashboard.autoAssignConfirm")}
          </CortexButton>
        </>
      }
    >
      <div className="px-8 py-6 space-y-5">
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold text-primary dark:text-primary-300 uppercase tracking-wider px-1">
            {t("rcmDashboard.team", "Team")}
          </label>
          <ApiAutocomplete
            config={autocompleteQueriesMapper.team.queryConfig}
            value={selectedTeam as never}
            onChange={(val) => setSelectedTeam(Array.isArray(val) ? (val[0] ?? null) : val)}
            placeholder={t("rcmDashboard.selectTeam", "Select team...")}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold text-primary dark:text-primary-300 uppercase tracking-wider px-1">
            {t("rcmDashboard.branch", "Branch")}
          </label>
          <ApiAutocomplete
            config={autocompleteQueriesMapper.branch.queryConfig}
            value={selectedBranches as never}
            onChange={(val) => setSelectedBranches(Array.isArray(val) ? val : val ? [val] : [])}
            placeholder={t("rcmDashboard.selectBranch", "Select branch...")}
            filter={{ isActive: true } as Record<string, unknown>}
            multiple
            showMultipleAsTags
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold text-primary dark:text-primary-300 uppercase tracking-wider px-1">
              {t("rcmDashboard.fromDate")}
            </label>
            <DatePicker
              date={fromDate ? fromIsoDateString(fromDate) : undefined}
              onDateChange={(d) => setFromDate(d ? toIsoDateString(d) : "")}
              placeholder="From date..."
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold text-primary dark:text-primary-300 uppercase tracking-wider px-1">
              {t("rcmDashboard.toDate")}
            </label>
            <DatePicker
              date={toDate ? fromIsoDateString(toDate) : undefined}
              onDateChange={(d) => setToDate(d ? toIsoDateString(d) : "")}
              placeholder="To date..."
            />
          </div>
        </div>

        {result && (
          <div
            className={
              result.success
                ? "p-3 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-[11px] font-medium text-emerald-600 dark:text-emerald-400"
                : "p-3 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-[11px] font-medium text-red-600 dark:text-red-400"
            }
          >
            {result.message}
          </div>
        )}
      </div>
    </Modal>
  );
}
