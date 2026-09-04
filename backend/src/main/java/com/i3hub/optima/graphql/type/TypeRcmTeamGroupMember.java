package com.i3hub.optima.graphql.type;

import java.time.Instant;

public interface TypeRcmTeamGroupMember {
	Long getId();
	Long getRcmTeamGroupId();
	Long getRcmTeamId();
	Long getUserId();
	Long getHomeGroupId();
	Instant getLastRotatedAt();
}
