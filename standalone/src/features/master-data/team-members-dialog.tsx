import { useState } from "react";
import { Modal, CortexButton, Badge, Input } from "@/components/enhanced";
import {
  useAddOptimaTeamUsersMutation,
  useRemoveOptimaTeamUsersMutation,
  useGetUsersLazyQuery,
  type GetOptimaTeamsQuery,
} from "@/__generated__/graphql";
import { Trash2, Plus, Users } from "lucide-react";
import { useTranslation } from "react-i18next";

type OptimaTeam = NonNullable<GetOptimaTeamsQuery["optimaTeams"]>[number];
type TeamUser = NonNullable<NonNullable<OptimaTeam["usersDetails"]>[number]>;

interface TeamMembersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  team: OptimaTeam | null;
  onMembersChanged: () => void;
}

function TrashIcon() {
  return <Trash2 size={16} />;
}

function PlusIcon() {
  return <Plus size={16} />;
}

export function TeamMembersDialog({
  open,
  onOpenChange,
  team,
  onMembersChanged,
}: TeamMembersDialogProps) {
  const { t } = useTranslation("provider");
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [addUsers, { loading: addingUsers }] = useAddOptimaTeamUsersMutation();
  const [removeUsers, { loading: removingUsers }] = useRemoveOptimaTeamUsersMutation();
  const [searchUsers, { data: searchData, loading: searchingUsers }] = useGetUsersLazyQuery();

  const members: TeamUser[] = (team?.usersDetails?.filter(Boolean) as TeamUser[]) ?? [];

  const existingUserIds = new Set(members.map((m) => m.id));

  const searchResults =
    searchData?.users?.edges
      ?.filter((e): e is NonNullable<typeof e> => e != null && e.node != null)
      .map((e) => e.node!)
      .filter((u): u is NonNullable<typeof u> => u != null)
      .filter((u) => !existingUserIds.has(u.id)) ?? [];

  const handleSearch = () => {
    if (!searchQuery.trim()) return;
    void searchUsers({
      variables: {
        first: 20,
        filter: {
          search: searchQuery.trim(),
        },
      },
    });
  };

  const handleAddUser = async (userId: string) => {
    if (!team) return;
    setError("");
    setSuccessMsg("");
    try {
      await addUsers({
        variables: { id: team.id, userIds: [userId] },
      });
      setSuccessMsg(t("masterData.teams.memberAdded"));
      onMembersChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
    }
  };

  const handleRemoveUser = async (userId: string) => {
    if (!team) return;
    setError("");
    setSuccessMsg("");
    try {
      await removeUsers({
        variables: { id: team.id, userIds: [userId] },
      });
      setSuccessMsg(t("masterData.teams.memberRemoved"));
      onMembersChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
    }
  };

  const formatUserName = (user: { firstName?: string | null; lastName?: string | null }) => {
    return [user.firstName, user.lastName].filter(Boolean).join(" ") || "—";
  };

  return (
    <Modal
      isOpen={open}
      onClose={() => onOpenChange(false)}
      title={`${t("masterData.teams.manageMembers")} — ${team?.name}`}
      icon={<Users size={18} className="text-primary" />}
      size="lg"
    >
      <div className="px-8 py-6 space-y-5">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-400">
            {error}
          </div>
        )}
        {successMsg && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">
            {successMsg}
          </div>
        )}

        {/* Add user search */}
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
            <CortexButton
              variant="outline"
              size="S"
              onClick={handleSearch}
              disabled={searchingUsers || !searchQuery.trim()}
            >
              {t("common.search")}
            </CortexButton>
          </div>

          {searchResults.length > 0 && (
            <div className="max-h-40 overflow-y-auto rounded-md border border-slate-200 dark:border-dark-border">
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
                  <CortexButton
                    variant="outline"
                    size="S"
                    onClick={() => void handleAddUser(user.id)}
                    disabled={addingUsers}
                  >
                    <PlusIcon />
                  </CortexButton>
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

        {/* Current members list */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {t("masterData.teams.currentMembers")} ({members.length})
          </p>
          <div className="max-h-64 overflow-y-auto rounded-md border border-slate-200 dark:border-dark-border">
            {members.length === 0 ? (
              <p className="p-4 text-center text-sm text-slate-500 dark:text-slate-400">
                {t("masterData.teams.noMembers")}
              </p>
            ) : (
              members.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between px-3 py-2 border-b border-slate-100 dark:border-dark-border last:border-b-0"
                >
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-dark-text">
                        {formatUserName(user)}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{user.email}</p>
                    </div>
                    {user.appRole && <Badge variant="info">{user.appRole}</Badge>}
                    <Badge variant={user.isActive ? "success" : "warning"}>
                      {user.isActive ? t("userManagement.active") : t("userManagement.inactive")}
                    </Badge>
                  </div>
                  <CortexButton
                    variant="outline"
                    size="S"
                    onClick={() => void handleRemoveUser(user.id)}
                    disabled={removingUsers}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    <TrashIcon />
                  </CortexButton>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
