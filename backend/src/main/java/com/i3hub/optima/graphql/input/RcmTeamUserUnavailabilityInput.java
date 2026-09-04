package com.i3hub.optima.graphql.input;

import com.i3hub.optima.enumeration.RcmTeamUnavailabilityAction;
import java.time.LocalDate;
import lombok.Data;

@Data
public class RcmTeamUserUnavailabilityInput {
	private Long teamId;
	private Long userId;
	private LocalDate startDate;
	private LocalDate endDate;
	private String reason;
	private RcmTeamUnavailabilityAction action;
}
