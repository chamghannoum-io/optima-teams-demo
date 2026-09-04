package com.i3hub.optima.service.impl;

import com.i3hub.optima.domain.RcmTeamGroup;
import com.i3hub.optima.domain.RcmTeamGroupMember;
import com.i3hub.optima.domain.RcmTeamV2;
import com.i3hub.optima.enumeration.RcmDepartment;
import com.i3hub.optima.enumeration.RcmTeamLogicAxis;
import com.i3hub.optima.graphql.input.RcmTeamGroupInput;
import com.i3hub.optima.graphql.input.RcmTeamV2Input;
import com.i3hub.optima.graphql.input.filter.RcmTeamV2FilterInput;
import com.i3hub.optima.repository.RcmTeamGroupMemberRepository;
import com.i3hub.optima.repository.RcmTeamGroupRepository;
import com.i3hub.optima.repository.RcmTeamV2Repository;
import com.i3hub.optima.service.RcmTeamV2Service;
import com.i3hub.optima.service.dto.RcmTeamCapacity;
import com.i3hub.optima.service.dto.RcmTeamCoverageReport;
import com.i3hub.optima.service.dto.RcmTeamDepartmentSuggestion;
import com.i3hub.optima.service.dto.RcmTeamDistributionAdvice;
import com.i3hub.optima.service.dto.RcmTeamPayerPlan;
import com.i3hub.optima.service.dto.RcmTeamMemberWarning;
import com.i3hub.optima.service.dto.RcmTeamMutationResult;
import com.i3hub.optima.util.JwtUtil;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * v2 team management.
 *
 * Enforces the structural rules through {@link RcmTeamV2Validator} and the department
 * coverage rule through {@link RcmTeamCoverageService}; capacity and rotation are
 * delegated to their own services.
 */
@Service
public class RcmTeamV2ServiceImpl implements RcmTeamV2Service {

	private final RcmTeamV2Repository teamRepository;
	private final RcmTeamGroupRepository groupRepository;
	private final RcmTeamGroupMemberRepository memberRepository;
	private final RcmTeamV2Validator validator;
	private final RcmTeamCoverageService coverageService;
	private final RcmTeamCapacityService capacityService;
	private final RcmTeamRotationService rotationService;
	private final FacilityDepartmentSource facilityDepartmentSource;
	private final RcmTeamDistributionAdvisor distributionAdvisor;

	/**
	 * Departments a facility actually handles.
	 *
	 * Derived from departments observed on that facility's work items rather than the
	 * {@code vendorDepartments} entity — that is a per-branch admin list and 19 of the
	 * 24 department tags used by production teams have no row in it.
	 */
	public interface FacilityDepartmentSource {
		List<RcmDepartment> departmentsFor(String facilityId);

		/** Payers seen on this facility's work items, for PAYER-team coverage. */
		List<Long> payersFor(String facilityId);
	}

	public RcmTeamV2ServiceImpl(RcmTeamV2Repository teamRepository,
			RcmTeamGroupRepository groupRepository,
			RcmTeamGroupMemberRepository memberRepository,
			RcmTeamV2Validator validator,
			RcmTeamCoverageService coverageService,
			RcmTeamCapacityService capacityService,
			RcmTeamRotationService rotationService,
			FacilityDepartmentSource facilityDepartmentSource,
			RcmTeamDistributionAdvisor distributionAdvisor) {
		this.teamRepository = teamRepository;
		this.groupRepository = groupRepository;
		this.memberRepository = memberRepository;
		this.validator = validator;
		this.coverageService = coverageService;
		this.capacityService = capacityService;
		this.rotationService = rotationService;
		this.facilityDepartmentSource = facilityDepartmentSource;
		this.distributionAdvisor = distributionAdvisor;
	}

	/* ─────────────────────────── reads ─────────────────────────── */

	@Override
	@Transactional(readOnly = true)
	public RcmTeamV2 findOne(String authorization, Long id) {
		return teamRepository.findById(id).filter(this::visibleToCurrentVendor).orElse(null);
	}

