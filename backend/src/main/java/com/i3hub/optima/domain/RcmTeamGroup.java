package com.i3hub.optima.domain;

import com.i3hub.optima.enumeration.RcmDepartment;
import com.i3hub.optima.enumeration.RcmTeamEncounterScope;
import com.i3hub.optima.graphql.type.TypeRcmTeamGroup;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Table;
import java.util.ArrayList;
import java.util.List;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.ToString;

/**
 * A group within an RCM team.
 *
 * Groups — not teams — carry the matching criteria and the members. A team is a
 * container (facility × division × encounter); each of its groups narrows that
 * down to a specific slice of work, e.g. "Dubai × AUTH_RESUBMISSION × OP —
 * ENT, ICU, GYN".
 *
 * Matching uses typed columns rather than the v1 comma-separated tag string, so
 * validation and coverage checks are exact rather than string matching.
 *
 * Which of {@link #departments} / {@link #payers} is populated is governed by the
 * owning team's logicAxis: exactly one of them is used, never both.
 */
@Data
@Entity
@Table(name = "rcm_team_group", indexes = {
		@Index(columnList = "rcm_team_id"),
		@Index(columnList = "is_active")
})
@EqualsAndHashCode(callSuper = true)
@ToString(callSuper = true)
public class RcmTeamGroup extends AbstractAuditingEntity<Long> implements TypeRcmTeamGroup {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(name = "rcm_team_id", nullable = false)
	private Long rcmTeamId;

	@Column(name = "name", nullable = false)
	private String name;

	@Column(name = "name_ar")
	private String nameAr;

	@Column(name = "description", columnDefinition = "TEXT")
	private String description;

	@Column(name = "is_active", columnDefinition = "boolean default true")
	private Boolean active = Boolean.TRUE;

	/**
	 * Work item types this group handles. Every value must belong to the owning
	 * team's division — a group under an AUTH team cannot list CLAIM_VALIDATION.
	 */
	@ElementCollection(fetch = FetchType.EAGER)
	@CollectionTable(name = "rcm_team_group_work_item_type",
			joinColumns = @JoinColumn(name = "rcm_team_group_id"))
	@Enumerated(EnumType.STRING)
	@Column(name = "work_item_type", length = 40)
	private List<WorkItemType> workItemTypes = new ArrayList<>();

	/**
	 * Encounter scope for this group. Must be covered by the team's scope: a team
	 * scoped OP cannot hold an IP group. A BOTH team may hold OP, IP or BOTH groups.
	 */
	@Enumerated(EnumType.STRING)
	@Column(name = "encounter_scope", length = 10)
	private RcmTeamEncounterScope encounterScope = RcmTeamEncounterScope.BOTH;

	/**
	 * Departments this group covers, when the team's logicAxis is DEPARTMENT.
	 * There is no "all departments" wildcard — every department is named
	 * explicitly so coverage gaps are detectable.
	 *
	 * Typed against {@link RcmDepartment} rather than free text, so a misspelled
	 * department is rejected at save instead of silently never matching.
	 */
	@ElementCollection(fetch = FetchType.EAGER)
	@CollectionTable(name = "rcm_team_group_department",
			joinColumns = @JoinColumn(name = "rcm_team_group_id"))
	@Enumerated(EnumType.STRING)
	@Column(name = "department", length = 60)
	private List<RcmDepartment> departments = new ArrayList<>();

	/**
	 * Catch-all flag, for PAYER teams only.
	 *
	 * Payer distributions have a long tail — 56-69 payers per site, of which 10-15
	 * carry ~85-90% of volume and 20-30 sit below one item a day. Naming every payer
	 * is impractical and leaves new payers matching nothing, so groups may instead
	 * declare themselves catch-alls: they take any payer no other group names.
	 *
	 * Several groups can be catch-alls; the tail is split between them so no single
	 * group becomes the dumping ground. Departments never use this — there are only
	 * 28 and they must all be named explicitly.
	 */
	@Column(name = "is_payer_catch_all", columnDefinition = "boolean default false")
	private Boolean payerCatchAll = Boolean.FALSE;

	/** Payer ids this group covers, when the team's logicAxis is PAYER. */
	@ElementCollection(fetch = FetchType.EAGER)
	@CollectionTable(name = "rcm_team_group_payer",
			joinColumns = @JoinColumn(name = "rcm_team_group_id"))
	@Column(name = "payer_id")
	private List<Long> payers = new ArrayList<>();

	/**
	 * Claim statuses this group accepts (coders take OPEN/CHECKED, submission takes
	 * VALIDATED). Empty means the group does not filter on status.
	 */
	@ElementCollection(fetch = FetchType.EAGER)
	@CollectionTable(name = "rcm_team_group_claim_status",
			joinColumns = @JoinColumn(name = "rcm_team_group_id"))
	@Column(name = "claim_status", length = 40)
	private List<String> claimStatuses = new ArrayList<>();

	/*
	 * Members are NOT held here. They live in rcm_team_group_member so each
	 * membership can carry its immutable home group for rotation. Load them via
	 * RcmTeamGroupMemberRepository.findByRcmTeamGroupId.
	 */

	/**
	 * Position of this group in its team's rotation order. Rotation shifts members
	 * from the group at position n to the group at position n+1, wrapping around.
	 */
	@Column(name = "rotation_order")
	private Integer rotationOrder;

	/**
	 * Match specificity — how <em>narrow</em> this group is. Higher is narrower.
	 *
	 * Used when several groups match one work item: the narrowest wins, with
	 * remaining capacity as the tiebreak. A group naming ENT alone must beat one
	 * naming six departments, so each dimension scores inversely to how many
	 * values it admits — counting values would make broad groups win.
	 *
	 * A dimension left empty is a wildcard and scores 0, so it never out-ranks a
	 * group that constrains that dimension.
	 */
	public int specificity() {
		// A catch-all scores zero on the payer dimension: a group naming the payer
		// explicitly must always win over one that merely accepts anything.
		int payerScore = Boolean.TRUE.equals(payerCatchAll)
				? 0
				: narrowness(payers == null ? 0 : payers.size());
		return narrowness(workItemTypes == null ? 0 : workItemTypes.size())
				+ narrowness(departments == null ? 0 : departments.size())
				+ payerScore
				+ narrowness(claimStatuses == null ? 0 : claimStatuses.size())
				+ (encounterScope != null && encounterScope != RcmTeamEncounterScope.BOTH
						? SCALE : 0);
	}

	/** Scale factor — large enough that one constrained dimension outweighs list-length noise. */
	private static final int SCALE = 100;

	/**
	 * Score for one dimension: 0 when unconstrained, otherwise SCALE/size so that
	 * fewer admitted values scores higher (1 value = 100, 3 = 33, 6 = 16).
	 */
	private static int narrowness(int size) {
		return size == 0 ? 0 : SCALE / size;
	}

	@Override
	public Long getId() {
		return id;
	}
}
