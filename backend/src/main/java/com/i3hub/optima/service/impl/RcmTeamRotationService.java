package com.i3hub.optima.service.impl;

import com.i3hub.optima.domain.RcmTeamGroup;
import com.i3hub.optima.domain.RcmTeamGroupMember;
import com.i3hub.optima.domain.RcmTeamV2;
import com.i3hub.optima.repository.RcmTeamGroupMemberRepository;
import com.i3hub.optima.repository.RcmTeamGroupRepository;
import com.i3hub.optima.repository.RcmTeamV2Repository;

import java.time.Instant;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Rotates members between the groups of a team.
 *
 * Each cycle shifts every member one position along their team's group order,
 * wrapping around: a member in the group at rotation order 0 moves to order 1, and
 * the last group's members return to the first.
 *
 * <p><strong>Work in progress is not disturbed.</strong> Rotation only rewrites
 * which group a member sits in, so newly allocated work follows the new group while
 * items already assigned stay with the person until they finish them. This is
 * deliberate: handing back part-done work would reset context for no benefit.
 *
 * <p>Each membership keeps an immutable {@code homeGroupId}, and the team keeps a
 * {@code rotationOffset}. Together they make the current layout reproducible and
 * let a cycle be reset to the original configuration.
 */
@Service
public class RcmTeamRotationService {

	private final RcmTeamV2Repository teamRepository;
	private final RcmTeamGroupRepository groupRepository;
	private final RcmTeamGroupMemberRepository memberRepository;

	public RcmTeamRotationService(RcmTeamV2Repository teamRepository,
			RcmTeamGroupRepository groupRepository,
			RcmTeamGroupMemberRepository memberRepository) {
		this.teamRepository = teamRepository;
		this.groupRepository = groupRepository;
		this.memberRepository = memberRepository;
	}

	/**
	 * Advances the team one rotation step.
	 *
	 * @return how many memberships moved
	 */
	@Transactional
	public int rotate(RcmTeamV2 team) {
		if (!Boolean.TRUE.equals(team.getRotationEnabled())) {
			throw new IllegalStateException("Rotation is not enabled for team " + team.getId());
		}
		List<RcmTeamGroup> groups =
				groupRepository.findByRcmTeamIdAndActiveTrueOrderByRotationOrderAsc(team.getId());
		if (groups.size() < 2) {
			// Nothing to rotate between; still advance the schedule so the next run
			// is not immediately due again.
			touchSchedule(team);
			teamRepository.save(team);
			return 0;
		}

		Map<Long, Integer> indexById = new HashMap<>();
		for (int i = 0; i < groups.size(); i++) {
			indexById.put(groups.get(i).getId(), i);
		}

		List<RcmTeamGroupMember> members = memberRepository.findByRcmTeamId(team.getId());
		Instant now = Instant.now();
		int moved = 0;

		for (RcmTeamGroupMember member : members) {
			Integer current = indexById.get(member.getRcmTeamGroupId());
			if (current == null) {
				// Member sits in an inactive group — leave them where they are.
				continue;
			}
			int next = (current + 1) % groups.size();
			Long nextGroupId = groups.get(next).getId();
			if (!nextGroupId.equals(member.getRcmTeamGroupId())) {
				member.setRcmTeamGroupId(nextGroupId);
				member.setLastRotatedAt(now);
				moved++;
			}
		}

		if (moved > 0) {
			memberRepository.saveAll(members);
		}
		team.setRotationOffset(
				((team.getRotationOffset() == null ? 0 : team.getRotationOffset()) + 1)
						% groups.size());
		touchSchedule(team);
		teamRepository.save(team);
		return moved;
	}

	/**
	 * Returns every member to their home group and clears the offset.
	 *
	 * @return how many memberships moved back
	 */
	@Transactional
	public int resetToHome(RcmTeamV2 team) {
		List<RcmTeamGroupMember> members = memberRepository.findByRcmTeamId(team.getId());
		int moved = 0;
		for (RcmTeamGroupMember member : members) {
			if (member.getHomeGroupId() != null
					&& !member.getHomeGroupId().equals(member.getRcmTeamGroupId())) {
				member.setRcmTeamGroupId(member.getHomeGroupId());
				member.setLastRotatedAt(Instant.now());
				moved++;
			}
		}
		if (moved > 0) {
			memberRepository.saveAll(members);
		}
		team.setRotationOffset(0);
		teamRepository.save(team);
		return moved;
	}

	private void touchSchedule(RcmTeamV2 team) {
		team.setLastRotationAt(Instant.now());
		if (team.getRotationFrequency() != null) {
			team.setNextRotationDate(team.getRotationFrequency().next(LocalDate.now()));
		}
	}

	/** Teams whose next rotation date has arrived. */
	@Transactional(readOnly = true)
	public List<RcmTeamV2> findDueForRotation() {
		return teamRepository.findAll().stream()
				.filter(t -> Boolean.TRUE.equals(t.getRotationEnabled()))
				.filter(t -> Boolean.TRUE.equals(t.getActive()))
				.filter(t -> t.getNextRotationDate() != null
						&& !t.getNextRotationDate().isAfter(LocalDate.now()))
				.toList();
	}
}
