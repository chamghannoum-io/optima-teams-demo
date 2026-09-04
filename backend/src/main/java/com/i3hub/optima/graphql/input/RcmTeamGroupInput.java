package com.i3hub.optima.graphql.input;

import com.i3hub.optima.domain.WorkItemType;
import com.i3hub.optima.enumeration.RcmDepartment;
import com.i3hub.optima.enumeration.RcmTeamEncounterScope;
import java.util.List;
import lombok.Data;

/**
 * Input for a group within a v2 team.
 *
 * Exactly one of {@link #departments} / {@link #payers} may be supplied, matching the
 * owning team's logic axis — the other is rejected by RcmTeamV2Validator.
 */
@Data
public class RcmTeamGroupInput {
	private String name;
	private String nameAr;
	private String description;
	private Boolean active;
	private List<WorkItemType> workItemTypes;
	private RcmTeamEncounterScope encounterScope;
	/** Supply when the team's logicAxis is DEPARTMENT. */
	private List<RcmDepartment> departments;
	/** Supply when the team's logicAxis is PAYER. */
	private List<Long> payers;
	/** PAYER teams only: accept any payer no group names explicitly. */
	private Boolean payerCatchAll;
	private List<String> claimStatuses;
	private Integer rotationOrder;
	/** Initial members; their home group is set to this group. */
	private List<Long> userIds;
}
