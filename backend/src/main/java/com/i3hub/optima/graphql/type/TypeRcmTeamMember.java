package com.i3hub.optima.graphql.type;

import com.i3hub.optima.common.mapper.FederationMapper;
import com.i3hub.optima.graphql.type.federated.TypeUser;
import java.util.List;

public class TypeRcmTeamMember {

	private final Long userId;
	private final List<TypeRcmTeamUserUnavailability> unavailabilities;

	public TypeRcmTeamMember(Long userId, List<TypeRcmTeamUserUnavailability> unavailabilities) {
		this.userId = userId;
		this.unavailabilities = unavailabilities == null ? List.of() : unavailabilities;
	}

	public Long getUserId() {
		return userId;
	}

	public List<TypeRcmTeamUserUnavailability> getUnavailabilities() {
		return unavailabilities;
	}

	public TypeUser getUser() {
		return FederationMapper.fromUserId(userId);
	}

	public Boolean getUnavailableToday() {
		return unavailabilities.stream().anyMatch(u -> Boolean.TRUE.equals(u.getActiveToday()));
	}
}
