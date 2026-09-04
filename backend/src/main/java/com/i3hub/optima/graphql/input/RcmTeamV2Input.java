package com.i3hub.optima.graphql.input;

import com.i3hub.optima.domain.RotationFrequency;
import com.i3hub.optima.enumeration.RcmTeamDivision;
import com.i3hub.optima.enumeration.RcmTeamEncounterScope;
import com.i3hub.optima.enumeration.RcmTeamLogicAxis;
import java.util.List;
import lombok.Data;

@Data
public class RcmTeamV2Input {
	private String name;
	private String nameAr;
	private String description;
	private Boolean active;
	private String facilityId;
	private RcmTeamDivision division;
	private RcmTeamEncounterScope encounterScope;
	private RcmTeamLogicAxis logicAxis;
	private Double highCostThreshold;
	private List<Long> branchIds;
	private Boolean rotationEnabled;
	private RotationFrequency rotationFrequency;
	/** Groups to create alongside the team. */
	private List<RcmTeamGroupInput> groups;
}
