import { useState, useEffect } from "react";
import { Modal, CortexButton, CortexSelect, Input, Textarea } from "@/components/enhanced";
import {
  useCreateOptimaTeamMutation,
  useUpdateOptimaTeamMutation,
  type GetOptimaTeamsQuery,
} from "@/__generated__/graphql";
import { ApiAutocomplete } from "@/shared/autocomplete/index.js";
import { autocompleteQueriesMapper } from "@/autocompletes/index.js";
import type { IBaseOption } from "@optima/shared";
import { useTranslation } from "react-i18next";
import { Users } from "lucide-react";

type OptimaTeam = NonNullable<GetOptimaTeamsQuery["optimaTeams"]>[number];

interface TeamFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  team?: OptimaTeam | null;
  onSuccess: () => void;
}

export function TeamFormDialog({ open, onOpenChange, team, onSuccess }: TeamFormDialogProps) {
  const { t } = useTranslation("provider");
  const isEdit = !!team;

  const [name, setName] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [description, setDescription] = useState("");
  const [selectedBranches, setSelectedBranches] = useState<IBaseOption[]>([]);
  const [active, setActive] = useState("true");
  const [validationError, setValidationError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [createTeam, { loading: creating }] = useCreateOptimaTeamMutation();
  const [updateTeam, { loading: updating }] = useUpdateOptimaTeamMutation();

  const loading = creating || updating;
  const selectedBranchIds = selectedBranches
    .map((branch) => branch.key.trim())
    .filter((branchId) => branchId.length > 0);

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setName(team?.name ?? "");
      setNameAr(team?.nameAr ?? "");
      setDescription(team?.description ?? "");
      setSelectedBranches(
        (((team as any)?.branches ?? []) as { id: string; name?: string | null }[]) // eslint-disable-line @typescript-eslint/no-explicit-any
          .filter(Boolean)
          .map((branch) => ({ key: branch.id, label: branch.name ?? branch.id, value: branch }))
      );
      setActive(team?.active !== false ? "true" : "false");
      setValidationError("");
      setSuccessMsg("");
    }
  }, [open, team]);

  const handleSubmit = async () => {
    setValidationError("");
    setSuccessMsg("");

    if (!name.trim()) {
      setValidationError(t("masterData.teams.nameRequired"));
      return;
    }
    if (!selectedBranchIds.length) {
      setValidationError(t("masterData.teams.branchesRequired"));
      return;
    }

    const input = {
      name: name.trim(),
      nameAr: nameAr.trim() || undefined,
      description: description.trim() || undefined,
      active: active === "true",
      branchIds: selectedBranchIds.length > 0 ? selectedBranchIds : undefined,
    };

    try {
      if (isEdit && team) {
        await updateTeam({ variables: { id: team.id, input } });
        setSuccessMsg(t("masterData.teams.updateSuccess"));
      } else {
        await createTeam({ variables: { input } });
        setSuccessMsg(t("masterData.teams.createSuccess"));
      }
      onSuccess();
      setTimeout(() => onOpenChange(false), 800);
    } catch (err) {
      setValidationError(err instanceof Error ? err.message : t("common.error"));
    }
  };

  return (
    <Modal
      isOpen={open}
      onClose={() => onOpenChange(false)}
      title={isEdit ? t("masterData.teams.editTeam") : t("masterData.teams.addTeam")}
      subtitle={isEdit ? t("masterData.teams.updateSubtitle") : t("masterData.teams.createSubtitle")}
      icon={<Users size={18} className="text-primary dark:text-primary-300" />}
      size="md"
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
          <CortexButton
            size="S"
            onClick={() => void handleSubmit()}
            disabled={loading}
            className="ml-auto"
          >
            {loading ? t("common.loading") : t("common.save")}
          </CortexButton>
        </>
      }
    >
      <div className="px-8 py-6 space-y-5">
        {validationError && (
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20">
            <p className="text-[11px] font-medium text-red-600 dark:text-red-400">
              {validationError}
            </p>
          </div>
        )}
        {successMsg && (
          <p className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
            {successMsg}
          </p>
        )}

        <div className="grid grid-cols-2 gap-5">
          <Input
            label={`${t("common.name")} *`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("masterData.teams.namePlaceholder")}
          />
          <Input
            label={`${t("common.name")} (AR)`}
            value={nameAr}
            onChange={(e) => setNameAr(e.target.value)}
            placeholder={t("masterData.teams.nameArPlaceholder")}
            dir="rtl"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold text-primary dark:text-primary-300 uppercase tracking-wider">
            {t("masterData.facilities.tabBranches")}{!isEdit ? " *" : ""}
          </label>
          <ApiAutocomplete
            config={autocompleteQueriesMapper.branch.queryConfig}
            placeholder={t("forms.selectBranches")}
            value={selectedBranches as never}
            onChange={(val) => setSelectedBranches((val ?? []) as IBaseOption[])}
            multiple
            showMultipleAsTags
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold text-primary dark:text-primary-300 uppercase tracking-wider">
            {t("common.description")}
          </label>
          <Textarea
            id="team-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("masterData.teams.descriptionPlaceholder")}
            rows={3}
          />
        </div>

        <CortexSelect
          label={t("common.status")}
          value={active}
          onChange={(e) => setActive(e.target.value)}
          options={[
            { value: "true", label: t("userManagement.active") },
            { value: "false", label: t("userManagement.inactive") },
          ]}
        />
      </div>
    </Modal>
  );
}
