package com.i3hub.optima.service;

import com.i3hub.optima.graphql.input.RcmTeamInput;
import com.i3hub.optima.graphql.input.RcmTeamUserUnavailabilityInput;
import com.i3hub.optima.graphql.input.filter.RcmTeamFilterInput;
import com.i3hub.optima.graphql.type.TypeRcmTeam;
import com.i3hub.optima.graphql.type.TypeRcmTeamMember;
import com.i3hub.optima.graphql.type.TypeRcmTeamUserUnavailability;
import java.util.List;

public interface RcmTeamService {
	TypeRcmTeam findOne(String authorization, Long id);

	List<TypeRcmTeam> findAll(String authorization, RcmTeamFilterInput filter);

	TypeRcmTeam create(String authorization, RcmTeamInput input);

	TypeRcmTeam update(String authorization, Long id, RcmTeamInput input);

	TypeRcmTeam addUsers(String authorization, Long id, List<Long> userIds);

	TypeRcmTeam removeUsers(String authorization, Long id, List<Long> userIds);

	TypeRcmTeam rotationComplete(String authorization, Long id, Long rotationPointer);

	TypeRcmTeamUserUnavailability setUserUnavailability(String authorization, RcmTeamUserUnavailabilityInput input);

	TypeRcmTeamUserUnavailability cancelUserUnavailability(String authorization, Long id);

	List<TypeRcmTeamUserUnavailability> findUserUnavailabilities(Long teamId);

	List<TypeRcmTeamMember> findMembers(TypeRcmTeam team, Boolean availableOnly);
}
