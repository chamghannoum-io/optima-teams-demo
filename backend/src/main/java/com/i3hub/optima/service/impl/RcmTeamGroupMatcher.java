package com.i3hub.optima.service.impl;

import com.i3hub.optima.domain.RcmTeamGroup;
import com.i3hub.optima.domain.RcmTeamV2;
import com.i3hub.optima.domain.WorkItemType;
import com.i3hub.optima.enumeration.RcmDepartment;
import com.i3hub.optima.enumeration.RcmTeamEncounterScope;
import com.i3hub.optima.enumeration.RcmTeamLogicAxis;

import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.Map;
import java.util.Optional;
import org.springframework.stereotype.Component;

/**
 * Picks the group that should receive a work item.
 *
 * Selection order, as agreed:
 * <ol>
 *   <li>the group must match the item at all (type, encounter, axis, status);</li>
 *   <li>most specific group wins — one naming ENT beats one naming six
 *       departments, because there is no catch-all group in this model;</li>
 *   <li>ties broken by remaining capacity, so load still spreads.</li>
 * </ol>
 *
 * This replaces the v1 approach of parsing a comma-separated tag string and
 * ranking teams by a priority-* tag.
 */
@Component
public class RcmTeamGroupMatcher {

	/** A work item, reduced to just what matching needs. */
	public record WorkItemCriteria(
			WorkItemType workItemType,
			RcmTeamEncounterScope encounter,
			RcmDepartment department,
			Long payerId,
			String claimStatus) {

		/**
		 * Builds criteria from a raw work item, resolving the source system's
		 * department spelling through {@link RcmDepartment#fromDisplayName}.
		 * An unmapped department resolves to null, which no group will match —
		 * the item is then reported as uncovered rather than mis-assigned.
		 */
		public static WorkItemCriteria of(WorkItemType workItemType,
				RcmTeamEncounterScope encounter, String departmentDisplayName,
				Long payerId, String claimStatus) {
			return new WorkItemCriteria(workItemType, encounter,
					RcmDepartment.fromDisplayName(departmentDisplayName).orElse(null),
					payerId, claimStatus);
		}
	}

	/**
	 * True when this group can take the item.
	 *
	 * Note the asymmetry between the two axes: on a DEPARTMENT team the group must
	 * name the item's department explicitly, because there is no wildcard group.
	 * On a PAYER team the same applies to payers, and departments are implicitly all.
	 */
	public boolean matches(RcmTeamV2 team, RcmTeamGroup group, WorkItemCriteria item) {
		if (!Boolean.TRUE.equals(group.getActive())) {
			return false;
		}
		if (group.getWorkItemTypes() == null
				|| !group.getWorkItemTypes().contains(item.workItemType())) {
			return false;
		}
		if (item.encounter() != null && item.encounter() != RcmTeamEncounterScope.BOTH
				&& !group.getEncounterScope().covers(item.encounter())) {
			return false;
		}

		if (team.getLogicAxis() == RcmTeamLogicAxis.DEPARTMENT) {
			// No catch-all: an item with no resolvable department cannot be placed.
			if (item.department() == null) {
				return false;
			}
			if (group.getDepartments() == null
					|| !group.getDepartments().contains(item.department())) {
				return false;
			}
		} else {
			if (item.payerId() == null) {
				return false;
			}
			boolean named = group.getPayers() != null
					&& group.getPayers().contains(item.payerId());
			// A catch-all accepts any payer; bestGroup() still prefers a group that
			// names the payer, because a catch-all scores zero on that dimension.
			if (!named && !Boolean.TRUE.equals(group.getPayerCatchAll())) {
				return false;
			}
		}

		// An empty status list means the group does not filter on status.
		List<String> statuses = group.getClaimStatuses();
		if (statuses != null && !statuses.isEmpty()) {
			if (item.claimStatus() == null) {
				return false;
			}
			boolean statusMatch = statuses.stream()
					.anyMatch(s -> s.equalsIgnoreCase(item.claimStatus().trim()));
			if (!statusMatch) {
				return false;
			}
		}
		return true;
	}

	/**
	 * Best group for an item, or empty when none matches.
	 *
	 * @param remainingByGroupId remaining capacity per group, used only as a tiebreak
	 */
	public Optional<RcmTeamGroup> bestGroup(RcmTeamV2 team, List<RcmTeamGroup> groups,
			WorkItemCriteria item, Map<Long, Integer> remainingByGroupId) {
		return groups.stream()
				.filter(g -> matches(team, g, item))
				.max(Comparator
						.comparingInt(RcmTeamGroup::specificity)
						.thenComparingInt(g -> remainingByGroupId
								.getOrDefault(g.getId(), 0)));
	}

	/**
	 * Departments at a facility that no active group covers.
	 *
	 * Because every department must be named explicitly, an omission is a real gap
	 * rather than something a catch-all would absorb.
	 */
	/**
	 * Payers no active group would accept.
	 *
	 * Empty whenever any active group is a catch-all — that is the point of the
	 * catch-all, and why PAYER teams are exempt from the hard coverage block.
	 */
	public List<Long> uncoveredPayers(List<RcmTeamGroup> groups, List<Long> facilityPayers) {
		List<RcmTeamGroup> active = groups.stream()
				.filter(g -> Boolean.TRUE.equals(g.getActive()))
				.toList();
		if (active.stream().anyMatch(g -> Boolean.TRUE.equals(g.getPayerCatchAll()))) {
			return List.of();
		}
		Set<Long> named = active.stream()
				.flatMap(g -> g.getPayers() == null
						? java.util.stream.Stream.<Long>empty()
						: g.getPayers().stream())
				.collect(java.util.stream.Collectors.toSet());
		return facilityPayers.stream().filter(p -> !named.contains(p)).toList();
	}

	public List<RcmDepartment> uncoveredDepartments(List<RcmTeamGroup> groups,
			List<RcmDepartment> facilityDepartments) {
		Set<RcmDepartment> covered = groups.stream()
				.filter(g -> Boolean.TRUE.equals(g.getActive()))
				.flatMap(g -> g.getDepartments() == null
						? java.util.stream.Stream.<RcmDepartment>empty()
						: g.getDepartments().stream())
				.collect(java.util.stream.Collectors.toSet());
		return facilityDepartments.stream().filter(d -> !covered.contains(d)).toList();
	}
}
