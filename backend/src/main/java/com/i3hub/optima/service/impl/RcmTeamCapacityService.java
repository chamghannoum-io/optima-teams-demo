package com.i3hub.optima.service.impl;

import com.i3hub.optima.domain.RcmTeamGroup;
import com.i3hub.optima.domain.RcmTeamGroupMember;
import com.i3hub.optima.domain.RcmTeamV2;
import com.i3hub.optima.enumeration.RcmTeamDivision;
import com.i3hub.optima.repository.RcmTeamGroupMemberRepository;
import com.i3hub.optima.service.dto.RcmTeamCapacity;

import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;

/**
 * Computes team and group capacity.
 *
 * Capacity is <strong>derived, never stored</strong>: it is the summed per-user
 * maximum over the team's <em>de-duplicated</em> roster. A user sitting in three
 * groups of one team is counted once, so capacity cannot drift from membership and
 * cannot be inflated by adding someone to more groups.
 *
 * The per-user maximum comes from {@code effectiveAssignmentSettings}, which returns
 * {@code maxAuth} and {@code maxClaim} separately — so the figure used depends on the
 * team's division.
 */
@Service
public class RcmTeamCapacityService {

	/**
	 * Per-user assignment limits, as returned by {@code effectiveAssignmentSettings}.
	 * Implemented against the real settings service in production; kept as an
	 * interface so capacity is testable without standing up that dependency.
	 */
	public interface AssignmentSettingsSource {

		/**
		 * @param userIds users to look up
		 * @param teamId team context, so team-level defaults resolve correctly
		 * @return userId → limits
		 */
		Map<Long, Limits> effectiveSettings(Collection<Long> userIds, Long teamId);

		/** Items currently assigned per user, for the given division. */
		Map<Long, Integer> assignedCounts(Collection<Long> userIds, RcmTeamDivision division);

		record Limits(int maxAuth, int maxClaim) {

			/** The limit that applies to a division. */
			int forDivision(RcmTeamDivision division) {
				return division == RcmTeamDivision.AUTH ? maxAuth : maxClaim;
			}
		}
	}

	private final RcmTeamGroupMemberRepository memberRepository;
	private final AssignmentSettingsSource settingsSource;

	public RcmTeamCapacityService(RcmTeamGroupMemberRepository memberRepository,
			AssignmentSettingsSource settingsSource) {
		this.memberRepository = memberRepository;
		this.settingsSource = settingsSource;
	}

	/**
	 * Capacity for a whole team, over its de-duplicated roster.
	 *
	 * {@code duplicateMemberships} reports how many raw memberships were collapsed,
	 * so the UI can explain why 20 group memberships show as 16 members.
	 */
	public RcmTeamCapacity forTeam(RcmTeamV2 team) {
		List<RcmTeamGroupMember> memberships = memberRepository.findByRcmTeamId(team.getId());
		if (memberships.isEmpty()) {
			return RcmTeamCapacity.empty();
		}
		Set<Long> distinct = memberships.stream()
				.map(RcmTeamGroupMember::getUserId)
				.collect(Collectors.toCollection(LinkedHashSet::new));

		RcmTeamCapacity capacity = capacityOf(distinct, team.getId(), team.getDivision());
		capacity.setDuplicateMemberships(memberships.size() - distinct.size());
		return capacity;
	}

	/**
	 * Capacity for one group.
	 *
	 * Note this does <em>not</em> sum to the team's capacity when a user belongs to
	 * several groups — the team de-duplicates, the groups do not. Group capacity is
	 * for distributing work within a team; team capacity is the real ceiling.
	 */
	public RcmTeamCapacity forGroup(RcmTeamV2 team, RcmTeamGroup group) {
		Set<Long> userIds = memberRepository.findByRcmTeamGroupId(group.getId()).stream()
				.map(RcmTeamGroupMember::getUserId)
				.collect(Collectors.toCollection(LinkedHashSet::new));
		if (userIds.isEmpty()) {
			return RcmTeamCapacity.empty();
		}
		return capacityOf(userIds, team.getId(), team.getDivision());
	}

	/** Capacity per group, keyed by group id — used as the matcher's tiebreak. */
	public Map<Long, Integer> remainingByGroup(RcmTeamV2 team, List<RcmTeamGroup> groups) {
		return groups.stream().collect(Collectors.toMap(
				RcmTeamGroup::getId,
				g -> forGroup(team, g).getRemaining(),
				(a, b) -> a));
	}

	private RcmTeamCapacity capacityOf(Set<Long> userIds, Long teamId,
			RcmTeamDivision division) {
		Map<Long, AssignmentSettingsSource.Limits> limits =
				settingsSource.effectiveSettings(userIds, teamId);
		Map<Long, Integer> assigned = settingsSource.assignedCounts(userIds, division);

		int total = 0;
		int used = 0;
		for (Long userId : userIds) {
			AssignmentSettingsSource.Limits limit = limits.get(userId);
			if (limit != null) {
				total += limit.forDivision(division);
			}
			used += assigned.getOrDefault(userId, 0);
		}
		return new RcmTeamCapacity(userIds.size(), total, used, Math.max(0, total - used), 0);
	}
}