	@Override
	@Transactional(readOnly = true)
	public List<RcmTeamV2> findAll(String authorization, RcmTeamV2FilterInput filter) {
		Specification<RcmTeamV2> spec = RcmTeamV2Repository.conjunction();
		Long vendorId = JwtUtil.getVendorId();
		if (vendorId != null) {
			spec = spec.and(RcmTeamV2Repository.vendorIdEq(vendorId));
		}
		if (filter != null) {
			spec = spec.and(RcmTeamV2Repository.idIn(filter.getIds()))
					.and(RcmTeamV2Repository.nameLike(filter.getName()))
					.and(RcmTeamV2Repository.isActive(filter.getActive()))
					.and(RcmTeamV2Repository.facilityIdEq(filter.getFacilityId()))
					.and(RcmTeamV2Repository.divisionEq(filter.getDivision()))
					.and(RcmTeamV2Repository.encounterScopeCovers(filter.getEncounterScope()))
					.and(RcmTeamV2Repository.branchIdIn(filter.getBranchIds()));
		}
		List<RcmTeamV2> teams = teamRepository.findAll(spec);

		// workItemType filtering needs the groups, so it is applied after the query.
		if (filter != null && filter.getWorkItemType() != null) {
			Set<Long> teamIds = teams.stream().map(RcmTeamV2::getId).collect(Collectors.toSet());
			if (teamIds.isEmpty()) {
				return teams;
			}
			Set<Long> matching = groupRepository.findByRcmTeamIdInOrderByRotationOrderAsc(teamIds)
					.stream()
					.filter(g -> g.getWorkItemTypes() != null
							&& g.getWorkItemTypes().contains(filter.getWorkItemType()))
					.map(RcmTeamGroup::getRcmTeamId)
					.collect(Collectors.toSet());
			teams = teams.stream().filter(t -> matching.contains(t.getId())).toList();
		}
		return teams;
	}

	@Override
	@Transactional(readOnly = true)
	public List<RcmTeamGroup> findGroups(Long teamId) {
		return groupRepository.findByRcmTeamIdOrderByRotationOrderAsc(teamId);
	}

	@Override
	@Transactional(readOnly = true)
	public List<RcmTeamGroupMember> findMembers(Long teamId) {
		// De-duplicated: one row per user, even when they sit in several groups.
		List<RcmTeamGroupMember> all = memberRepository.findByRcmTeamId(teamId);
		Set<Long> seen = new HashSet<>();
		List<RcmTeamGroupMember> distinct = new ArrayList<>();
		for (RcmTeamGroupMember m : all) {
			if (seen.add(m.getUserId())) {
				distinct.add(m);
			}
		}
		return distinct;
	}

	@Override
	@Transactional(readOnly = true)
	public List<RcmTeamGroupMember> findGroupMembers(Long groupId) {
		return memberRepository.findByRcmTeamGroupId(groupId);
	}

	@Override
	public RcmTeamCapacity capacityOf(RcmTeamV2 team) {
		return capacityService.forTeam(team);
	}

	@Override
	public RcmTeamCapacity capacityOfGroup(RcmTeamV2 team, RcmTeamGroup group) {
		return capacityService.forGroup(team, group);
	}

	@Override
	@Transactional(readOnly = true)
	public RcmTeamCoverageReport coverageOf(Long teamId) {
		RcmTeamV2 team = teamRepository.findById(teamId).orElse(null);
		if (team == null) {
			return new RcmTeamCoverageReport();
		}
		List<RcmTeamGroup> groups = findGroups(teamId);
		RcmTeamCoverageReport report = coverageService.analyse(team, groups,
				facilityDepartments(team.getFacilityId()),
				facilityDepartmentSource.payersFor(team.getFacilityId()));

		// Groups with no members can never receive work.
		for (RcmTeamGroup group : groups) {
			if (memberRepository.findByRcmTeamGroupId(group.getId()).isEmpty()) {
				report.getEmptyGroupIds().add(group.getId());
			}
		}
		return report;
	}

	@Override
	public List<RcmDepartment> facilityDepartments(String facilityId) {
		return facilityId == null ? List.of()
				: facilityDepartmentSource.departmentsFor(facilityId);
	}

	@Override
	@Transactional(readOnly = true)
	public List<RcmTeamDepartmentSuggestion> suggestDepartments(Long teamId) {
		RcmTeamV2 team = teamRepository.findById(teamId).orElse(null);
		if (team == null || team.getLogicAxis() != RcmTeamLogicAxis.DEPARTMENT) {
			return List.of();
		}
		List<RcmTeamGroup> groups = findGroups(teamId);
		Map<Long, List<RcmDepartment>> suggestion = coverageService.suggestDistribution(
				groups, facilityDepartments(team.getFacilityId()));

		Map<Long, String> names = groups.stream()
				.collect(Collectors.toMap(RcmTeamGroup::getId, RcmTeamGroup::getName, (a, b) -> a));
		return suggestion.entrySet().stream()
				.map(e -> new RcmTeamDepartmentSuggestion(
						e.getKey(), names.get(e.getKey()), e.getValue()))
				.toList();
	}

