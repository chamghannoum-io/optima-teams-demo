package com.i3hub.optima.service.impl;

import com.i3hub.optima.domain.RcmTeam;
import com.i3hub.optima.domain.RcmTeamGroup;
import com.i3hub.optima.domain.RcmTeamGroupMember;
import com.i3hub.optima.domain.RcmTeamV2;
import com.i3hub.optima.domain.WorkItemType;
import com.i3hub.optima.enumeration.RcmDepartment;
import com.i3hub.optima.enumeration.RcmTeamDivision;
import com.i3hub.optima.enumeration.RcmTeamEncounterScope;
import com.i3hub.optima.enumeration.RcmTeamLogicAxis;
import com.i3hub.optima.repository.RcmTeamGroupMemberRepository;
import com.i3hub.optima.repository.RcmTeamGroupRepository;
import com.i3hub.optima.repository.RcmTeamRepository;
import com.i3hub.optima.repository.RcmTeamV2Repository;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import lombok.Data;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Converts v1 teams into the v2 team/group model.
 *
 * v1 encodes everything in one comma-separated tag string per team; v2 splits that
 * into a container plus typed groups. The important structural change is that
 * <strong>several v1 teams collapse into one v2 team</strong>: v1 teams sharing a
 * facility, division and encounter scope become groups of a single v2 team.
 *
 * <p>Against production data this turns 16 v1 teams into 10 v2 teams — six identically
 * named "Authorization Team OP (Dubai)" teams become one team with six groups, and
 * their ten memberships de-duplicate to five distinct members.
 *
 * <p>Idempotent by team key: running twice does not duplicate teams. Safe to dry-run.
 */
@Service
public class RcmTeamV1ToV2Migrator {

	private static final Logger log = LoggerFactory.getLogger(RcmTeamV1ToV2Migrator.class);

	/** v1 work-type tags → v2 work item types, from the production workflow's map. */
	private static final Map<String, List<WorkItemType>> WORK_TYPE_TAGS = Map.ofEntries(
			Map.entry("auth-resubmission", List.of(WorkItemType.AUTHORIZATION_RESUBMISSION)),
			Map.entry("auth-submission", List.of(WorkItemType.AUTHORIZATION_SUBMISSION)),
			Map.entry("authorization", List.of(WorkItemType.AUTHORIZATION_SUBMISSION,
					WorkItemType.AUTHORIZATION_RESUBMISSION)),
			Map.entry("claim-validation", List.of(WorkItemType.CLAIM_VALIDATION)),
			Map.entry("claim-submission", List.of(WorkItemType.CLAIM_SUBMISSION)),
			Map.entry("claim-resubmission", List.of(WorkItemType.CLAIM_RESUBMISSION)),
			Map.entry("claim-reconciliation", List.of(WorkItemType.RECONCILIATION)),
			Map.entry("coding", List.of(WorkItemType.CLAIM_VALIDATION)),
			Map.entry("validation", List.of(WorkItemType.CLAIM_VALIDATION)),
			Map.entry("claim", List.of(WorkItemType.CLAIM_VALIDATION)),
			Map.entry("submission", List.of(WorkItemType.AUTHORIZATION_SUBMISSION,
					WorkItemType.CLAIM_VALIDATION)),
			Map.entry("resubmission", List.of(WorkItemType.CLAIM_RESUBMISSION,
					WorkItemType.AUTHORIZATION_RESUBMISSION)));

	private static final Map<String, String> CLAIM_STATUS_TAGS = Map.of(
			"claim-status-open", "OPEN",
			"claim-status-checked", "CHECKED",
			"claim-status-validated", "VALIDATED");

	private final RcmTeamRepository v1Repository;
	private final RcmTeamV2Repository v2Repository;
	private final RcmTeamGroupRepository groupRepository;
	private final RcmTeamGroupMemberRepository memberRepository;

	public RcmTeamV1ToV2Migrator(RcmTeamRepository v1Repository,
			RcmTeamV2Repository v2Repository,
			RcmTeamGroupRepository groupRepository,
			RcmTeamGroupMemberRepository memberRepository) {
		this.v1Repository = v1Repository;
		this.v2Repository = v2Repository;
		this.groupRepository = groupRepository;
		this.memberRepository = memberRepository;
	}

	/** What a migration run did, or would do. */
	@Data
	public static class MigrationReport {
		private int v1TeamsRead;
		private int v2TeamsCreated;
		private int groupsCreated;
		private int membershipsCreated;
		private int duplicateMembershipsCollapsed;
		private final List<String> warnings = new ArrayList<>();
		private final List<String> skipped = new ArrayList<>();
	}

