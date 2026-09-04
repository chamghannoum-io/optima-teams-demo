package com.i3hub.optima.domain;

import com.i3hub.optima.enumeration.RcmTeamDivision;
import com.i3hub.optima.enumeration.RcmTeamEncounterScope;
import com.i3hub.optima.enumeration.RcmTeamLogicAxis;
import com.i3hub.optima.graphql.type.TypeRcmTeamV2;

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
import jakarta.persistence.OrderColumn;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.ToString;

/**
 * An RCM team under the v2 allocation model.
 *
 * A team is a <em>container</em> identified by facility × division × encounter
 * scope. It holds no matching tags of its own: its {@link RcmTeamGroup}s carry the
 * criteria and the members. Examples:
 *
 * <pre>
 *   Dubai × AUTH × OP
 *     ├── AUTH_RESUBMISSION — ENT, ICU, GYN
 *     ├── AUTH_RESUBMISSION — Cardiology, Emergency, Dental
 *     ├── AUTH_SUBMISSION
 *     └── AUTH_SUBMISSION + AUTH_RESUBMISSION
 * </pre>
 *
 * Invariants enforced in RcmTeamV2ServiceImpl:
 * <ul>
 *   <li>every group's work item types belong to this team's {@link #division} —
 *       AUTH and CLAIM are never mixed;</li>
 *   <li>every group's encounter scope is covered by {@link #encounterScope};</li>
 *   <li>groups populate departments or payers according to {@link #logicAxis},
 *       never both.</li>
 * </ul>
 *
 * Capacity is <strong>derived</strong>, never stored — see
 * RcmTeamV2Service#capacityOf. It is the summed capacity of the team's
 * de-duplicated members, so a user in three groups is counted once.
 */
@Data
@Entity
@Table(name = "rcm_team_v2", indexes = {
		@Index(columnList = "is_active"),
		@Index(columnList = "name"),
		@Index(columnList = "vendor_id"),
		@Index(columnList = "facility_id"),
		@Index(columnList = "division")
})
@EqualsAndHashCode(callSuper = true)
@ToString(callSuper = true)
public class RcmTeamV2 extends AbstractAuditingEntity<Long> implements TypeRcmTeamV2 {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(name = "vendor_id")
	private Long vendorId;

	@Column(name = "name", nullable = false)
	private String name;

	@Column(name = "name_ar")
	private String nameAr;

	@Column(name = "description", columnDefinition = "TEXT")
	private String description;

	@Column(name = "is_active", columnDefinition = "boolean default true")
	private Boolean active = Boolean.TRUE;

	/**
	 * Facility this team serves, as a health licence. Together with division and
	 * encounter scope this is the team's identity.
	 */
	@Column(name = "facility_id", length = 120)
	private String facilityId;

	/** AUTH or CLAIM. A team never handles both. */
	@Enumerated(EnumType.STRING)
	@Column(name = "division", length = 10, nullable = false)
	private RcmTeamDivision division;

	/**
	 * OP, IP, or BOTH. A facility may run one BOTH team, or two teams split by
	 * encounter — both layouts are supported.
	 */
	@Enumerated(EnumType.STRING)
	@Column(name = "encounter_scope", length = 10, nullable = false)
	private RcmTeamEncounterScope encounterScope = RcmTeamEncounterScope.BOTH;

	/**
	 * Whether this team's groups split by DEPARTMENT or by PAYER. Inherited by all
	 * groups; when DEPARTMENT, payers are implicitly all.
	 */
	@Enumerated(EnumType.STRING)
	@Column(name = "logic_axis", length = 20, nullable = false)
	private RcmTeamLogicAxis logicAxis = RcmTeamLogicAxis.DEPARTMENT;

	/**
	 * Net-value threshold above which an item is flagged as high cost for this
	 * team. When null the allocation run falls back to the 95th percentile of the
	 * run's values, matching v1 behaviour.
	 */
	@Column(name = "high_cost_threshold")
	private Double highCostThreshold;

	@ElementCollection
	@CollectionTable(name = "rcm_team_v2_branch", joinColumns = @JoinColumn(name = "rcm_team_id"))
	@OrderColumn(name = "sort_order")
	@Column(name = "branch_id")
	private List<Long> branchIds = new ArrayList<>();

	/*
	 * Groups are loaded via RcmTeamGroupRepository.findByRcmTeamIdOrderByRotationOrder
	 * rather than mapped here, to keep team loads cheap — a team's groups pull in
	 * their own element collections.
	 */

	@Column(name = "rotation_enabled", columnDefinition = "boolean default false")
	private Boolean rotationEnabled = Boolean.FALSE;

	@Enumerated(EnumType.STRING)
	@Column(name = "rotation_frequency", length = 20)
	private RotationFrequency rotationFrequency;

	@Column(name = "next_rotation_date")
	private LocalDate nextRotationDate;

	@Column(name = "last_rotation_at")
	private Instant lastRotationAt;

	/**
	 * How many positions members have shifted from their home group. Incremented
	 * each rotation; with it and the home group, a member's current group is fully
	 * determined, so a cycle can be replayed or reset.
	 */
	@Column(name = "rotation_offset", columnDefinition = "integer default 0")
	private Integer rotationOffset = 0;

	@Override
	public Long getId() {
		return id;
	}
}
