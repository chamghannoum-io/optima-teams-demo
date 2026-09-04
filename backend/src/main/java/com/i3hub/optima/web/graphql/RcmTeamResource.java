package com.i3hub.optima.web.graphql;

import java.util.List;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.RequestHeader;

import com.i3hub.optima.annotation.Authenticated;
import com.i3hub.optima.annotation.HasPermission;
import com.i3hub.optima.enumeration.Permission;
import com.i3hub.optima.graphql.input.RcmTeamInput;
import com.i3hub.optima.graphql.input.RcmTeamUserUnavailabilityInput;
import com.i3hub.optima.graphql.input.filter.RcmTeamFilterInput;
import com.i3hub.optima.graphql.type.TypeRcmTeam;
import com.i3hub.optima.graphql.type.TypeRcmTeamMember;
import com.i3hub.optima.graphql.type.TypeRcmTeamUserUnavailability;
import com.i3hub.optima.service.RcmTeamService;
import com.netflix.graphql.dgs.DgsComponent;
import com.netflix.graphql.dgs.DgsData;
import com.netflix.graphql.dgs.DgsMutation;
import com.netflix.graphql.dgs.DgsQuery;
import com.netflix.graphql.dgs.InputArgument;
import graphql.schema.DataFetchingEnvironment;

@DgsComponent
public class RcmTeamResource {
	private final RcmTeamService rcmTeamService;

	public RcmTeamResource(RcmTeamService rcmTeamService) {
		this.rcmTeamService = rcmTeamService;
	}

	@DgsQuery
	@Authenticated
	@HasPermission({Permission.VIEW_RCM_TEAM, Permission.MANAGE_RCM_TEAM})
	public TypeRcmTeam optimaTeam(@RequestHeader(name = "Authorization") String authorization,
			@InputArgument Long id) {
		return rcmTeamService.findOne(authorization, id);
	}

	@DgsQuery
	@Authenticated
	@HasPermission({Permission.VIEW_RCM_TEAM, Permission.MANAGE_RCM_TEAM})
	public List<TypeRcmTeam> optimaTeams(@RequestHeader(name = "Authorization") String authorization,
			@InputArgument RcmTeamFilterInput filter) {
		return rcmTeamService.findAll(authorization, filter);
	}

	@DgsMutation
	@HasPermission({Permission.MANAGE_RCM_TEAM})
	public TypeRcmTeam optimaTeamCreate(@RequestHeader(name = "Authorization") String authorization,
			@InputArgument RcmTeamInput input) {
		return rcmTeamService.create(authorization, input);
	}

	@DgsMutation
	@HasPermission({Permission.MANAGE_RCM_TEAM})
	public TypeRcmTeam optimaTeamUpdate(@RequestHeader(name = "Authorization") String authorization,
			@InputArgument Long id, @InputArgument RcmTeamInput input) {
		return rcmTeamService.update(authorization, id, input);
	}

	@DgsMutation
	@HasPermission({Permission.MANAGE_RCM_TEAM})
	public TypeRcmTeam optimaTeamUserAdd(@RequestHeader(name = "Authorization") String authorization,
			@InputArgument Long id, @InputArgument List<Long> userIds) {
		return rcmTeamService.addUsers(authorization, id, userIds);
	}

	@DgsMutation
	@HasPermission({Permission.MANAGE_RCM_TEAM})
	public TypeRcmTeam optimaTeamUserRemove(@RequestHeader(name = "Authorization") String authorization,
			@InputArgument Long id, @InputArgument List<Long> userIds) {
		return rcmTeamService.removeUsers(authorization, id, userIds);
	}

	@DgsMutation
	@HasPermission({Permission.MANAGE_RCM_TEAM})
	public TypeRcmTeam optimaTeamRotationComplete(@RequestHeader(name = "Authorization") String authorization,
			@InputArgument Long id, @InputArgument Long rotationPointer) {
		return rcmTeamService.rotationComplete(authorization, id, rotationPointer);
	}

	@DgsMutation
	@HasPermission({Permission.MANAGE_RCM_TEAM})
	public TypeRcmTeamUserUnavailability optimaTeamUserUnavailabilitySet(
			@RequestHeader(name = "Authorization") String authorization,
			@InputArgument RcmTeamUserUnavailabilityInput input) {
		return rcmTeamService.setUserUnavailability(authorization, input);
	}

	@DgsMutation
	@HasPermission({Permission.MANAGE_RCM_TEAM})
	public TypeRcmTeamUserUnavailability optimaTeamUserUnavailabilityCancel(
			@RequestHeader(name = "Authorization") String authorization, @InputArgument Long id) {
		return rcmTeamService.cancelUserUnavailability(authorization, id);
	}

	@DgsData(parentType = "OptimaTeam")
	public List<TypeRcmTeamMember> members(DataFetchingEnvironment env, @InputArgument Boolean availableOnly) {
		TypeRcmTeam team = env.getSource();
		if (team == null) {
			return List.of();
		}
		return rcmTeamService.findMembers(team, availableOnly);
	}
}