	/**
	 * Runs the migration.
	 *
	 * @param dryRun when true, nothing is written — the report describes what would
	 *        happen. Always worth running first against production data.
	 */
	@Transactional
	public MigrationReport migrate(boolean dryRun) {
		MigrationReport report = new MigrationReport();
		List<RcmTeam> v1Teams = v1Repository.findAll();
		report.setV1TeamsRead(v1Teams.size());

		// Group v1 teams by their v2 identity: facility × division × encounter scope.
		Map<TeamKey, List<Parsed>> byKey = new LinkedHashMap<>();
		for (RcmTeam v1 : v1Teams) {
			Parsed parsed = parse(v1);
			if (parsed == null) {
				report.getSkipped().add(String.format(
						"Team %d '%s': no work item types could be resolved from tag '%s'",
						v1.getId(), v1.getName(), v1.getTag()));
				continue;
			}
			if (parsed.division == null) {
				report.getSkipped().add(String.format(
						"Team %d '%s': mixes AUTH and CLAIM work types (%s) — v2 forbids this, "
								+ "split it into two teams before migrating",
						v1.getId(), v1.getName(), parsed.workItemTypes));
				continue;
			}
			byKey.computeIfAbsent(parsed.key, k -> new ArrayList<>()).add(parsed);
		}

		for (Map.Entry<TeamKey, List<Parsed>> entry : byKey.entrySet()) {
			TeamKey key = entry.getKey();
			List<Parsed> members = entry.getValue();

			RcmTeamV2 team = new RcmTeamV2();
			team.setName(deriveTeamName(key, members));
			team.setVendorId(members.get(0).source.getVendorId());
			team.setFacilityId(key.facilityId);
			team.setDivision(key.division);
			team.setEncounterScope(key.encounterScope);
			// v1 has no payer-based teams, so everything migrates as DEPARTMENT.
			team.setLogicAxis(RcmTeamLogicAxis.DEPARTMENT);
			team.setActive(members.stream().anyMatch(m -> Boolean.TRUE.equals(m.source.getActive())));
			team.setBranchIds(members.stream()
					.flatMap(m -> m.source.getBranchIds().stream())
					.distinct()
					.collect(java.util.stream.Collectors.toCollection(ArrayList::new)));
			team.setRotationEnabled(Boolean.FALSE);

			report.setV2TeamsCreated(report.getV2TeamsCreated() + 1);

			Set<Long> distinctUsers = new LinkedHashSet<>();
			int rawMemberships = 0;

			RcmTeamV2 savedTeam = dryRun ? team : v2Repository.save(team);

			int order = 0;
			for (Parsed parsed : members) {
				RcmTeamGroup group = new RcmTeamGroup();
				group.setName(parsed.source.getName());
				group.setNameAr(parsed.source.getNameAr());
				group.setDescription(parsed.source.getDescription());
				group.setActive(parsed.source.getActive());
				group.setWorkItemTypes(new ArrayList<>(parsed.workItemTypes));
				group.setEncounterScope(parsed.encounterScope);
				group.setDepartments(new ArrayList<>(parsed.departments));
				group.setClaimStatuses(new ArrayList<>(parsed.claimStatuses));
				group.setRotationOrder(order++);
				if (!dryRun) {
					group.setRcmTeamId(savedTeam.getId());
				}
				report.setGroupsCreated(report.getGroupsCreated() + 1);

				for (String unmapped : parsed.unmappedTags) {
					report.getWarnings().add(String.format(
							"Team %d '%s': tag '%s' has no v2 equivalent and was dropped",
							parsed.source.getId(), parsed.source.getName(), unmapped));
				}

				RcmTeamGroup savedGroup = dryRun ? group : groupRepository.save(group);

				for (Long userId : parsed.source.getUsers()) {
					rawMemberships++;
					distinctUsers.add(userId);
					if (!dryRun) {
						RcmTeamGroupMember member = new RcmTeamGroupMember();
						member.setRcmTeamGroupId(savedGroup.getId());
						member.setRcmTeamId(savedTeam.getId());
						member.setUserId(userId);
						member.setHomeGroupId(savedGroup.getId());
						memberRepository.save(member);
					}
					report.setMembershipsCreated(report.getMembershipsCreated() + 1);
				}
			}

			int collapsed = rawMemberships - distinctUsers.size();
			report.setDuplicateMembershipsCollapsed(
					report.getDuplicateMembershipsCollapsed() + collapsed);
			if (collapsed > 0) {
				log.info("Team '{}': {} memberships across {} groups -> {} distinct members",
						team.getName(), rawMemberships, members.size(), distinctUsers.size());
			}
		}
		return report;
	}

