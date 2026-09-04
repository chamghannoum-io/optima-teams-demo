import type { TeamTag } from "./team-tags-autocomplete.js";

/** How often an enabled team rotation re-allocates work between members. */
export type RotationFrequency = "DAILY" | "WEEKLY" | "MONTHLY";

/** Boolean operator combining tags within a group, or groups within a formula. */
export type TagOperator = "AND" | "OR";

/**
 * One tag group in a team's auto-allocation formula: the tags selected for it (all combined
 * by this group's own {@link TagGroup.operator}, meaningless with 0-1 tags), plus the operator
 * joining the whole group to whatever group precedes it (ignored for the first group). A group
 * is a single multi-select condition — adding another tag never creates a new row.
 */
export interface TagGroup {
  /** Stable client-side id used for React keys; not persisted. */
  id: string;
  /** Tags selected for this group. */
  tags: TeamTag[];
  /** Operator combining this group's own tags. */
  operator: TagOperator;
  /** Operator joining this group to the previous group; ignored for the first group. */
  joinOperator: TagOperator;
}

/** Team-level rotation configuration captured in the Team Info step. */
export interface TeamRotationConfig {
  /** Whether automatic rotation is turned on for the team. */
  enabled: boolean;
  /** Cadence at which the rotation runs; only meaningful when {@link TeamRotationConfig.enabled}. */
  frequency: RotationFrequency;
}

/** What happens to a member's assigned work items when they are marked unavailable. */
export type UnavailabilityResolution = "UNASSIGN" | "REDISTRIBUTE";

/** An unavailability window for a team member (mirrors `OptimaTeamUserUnavailability`). */
export interface MemberUnavailability {
  /** Server id of the window; present once persisted, needed to cancel it. */
  id?: string;
  /** First day the member is unavailable. */
  startDate: Date;
  /** Last day the member is unavailable (inclusive). */
  endDate: Date;
  /** Optional free-text reason recorded for the audit trail. */
  reason?: string;
  /** Who recorded the window, when known. */
  createdBy?: string;
}