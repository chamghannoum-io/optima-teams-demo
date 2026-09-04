package com.i3hub.optima.graphql.type;

import java.time.Instant;
import java.time.LocalDate;

public interface TypeRcmTeamUserUnavailability {
	Long getId();
	Long getRcmTeamId();
	Long getUserId();
	LocalDate getStartDate();
	LocalDate getEndDate();
	String getReason();
	Boolean getCancelled();
	String getCreatedBy();
	Instant getCreatedDate();

	default Boolean getActiveToday() {
		LocalDate today = LocalDate.now();
		return !Boolean.TRUE.equals(getCancelled())
				&& getStartDate() != null && getEndDate() != null
				&& !today.isBefore(getStartDate()) && !today.isAfter(getEndDate());
	}
}
