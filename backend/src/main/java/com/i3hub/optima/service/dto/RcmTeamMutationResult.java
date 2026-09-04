package com.i3hub.optima.service.dto;

import com.i3hub.optima.domain.RcmTeamGroup;
import com.i3hub.optima.domain.RcmTeamV2;
import java.util.ArrayList;
import java.util.List;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Result of a team or group mutation.
 *
 * {@link #warnings} is advisory only — the mutation has already committed. It carries
 * the "already allocated 150 in Team 2" detail so the UI can confirm after the fact,
 * per the agreed permissive-backend approach.
 */
@Data
@NoArgsConstructor
public class RcmTeamMutationResult {
	private RcmTeamV2 team;
	private RcmTeamGroup group;
	private List<RcmTeamMemberWarning> warnings = new ArrayList<>();
	private RcmTeamCoverageReport coverage;

	public static RcmTeamMutationResult of(RcmTeamV2 team) {
		RcmTeamMutationResult r = new RcmTeamMutationResult();
		r.setTeam(team);
		return r;
	}
}
