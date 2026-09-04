package com.i3hub.optima.service.impl;

import com.i3hub.optima.domain.RcmTeam;
import com.i3hub.optima.domain.RcmTeamTag;
import com.i3hub.optima.domain.RcmTeamUserUnavailability;
import com.i3hub.optima.domain.RotationFrequency;
import com.i3hub.optima.enumeration.RcmTeamUnavailabilityAction;
import com.i3hub.optima.graphql.client.GraphQlBackendService;
import com.i3hub.optima.graphql.input.RcmTeamInput;
import com.i3hub.optima.graphql.input.RcmTeamTagInput;
import com.i3hub.optima.graphql.input.RcmTeamUserUnavailabilityInput;
import com.i3hub.optima.graphql.input.filter.RcmTeamFilterInput;
import com.i3hub.optima.graphql.type.TypeRcmTeam;
import com.i3hub.optima.graphql.type.TypeRcmTeamMember;
import com.i3hub.optima.graphql.type.TypeRcmTeamUserUnavailability;
import com.i3hub.optima.repository.RcmTeamRepository;
import com.i3hub.optima.repository.RcmTeamUserUnavailabilityRepository;
import com.i3hub.optima.service.AssignmentService;
import com.i3hub.optima.service.RcmTeamService;
import com.i3hub.optima.util.JwtUtil;
import java.time.Instant;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;

@Service
public class RcmTeamServiceImpl implements RcmTeamService {
	private final RcmTeamRepository rcmTeamRepository;
	private final RcmTeamUserUnavailabilityRepository unavailabilityRepository;
	private final AssignmentService assignmentService;
	private final GraphQlBackendService graphQlBackendService;

	public RcmTeamServiceImpl(RcmTeamRepository rcmTeamRepository,
			RcmTeamUserUnavailabilityRepository unavailabilityRepository,
			AssignmentService assignmentService,
			GraphQlBackendService graphQlBackendService) {
		this.rcmTeamRepository = rcmTeamRepository;
		this.unavailabilityRepository = unavailabilityRepository;
		this.assignmentService = assignmentService;
		this.graphQlBackendService = graphQlBackendService;
	}

	@Override
	public TypeRcmTeam findOne(String authorization, Long id) {
		RcmTeam team = rcmTeamRepository.findById(id).orElse(null);
		if (team == null) {
			return null;
		}
		Long currentVendorId = JwtUtil.getVendorId();
		if (currentVendorId != null && team.getVendorId() != null
				&& !currentVendorId.equals(team.getVendorId())) {
			return null;
		}
		return team;
	}

	@Override
	public List<TypeRcmTeam> findAll(String authorization, RcmTeamFilterInput filter) {
		Specification<RcmTeam> specification = RcmTeamRepository.conjunction();
		Long currentVendorId = JwtUtil.getVendorId();
		if (currentVendorId != null) {
			specification = specification.and(RcmTeamRepository.vendorIdEq(currentVendorId));
		}
		if (filter != null) {
			if (filter.getIds() != null && !filter.getIds().isEmpty()) {
				specification = specification.and(RcmTeamRepository.idIn(filter.getIds()));
			}
			if (filter.getName() != null && !filter.getName().isBlank()) {
				specification = specification.and(RcmTeamRepository.nameLike(filter.getName()));
			}
			if (filter.getTag() != null && !filter.getTag().isBlank()) {
				List<String> tags = Arrays.stream(filter.getTag().split(","))
						.map(String::trim)
						.filter(t -> !t.isEmpty())
						.toList();
				specification = specification.and(RcmTeamRepository.tagContainsAny(tags));
			}
			if (filter.getActive() != null) {
				specification = specification.and(RcmTeamRepository.isActive(filter.getActive()));
			}
			if (filter.getBranchIds() != null && !filter.getBranchIds().isEmpty()) {
				specification = specification.and(RcmTeamRepository.branchIdIn(filter.getBranchIds()));
			}
            if (filter.getVendorId() != null) {
                specification = specification.and(RcmTeamRepository.vendorIdEq(filter.getVendorId()));
            }
		}
		return rcmTeamRepository.findAll(specification).stream().map(team -> (TypeRcmTeam) team).toList();
	}

