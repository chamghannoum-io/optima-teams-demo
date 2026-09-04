package com.i3hub.optima.service.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Returned when a user is added to a group while already allocated elsewhere.
 *
 * The mutation still succeeds — this is advisory, so the UI can ask
 * "already allocated 150 of 200 in Dubai × AUTH × IP, proceed?" before committing.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class RcmTeamMemberWarning {

	private Long userId;
	private String userName;

	/** The other team the user already belongs to. */
	private Long otherTeamId;
	private String otherTeamName;

	/** Their current load on that team. */
	private int assignedOnOtherTeam;
	private int capacityOnOtherTeam;

	/** True when the user is already at or above capacity on the other team. */
	public boolean isAtCapacity() {
		return capacityOnOtherTeam > 0 && assignedOnOtherTeam >= capacityOnOtherTeam;
	}
}
