package com.i3hub.optima.service.dto;

import com.i3hub.optima.domain.WorkItemType;
import com.i3hub.optima.enumeration.RcmDepartment;

import java.util.ArrayList;
import java.util.List;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * What a team's groups do and do not cover.
 *
 * Only the fields for the team's own logic axis are populated: a DEPARTMENT team
 * reports department coverage and leaves the payer lists empty, and vice versa.
 * Departments are simply not a factor on a PAYER team.
 *
 * For an <em>active</em> DEPARTMENT team, uncovered departments are a hard block —
 * see RcmTeamCoverageService#requireCompleteCoverage. This report is what the UI
 * shows while the team is still being built.
 */
@Data
@NoArgsConstructor
public class RcmTeamCoverageReport {

	/** Departments at the facility that no active group covers. DEPARTMENT teams only. */
	private List<RcmDepartment> uncoveredDepartments = new ArrayList<>();

	/** Departments covered by more than one group — allowed, but usually a mistake. */
	private List<RcmDepartment> overlappingDepartments = new ArrayList<>();

	/** Payers that no active group covers. PAYER teams only. */
	private List<Long> uncoveredPayers = new ArrayList<>();

	/** Payers covered by more than one group. */
	private List<Long> overlappingPayers = new ArrayList<>();

	/**
	 * Work item types valid for the team's division that no active group handles,
	 * e.g. an AUTH team with no group covering AUTHORIZATION_RESUBMISSION.
	 */
	private List<WorkItemType> uncoveredWorkItemTypes = new ArrayList<>();

	/** Groups with no members — they can never receive work. */
	private List<Long> emptyGroupIds = new ArrayList<>();

	/** True when nothing is uncovered — i.e. the team may be activated. */
	public boolean isComplete() {
		return uncoveredDepartments.isEmpty()
				&& uncoveredPayers.isEmpty()
				&& uncoveredWorkItemTypes.isEmpty()
				&& emptyGroupIds.isEmpty();
	}
}