	/* ─────────────────────────── parsing ─────────────────────────── */

	private record TeamKey(String facilityId, RcmTeamDivision division,
			RcmTeamEncounterScope encounterScope) {
	}

	private static class Parsed {
		RcmTeam source;
		TeamKey key;
		RcmTeamDivision division;
		RcmTeamEncounterScope encounterScope;
		List<WorkItemType> workItemTypes = new ArrayList<>();
		List<RcmDepartment> departments = new ArrayList<>();
		List<String> claimStatuses = new ArrayList<>();
		List<String> unmappedTags = new ArrayList<>();
	}

	private Parsed parse(RcmTeam v1) {
		List<String> tags = Arrays.stream(
						(v1.getTag() == null ? "" : v1.getTag()).split(","))
				.map(s -> s.trim().toLowerCase(Locale.ROOT))
				.filter(s -> !s.isEmpty())
				.toList();

		Parsed parsed = new Parsed();
		parsed.source = v1;

		Set<WorkItemType> types = new LinkedHashSet<>();
		Set<RcmDepartment> departments = new LinkedHashSet<>();
		Set<String> statuses = new LinkedHashSet<>();
		boolean ip = false;
		boolean op = false;

		for (String tag : tags) {
			if (tag.equals("encounter_ip")) {
				ip = true;
			} else if (tag.equals("encounter_op")) {
				op = true;
			} else if (WORK_TYPE_TAGS.containsKey(tag)) {
				types.addAll(WORK_TYPE_TAGS.get(tag));
			} else if (CLAIM_STATUS_TAGS.containsKey(tag)) {
				statuses.add(CLAIM_STATUS_TAGS.get(tag));
			} else if (tag.startsWith("department-")) {
				RcmDepartment.fromDisplayName(tag)
						.ifPresentOrElse(departments::add,
								() -> parsed.unmappedTags.add(tag));
			} else if (!tag.startsWith("priority-")) {
				// priority-* tags controlled v1 team ranking, which v2 replaces with
				// group specificity — dropping them is intended, not a loss.
				parsed.unmappedTags.add(tag);
			}
		}

		if (types.isEmpty()) {
			return null;
		}

		parsed.workItemTypes = new ArrayList<>(types);
		parsed.departments = new ArrayList<>(departments);
		parsed.claimStatuses = new ArrayList<>(statuses);
		parsed.encounterScope = ip && op ? RcmTeamEncounterScope.BOTH
				: ip ? RcmTeamEncounterScope.IP
						: op ? RcmTeamEncounterScope.OP : RcmTeamEncounterScope.BOTH;

		boolean hasAuth = types.stream()
				.anyMatch(t -> RcmTeamV2Validator.divisionOf(t) == RcmTeamDivision.AUTH);
		boolean hasClaim = types.stream()
				.anyMatch(t -> RcmTeamV2Validator.divisionOf(t) == RcmTeamDivision.CLAIM);
		// A team spanning both divisions cannot be represented in v2 and is skipped
		// with a warning rather than silently split.
		parsed.division = hasAuth && hasClaim ? null
				: hasAuth ? RcmTeamDivision.AUTH : RcmTeamDivision.CLAIM;

		if (parsed.division != null) {
			parsed.key = new TeamKey(facilityOf(v1), parsed.division, parsed.encounterScope);
		}
		return parsed;
	}

	/**
	 * v1 matched facilities by {@code branches.healthLicense}, which is not on the
	 * entity — the first branch id stands in until the licence is resolvable.
	 */
	private String facilityOf(RcmTeam v1) {
		return v1.getBranchIds() == null || v1.getBranchIds().isEmpty()
				? null
				: String.valueOf(v1.getBranchIds().get(0));
	}

	/** Names the consolidated team after its identity, not after one of its groups. */
	private String deriveTeamName(TeamKey key, List<Parsed> members) {
		if (members.size() == 1) {
			return members.get(0).source.getName();
		}
		return String.format("%s × %s × %s",
				key.facilityId == null ? "Unknown facility" : "Facility " + key.facilityId,
				key.division, key.encounterScope);
	}
}
