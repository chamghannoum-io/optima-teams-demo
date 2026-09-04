package com.i3hub.optima.graphql.input;

import com.i3hub.optima.enumeration.TagOperation;
import java.util.List;
import lombok.Data;

@Data
public class RcmTeamTagInput {
	private String tag;
	private Boolean isGroup;
	private TagOperation tagOperation;
	private List<RcmTeamTagInput> tags;
}