	@Override
	@Transactional(readOnly = true)
	public List<RcmTeamPayerPlan> suggestPayers(Long teamId) {
		RcmTeamV2 team = teamRepository.findById(teamId).orElse(null);
		if (team == null || team.getLogicAxis() != RcmTeamLogicAxis.PAYER) {
			return List.of();
		}
		List<RcmTeamGroup> groups = findGroups(teamId);
		RcmTeamDistributionAdvisor.PayerPlan plan =
				distributionAdvisor.recommendPayers(team.getFacilityId(), groups);

		Map<Long, String> names = groups.stream()
				.collect(Collectors.toMap(RcmTeamGroup::getId, RcmTeamGroup::getName, (a, b) -> a));
		// Every group in the plan shares the tail, so all are catch-alls.
		double tailShare = plan.catchAllGroupIds().isEmpty() ? 0
				: plan.tailVolumePerDay() / plan.catchAllGroupIds().size();

		return plan.namedPayersByGroup().entrySet().stream()
				.map(e -> new RcmTeamPayerPlan(e.getKey(), names.get(e.getKey()),
						e.getValue(), plan.catchAllGroupIds().contains(e.getKey()), tailShare))
				.toList();
	}

	@Override
	@Transactional(readOnly = true)
	public RcmTeamDistributionAdvice distributionAdvice(Long teamId) {
		RcmTeamV2 team = teamRepository.findById(teamId).orElse(null);
		if (team == null) {
			return new RcmTeamDistributionAdvice();
		}
		return distributionAdvisor.analyse(team, findGroups(teamId));
	}

	@Override
	@Transactional(readOnly = true)
	public List<RcmTeamMemberWarning> previewMemberWarnings(Long groupId, List<Long> userIds) {
		RcmTeamGroup group = groupRepository.findById(groupId).orElse(null);
		return group == null ? List.of() : warningsFor(group.getRcmTeamId(), userIds);
	}

	/* ─────────────────────────── team writes ─────────────────────────── */

	@Override
	@Transactional
	public RcmTeamMutationResult create(String authorization, RcmTeamV2Input input) {
		RcmTeamV2 team = new RcmTeamV2();
		applyTeamInput(team, input);
		team.setVendorId(JwtUtil.getVendorId());
		validator.validateTeam(team);

		// Groups are validated against the team before anything is written, so a bad
		// group cannot leave a half-created team behind.
		List<RcmTeamGroup> groups = new ArrayList<>();
		if (input.getGroups() != null) {
			for (RcmTeamGroupInput groupInput : input.getGroups()) {
				RcmTeamGroup group = new RcmTeamGroup();
				applyGroupInput(group, groupInput);
				validator.validateGroup(team, group);
				groups.add(group);
			}
		}
		requireCoverageIfActive(team, groups);

		RcmTeamV2 saved = teamRepository.save(team);
		int order = 0;
		for (int i = 0; i < groups.size(); i++) {
			RcmTeamGroup group = groups.get(i);
			group.setRcmTeamId(saved.getId());
			if (group.getRotationOrder() == null) {
				group.setRotationOrder(order++);
			}
			RcmTeamGroup savedGroup = groupRepository.save(group);
			List<Long> userIds = input.getGroups().get(i).getUserIds();
			if (userIds != null) {
				addMembers(savedGroup, userIds);
			}
		}

		RcmTeamMutationResult result = RcmTeamMutationResult.of(saved);
		result.setCoverage(coverageOf(saved.getId()));
		return result;
	}

	@Override
	@Transactional
	public RcmTeamMutationResult update(String authorization, Long id, RcmTeamV2Input input) {
		RcmTeamV2 team = requireTeam(id);
		applyTeamInput(team, input);
		validator.validateTeam(team);

		// Changing division, axis or scope can invalidate existing groups.
		List<RcmTeamGroup> groups = findGroups(id);
		for (RcmTeamGroup group : groups) {
			validator.validateGroup(team, group);
		}
		requireCoverageIfActive(team, groups);

		RcmTeamV2 saved = teamRepository.save(team);
		RcmTeamMutationResult result = RcmTeamMutationResult.of(saved);
		result.setCoverage(coverageOf(saved.getId()));
		return result;
	}

	@Override
	@Transactional
	public boolean delete(String authorization, Long id) {
		RcmTeamV2 team = requireTeam(id);
		memberRepository.deleteByRcmTeamId(team.getId());
		groupRepository.deleteByRcmTeamId(team.getId());
		teamRepository.delete(team);
		return true;
	}

