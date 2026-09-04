import { useState, useEffect } from "react";
import {
  Button,
  Modal,
  Input,
  Label,
  Textarea,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Alert,
  AlertDescription,
  Badge,
} from "@/components/enhanced";
import {
  useUpdateOptimaTeamMutation,
  useAddOptimaTeamUsersMutation,
  useRemoveOptimaTeamUsersMutation,
  useGetUsersLazyQuery,
  type GetOptimaTeamsQuery,
  type OptimaTeamRotationFrequency,
} from "@/__generated__/graphql";
import { ApiAutocomplete } from "@/shared/autocomplete/index.js";
import { autocompleteQueriesMapper } from "@/autocompletes/index.js";
import type { IBaseOption } from "@optima/shared";
import { gql, useMutation, useLazyQuery } from "@apollo/client";
import {
  Plus,
  Trash2,
  XCircle,
  Users as UsersIcon,
  Check,
  ChevronLeft,
  ChevronRight,
  Info,
  CalendarOff,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { TeamRotationSettings } from "./components/team-rotation-settings.js";
import { TeamBranchAllocation } from "./components/team-branch-allocation.js";
import { TeamTagGroups } from "./components/team-tag-groups.js";
import { MemberUnavailabilityDialog } from "./components/member-unavailability-dialog.js";
import { MemberUnavailabilityIndicator } from "./components/member-unavailability-indicator.js";
import { useMemberUnavailability } from "./hooks/use-member-unavailability.js";
import { DEFAULT_ROTATION_FREQUENCY, MIN_ROTATION_MEMBERS } from "./constants.js";
import type { RotationFrequency, TagGroup } from "./types.js";
import { buildFlatTagList, buildTeamTagsInput, parseIsoDate, parseTeamTags } from "./utils.js";

// ── Assignment Settings queries/mutations ─────────────────────────────────

const GET_ASSIGNMENT_SETTING_BY_TEAM = gql`
  query AssignmentSettingByTeam($teamId: ID!) {
    assignmentSettingByTeam(teamId: $teamId) {
      id
      maxAuth
      maxClaim
      targetId
      type
    }
  }
`;

const ASSIGNMENT_SETTING_TEAM_SAVE = gql`
  mutation AssignmentSettingTeamSave($teamId: ID!, $input: AssignmentSettingInput!) {
    assignmentSettingTeamSave(teamId: $teamId, input: $input) {
      id
      maxAuth
      maxClaim
      targetId
      type
    }
  }
`;

interface AssignmentSettingData {
  assignmentSettingByTeam: {
    id: string;
    maxAuth: number | null;
    maxClaim: number | null;
    targetId: string;
    type: string;
  } | null;
}

interface AssignmentSettingSaveResult {
  assignmentSettingTeamSave: {
    id: string;
    maxAuth: number | null;
    maxClaim: number | null;
  };
}

// ── Types ─────────────────────────────────────────────────────────────────

type OptimaTeam = NonNullable<GetOptimaTeamsQuery["optimaTeams"]>[number];
type TeamUser = NonNullable<NonNullable<OptimaTeam["usersDetails"]>[number]>;

interface SelectedMember {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  appRole?: string | null;
  isActive?: boolean | null;
}

interface EditTeamDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  team: OptimaTeam | null;
  onSuccess: () => void;
  /** Wizard step to open on (1–4); defaults to Team Info. Used by the manage-members shortcut. */
  initialStep?: number;
}

// ── Icons ─────────────────────────────────────────────────────────────────

function PlusIcon() {
  return <Plus size={16} />;
}

function TrashIcon() {
  return <Trash2 size={16} />;
}

// ── Wizard step definitions ───────────────────────────────────────────────

const STEPS = [
  {
    id: 1,
    label: "Team Info",
    icon: "M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z",
  },
  {
    id: 2,
    label: "Members",
    icon: "M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z",
  },
  {
    id: 3,
    label: "Settings",
    icon: "M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z",
  },
  {
    id: 4,
    label: "Review",
    icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2Z",
  },
] as const;

const TOTAL_STEPS = STEPS.length;

// ── Main Component ────────────────────────────────────────────────────────

