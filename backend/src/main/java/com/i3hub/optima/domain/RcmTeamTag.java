package com.i3hub.optima.domain;

import com.i3hub.optima.enumeration.TagOperation;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToMany;
import java.util.List;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Table;
import lombok.Data;

@Data
@Entity
@Table(name = "rcm_team_tag", indexes = {
})
public class RcmTeamTag {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(name = "tag", length = 1000)
	private String tag;

	@Column(name = "is_group")
	private Boolean isGroup = false;

	@Enumerated(EnumType.STRING)
	@Column(name = "tag_operation")
	private TagOperation tagOperation;

	@OneToMany(cascade = CascadeType.ALL, orphanRemoval = true)
	@JoinColumn(name = "parent_id")
	private List<RcmTeamTag> tags;

}
