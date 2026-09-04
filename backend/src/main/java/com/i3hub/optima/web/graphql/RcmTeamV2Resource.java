package com.i3hub.optima.web.graphql;

import java.util.List;

import org.springframework.web.bind.annotation.RequestHeader;

import com.i3hub.optima.annotation.Authenticated;
import com.i3hub.optima.annotation.HasPermission;
import com.i3hub.optima.domain.RcmTeamGroup;
import com.i3hub.optima.domain.RcmTeamGroupMember;
import com.i3hub.optima.domain.RcmTeamV2;
import com.i3hub.optima.enumeration.Permission;
import com.i3hub.optima.graphql.input.RcmTeamGroupInput;
import com.i3hub.optima.graphql.input.RcmTeamV2Input;
import com.i3hub.optima.graphql.input.filter.RcmTeamV2FilterInput;
import com.i3hub.optima.service.RcmTeamV2Service;
import com.i3hub.optima.service.dto.RcmTeamCapacity;
import com.i3hub.optima.service.dto.RcmTeamCoverageReport;
import com.i3hub.optima.service.dto.RcmTeamDepartmentSuggestion;
import com.i3hub.optima.service.dto.RcmTeamDistributionAdvice;
import com.i3hub.optima.service.dto.RcmTeamPayerPlan;
import com.i3hub.optima.service.dto.RcmTeamMemberWarning;
import com.i3hub.optima.service.dto.RcmTeamMutationResult;
import com.netflix.graphql.dgs.DgsComponent;
import com.netflix.graphql.dgs.DgsData;
import com.netflix.graphql.dgs.DgsMutation;
import com.netflix.graphql.dgs.DgsQuery;
import com.netflix.graphql.dgs.InputArgument;

import graphql.schema.DataFetchingEnvironment;

/**
 * GraphQL surface for v2 teams.
 *
 * Runs alongside {@link RcmTeamResource} (v1) during the migration — both models are
 * live, on separate tables and separate operations.
 */
@DgsComponent
public class RcmTeamV2Resource {

	private final RcmTeamV2Service service;

	public RcmTeamV2Resource(RcmTeamV2Service service) {
		this.service = service;
	}

	/* ─────────────────────────── queries ─────────────────────────── */

	@DgsQuery
	@Authenticated
	@HasPermission({Permission.VIEW_RCM_TEAM, Permission.MANAGE_RCM_TEAM})
	public RcmTeamV2 optimaTeamV2(@RequestHeader(name = "Authorization") String authorization,
			@InputArgument Long id) {
		return service.findOne(authorization, id);
	}

	@DgsQuery
	@Authenticated
	@HasPermission({Permission.VIEW_RCM_TEAM, Permission.MANAGE_RCM_TEAM})
	public List<RcmTeamV2> optimaTeamsV2(
			@RequestHeader(name = "Authorization") String authorization,
			@InputArgument RcmTeamV2FilterInput filter) {
		return service.findAll(authorization, filter);
	}

	@DgsQuery
	@Authenticated
	@HasPermission({Permission.VIEW_RCM_TEAM, Permission.MANAGE_RCM_TEAM})
	public RcmTeamCoverageReport optimaTeamV2Coverage(
			@RequestHeader(name = "Authorization") String authorization,
			@InputArgument Long id) {
		return service.coverageOf(id);
	}

	@DgsQuery
	@Authenticated
	@HasPermission({Permission.MANAGE_RCM_TEAM})
	public List<RcmTeamDepartmentSuggestion> optimaTeamV2SuggestDepartments(
			@RequestHeader(name = "Authorization") String authorization,
			@InputArgument Long id) {
		return service.suggestDepartments(id);
	}

	@DgsQuery
	@Authenticated
	@HasPermission({Permission.VIEW_RCM_TEAM, Permission.MANAGE_RCM_TEAM})
	public RcmTeamDistributionAdvice optimaTeamV2DistributionAdvice(
			@RequestHeader(name = "Authorization") String authorization,
			@InputArgument Long id) {
		return service.distributionAdvice(id);
	}

	@DgsQuery
	@Authenticated
	@HasPermission({Permission.MANAGE_RCM_TEAM})
	public List<RcmTeamPayerPlan> optimaTeamV2SuggestPayers(
			@RequestHeader(name = "Authorization") String authorization,
			@InputArgument Long id) {
		return service.suggestPayers(id);
	}

	@DgsQuery
	@Authenticated
	@HasPermission({Permission.MANAGE_RCM_TEAM})
	public List<RcmTeamMemberWarning> optimaTeamV2MemberWarnings(
			@RequestHeader(name = "Authorization") String authorization,
			@InputArgument Long groupId, @InputArgument List<Long> userIds) {
		return service.previewMemberWarnings(groupId, userIds);
	}

	/* ─────────────────────────── mutations ─────────────────────────── */

	@DgsMutation
	@HasPermission({Permission.MANAGE_RCM_TEAM})
	public RcmTeamMutationResult optimaTeamV2Create(
			@RequestHeader(name = "Authorization") String authorization,
			@InputArgument RcmTeamV2Input input) {
		return service.create(authorization, input);
	}

