package com.i3hub.optima.service.dto;

import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * One group's share of a recommended payer split.
 *
 * High-volume payers are named explicitly; the long tail is absorbed by the groups
 * flagged {@link #catchAll}, so no single group becomes the dumping ground.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class RcmTeamPayerPlan {
	private Long groupId;
	private String groupName;
	private List<Long> namedPayers;
	private boolean catchAll;
	private double projectedPerDay;
}
