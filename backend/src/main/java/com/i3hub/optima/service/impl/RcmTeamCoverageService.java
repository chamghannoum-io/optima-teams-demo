package com.i3hub.optima.service.impl;

import com.i3hub.optima.domain.RcmTeamGroup;
import com.i3hub.optima.domain.RcmTeamV2;
import com.i3hub.optima.enumeration.RcmDepartment;
import com.i3hub.optima.enumeration.RcmTeamLogicAxis;
import com.i3hub.optima.service.dto.RcmTeamCoverageReport;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Service;

/**
 * Coverage rules for a team's groups.
 *
 * The two logic axes are deliberately asymmetric, matching how allocation reads them:
 *
 * <ul>
 *   <li><b>PAYER teams</b> — departments are not a factor at all. A claim for ENT
 *       from Sukoon is routed purely on the payer, so no department coverage is
 *       required or checked.</li>
 *   <li><b>DEPARTMENT teams</b> — payers are implicitly all, and every department the
 *       facility handles <b>must</b> be covered by some group. This is a hard block:
 *       a team cannot be activated with 18 departments spread over 3 groups unless
 *       all 18 are assigned.</li>
 * </ul>
 *
 * {@link #suggestDistribution} proposes an even split as a starting point so the
 * requirement is easy to satisfy rather than tedious.
 */
@Service
public class RcmTeamCoverageService {

	/**
	 * Full coverage check.
	 *
	 * @param facilityDepartments departments the facility handles; ignored entirely
	 *        for PAYER teams
	 * @param facilityPayerIds payers the facility deals with; ignored for DEPARTMENT teams
	 */
	public RcmTeamCoverageReport analyse(RcmTeamV2 team, List<RcmTeamGroup> groups,
			List<RcmDepartment> facilityDepartments, List<Long> facilityPayerIds) {

		RcmTeamCoverageReport report = new RcmTeamCoverageReport();
		List<RcmTeamGroup> active = groups.stream()
				.filter(g -> Boolean.TRUE.equals(g.getActive()))
				.toList();

		if (team.getLogicAxis() == RcmTeamLogicAxis.DEPARTMENT) {
			analyseDepartments(active, facilityDepartments, report);
		} else {
			analysePayers(active, facilityPayerIds, report);
		}

		// Work item types valid for the division that nothing handles.
		Set<com.i3hub.optima.domain.WorkItemType> handled = new HashSet<>();
		active.forEach(g -> handled.addAll(
				g.getWorkItemTypes() == null ? List.of() : g.getWorkItemTypes()));
		RcmTeamV2Validator.typesFor(team.getDivision()).stream()
				.filter(t -> !handled.contains(t))
				.forEach(report.getUncoveredWorkItemTypes()::add);

		// A group with no members can never receive work.
		return report;
	}

	private void analyseDepartments(List<RcmTeamGroup> active,
			List<RcmDepartment> facilityDepartments, RcmTeamCoverageReport report) {
		if (facilityDepartments == null || facilityDepartments.isEmpty()) {
			return;
		}
		Map<RcmDepartment, Integer> counts = new HashMap<>();
		for (RcmTeamGroup group : active) {
			for (RcmDepartment dept : safe(group.getDepartments())) {
				counts.merge(dept, 1, Integer::sum);
			}
		}
		for (RcmDepartment dept : facilityDepartments) {
			int count = counts.getOrDefault(dept, 0);
			if (count == 0) {
				report.getUncoveredDepartments().add(dept);
			} else if (count > 1) {
				report.getOverlappingDepartments().add(dept);
			}
		}
	}

	private void analysePayers(List<RcmTeamGroup> active, List<Long> facilityPayerIds,
			RcmTeamCoverageReport report) {
		if (facilityPayerIds == null || facilityPayerIds.isEmpty()) {
			return;
		}
		Map<Long, Integer> counts = new HashMap<>();
		for (RcmTeamGroup group : active) {
			for (Long payer : group.getPayers() == null ? List.<Long>of() : group.getPayers()) {
				counts.merge(payer, 1, Integer::sum);
			}
		}
		for (Long payer : facilityPayerIds) {
			int count = counts.getOrDefault(payer, 0);
			if (count == 0) {
				report.getUncoveredPayers().add(payer);
			} else if (count > 1) {
				report.getOverlappingPayers().add(payer);
			}
		}
	}

	/**
	 * Hard block: rejects an active DEPARTMENT team that does not cover every
	 * department at its facility.
	 *
	 * PAYER teams are exempt — departments are not a factor for them. An inactive
	 * team is exempt too, so a team can be built up incrementally and only has to be
	 * complete at the point it goes live.
	 *
	 * @throws IllegalStateException listing exactly which departments are missing
	 */
	public void requireCompleteCoverage(RcmTeamV2 team, List<RcmTeamGroup> groups,
			List<RcmDepartment> facilityDepartments) {
		if (team.getLogicAxis() != RcmTeamLogicAxis.DEPARTMENT) {
			return;
		}
		if (!Boolean.TRUE.equals(team.getActive())) {
			return;
		}
		if (facilityDepartments == null || facilityDepartments.isEmpty()) {
			return;
		}
		Set<RcmDepartment> covered = new HashSet<>();
		groups.stream()
				.filter(g -> Boolean.TRUE.equals(g.getActive()))
				.forEach(g -> covered.addAll(safe(g.getDepartments())));

		List<RcmDepartment> missing = facilityDepartments.stream()
				.filter(d -> !covered.contains(d))
				.toList();

		if (!missing.isEmpty()) {
			throw new IllegalStateException(String.format(
					"Team '%s' splits by DEPARTMENT so every department must be assigned to a "
							+ "group before it can be active. %d of %d uncovered: %s",
					team.getName(), missing.size(), facilityDepartments.size(),
					missing.stream().map(RcmDepartment::getTag).toList()));
		}
	}

	/**
	 * Proposes an even distribution of departments across groups, as a starting point
	 * for the UI.
	 *
	 * Departments already assigned stay where they are; only unassigned ones are
	 * dealt out, to the emptiest group first so the result stays balanced.
	 *
	 * @return group id → departments that group should cover
	 */
	public Map<Long, List<RcmDepartment>> suggestDistribution(List<RcmTeamGroup> groups,
			List<RcmDepartment> facilityDepartments) {

		List<RcmTeamGroup> active = groups.stream()
				.filter(g -> Boolean.TRUE.equals(g.getActive()))
				.toList();

		Map<Long, List<RcmDepartment>> result = new LinkedHashMap<>();
		if (active.isEmpty()) {
			return result;
		}

		Set<RcmDepartment> alreadyAssigned = new HashSet<>();
		for (RcmTeamGroup group : active) {
			List<RcmDepartment> existing = new ArrayList<>(safe(group.getDepartments()));
			result.put(group.getId(), existing);
			alreadyAssigned.addAll(existing);
		}

		List<RcmDepartment> unassigned = facilityDepartments.stream()
				.filter(d -> !alreadyAssigned.contains(d))
				.sorted(Comparator.comparing(Enum::name))
				.toList();

		for (RcmDepartment dept : unassigned) {
			Long smallest = result.entrySet().stream()
					.min(Comparator
							.<Map.Entry<Long, List<RcmDepartment>>>comparingInt(
									e -> e.getValue().size())
							.thenComparing(Map.Entry::getKey))
					.map(Map.Entry::getKey)
					.orElseThrow();
			result.get(smallest).add(dept);
		}
		return result;
	}

	private static List<RcmDepartment> safe(List<RcmDepartment> value) {
		return value == null ? List.of() : value;
	}
}