	/* ─────────────────────────── group writes ─────────────────────────── */

	@Override
	@Transactional
	public RcmTeamMutationResult createGroup(String authorization, Long teamId,
			RcmTeamGroupInput input) {
		RcmTeamV2 team = requireTeam(teamId);
		RcmTeamGroup group = new RcmTeamGroup();
		applyGroupInput(group, input);
		group.setRcmTeamId(teamId);
		validator.validateGroup(team, group);

		if (group.getRotationOrder() == null) {
			group.setRotationOrder((int) groupRepository.countByRcmTeamId(teamId));
		}
		RcmTeamGroup saved = groupRepository.save(group);

		RcmTeamMutationResult result = new RcmTeamMutationResult();
		result.setTeam(team);
		result.setGroup(saved);
		if (input.getUserIds() != null && !input.getUserIds().isEmpty()) {
			result.setWarnings(warningsFor(teamId, input.getUserIds()));
			addMembers(saved, input.getUserIds());
		}
		result.setCoverage(coverageOf(teamId));
		return result;
	}

	@Override
	@Transactional
	public RcmTeamMutationResult updateGroup(String authorization, Long groupId,
			RcmTeamGroupInput input) {
		RcmTeamGroup group = requireGroup(groupId);
		RcmTeamV2 team = requireTeam(group.getRcmTeamId());
		applyGroupInput(group, input);
		validator.validateGroup(team, group);

		List<RcmTeamGroup> groups = findGroups(team.getId()).stream()
				.map(g -> g.getId().equals(groupId) ? group : g)
				.toList();
		requireCoverageIfActive(team, groups);

		RcmTeamGroup saved = groupRepository.save(group);
		RcmTeamMutationResult result = new RcmTeamMutationResult();
		result.setTeam(team);
		result.setGroup(saved);
		result.setCoverage(coverageOf(team.getId()));
		return result;
	}

	@Override
	@Transactional
	public boolean deleteGroup(String authorization, Long groupId) {
		RcmTeamGroup group = requireGroup(groupId);
		requireTeam(group.getRcmTeamId());
		memberRepository.deleteByRcmTeamGroupId(groupId);
		groupRepository.delete(group);
		return true;
	}

	/* ─────────────────────────── membership ─────────────────────────── */

	@Override
	@Transactional
	public RcmTeamMutationResult addGroupUsers(String authorization, Long groupId,
			List<Long> userIds) {
		RcmTeamGroup group = requireGroup(groupId);
		RcmTeamV2 team = requireTeam(group.getRcmTeamId());

		// Collected before writing, so the warning reflects the pre-existing state.
		List<RcmTeamMemberWarning> warnings = warningsFor(team.getId(), userIds);
		addMembers(group, userIds);

		RcmTeamMutationResult result = new RcmTeamMutationResult();
		result.setTeam(team);
		result.setGroup(group);
		result.setWarnings(warnings);
		result.setCoverage(coverageOf(team.getId()));
		return result;
	}

	@Override
	@Transactional
	public RcmTeamMutationResult removeGroupUsers(String authorization, Long groupId,
			List<Long> userIds) {
		RcmTeamGroup group = requireGroup(groupId);
		RcmTeamV2 team = requireTeam(group.getRcmTeamId());
		for (Long userId : userIds) {
			memberRepository.deleteByRcmTeamGroupIdAndUserId(groupId, userId);
		}
		RcmTeamMutationResult result = new RcmTeamMutationResult();
		result.setTeam(team);
		result.setGroup(group);
		result.setCoverage(coverageOf(team.getId()));
		return result;
	}

	/* ─────────────────────────── rotation ─────────────────────────── */

	@Override
	@Transactional
	public RcmTeamV2 rotate(String authorization, Long id) {
		RcmTeamV2 team = requireTeam(id);
		rotationService.rotate(team);
		return teamRepository.findById(id).orElse(team);
	}

	@Override
	@Transactional
	public RcmTeamV2 resetRotation(String authorization, Long id) {
		RcmTeamV2 team = requireTeam(id);
		rotationService.resetToHome(team);
		return teamRepository.findById(id).orElse(team);
	}

	/* ─────────────────────────── helpers ─────────────────────────── */

	private void addMembers(RcmTeamGroup group, List<Long> userIds) {
		for (Long userId : userIds) {
			if (memberRepository.findByRcmTeamGroupIdAndUserId(group.getId(), userId)
					.isPresent()) {
				continue;
			}
			RcmTeamGroupMember member = new RcmTeamGroupMember();
			member.setRcmTeamGroupId(group.getId());
			member.setRcmTeamId(group.getRcmTeamId());
			member.setUserId(userId);
			// Home is where the member starts; rotation never rewrites it.
			member.setHomeGroupId(group.getId());
			memberRepository.save(member);
		}
	}

