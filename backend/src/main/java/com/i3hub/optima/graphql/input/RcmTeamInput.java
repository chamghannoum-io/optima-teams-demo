package com.i3hub.optima.graphql.input;

import com.i3hub.optima.domain.RotationFrequency;
import java.util.List;
import lombok.Data;

@Data
public class RcmTeamInput {
	private String name;
	private String tag;
	private List<RcmTeamTagInput> tags;
	private String nameAr;
	private String description;
	private Boolean active;
	private Boolean rotationEnabled;
	private RotationFrequency rotationFrequency;
	private List<Long> users;
	private List<Long> branchIds;
}
