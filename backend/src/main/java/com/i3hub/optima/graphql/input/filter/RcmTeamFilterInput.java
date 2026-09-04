package com.i3hub.optima.graphql.input.filter;

import java.util.Set;
import lombok.Data;

@Data
public class RcmTeamFilterInput {
	private Set<Long> ids;
	private String name;
	private String tag;
	private Boolean active;
	private Set<Long> branchIds;
	private Long vendorId;
}
