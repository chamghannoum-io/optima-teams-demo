package com.i3hub.optima.graphql.input.filter;

import com.i3hub.optima.domain.WorkItemType;
import com.i3hub.optima.enumeration.RcmTeamDivision;
import com.i3hub.optima.enumeration.RcmTeamEncounterScope;
import com.i3hub.optima.enumeration.RcmTeamLogicAxis;
import java.util.List;
import java.util.Set;
import lombok.Data;

@Data
public class RcmTeamV2FilterInput {
	private Set<Long> ids;
	private String name;
	private Boolean active;
	private String facilityId;
	private RcmTeamDivision division;
	private RcmTeamEncounterScope encounterScope;
	private RcmTeamLogicAxis logicAxis;
	private List<Long> branchIds;
	private Long vendorId;
	/** Only teams with at least one group handling this type. */
	private WorkItemType workItemType;
}
