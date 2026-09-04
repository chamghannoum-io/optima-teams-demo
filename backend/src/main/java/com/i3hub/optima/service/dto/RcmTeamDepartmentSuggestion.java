package com.i3hub.optima.service.dto;

import com.i3hub.optima.enumeration.RcmDepartment;
import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/** One group's share of a suggested department distribution. */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class RcmTeamDepartmentSuggestion {
	private Long groupId;
	private String groupName;
	private List<RcmDepartment> departments;
}