	@Override
	public TypeRcmTeam create(String authorization, RcmTeamInput input) {
		if (input == null || input.getName() == null || input.getName().isBlank()) {
			throw new IllegalArgumentException("name is required");
		}
		if (input.getBranchIds() == null || input.getBranchIds().isEmpty()) {
			throw new IllegalArgumentException("branchIds is required");
		}
		Long vendorId = JwtUtil.getVendorId();
		if (vendorId == null) {
			throw new IllegalStateException("vendorId is required for the current user");
		}
		validateBranchesBelongToVendor(authorization, input.getBranchIds(), vendorId);
		RcmTeam team = new RcmTeam();
		team.setVendorId(vendorId);
		applyInput(team, input, true);
		return rcmTeamRepository.save(team);
	}

	@Override
	public TypeRcmTeam update(String authorization, Long id, RcmTeamInput input) {
		RcmTeam team = loadTeamForCurrentVendor(id);
		if (input != null && input.getBranchIds() != null && !input.getBranchIds().isEmpty()) {
			Long vendorId = team.getVendorId() != null ? team.getVendorId() : JwtUtil.getVendorId();
			validateBranchesBelongToVendor(authorization, input.getBranchIds(), vendorId);
		}
		applyInput(team, input, false);
		return rcmTeamRepository.save(team);
	}

	@Override
	public TypeRcmTeam addUsers(String authorization, Long id, List<Long> userIds) {
		RcmTeam team = loadTeamForCurrentVendor(id);
		if (userIds == null || userIds.isEmpty()) {
			return team;
		}
		List<Long> existingUsers = team.getUsers() == null ? new ArrayList<>() : team.getUsers();
		Set<Long> merged = new LinkedHashSet<>(existingUsers);
		merged.addAll(userIds);
		team.setUsers(new ArrayList<>(merged));
		return rcmTeamRepository.save(team);
	}

	@Override
	public TypeRcmTeam removeUsers(String authorization, Long id, List<Long> userIds) {
		RcmTeam team = loadTeamForCurrentVendor(id);
		if (userIds == null || userIds.isEmpty()) {
			return team;
		}
		List<Long> existingUsers = team.getUsers();
		if (existingUsers == null || existingUsers.isEmpty()) {
			return team;
		}
		existingUsers.removeIf(userIds::contains);
		if (Boolean.TRUE.equals(team.getRotationEnabled()) && existingUsers.size() < 2) {
			team.setRotationEnabled(false);
			team.setNextRotationDate(null);
		}
		return rcmTeamRepository.save(team);
	}

	@Override
	public TypeRcmTeam rotationComplete(String authorization, Long id, Long rotationPointer) {
		RcmTeam team = loadTeamForCurrentVendor(id);
		if (!Boolean.TRUE.equals(team.getRotationEnabled())) {
			throw new IllegalStateException("Rotation is not enabled for this team");
		}
		if (rotationPointer != null
				&& (team.getUsers() == null || !team.getUsers().contains(rotationPointer))) {
			throw new IllegalArgumentException("rotationPointer must be a member of the team");
		}
		if (rotationPointer != null) {
			team.setRotationPointer(rotationPointer);
		}
		team.setLastRotationAt(Instant.now());
		team.setNextRotationDate(team.getRotationFrequency().next(LocalDate.now()));
		return rcmTeamRepository.save(team);
	}