	/**
	 * Existing allocations for users being added, so the UI can confirm
	 * "already allocated 150 in Team 2".
	 */
	private List<RcmTeamMemberWarning> warningsFor(Long teamId, List<Long> userIds) {
		List<RcmTeamMemberWarning> warnings = new ArrayList<>();
		for (Long userId : userIds) {
			for (Long otherTeamId : memberRepository.findOtherTeamIdsForUser(userId, teamId)) {
				RcmTeamV2 other = teamRepository.findById(otherTeamId).orElse(null);
				if (other == null) {
					continue;
				}
				RcmTeamCapacity capacity = capacityService.forTeam(other);
				warnings.add(new RcmTeamMemberWarning(userId, null, other.getId(),
						other.getName(), capacity.getAssigned(), capacity.getTotalCapacity()));
			}
		}
		return warnings;
	}

	/**
	 * A DEPARTMENT team may only be active once every department at its facility is
	 * covered. Inactive teams are exempt so they can be built up over several edits.
	 */
	private void requireCoverageIfActive(RcmTeamV2 team, List<RcmTeamGroup> groups) {
		coverageService.requireCompleteCoverage(team, groups,
				facilityDepartments(team.getFacilityId()));
	}

	private void applyTeamInput(RcmTeamV2 team, RcmTeamV2Input input) {
		if (input.getName() != null) {
			team.setName(input.getName());
		}
		team.setNameAr(input.getNameAr());
		team.setDescription(input.getDescription());
		if (input.getActive() != null) {
			team.setActive(input.getActive());
		}
		if (input.getFacilityId() != null) {
			team.setFacilityId(input.getFacilityId());
		}
		if (input.getDivision() != null) {
			team.setDivision(input.getDivision());
		}
		if (input.getEncounterScope() != null) {
			team.setEncounterScope(input.getEncounterScope());
		}
		if (input.getLogicAxis() != null) {
			team.setLogicAxis(input.getLogicAxis());
		}
		team.setHighCostThreshold(input.getHighCostThreshold());
		if (input.getBranchIds() != null) {
			team.setBranchIds(new ArrayList<>(input.getBranchIds()));
		}
		if (input.getRotationEnabled() != null) {
			team.setRotationEnabled(input.getRotationEnabled());
		}
		if (input.getRotationFrequency() != null) {
			team.setRotationFrequency(input.getRotationFrequency());
		}
	}

	private void applyGroupInput(RcmTeamGroup group, RcmTeamGroupInput input) {
		if (input.getName() != null) {
			group.setName(input.getName());
		}
		group.setNameAr(input.getNameAr());
		group.setDescription(input.getDescription());
		if (input.getActive() != null) {
			group.setActive(input.getActive());
		}
		if (input.getWorkItemTypes() != null) {
			group.setWorkItemTypes(new ArrayList<>(input.getWorkItemTypes()));
		}
		if (input.getEncounterScope() != null) {
			group.setEncounterScope(input.getEncounterScope());
		}
		// Null leaves the existing values; an empty list clears them.
		if (input.getDepartments() != null) {
			group.setDepartments(new ArrayList<>(input.getDepartments()));
		}
		if (input.getPayers() != null) {
			group.setPayers(new ArrayList<>(input.getPayers()));
		}
		if (input.getPayerCatchAll() != null) {
			group.setPayerCatchAll(input.getPayerCatchAll());
		}
		if (input.getClaimStatuses() != null) {
			group.setClaimStatuses(new ArrayList<>(input.getClaimStatuses()));
		}
		if (input.getRotationOrder() != null) {
			group.setRotationOrder(input.getRotationOrder());
		}
	}

	private boolean visibleToCurrentVendor(RcmTeamV2 team) {
		Long vendorId = JwtUtil.getVendorId();
		return vendorId == null || team.getVendorId() == null
				|| vendorId.equals(team.getVendorId());
	}

	private RcmTeamV2 requireTeam(Long id) {
		RcmTeamV2 team = teamRepository.findById(id)
				.filter(this::visibleToCurrentVendor)
				.orElseThrow(() -> new IllegalArgumentException("Team not found: " + id));
		return team;
	}

	private RcmTeamGroup requireGroup(Long id) {
		return groupRepository.findById(id)
				.orElseThrow(() -> new IllegalArgumentException("Group not found: " + id));
	}
}
