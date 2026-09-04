package com.i3hub.optima.graphql.type;

import com.i3hub.optima.domain.WorkItemType;
import com.i3hub.optima.enumeration.RcmDepartment;
import com.i3hub.optima.enumeration.RcmTeamEncounterScope;

import java.time.Instant;
import java.util.List;

public interface TypeRcmTeamGroup {
	Long getId();
	Instant getCreatedDate();
	Long getRcmTeamId();
	String getName();
	String getNameAr();
	String getDescription();
	Boolean getActive();
	List<WorkItemType> getWorkItemTypes();
	RcmTeamEncounterScope getEncounterScope();
	List<RcmDepartment> getDepartments();
	List<Long> getPayers();
	Boolean getPayerCatchAll();
	List<String> getClaimStatuses();
	Integer getRotationOrder();
}