	@Override
	public TypeRcmTeamUserUnavailability setUserUnavailability(String authorization, RcmTeamUserUnavailabilityInput input) {
		if (input == null || input.getTeamId() == null || input.getUserId() == null) {
			throw new IllegalArgumentException("teamId and userId are required");
		}
		if (input.getStartDate() == null || input.getEndDate() == null) {
			throw new IllegalArgumentException("startDate and endDate are required");
		}
		if (input.getEndDate().isBefore(input.getStartDate())) {
			throw new IllegalArgumentException("endDate cannot be before startDate");
		}
		if (input.getAction() == null) {
			throw new IllegalArgumentException("action is required");
		}
		RcmTeam team = loadTeamForCurrentVendor(input.getTeamId());
		if (team.getUsers() == null || !team.getUsers().contains(input.getUserId())) {
			throw new IllegalArgumentException("User is not a member of the team");
		}
		boolean overlaps = unavailabilityRepository
				.existsByRcmTeamIdAndUserIdAndCancelledFalseAndStartDateLessThanEqualAndEndDateGreaterThanEqual(
						team.getId(), input.getUserId(), input.getEndDate(), input.getStartDate());
		if (overlaps) {
			throw new IllegalArgumentException("User already has an unavailability window overlapping these dates");
		}
		RcmTeamUserUnavailability unavailability = new RcmTeamUserUnavailability();
		unavailability.setRcmTeamId(team.getId());
		unavailability.setUserId(input.getUserId());
		unavailability.setStartDate(input.getStartDate());
		unavailability.setEndDate(input.getEndDate());
		unavailability.setReason(input.getReason());
		unavailability.setCancelled(false);
		unavailability = unavailabilityRepository.save(unavailability);
		if (input.getAction() == RcmTeamUnavailabilityAction.UNASSIGN) {
			// Assignments carry no team dimension, so this unassigns the user's active items across all teams.
			assignmentService.unassignAllActiveForCoder(String.valueOf(input.getUserId()),
					String.valueOf(Objects.requireNonNull(JwtUtil.getCurrentUserId())), JwtUtil.getCurrentName(),
					"Coder marked unavailable " + input.getStartDate() + " to " + input.getEndDate());
		}
		return unavailability;
	}

	@Override
	public TypeRcmTeamUserUnavailability cancelUserUnavailability(String authorization, Long id) {
		RcmTeamUserUnavailability unavailability = unavailabilityRepository.findById(id)
				.orElseThrow(() -> new IllegalArgumentException("Unavailability not found"));
		loadTeamForCurrentVendor(unavailability.getRcmTeamId());
		unavailability.setCancelled(true);
		return unavailabilityRepository.save(unavailability);
	}

	@Override
	public List<TypeRcmTeamUserUnavailability> findUserUnavailabilities(Long teamId) {
		if (teamId == null) {
			return List.of();
		}
		return unavailabilityRepository
				.findByRcmTeamIdAndCancelledFalseAndEndDateGreaterThanEqual(teamId, LocalDate.now())
				.stream().map(u -> (TypeRcmTeamUserUnavailability) u).toList();
	}

	@Override
	public List<TypeRcmTeamMember> findMembers(TypeRcmTeam team, Boolean availableOnly) {
		if (team == null || team.getUsers() == null || team.getUsers().isEmpty()) {
			return List.of();
		}
		Map<Long, List<TypeRcmTeamUserUnavailability>> unavailabilitiesByUser = findUserUnavailabilities(team.getId())
				.stream().collect(Collectors.groupingBy(TypeRcmTeamUserUnavailability::getUserId));
		return team.getUsers().stream()
				.map(userId -> new TypeRcmTeamMember(userId, unavailabilitiesByUser.getOrDefault(userId, List.of())))
				.filter(member -> !Boolean.TRUE.equals(availableOnly)
						|| !Boolean.TRUE.equals(member.getUnavailableToday()))
				.toList();
	}

	private RcmTeam loadTeamForCurrentVendor(Long id) {
		RcmTeam team = rcmTeamRepository.findById(id).orElse(null);
		if (team == null) {
			throw new RuntimeException("Team not found");
		}
		Long currentVendorId = JwtUtil.getVendorId();
		if (currentVendorId != null && team.getVendorId() != null
				&& !currentVendorId.equals(team.getVendorId())) {
			throw new RuntimeException("Team not found");
		}
		return team;
	}

	private void validateBranchesBelongToVendor(String authorization, List<Long> branchIds, Long vendorId) {
		// Temporarily disabled — re-enable once federated branch lookup is wired up.
		// if (vendorId == null || branchIds == null || branchIds.isEmpty()) {
		// 	return;
		// }
		// boolean ok = graphQlBackendService.branchesBelongToVendor(authorization, branchIds, vendorId);
		// if (!ok) {
		// 	throw new IllegalArgumentException("All branches must belong to the same vendor");
		// }
	}