	@DgsMutation
	@HasPermission({Permission.MANAGE_RCM_TEAM})
	public RcmTeamMutationResult optimaTeamV2Update(
			@RequestHeader(name = "Authorization") String authorization,
			@InputArgument Long id, @InputArgument RcmTeamV2Input input) {
		return service.update(authorization, id, input);
	}

	@DgsMutation
	@HasPermission({Permission.MANAGE_RCM_TEAM})
	public Boolean optimaTeamV2Delete(
			@RequestHeader(name = "Authorization") String authorization,
			@InputArgument Long id) {
		return service.delete(authorization, id);
	}

	@DgsMutation
	@HasPermission({Permission.MANAGE_RCM_TEAM})
	public RcmTeamMutationResult optimaTeamV2GroupCreate(
			@RequestHeader(name = "Authorization") String authorization,
			@InputArgument Long teamId, @InputArgument RcmTeamGroupInput input) {
		return service.createGroup(authorization, teamId, input);
	}

	@DgsMutation
	@HasPermission({Permission.MANAGE_RCM_TEAM})
	public RcmTeamMutationResult optimaTeamV2GroupUpdate(
			@RequestHeader(name = "Authorization") String authorization,
			@InputArgument Long groupId, @InputArgument RcmTeamGroupInput input) {
		return service.updateGroup(authorization, groupId, input);
	}

	@DgsMutation
	@HasPermission({Permission.MANAGE_RCM_TEAM})
	public Boolean optimaTeamV2GroupDelete(
			@RequestHeader(name = "Authorization") String authorization,
			@InputArgument Long groupId) {
		return service.deleteGroup(authorization, groupId);
	}

	@DgsMutation
	@HasPermission({Permission.MANAGE_RCM_TEAM})
	public RcmTeamMutationResult optimaTeamV2GroupUserAdd(
			@RequestHeader(name = "Authorization") String authorization,
			@InputArgument Long groupId, @InputArgument List<Long> userIds) {
		return service.addGroupUsers(authorization, groupId, userIds);
	}

	@DgsMutation
	@HasPermission({Permission.MANAGE_RCM_TEAM})
	public RcmTeamMutationResult optimaTeamV2GroupUserRemove(
			@RequestHeader(name = "Authorization") String authorization,
			@InputArgument Long groupId, @InputArgument List<Long> userIds) {
		return service.removeGroupUsers(authorization, groupId, userIds);
	}

	@DgsMutation
	@HasPermission({Permission.MANAGE_RCM_TEAM})
	public RcmTeamV2 optimaTeamV2Rotate(
			@RequestHeader(name = "Authorization") String authorization,
			@InputArgument Long id) {
		return service.rotate(authorization, id);
	}

	@DgsMutation
	@HasPermission({Permission.MANAGE_RCM_TEAM})
	public RcmTeamV2 optimaTeamV2RotationReset(
			@RequestHeader(name = "Authorization") String authorization,
			@InputArgument Long id) {
		return service.resetRotation(authorization, id);
	}

	/* ─────────────────────── field resolvers ─────────────────────── */

	@DgsData(parentType = "RcmTeamV2", field = "groups")
	public List<RcmTeamGroup> teamGroups(DataFetchingEnvironment env) {
		RcmTeamV2 team = env.getSource();
		return team == null ? List.of() : service.findGroups(team.getId());
	}

	/** The de-duplicated roster — one row per user, however many groups they are in. */
	@DgsData(parentType = "RcmTeamV2", field = "members")
	public List<RcmTeamGroupMember> teamMembers(DataFetchingEnvironment env) {
		RcmTeamV2 team = env.getSource();
		return team == null ? List.of() : service.findMembers(team.getId());
	}

	@DgsData(parentType = "RcmTeamV2", field = "capacity")
	public RcmTeamCapacity teamCapacity(DataFetchingEnvironment env) {
		RcmTeamV2 team = env.getSource();
		return team == null ? RcmTeamCapacity.empty() : service.capacityOf(team);
	}

	@DgsData(parentType = "RcmTeamV2", field = "coverage")
	public RcmTeamCoverageReport teamCoverage(DataFetchingEnvironment env) {
		RcmTeamV2 team = env.getSource();
		return team == null ? new RcmTeamCoverageReport() : service.coverageOf(team.getId());
	}

	@DgsData(parentType = "RcmTeamGroup", field = "members")
	public List<RcmTeamGroupMember> groupMembers(DataFetchingEnvironment env) {
		RcmTeamGroup group = env.getSource();
		return group == null ? List.of() : service.findGroupMembers(group.getId());
	}

	@DgsData(parentType = "RcmTeamGroup", field = "specificity")
	public Integer groupSpecificity(DataFetchingEnvironment env) {
		RcmTeamGroup group = env.getSource();
		return group == null ? 0 : group.specificity();
	}

	@DgsData(parentType = "RcmTeamGroupMember", field = "rotatedAway")
	public Boolean memberRotatedAway(DataFetchingEnvironment env) {
		RcmTeamGroupMember member = env.getSource();
		return member != null && member.isRotatedAway();
	}
}
