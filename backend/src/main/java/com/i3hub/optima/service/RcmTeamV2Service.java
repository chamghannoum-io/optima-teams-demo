package com.i3hub.optima.service;

import com.i3hub.optima.enumeration.RcmDepartment;
import com.i3hub.optima.graphql.input.RcmTeamGroupInput;
import com.i3hub.optima.graphql.input.RcmTeamV2Input;
import com.i3hub.optima.graphql.input.filter.RcmTeamV2FilterInput;
import com.i3hub.optima.domain.RcmTeamGroup;
import com.i3hub.optima.domain.RcmTeamGroupMember;
import com.i3hub.optima.domain.RcmTeamV2;
import com.i3hub.optima.service.dto.RcmTeamCapacity;
import com.i3hub.optima.service.dto.RcmTeamCoverageReport;
import com.i3hub.optima.service.dto.RcmTeamDepartmentSuggestion;
import com.i3hub.optima.service.dto.RcmTeamDistributionAdvice;
import com.i3hub.optima.service.dto.RcmTeamPayerPlan;
import com.i3hub.optima.service.dto.RcmTeamMemberWarning;
import com.i3hub.optima.service.dto.RcmTeamMutationResult;
import java.util.List;

public interface RcmTeamV2Service {

	RcmTeamV2 findOne(String authorization, Long id);

	List<RcmTeamV2> findAll(String authorization, RcmTeamV2FilterInput filter);

	RcmTeamMutationResult create(String authorization, RcmTeamV2Input input);

	RcmTeamMutationResult update(String authorization, Long id, RcmTeamV2Input input);

	boolean delete(String authorization, Long id);

	RcmTeamMutationResult createGroup(String authorization, Long teamId, RcmTeamGroupInput input);

	RcmTeamMutationResult updateGroup(String authorization, Long groupId, RcmTeamGroupInput input);

	boolean deleteGroup(String authorization, Long groupId);

	RcmTeamMutationResult addGroupUsers(String authorization, Long groupId, List<Long> userIds);

	RcmTeamMutationResult removeGroupUsers(String authorization, Long groupId, List<Long> userIds);

	RcmTeamV2 rotate(String authorization, Long id);

	RcmTeamV2 resetRotation(String authorization, Long id);

	/* ---- reads used by field resolvers ---- */

	List<RcmTeamGroup> findGroups(Long teamId);

	List<RcmTeamGroupMember> findMembers(Long teamId);

	List<RcmTeamGroupMember> findGroupMembers(Long groupId);

	RcmTeamCapacity capacityOf(RcmTeamV2 team);

	RcmTeamCapacity capacityOfGroup(RcmTeamV2 team, RcmTeamGroup group);

	RcmTeamCoverageReport coverageOf(Long teamId);

	/** Departments observed on this facility's work items — the coverage baseline. */
	List<RcmDepartment> facilityDepartments(String facilityId);

	List<RcmTeamDepartmentSuggestion> suggestDepartments(Long teamId);

	/** Recommended payer split: named high-volume payers plus shared catch-all tail. */
	List<RcmTeamPayerPlan> suggestPayers(Long teamId);

	/** Projected load per group with overflow warnings, from observed volume. */
	RcmTeamDistributionAdvice distributionAdvice(Long teamId);

	/** Preview warnings without writing, so the UI can confirm before committing. */
	List<RcmTeamMemberWarning> previewMemberWarnings(Long groupId, List<Long> userIds);
}
