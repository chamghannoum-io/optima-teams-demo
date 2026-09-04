package com.i3hub.optima.graphql.type;

import com.i3hub.optima.common.mapper.FederationMapper;
import com.i3hub.optima.domain.RcmTeamTag;
import com.i3hub.optima.domain.RotationFrequency;
import com.i3hub.optima.graphql.type.federated.TypeBranch;
import com.i3hub.optima.graphql.type.federated.TypeUser;
import com.i3hub.optima.graphql.type.federated.TypeVendor;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public interface TypeRcmTeam {
	Long getId();
	Instant getCreatedDate();
	Long getVendorId();
	String getName();
	String getTag();
	List<RcmTeamTag> getTags();
	String getNameAr();
	String getDescription();
	Boolean getActive();
	Boolean getRotationEnabled();
	RotationFrequency getRotationFrequency();
	LocalDate getNextRotationDate();
	Long getRotationPointer();
	Instant getLastRotationAt();
	List<Long> getUsers();
	List<Long> getBranchIds();
	default List<TypeUser> getUsersDetails() {
		return FederationMapper.fromUserIds(getUsers());
	}
	default List<TypeBranch> getBranches() {
		return FederationMapper.fromBranchIds(getBranchIds());
	}
	default TypeVendor getVendor() {
		return FederationMapper.fromVendorId(getVendorId());
	}
}
