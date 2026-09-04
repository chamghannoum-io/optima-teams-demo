package com.i3hub.optima.domain;

import com.i3hub.optima.graphql.type.TypeRcmTeamUserUnavailability;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import java.time.LocalDate;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.ToString;

@Data
@Entity
@Table(name = "rcm_team_user_unavailability", indexes = {
		@Index(columnList = "rcm_team_id, user_id")
})
@EqualsAndHashCode(callSuper = true)
@ToString(callSuper = true)
public class RcmTeamUserUnavailability extends AbstractAuditingEntity<Long> implements TypeRcmTeamUserUnavailability {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(name = "rcm_team_id", nullable = false)
	private Long rcmTeamId;

	@Column(name = "user_id", nullable = false)
	private Long userId;

	@Column(name = "start_date", nullable = false)
	private LocalDate startDate;

	@Column(name = "end_date", nullable = false)
	private LocalDate endDate;

	@Column(name = "reason", length = 500)
	private String reason;

	@Column(name = "cancelled", nullable = false, columnDefinition = "boolean default false")
	private Boolean cancelled = false;

	@Override
	public Long getId() {
		return id;
	}
}
