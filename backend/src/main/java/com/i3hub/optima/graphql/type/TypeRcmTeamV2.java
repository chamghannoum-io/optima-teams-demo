package com.i3hub.optima.graphql.type;

import com.i3hub.optima.domain.RotationFrequency;
import com.i3hub.optima.enumeration.RcmTeamDivision;
import com.i3hub.optima.enumeration.RcmTeamEncounterScope;
import com.i3hub.optima.enumeration.RcmTeamLogicAxis;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public interface TypeRcmTeamV2 {
	Long getId();
	Instant getCreatedDate();
	Long getVendorId();
	String getName();
	String getNameAr();
	String getDescription();
	Boolean getActive();
	String getFacilityId();
	RcmTeamDivision getDivision();
	RcmTeamEncounterScope getEncounterScope();
	RcmTeamLogicAxis getLogicAxis();
	Double getHighCostThreshold();
	List<Long> getBranchIds();
	Boolean getRotationEnabled();
	RotationFrequency getRotationFrequency();
	LocalDate getNextRotationDate();
	Instant getLastRotationAt();
	Integer getRotationOffset();
}
