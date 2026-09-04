package com.i3hub.optima.domain;

import com.i3hub.optima.graphql.type.TypeRcmTeamGroupMember;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.Instant;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.ToString;

/**
 * A user's membership of one group.
 *
 * Membership lives on groups; a team's roster is the de-duplicated union of these
 * rows across its groups. A user may hold several memberships in one team (one per
 * group) — that is exactly the case the de-duplicated team capacity accounts for.
 *
 * {@link #homeGroupId} records where the member started. Rotation moves members
 * between groups by rewriting {@link #rcmTeamGroupId}, leaving the home fixed, so
 * the intended layout is always recoverable and a rotation cycle can be reset.
 */
@Data
@Entity
@Table(name = "rcm_team_group_member",
		uniqueConstraints = @UniqueConstraint(
				name = "uk_group_member",
				columnNames = {"rcm_team_group_id", "user_id"}),
		indexes = {
				@Index(columnList = "rcm_team_group_id"),
				@Index(columnList = "rcm_team_id"),
				@Index(columnList = "user_id")
		})
@EqualsAndHashCode(callSuper = true)
@ToString(callSuper = true)
public class RcmTeamGroupMember extends AbstractAuditingEntity<Long> implements TypeRcmTeamGroupMember {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	/** Group the member currently sits in. Rewritten by rotation. */
	@Column(name = "rcm_team_group_id", nullable = false)
	private Long rcmTeamGroupId;

	/** Denormalised for cheap team-level roster and capacity queries. */
	@Column(name = "rcm_team_id", nullable = false)
	private Long rcmTeamId;

	@Column(name = "user_id", nullable = false)
	private Long userId;

	/**
	 * The group this member was originally placed in. Immutable across rotations —
	 * set once when the membership is created.
	 */
	@Column(name = "home_group_id", nullable = false)
	private Long homeGroupId;

	/** When this member last moved group via rotation. Null if never rotated. */
	@Column(name = "last_rotated_at")
	private Instant lastRotatedAt;

	/** True when the member currently sits somewhere other than their home group. */
	public boolean isRotatedAway() {
		return homeGroupId != null && !homeGroupId.equals(rcmTeamGroupId);
	}

	@Override
	public Long getId() {
		return id;
	}
}