	private void applyInput(RcmTeam team, RcmTeamInput input, boolean isCreate) {
		if (input == null) {
			return;
		}
		if (isCreate || input.getName() != null) {
			team.setName(input.getName());
		}
		if (input.getTags() != null) {
			// Mutate the managed collection in place (clear + addAll) rather than replacing the
			// reference with a new list — orphanRemoval only deletes children that Hibernate sees
			// removed from the SAME tracked collection instance; team.setTags(newList) silently
			// leaves the old rcm_team_tag rows behind instead of deleting them.
			team.getTags().clear();
			team.getTags().addAll(mapTeamTags(input.getTags()));
			// rcm_team_tag is the source of truth; derive the legacy flat tag from it (deduped)
			// instead of trusting a client-supplied string, so the two can never drift apart.
			team.setTag(flattenTagCodes(team.getTags()));
		} else if (input.getTag() != null) {
			team.setTag(input.getTag());
		}
		if (input.getNameAr() != null) {
			team.setNameAr(input.getNameAr());
		}
		if (input.getDescription() != null) {
			team.setDescription(input.getDescription());
		}
		if (input.getActive() != null) {
			team.setActive(input.getActive());
		} else if (isCreate && team.getActive() == null) {
			team.setActive(true);
		}
		if (input.getUsers() != null) {
			team.setUsers(new ArrayList<>(input.getUsers()));
		} else if (isCreate && team.getUsers() == null) {
			team.setUsers(new ArrayList<>());
		}
		if (input.getBranchIds() != null) {
			if (!isCreate && input.getBranchIds().isEmpty()) {
				throw new IllegalArgumentException("branchIds cannot be empty");
			}
			team.setBranchIds(new ArrayList<>(input.getBranchIds()));
		} else if (isCreate && team.getBranchIds() == null) {
			team.setBranchIds(new ArrayList<>());
		}
		applyRotation(team, input, isCreate);
	}

	private List<RcmTeamTag> mapTeamTags(List<RcmTeamTagInput> tagInputs) {
		if (tagInputs == null) {
			return new ArrayList<>();
		}
		return tagInputs.stream().map(this::mapTeamTag).toList();
	}

	/** Flattens every leaf tag code in the tree into a deduped, comma-separated string. */
	private String flattenTagCodes(List<RcmTeamTag> tags) {
		LinkedHashSet<String> codes = new LinkedHashSet<>();
		collectLeafTagCodes(tags, codes);
		return String.join(", ", codes);
	}

	private void collectLeafTagCodes(List<RcmTeamTag> nodes, LinkedHashSet<String> codes) {
		if (nodes == null) {
			return;
		}
		for (RcmTeamTag node : nodes) {
			if (Boolean.TRUE.equals(node.getIsGroup())) {
				collectLeafTagCodes(node.getTags(), codes);
			} else if (node.getTag() != null) {
				codes.add(node.getTag());
			}
		}
	}

	private RcmTeamTag mapTeamTag(RcmTeamTagInput tagInput) {
		RcmTeamTag tag = new RcmTeamTag();
		tag.setTag(tagInput.getTag());
		tag.setIsGroup(tagInput.getIsGroup());
		tag.setTagOperation(tagInput.getTagOperation());
		tag.setTags(mapTeamTags(tagInput.getTags()));
		return tag;
	}

	private void applyRotation(RcmTeam team, RcmTeamInput input, boolean isCreate) {
		RotationFrequency previousFrequency = team.getRotationFrequency();
		boolean wasEnabled = Boolean.TRUE.equals(team.getRotationEnabled());
		if (input.getRotationFrequency() != null) {
			team.setRotationFrequency(input.getRotationFrequency());
		}
		if (input.getRotationEnabled() != null) {
			team.setRotationEnabled(input.getRotationEnabled());
		} else if (isCreate && team.getRotationEnabled() == null) {
			team.setRotationEnabled(false);
		}
		if (!Boolean.TRUE.equals(team.getRotationEnabled())) {
			team.setNextRotationDate(null);
			return;
		}
		if (team.getRotationFrequency() == null) {
			throw new IllegalArgumentException("rotationFrequency is required when rotation is enabled");
		}
		int userCount = team.getUsers() == null ? 0 : team.getUsers().size();
		if (userCount < 2) {
			throw new IllegalArgumentException("Rotation requires at least 2 team members");
		}
		if (!wasEnabled || team.getNextRotationDate() == null || team.getRotationFrequency() != previousFrequency) {
			team.setNextRotationDate(team.getRotationFrequency().next(LocalDate.now()));
		}
	}
}
