package com.i3hub.optima.domain;

import com.i3hub.optima.graphql.type.TypeRcmTeam;

import jakarta.persistence.CascadeType;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderColumn;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.ToString;

@Data
@Entity
@Table(name = "rcm_team", indexes = {
		@Index(columnList = "is_active"),
		@Index(columnList = "name"),
		@Index(columnList = "vendor_id")
})
@EqualsAndHashCode(callSuper = true)
@ToString(callSuper = true)
public class RcmTeam extends AbstractAuditingEntity<Long> implements TypeRcmTeam {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(name = "vendor_id")
	private Long vendorId;

	@Column(name = "name", nullable = false)
	private String name;

	@Column(name = "tag", length = 1000)
	private String tag;

	@OneToMany(cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
	@JoinColumn(name = "rcm_team_id")
	private List<RcmTeamTag> tags = new ArrayList<>();

	@Column(name = "name_ar")
	private String nameAr;

	@Column(name = "description", columnDefinition = "TEXT")
	private String description;

	@Column(name = "is_active", columnDefinition = "boolean default true")
	private Boolean active;

	@Column(name = "rotation_enabled", columnDefinition = "boolean default false")
	private Boolean rotationEnabled;

	@Enumerated(EnumType.STRING)
	@Column(name = "rotation_frequency", length = 20)
	private RotationFrequency rotationFrequency;

	@Column(name = "next_rotation_date")
	private LocalDate nextRotationDate;

	@Column(name = "rotation_pointer")
	private Long rotationPointer;

	@Column(name = "last_rotation_at")
	private Instant lastRotationAt;

	@ElementCollection
	@CollectionTable(name = "rcm_team_user", joinColumns = @JoinColumn(name = "rcm_team_id"))
	@Column(name = "user_id")
	private List<Long> users = new ArrayList<>();

	@ElementCollection
	@CollectionTable(name = "rcm_team_branch", joinColumns = @JoinColumn(name = "rcm_team_id"))
	@OrderColumn(name = "sort_order")
	@Column(name = "branch_id")
	private List<Long> branchIds = new ArrayList<>();

	@Override
	public Long getId() {
		return id;
	}
}
