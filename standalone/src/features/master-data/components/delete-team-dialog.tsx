/**
 * Deleting a team is the only destructive action on this page, so it states its
 * cost before it happens: readiness is recomputed without the team, and the
 * teams left carrying that facility's work are named. The server computes both,
 * so what the dialog warns about is exactly what the deletion does.
 */
import { useMemo } from "react";
import { gql, useMutation, useQuery } from "@apollo/client";
import { AlertTriangle, ShieldAlert } from "lucide-react";
import { Badge, ConfirmationDialog, toast } from "@optima/ui";
import { READINESS } from "./allocation-readiness.js";

const IMPACT = gql`
  query TeamDeletionImpact($id: ID!) {
    optimaTeamDeletionImpact(id: $id) {
      deletedName
      affectedTeams {
        id
        name
      }
      readiness {
        teamsTotal
        teamsReady
        issues {
          severity
          kind
          message
        }
      }
    }
  }
`;

const DELETE_TEAM = gql`
  mutation DeleteTeamV2($id: ID!) {
    optimaTeamV2Delete(id: $id) {
      deletedId
      deletedName
    }
  }
`;

export function DeleteTeamDialog({
  team,
  onOpenChange,
  onDeleted,
}: {
  team: { id: string; name: string } | null;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
}) {
  const open = !!team;
  const { data, loading } = useQuery(IMPACT, {
    variables: { id: team?.id },
    skip: !team,
    fetchPolicy: "network-only",
  });
  const [doDelete, { loading: deleting }] = useMutation(DELETE_TEAM, {
    refetchQueries: [READINESS],
  });

  const impact = data?.optimaTeamDeletionImpact;

  // Only the issues this deletion introduces are worth showing; the estate's
  // existing warnings are already on the dashboard.
  const newIssues = useMemo(
    () =>
      (impact?.readiness?.issues ?? []).filter(
        (i: any) => i.kind === "UNHANDLED_TYPE" || i.severity === "BLOCKER"
      ),
    [impact]
  );

  async function confirm() {
    if (!team) return;
    try {
      await doDelete({ variables: { id: team.id } });
      toast.success(`Deleted ${team.name}`);
      onDeleted();
      onOpenChange(false);
    } catch (err) {
      toast.error(`Failed to delete: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }

  return (
    <ConfirmationDialog
      open={open}
      onOpenChange={onOpenChange}
      variant="delete"
      title={`Delete ${team?.name ?? "team"}?`}
      message="Its groups and their tags go with it. Members keep their accounts and stay on any other team."
      confirmLabel={deleting ? "Deleting…" : "Delete team"}
      isConfirmDisabled={deleting || loading}
      onConfirm={confirm}
    >
      {loading && (
        <p className="text-sm text-slate-500 dark:text-slate-400">Checking what this affects…</p>
      )}

      {impact && (
        <div className="space-y-3 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-slate-600 dark:text-slate-300">Readiness after deleting:</span>
            <Badge
              variant={
                impact.readiness.teamsReady === impact.readiness.teamsTotal ? "success" : "warning"
              }
            >
              {impact.readiness.teamsReady} / {impact.readiness.teamsTotal} teams ready
            </Badge>
          </div>

          {impact.affectedTeams.length > 0 ? (
            <div>
              <p className="mb-1 text-slate-600 dark:text-slate-300">
                Left covering this facility and division:
              </p>
              <div className="flex flex-wrap gap-1">
                {impact.affectedTeams.map((t: any) => (
                  <Badge key={t.id} variant="default">
                    {t.name}
                  </Badge>
                ))}
              </div>
            </div>
          ) : (
            <p className="flex items-start gap-2 text-amber-700 dark:text-amber-400">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" />
              No other team covers this facility and division. Its work will have nowhere to go.
            </p>
          )}

          {newIssues.length > 0 && (
            <div>
              <p className="mb-1 flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                <ShieldAlert size={14} className="text-amber-600 dark:text-amber-400" />
                {newIssues.length} {newIssues.length === 1 ? "issue" : "issues"} would remain:
              </p>
              <ul className="space-y-0.5 ps-5 text-slate-600 dark:text-slate-400">
                {newIssues.slice(0, 4).map((i: any, n: number) => (
                  <li key={n} className="list-disc">
                    {i.message}
                  </li>
                ))}
                {newIssues.length > 4 && (
                  <li className="list-none text-xs">and {newIssues.length - 4} more…</li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}
    </ConfirmationDialog>
  );
}
