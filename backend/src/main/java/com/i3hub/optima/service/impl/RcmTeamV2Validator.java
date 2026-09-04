package com.i3hub.optima.service.impl;

import com.i3hub.optima.domain.RcmTeamGroup;
import com.i3hub.optima.domain.RcmTeamV2;
import com.i3hub.optima.domain.WorkItemType;
import com.i3hub.optima.enumeration.RcmTeamDivision;
import com.i3hub.optima.enumeration.RcmTeamLogicAxis;

import java.util.EnumSet;
import java.util.List;
import java.util.Set;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

/**
 * Structural rules for v2 teams and groups.
 *
 * These are hard blocks, not warnings: a team that mixes AUTH and CLAIM work, or a
 * group that splits on both payer and department, is rejected. Keeping invalid
 * states unrepresentable means the allocation workflow can trust the data rather
 * than defending against it.
 *
 * Coverage is handled separately in RcmTeamCoverageService: a DEPARTMENT team must
 * cover every department at its facility before it can be <em>activated</em>, but an
 * inactive team may be saved incomplete so it can be built up over several edits.
 */
@Component
public class RcmTeamV2Validator {

	/** Resolves payer ids against the payer master list. */
	public interface PayerValidator {
		boolean exists(Long payerId);

		boolean isActive(Long payerId);
	}

	private final PayerValidator payerValidator;

	public RcmTeamV2Validator(@Autowired(required = false) PayerValidator payerValidator) {
		this.payerValidator = payerValidator;
	}

	private static final Set<WorkItemType> AUTH_TYPES = EnumSet.of(
			WorkItemType.AUTHORIZATION_SUBMISSION,
			WorkItemType.AUTHORIZATION_RESUBMISSION);

	private static final Set<WorkItemType> CLAIM_TYPES = EnumSet.of(
			WorkItemType.CLAIM_VALIDATION,
			WorkItemType.CLAIM_SUBMISSION,
			WorkItemType.CLAIM_RESUBMISSION,
			WorkItemType.RECONCILIATION);

	/** Work item types belonging to a division. */
	public static Set<WorkItemType> typesFor(RcmTeamDivision division) {
		return division == RcmTeamDivision.AUTH ? AUTH_TYPES : CLAIM_TYPES;
	}

	public static RcmTeamDivision divisionOf(WorkItemType type) {
		return AUTH_TYPES.contains(type) ? RcmTeamDivision.AUTH : RcmTeamDivision.CLAIM;
	}

	/** Validates the team itself, independent of its groups. */
	public void validateTeam(RcmTeamV2 team) {
		if (team.getName() == null || team.getName().isBlank()) {
			throw new IllegalArgumentException("Team name is required");
		}
		if (team.getDivision() == null) {
			throw new IllegalArgumentException("Team division (AUTH or CLAIM) is required");
		}
		if (team.getEncounterScope() == null) {
			throw new IllegalArgumentException("Team encounter scope is required");
		}
		if (team.getLogicAxis() == null) {
			throw new IllegalArgumentException("Team logic axis (DEPARTMENT or PAYER) is required");
		}
		if (Boolean.TRUE.equals(team.getRotationEnabled()) && team.getRotationFrequency() == null) {
			throw new IllegalArgumentException(
					"Rotation frequency is required when rotation is enabled");
		}
		if (team.getHighCostThreshold() != null && team.getHighCostThreshold() < 0) {
			throw new IllegalArgumentException("High cost threshold cannot be negative");
		}
	}

	/**
	 * Validates one group against its owning team.
	 *
	 * @throws IllegalArgumentException on a division mix, an encounter scope the
	 *         team does not cover, or a payer/department axis violation
	 */
	public void validateGroup(RcmTeamV2 team, RcmTeamGroup group) {
		if (group.getName() == null || group.getName().isBlank()) {
			throw new IllegalArgumentException("Group name is required");
		}

		// A team handles exactly one division.
		List<WorkItemType> types = group.getWorkItemTypes();
		if (types == null || types.isEmpty()) {
			throw new IllegalArgumentException(
					"Group '" + group.getName() + "' must declare at least one work item type");
		}
		Set<WorkItemType> allowed = typesFor(team.getDivision());
		for (WorkItemType type : types) {
			if (!allowed.contains(type)) {
				throw new IllegalArgumentException(String.format(
						"Group '%s' declares %s, which belongs to the %s division, but the team "
								+ "is %s. A team cannot handle both AUTH and CLAIM work.",
						group.getName(), type, divisionOf(type), team.getDivision()));
			}
		}

		// The group's encounter scope must fit inside the team's.
		if (group.getEncounterScope() == null) {
			throw new IllegalArgumentException(
					"Group '" + group.getName() + "' must declare an encounter scope");
		}
		if (!team.getEncounterScope().covers(group.getEncounterScope())) {
			throw new IllegalArgumentException(String.format(
					"Group '%s' is scoped %s but the team is scoped %s — a group cannot widen "
							+ "its team's encounter scope.",
					group.getName(), group.getEncounterScope(), team.getEncounterScope()));
		}

		// Exactly one logic axis, inherited from the team.
		boolean hasDepartments = group.getDepartments() != null && !group.getDepartments().isEmpty();
		boolean hasPayers = group.getPayers() != null && !group.getPayers().isEmpty();

		if (hasDepartments && hasPayers) {
			throw new IllegalArgumentException(String.format(
					"Group '%s' declares both departments and payers. A team splits on one axis "
							+ "only — this team splits by %s.",
					group.getName(), team.getLogicAxis()));
		}
		if (team.getLogicAxis() == RcmTeamLogicAxis.DEPARTMENT && hasPayers) {
			throw new IllegalArgumentException(String.format(
					"Group '%s' declares payers but the team splits by DEPARTMENT. When the axis "
							+ "is DEPARTMENT all payers are covered implicitly.",
					group.getName()));
		}
		if (team.getLogicAxis() == RcmTeamLogicAxis.PAYER && hasDepartments) {
			throw new IllegalArgumentException(String.format(
					"Group '%s' declares departments but the team splits by PAYER. When the axis "
							+ "is PAYER all departments are covered implicitly.",
					group.getName()));
		}

		// Payers must exist. Groups reference payer ids, and a typo silently means
		// "matches nothing", so it is rejected here rather than at 2am.
		if (hasPayers && payerValidator != null) {
			List<Long> unknown = group.getPayers().stream()
					.filter(id -> !payerValidator.exists(id))
					.toList();
			if (!unknown.isEmpty()) {
				throw new IllegalArgumentException(String.format(
						"Group '%s' references unknown payer ids: %s",
						group.getName(), unknown));
			}
			List<Long> inactive = group.getPayers().stream()
					.filter(payerValidator::exists)
					.filter(id -> !payerValidator.isActive(id))
					.toList();
			if (!inactive.isEmpty()) {
				throw new IllegalArgumentException(String.format(
						"Group '%s' references inactive payers: %s",
						group.getName(), inactive));
			}
		}

		// Claim statuses only mean something for claim work.
		if (group.getClaimStatuses() != null && !group.getClaimStatuses().isEmpty()
				&& team.getDivision() != RcmTeamDivision.CLAIM) {
			throw new IllegalArgumentException(String.format(
					"Group '%s' declares claim statuses, which only apply to CLAIM teams.",
					group.getName()));
		}
	}

	/** Validates a whole team with its groups. */
	public void validateTeamWithGroups(RcmTeamV2 team, List<RcmTeamGroup> groups) {
		validateTeam(team);
		if (groups != null) {
			for (RcmTeamGroup group : groups) {
				validateGroup(team, group);
			}
		}
	}
}
