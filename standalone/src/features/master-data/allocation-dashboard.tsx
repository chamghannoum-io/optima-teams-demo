/**
 * The supervisor / admin view.
 *
 * Everything that answers "is tonight's run going to work, and who needs to
 * know" lives here, so the Teams tab can go back to being a list. That includes
 * the review-allocation module, which used to be buried in the last step of the
 * team wizard: reviewing an allocation is a supervisor's daily question, not
 * something you should have to open an edit drawer to ask.
 */
import { useEffect, useMemo, useState } from "react";
import { gql, useQuery } from "@apollo/client";
import { Gauge, PlayCircle } from "lucide-react";

import {
  Badge,
  SectionHeader,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@optima/ui";

import {
  ReadinessIssues,
  ReadinessKpis,
  SupervisorDigest,
  useReadiness,
} from "./components/allocation-readiness.js";
import { AllocationPreview } from "./components/allocation-preview.js";
import { AllocationRuns } from "./components/allocation-runs.js";

const TEAMS = gql`
  query DashboardTeams {
    optimaAllocationEstate {
      activeTeams
      groups
      people
      capacityPerDay
      sharedMemberships
    }
    optimaTeamsV2 {
      id
      name
      description
    }
  }
`;

export function AllocationDashboard({ onOpenTeam }: { onOpenTeam?: (teamId: string) => void }) {
  const { data } = useQuery(TEAMS, { fetchPolicy: "cache-and-network" });
  const { readiness } = useReadiness();
  const [teamId, setTeamId] = useState<string>("");
  const [issuesOpen, setIssuesOpen] = useState(false);

  const teams = useMemo(() => data?.optimaTeamsV2 ?? [], [data]);

  // Default the review panel to the first team once they load.
  useEffect(() => {
    if (!teamId && teams.length) setTeamId(String(teams[0].id));
  }, [teams, teamId]);

  const selected = teams.find((x: any) => String(x.id) === teamId);

  const estate = data?.optimaAllocationEstate;

  return (
    <div className="space-y-4">
      {/* Readiness, compact. */}
      <section className="space-y-2">
        <SectionHeader
          micro
          title="Tonight's run"
          action={
            readiness ? (
              <Badge variant={readiness.teamsReady === readiness.teamsTotal ? "success" : "warning"}>
                {readiness.teamsReady === readiness.teamsTotal ? "ready" : "needs attention"}
              </Badge>
            ) : undefined
          }
        />
        <ReadinessKpis onShowIssues={() => setIssuesOpen(true)} />
      </section>

      {/* The estate is standing context, not a daily signal, so it is one line
          rather than a second band of boxes. */}
      {estate && (
        <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
          <Gauge size={13} className="text-slate-400" />
          <strong className="font-semibold text-slate-700 dark:text-slate-300">
            {estate.activeTeams}
          </strong>
          active teams,
          <strong className="font-semibold text-slate-700 dark:text-slate-300">
            {estate.groups}
          </strong>
          groups,
          <strong className="font-semibold text-slate-700 dark:text-slate-300">
            {estate.people}
          </strong>
          people,
          <strong className="font-semibold text-slate-700 dark:text-slate-300">
            {estate.capacityPerDay.toLocaleString()}/day
          </strong>
          capacity
          {estate.sharedMemberships > 0 && (
            <span title="Counted once each, though they sit in more than one team">
              ({estate.sharedMemberships} shared memberships, counted once)
            </span>
          )}
        </p>
      )}

      {/*
       * What the last run actually did.
       *
       * Readiness above is a forecast; this is the outcome, and it is the half
       * that has never been visible. Optima has been writing every run to
       * assignment_auto_assign_request_response_log and exposing none of it.
       */}
      <section className="space-y-2">
        <SectionHeader micro title="Last night's run" />
        <AllocationRuns />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {/*
         * Review allocation, moved out of the wizard.
         * A supervisor picks a team and dry-runs tonight's allocation against it
         * without touching the configuration.
         */}
        <section className="space-y-2">
          <SectionHeader
            micro
            title="Review allocation"
            action={
              <span className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                <PlayCircle size={12} /> dry run
              </span>
            }
          />
          <div className="rounded-xl bg-white p-4 shadow-custom dark:bg-dark-surface">
            <div className="mb-3 flex items-center gap-2">
              <Select value={teamId} onValueChange={setTeamId}>
                <SelectTrigger className="h-10 flex-1 text-xs">
                  <SelectValue placeholder="Pick a team to review" />
                </SelectTrigger>
                <SelectContent>
                  {teams.map((x: any) => (
                    <SelectItem key={x.id} value={String(x.id)}>
                      {x.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selected && onOpenTeam && (
                <button
                  type="button"
                  onClick={() => onOpenTeam(String(selected.id))}
                  className="shrink-0 text-xs font-medium text-primary underline underline-offset-2 dark:text-primary-300"
                >
                  Edit team
                </button>
              )}
            </div>

            {selected ? (
              <>
                <p className="mb-3 text-[11px] text-slate-500 dark:text-slate-400">
                  {selected.description || "No description"}
                </p>
                <AllocationPreview key={selected.id} teamId={String(selected.id)} autoRun hideHeading />
              </>
            ) : (
              <p className="py-6 text-center text-sm text-slate-500">No teams to review yet.</p>
            )}
          </div>
        </section>

        <div className="space-y-4">
          <section className="space-y-2">
            <SectionHeader micro title="What would fall through" />
            <ReadinessIssues
              onOpenTeam={onOpenTeam}
              open={issuesOpen}
              onOpenChange={setIssuesOpen}
            />
          </section>

          <section className="space-y-2">
            <SectionHeader micro title="Who gets told" />
            <SupervisorDigest />
          </section>
        </div>
      </div>
    </div>
  );
}
