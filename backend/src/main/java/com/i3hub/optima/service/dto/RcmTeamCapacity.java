package com.i3hub.optima.service.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Derived capacity for a team or one of its groups.
 *
 * Never stored — computed on read from the de-duplicated member set, so it cannot
 * drift from membership. A user sitting in three groups of the same team
 * contributes to {@link #totalCapacity} once.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class RcmTeamCapacity {

	/** Distinct users, after de-duplication across the team's groups. */
	private int memberCount;

	/** Summed per-user maximum from assignment settings. */
	private int totalCapacity;

	/** Items currently assigned to those members. */
	private int assigned;

	/** totalCapacity − assigned, floored at zero. */
	private int remaining;

	/**
	 * How many of the raw group memberships were duplicates, i.e.
	 * (sum of group member counts) − memberCount. Surfaced so the UI can explain
	 * why a team of "20 memberships" reports 16 members.
	 */
	private int duplicateMemberships;

	public static RcmTeamCapacity empty() {
		return new RcmTeamCapacity(0, 0, 0, 0, 0);
	}
}