export function EditTeamDrawer({
  open,
  onOpenChange,
  team,
  onSuccess,
  initialStep = 1,
}: EditTeamDrawerProps) {
  const { t } = useTranslation("provider");
  const [currentStep, setCurrentStep] = useState(initialStep);

  const getStepLabel = (id: number): string => {
    switch (id) {
      case 1:
        return t("masterData.teams.stepTeamInfo");
      case 2:
        return t("masterData.teams.stepMembers");
      case 3:
        return t("masterData.teams.stepSettings");
      case 4:
        return t("masterData.teams.stepReview");
      default:
        return "";
    }
  };

  // Step 1 — Team Info
  const [name, setName] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [description, setDescription] = useState("");
  const [active, setActive] = useState("true");
  const [tagGroups, setTagGroups] = useState<TagGroup[]>([]);
  const [selectedBranches, setSelectedBranches] = useState<IBaseOption[]>([]);
  const [rotationEnabled, setRotationEnabled] = useState(false);
  const [rotationFrequency, setRotationFrequency] = useState<RotationFrequency>(
    DEFAULT_ROTATION_FREQUENCY
  );

  // Step 2 — Members (held locally; persisted only on final Save)
  const [originalMemberIds, setOriginalMemberIds] = useState<string[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<SelectedMember[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const memberUnavailability = useMemberUnavailability(team?.id ?? null);

  // Step 3 — Assignment Settings
  const [maxClaim, setMaxClaim] = useState("");
  const [maxAuth, setMaxAuth] = useState("");
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // Feedback
  const [validationError, setValidationError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Mutations
  const [updateTeam, { loading: updating }] = useUpdateOptimaTeamMutation();
  const [addUsers, { loading: addingUsers }] = useAddOptimaTeamUsersMutation();
  const [removeUsers, { loading: removingUsers }] = useRemoveOptimaTeamUsersMutation();
  const [searchUsers, { data: searchData, loading: searchingUsers }] = useGetUsersLazyQuery();
  const [fetchSettings] = useLazyQuery<AssignmentSettingData>(GET_ASSIGNMENT_SETTING_BY_TEAM);
  const [saveTeamSettings, { loading: savingSettings }] = useMutation<AssignmentSettingSaveResult>(
    ASSIGNMENT_SETTING_TEAM_SAVE
  );

  const submitting = updating || addingUsers || removingUsers || savingSettings;

  // ── Helpers ───────────────────────────────────────────────────────────

  const selectedBranchIds = selectedBranches
    .map((b) => b.key.trim())
    .filter((branchId) => branchId.length > 0);

  const selectedMemberIdSet = new Set(selectedMembers.map((m) => String(m.id)));
  const selectedMemberEmailSet = new Set(
    selectedMembers.map((m) => m.email?.toLowerCase().trim()).filter(Boolean) as string[]
  );

  const isAlreadySelected = (u: { id: string; email?: string | null }) =>
    selectedMemberIdSet.has(String(u.id)) ||
    (u.email ? selectedMemberEmailSet.has(u.email.toLowerCase().trim()) : false);

  const searchResults =
    searchData?.users?.edges
      ?.filter((e): e is NonNullable<typeof e> => e != null && e.node != null)
      .map((e) => e.node!)
      .filter((u): u is NonNullable<typeof u> => u != null)
      .filter((u) => !isAlreadySelected(u)) ?? [];

  const formatUserName = (user: { firstName?: string | null; lastName?: string | null }) =>
    [user.firstName, user.lastName].filter(Boolean).join(" ") || "—";

  const rotationFrequencyLabels: Record<RotationFrequency, string> = {
    DAILY: t("masterData.teams.rotationDaily", "Daily"),
    WEEKLY: t("masterData.teams.rotationWeekly", "Weekly"),
    MONTHLY: t("masterData.teams.rotationMonthly", "Monthly"),
  };

  // Load team data when drawer opens
  useEffect(() => {
    if (open && team) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCurrentStep(initialStep);
      setName(team.name ?? "");
      setRotationEnabled(team.rotationEnabled ?? false);
      setRotationFrequency(
        (team.rotationFrequency as RotationFrequency | null) ?? DEFAULT_ROTATION_FREQUENCY
      );
      setNameAr(team.nameAr ?? "");
      setDescription(team.description ?? "");
      setActive(team.active !== false ? "true" : "false");
      setTagGroups(parseTeamTags(team.tags));
      setSelectedBranches(
        (((team as any).branches ?? []) as { id: string; name?: string | null }[]) // eslint-disable-line @typescript-eslint/no-explicit-any
          .filter(Boolean)
          .map((b) => ({ key: b.id, label: b.name ?? b.id, value: b }))
      );

      const teamMembers: TeamUser[] = (team.usersDetails?.filter(Boolean) as TeamUser[]) ?? [];
      setOriginalMemberIds(teamMembers.map((m) => m.id));
      setSelectedMembers(
        teamMembers.map((u) => ({
          id: u.id,
          firstName: u.firstName,
          lastName: u.lastName,
          email: u.email,
          appRole: u.appRole,
          isActive: u.isActive,
        }))
      );

      setSearchQuery("");
      setValidationError("");
      setSuccessMsg("");
      setSettingsLoaded(false);
      setMaxClaim("");
      setMaxAuth("");

      // Fetch assignment settings
      void fetchSettings({ variables: { teamId: team.id } }).then((res) => {
        const s = res.data?.assignmentSettingByTeam;
        setMaxClaim(s?.maxClaim != null ? String(s.maxClaim) : "");
        setMaxAuth(s?.maxAuth != null ? String(s.maxAuth) : "");
        setSettingsLoaded(true);
      });
    }
  }, [open, team, initialStep, fetchSettings]);

  // ── Navigation ────────────────────────────────────────────────────────

  const handleNext = () => {
    setValidationError("");
    if (currentStep === 1) {
      const stepOneErrors: string[] = [];
      if (!name.trim()) stepOneErrors.push(t("masterData.teams.nameRequired"));
      if (stepOneErrors.length > 0) {
        setValidationError(stepOneErrors.join("\n"));
        return;
      }
    }
    if (currentStep === 3) {
      if (!maxClaim.trim() || !maxAuth.trim()) {
        setValidationError(t("masterData.teams.settingsRequiredError"));
        return;
      }
    }
    setCurrentStep((s) => Math.min(s + 1, TOTAL_STEPS));
  };

  const handleBack = () => {
    setValidationError("");
    setCurrentStep((s) => Math.max(s - 1, 1));
  };

  // Backward navigation is always allowed; forward only when every step before the target is valid
  const canNavigateToStep = (step: number) => {
    if (step <= currentStep) return true;
    for (let s = 1; s < step; s++) {
      if (!isStepComplete(s)) return false;
    }
    return true;
  };

  const goToStep = (step: number) => {
    if (step === currentStep || !canNavigateToStep(step)) return;
    setValidationError("");
    setCurrentStep(step);
  };

  // ── Search ────────────────────────────────────────────────────────────

  const handleSearch = () => {
    if (!searchQuery.trim()) return;
    void searchUsers({
      variables: { first: 20, filter: { search: searchQuery.trim() } },
    });
  };

  const handleAddMember = (user: SelectedMember) => {
    setSelectedMembers((prev) => {
      const isDuplicate = prev.some(
        (m) =>
          String(m.id) === String(user.id) ||
          (m.email &&
            user.email &&
            m.email.toLowerCase().trim() === user.email.toLowerCase().trim())
      );
      return isDuplicate ? prev : [...prev, user];
    });
  };

  const handleRemoveMember = (userId: string) => {
    setSelectedMembers((prev) => prev.filter((m) => m.id !== userId));
  };

  // ── Submit ────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!team) return;
    setValidationError("");
    setSuccessMsg("");

    if (!name.trim()) {
      setValidationError(t("masterData.teams.nameRequired"));
      setCurrentStep(1);
      return;
    }
    if (!maxClaim.trim() || !maxAuth.trim()) {
      setValidationError(t("masterData.teams.settingsRequiredError"));
      setCurrentStep(3);
      return;
    }
    // Mirrors the backend rule: rotation cannot be enabled with fewer than 2 members
    if (rotationEnabled && selectedMembers.length < MIN_ROTATION_MEMBERS) {
      setValidationError(
        t("masterData.teams.rotationMinMembersMessage", {
          defaultValue:
            "Rotation cannot be performed — at least {{min}} users are required in the team scope.",
          min: MIN_ROTATION_MEMBERS,
        })
      );
      setCurrentStep(1);
      return;
    }

    const input = {
      name: name.trim(),
      nameAr: nameAr.trim() || undefined,
      description: description.trim() || undefined,
      active: active === "true",
      tag: buildFlatTagList(tagGroups),
      tags: buildTeamTagsInput(tagGroups),
      branchIds: selectedBranchIds.length > 0 ? selectedBranchIds : undefined,
      rotationEnabled,
      rotationFrequency: rotationEnabled
        ? (rotationFrequency as OptimaTeamRotationFrequency)
        : undefined,
    };

    const originalSet = new Set(originalMemberIds);
    const currentSet = selectedMemberIdSet;
    const userIdsToAdd = [...currentSet].filter((id) => !originalSet.has(id));
    const userIdsToRemove = originalMemberIds.filter((id) => !currentSet.has(id));

    try {
      await updateTeam({ variables: { id: team.id, input } });

      if (userIdsToAdd.length > 0) {
        await addUsers({ variables: { id: team.id, userIds: userIdsToAdd } });
      }
      if (userIdsToRemove.length > 0) {
        await removeUsers({ variables: { id: team.id, userIds: userIdsToRemove } });
      }

      await saveTeamSettings({
        variables: {
          teamId: team.id,
          input: {
            maxClaim: parseInt(maxClaim, 10),
            maxAuth: parseInt(maxAuth, 10),
          },
        },
      });

      setSuccessMsg(t("masterData.teams.updateSuccess"));
      onSuccess();
      setTimeout(() => onOpenChange(false), 600);
    } catch (err) {
      setValidationError(err instanceof Error ? err.message : t("common.error"));
    }
  };

  // ── Step completion checks ────────────────────────────────────────────

  const isStepComplete = (step: number) => {
    if (step === 1) return !!name.trim();
    if (step === 2) return true; // optional
    if (step === 3) return !!(maxClaim.trim() && maxAuth.trim());
    return false;
  };

  // Show the server-computed next rotation date only while the form still matches the server state
  const rotationMatchesServer =
    !!team &&
    rotationEnabled === (team.rotationEnabled ?? false) &&
    (!rotationEnabled || rotationFrequency === (team.rotationFrequency as RotationFrequency));
  const serverNextRotationDate =
    rotationMatchesServer && team?.nextRotationDate
      ? parseIsoDate(String(team.nextRotationDate))
      : undefined;

  if (!team) return null;

  return (
    <Modal
      variant="slide-right"
      isOpen={open}
      onClose={() => onOpenChange(false)}
      title={`${t("masterData.teams.editTeam")} — ${team.name}`}
      size="xl"
      className="w-full sm:w-[540px] lg:w-[640px]"
    >
      <div className="flex flex-col h-full overflow-hidden">
        {/* ── Header with stepper ───────────────────────────────── */}
        <div className="shrink-0 border-b border-slate-200 dark:border-dark-border px-6 pt-6 pb-4">
          <nav aria-label="Progress">
            <ol className="flex items-center">
              {STEPS.map((step, idx) => {
                const isActive = currentStep === step.id;
                const isCompleted =
                  step.id < currentStep || (step.id < TOTAL_STEPS && isStepComplete(step.id));
                const isClickable = step.id !== currentStep && canNavigateToStep(step.id);

                return (
                  <li
                    key={step.id}
                    className={`relative flex items-center ${idx < STEPS.length - 1 ? "flex-1" : ""}`}
                  >
                    <button
                      type="button"
                      onClick={() => isClickable && goToStep(step.id)}
                      disabled={!isClickable}
                      className={`group flex items-center gap-2 ${isClickable ? "cursor-pointer" : "cursor-default"}`}
                    >
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                          isActive
                            ? "border-blue-600 bg-primary text-white"
                            : isCompleted
                              ? "border-green-500 bg-green-500 text-white"
                              : "border-slate-300 bg-white text-slate-500 dark:border-dark-border dark:bg-dark-surface dark:text-slate-400"
                        }`}
                      >
                        {isCompleted && !isActive ? (
                          <Check size={16} strokeWidth={2.5} />
                        ) : (
                          <svg
                            className="h-4 w-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={1.5}
                              d={step.icon}
                            />
                          </svg>
                        )}
                      </span>
                      <span
                        className={`hidden text-xs font-medium sm:flex sm:items-center sm:gap-1.5 ${
                          isActive
                            ? "text-blue-600 dark:text-blue-400"
                            : isCompleted
                              ? "text-green-600 dark:text-green-400"
                              : "text-slate-500 dark:text-slate-400"
                        }`}
                      >
                        {getStepLabel(step.id)}
                        {step.id === 2 && (
                          <Badge variant="info" className="text-[10px] px-1.5 py-0">
                            {selectedMembers.length}
                          </Badge>
                        )}
                      </span>
                    </button>
                    {idx < STEPS.length - 1 && (
                      <div
                        className={`mx-3 h-0.5 flex-1 transition-colors ${
                          step.id < currentStep ? "bg-green-500" : "bg-slate-200 dark:bg-dark-card"
                        }`}
                      />
                    )}
                  </li>
                );
              })}
            </ol>
          </nav>
        </div>

        {/* ── Scrollable content ──────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {validationError && (
            <Alert variant="error" className="mb-4">
              <AlertDescription>
                <ul className="list-disc pl-4 space-y-1">
                  {validationError.split("\n").map((errorMessage, index) => (
                    <li key={`${errorMessage}-${index}`}>{errorMessage}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
          {successMsg && (
            <Alert className="mb-4">
              <AlertDescription>{successMsg}</AlertDescription>
            </Alert>
          )}

          {/* ═══════════════════════════════════════════════════════
              STEP 1: Team Info
             ═══════════════════════════════════════════════════════ */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="edit-team-name">{t("common.name")} *</Label>
                  <Input
                    id="edit-team-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t("masterData.teams.namePlaceholder")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-team-name-ar">{t("common.name")} (AR)</Label>
                  <Input
                    id="edit-team-name-ar"
                    value={nameAr}
                    onChange={(e) => setNameAr(e.target.value)}
                    placeholder={t("masterData.teams.nameArPlaceholder")}
                    dir="rtl"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-team-active">{t("common.status")}</Label>
                <Select value={active} onValueChange={setActive}>
                  <SelectTrigger id="edit-team-active">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">{t("userManagement.active")}</SelectItem>
                    <SelectItem value="false">{t("userManagement.inactive")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <TeamTagGroups groups={tagGroups} onChange={setTagGroups} />

              <TeamBranchAllocation branches={selectedBranches} onChange={setSelectedBranches}>
                <ApiAutocomplete
                  config={autocompleteQueriesMapper.branch.queryConfig}
                  placeholder={t("masterData.teams.selectBranches")}
                  value={selectedBranches as never}
                  onChange={(val) => setSelectedBranches((val ?? []) as IBaseOption[])}
                  multiple
                  hideSelected
                />
              </TeamBranchAllocation>

              <TeamRotationSettings
                enabled={rotationEnabled}
                frequency={rotationFrequency}
                memberCount={selectedMembers.length}
                nextRotationDate={serverNextRotationDate}
                onEnabledChange={setRotationEnabled}
                onFrequencyChange={setRotationFrequency}
                idPrefix="edit-team"
              />

              <div className="space-y-2">
                <Label htmlFor="edit-team-description">{t("common.description")}</Label>
                <Textarea
                  id="edit-team-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t("masterData.teams.descriptionPlaceholder")}
                  rows={3}
                />
              </div>

              {team.createdDate && (
                <div className="rounded-md bg-slate-50 dark:bg-dark-surface/50 px-4 py-3">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {t("common.createdAt", "Created")}:{" "}
                    {new Date(team.createdDate).toLocaleDateString()}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════
              STEP 2: Members
             ═══════════════════════════════════════════════════════ */}
          {currentStep === 2 && (
            <div className="space-y-5">
              {/* Search users */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  {t("masterData.teams.addMember")}
                </p>
                <div className="flex gap-2">
                  <Input
                    placeholder={t("masterData.teams.searchUserPlaceholder")}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSearch();
                    }}
                    className="flex-1"
                  />
                  {searchQuery.trim() && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setSearchQuery("")}
                      className="h-8 w-8 px-0"
                    >
                      <span className="sr-only">{t("common.clear", "Clear search")}</span>
                      <XCircle size={14} />
                    </Button>
                  )}
                  <Button
                    size="sm"
                    onClick={handleSearch}
                    disabled={searchingUsers || !searchQuery.trim()}
                  >
                    {t("common.search")}
                  </Button>
                </div>

                {searchResults.length > 0 && (
                  <div className="max-h-48 overflow-y-auto rounded-md border border-slate-200 dark:border-dark-border">
                    {searchResults.map((user) => (
                      <div
                        key={user.id}
                        className="flex items-center justify-between px-3 py-2 hover:bg-slate-50 dark:bg-dark-card dark:hover:bg-slate-800 border-b border-slate-100 dark:border-dark-border last:border-b-0"
                      >
                        <div>
                          <p className="text-sm font-medium text-slate-900 dark:text-dark-text">
                            {formatUserName(user)}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{user.email}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            handleAddMember({
                              id: user.id,
                              firstName: user.firstName,
                              lastName: user.lastName,
                              email: user.email,
                              appRole: user.appRole,
                              isActive: user.isActive,
                            })
                          }
                        >
                          <PlusIcon />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                {searchData && searchResults.length === 0 && !searchingUsers && (
                  <p className="text-sm text-slate-500 dark:text-slate-400 py-2">
                    {t("masterData.teams.noUsersFound")}
                  </p>
                )}
              </div>

              {memberUnavailability.membersError && (
                <Alert variant="error">
                  <AlertDescription>
                    {t("masterData.teams.unavailabilityLoadError", {
                      defaultValue: "Could not load member unavailability: {{message}}",
                      message: memberUnavailability.membersError,
                    })}
                  </AlertDescription>
                </Alert>
              )}

              {/* Selected members list */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  {t("masterData.teams.currentMembers")} ({selectedMembers.length})
                </p>
                <div className="rounded-md border border-slate-200 dark:border-dark-border">
                  {selectedMembers.length === 0 ? (
                    <div className="p-6 text-center">
                      <UsersIcon
                        className="mx-auto mb-2 text-slate-300 dark:text-slate-600"
                        size={32}
                      />
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        {t("masterData.teams.noMembers")}
                      </p>
                    </div>
                  ) : (
                    selectedMembers.map((user) => (
                      <div
                        key={user.id}
                        className="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-100 dark:border-dark-border last:border-b-0"
                      >
                        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-slate-900 dark:text-dark-text">
                              {formatUserName(user)}
                            </p>
                            <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                              {user.email}
                            </p>
                          </div>
                          {user.appRole && <Badge variant="info">{user.appRole}</Badge>}
                          {user.isActive != null && (
                            <Badge variant={user.isActive ? "success" : "warning"}>
                              {user.isActive
                                ? t("userManagement.active")
                                : t("userManagement.inactive")}
                            </Badge>
                          )}
                          <MemberUnavailabilityIndicator
                            unavailability={memberUnavailability.unavailabilityByMemberId[user.id]}
                            unavailableToday={memberUnavailability.isMemberUnavailable(user.id)}
                          />
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          {/* Unavailability applies to persisted members only; newly added ones are saved first */}
                          {originalMemberIds.includes(user.id) && (
                            <span className="relative inline-flex">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => memberUnavailability.openDialog(user.id)}
                                title={t(
                                  "masterData.teams.manageUnavailability",
                                  "Manage Unavailability"
                                )}
                                className={
                                  memberUnavailability.isMemberUnavailable(user.id)
                                    ? "text-amber-600 hover:text-amber-700"
                                    : undefined
                                }
                              >
                                <span className="sr-only">
                                  {t(
                                    "masterData.teams.manageUnavailability",
                                    "Manage Unavailability"
                                  )}
                                </span>
                                <CalendarOff size={16} />
                              </Button>
                              {(memberUnavailability.unavailabilitiesByMemberId[user.id]?.length ??
                                0) > 0 && (
                                <span className="pointer-events-none absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold leading-none text-white">
                                  {memberUnavailability.unavailabilitiesByMemberId[user.id]?.length}
                                </span>
                              )}
                            </span>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveMember(user.id)}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                          >
                            <TrashIcon />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {memberUnavailability.dialogMemberId != null &&
                (() => {
                  const dialogMember = selectedMembers.find(
                    (m) => m.id === memberUnavailability.dialogMemberId
                  );
                  if (!dialogMember) return null;
                  const surfaceUnavailabilityError = (err: unknown) =>
                    setValidationError(err instanceof Error ? err.message : t("common.error"));
                  return (
                    <MemberUnavailabilityDialog
                      key={dialogMember.id}
                      open
                      memberName={formatUserName(dialogMember)}
                      existing={
                        memberUnavailability.unavailabilitiesByMemberId[dialogMember.id] ?? []
                      }
                      saving={memberUnavailability.saving}
                      onClose={memberUnavailability.closeDialog}
                      onConfirm={(entry, resolution) => {
                        void memberUnavailability
                          .confirmUnavailability(dialogMember.id, entry, resolution)
                          .catch(surfaceUnavailabilityError);
                      }}
                      onCancelWindow={(windowId) => {
                        void memberUnavailability
                          .cancelUnavailability(windowId)
                          .catch(surfaceUnavailabilityError);
                      }}
                    />
                  );
                })()}
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════
              STEP 3: Assignment Settings
             ═══════════════════════════════════════════════════════ */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-dark-text mb-1">
                  {t("masterData.teams.assignmentSettings", "Assignment Settings")}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t(
                    "masterData.teams.assignmentSettingsHint",
                    "Set the default daily capacity limits for this team. These apply to all team members unless overridden at the user level."
                  )}
                </p>
              </div>

              {!settingsLoaded ? (
                <div className="flex h-20 items-center justify-center">
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {t("common.loading")}
                  </p>
                </div>
              ) : (
                <div className="rounded-lg border border-slate-200 dark:border-dark-border p-5 space-y-5">
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="edit-team-max-claim">
                        {t("masterData.teams.maxClaimsPerDay", "Max Claims / Day")} *
                      </Label>
                      <Input
                        id="edit-team-max-claim"
                        type="number"
                        min="0"
                        value={maxClaim}
                        onChange={(e) => setMaxClaim(e.target.value)}
                        placeholder={t("masterData.teams.maxClaimPlaceholder", "e.g. 50")}
                      />
                      <p className="text-xs text-slate-400 dark:text-slate-500">
                        {t(
                          "masterData.teams.maxClaimHint",
                          "Maximum number of claims that can be assigned to a team member per day."
                        )}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="edit-team-max-auth">
                        {t("masterData.teams.maxAuthsPerDay", "Max Authorizations / Day")} *
                      </Label>
                      <Input
                        id="edit-team-max-auth"
                        type="number"
                        min="0"
                        value={maxAuth}
                        onChange={(e) => setMaxAuth(e.target.value)}
                        placeholder={t("masterData.teams.maxAuthPlaceholder", "e.g. 30")}
                      />
                      <p className="text-xs text-slate-400 dark:text-slate-500">
                        {t(
                          "masterData.teams.maxAuthHint",
                          "Maximum number of authorizations that can be assigned to a team member per day."
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-md bg-slate-50 dark:bg-dark-surface/50 px-4 py-3">
                    <p className="text-xs text-slate-500 dark:text-slate-400 flex items-start gap-2">
                      <Info className="shrink-0 mt-0.5 text-slate-400" size={16} />
                      {t(
                        "masterData.teams.settingsRequiredHint",
                        "Both fields are required. These limits apply to all team members unless overridden at the user level."
                      )}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════
              STEP 4: Review & Save
             ═══════════════════════════════════════════════════════ */}
          {currentStep === 4 && (
            <div className="space-y-5">
              {/* Team Info summary */}
              <div className="rounded-lg border border-slate-200 dark:border-dark-border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-dark-text">
                    {t("masterData.teams.teamInfo", "Team Information")}
                  </h3>
                  <button
                    type="button"
                    onClick={() => goToStep(1)}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {t("common.edit")}
                  </button>
                </div>
                <div className="grid gap-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">{t("common.name")}</span>
                    <span className="font-medium text-slate-900 dark:text-dark-text">{name}</span>
                  </div>
                  {nameAr && (
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-slate-400">
                        {t("common.name")} (AR)
                      </span>
                      <span className="font-medium text-slate-900 dark:text-dark-text" dir="rtl">
                        {nameAr}
                      </span>
                    </div>
                  )}
                  {description && (
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-slate-400">
                        {t("common.description")}
                      </span>
                      <span className="font-medium text-slate-900 dark:text-dark-text text-right max-w-[60%]">
                        {description}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">{t("common.status")}</span>
                    <Badge variant={active === "true" ? "success" : "warning"}>
                      {active === "true"
                        ? t("userManagement.active")
                        : t("userManagement.inactive")}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-start gap-2">
                    <span className="text-slate-500 dark:text-slate-400 shrink-0">
                      {t("masterData.teams.branches")}
                    </span>
                    <span className="font-medium text-slate-900 dark:text-dark-text text-right max-w-[60%]">
                      {selectedBranches.length > 0
                        ? selectedBranches.map((b) => b.label).join(", ")
                        : "—"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">
                      {t("masterData.teams.rotation", "Rotation")}
                    </span>
                    <Badge variant={rotationEnabled ? "success" : "default"}>
                      {rotationEnabled
                        ? rotationFrequencyLabels[rotationFrequency]
                        : t("masterData.teams.rotationOff", "Off")}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Members summary */}
              <div className="rounded-lg border border-slate-200 dark:border-dark-border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-dark-text">
                    {t("masterData.teams.members", "Members")} ({selectedMembers.length})
                  </h3>
                  <button
                    type="button"
                    onClick={() => goToStep(2)}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {t("common.edit")}
                  </button>
                </div>
                {selectedMembers.length === 0 ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {t("masterData.teams.noMembers")}
                  </p>
                ) : (
                  <div className="space-y-1">
                    {selectedMembers.map((user) => (
                      <div key={user.id} className="flex items-center justify-between text-sm py-1">
                        <span className="text-slate-900 dark:text-dark-text">
                          {formatUserName(user)}
                        </span>
                        <span className="text-slate-500 dark:text-slate-400 text-xs">
                          {user.email}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Assignment Settings summary */}
              <div className="rounded-lg border border-slate-200 dark:border-dark-border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-dark-text">
                    {t("masterData.teams.assignmentSettings", "Assignment Settings")}
                  </h3>
                  <button
                    type="button"
                    onClick={() => goToStep(3)}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {t("common.edit")}
                  </button>
                </div>
                <div className="grid gap-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">
                      {t("masterData.teams.maxClaimsPerDay", "Max Claims / Day")}
                    </span>
                    <span className="font-medium text-slate-900 dark:text-dark-text">
                      {maxClaim || "—"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">
                      {t("masterData.teams.maxAuthsPerDay", "Max Authorizations / Day")}
                    </span>
                    <span className="font-medium text-slate-900 dark:text-dark-text">
                      {maxAuth || "—"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer with navigation ──────────────────────────────── */}
        <div className="shrink-0 border-t border-slate-200 dark:border-dark-border px-6 py-3 flex items-center justify-between">
          <Button variant="secondary" size="sm" onClick={() => onOpenChange(false)}>
            {t("common.close", "Close")}
          </Button>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 dark:text-slate-500 mr-2">
              {t("masterData.teams.stepCounter", { current: currentStep, total: TOTAL_STEPS })}
            </span>
            {currentStep > 1 && (
              <Button variant="secondary" onClick={handleBack} size="sm">
                <ChevronLeft className="mr-1.5" size={14} />
                {t("common.back", "Back")}
              </Button>
            )}
            {currentStep < TOTAL_STEPS ? (
              <Button onClick={handleNext} size="sm">
                {t("common.next", "Next")}
                <ChevronRight className="ml-1.5" size={14} />
              </Button>
            ) : (
              <Button onClick={() => void handleSubmit()} disabled={submitting} size="sm">
                {submitting ? (
                  <>
                    <div className="mr-1.5 h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    {t("common.loading")}
                  </>
                ) : (
                  <>
                    <Check className="mr-1.5" size={14} />
                    {t("common.save")}
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
