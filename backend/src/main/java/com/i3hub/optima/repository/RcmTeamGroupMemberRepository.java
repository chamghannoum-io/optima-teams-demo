package com.i3hub.optima.repository;

import com.i3hub.optima.domain.RcmTeamGroupMember;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface RcmTeamGroupMemberRepository extends JpaRepository<RcmTeamGroupMember, Long> {

	List<RcmTeamGroupMember> findByRcmTeamGroupId(Long rcmTeamGroupId);

	List<RcmTeamGroupMember> findByRcmTeamGroupIdIn(Collection<Long> groupIds);

	List<RcmTeamGroupMember> findByRcmTeamId(Long rcmTeamId);

	List<RcmTeamGroupMember> findByUserId(Long userId);

	Optional<RcmTeamGroupMember> findByRcmTeamGroupIdAndUserId(Long groupId, Long userId);

	void deleteByRcmTeamGroupIdAndUserId(Long groupId, Long userId);

	void deleteByRcmTeamGroupId(Long groupId);

	void deleteByRcmTeamId(Long rcmTeamId);

	/**
	 * Distinct users on a team — the de-duplicated roster that derived capacity is
	 * computed from. A user in three groups appears once.
	 */
	@Query("SELECT DISTINCT m.userId FROM RcmTeamGroupMember m WHERE m.rcmTeamId = :teamId")
	List<Long> findDistinctUserIdsByTeamId(@Param("teamId") Long teamId);

	/** Raw membership count, including duplicates — for the dedup explanation. */
	long countByRcmTeamId(Long rcmTeamId);

	/**
	 * Other teams a user already belongs to, used to build the multi-team warning
	 * when adding them somewhere new.
	 */
	@Query("SELECT DISTINCT m.rcmTeamId FROM RcmTeamGroupMember m "
			+ "WHERE m.userId = :userId AND m.rcmTeamId <> :excludeTeamId")
	List<Long> findOtherTeamIdsForUser(@Param("userId") Long userId,
			@Param("excludeTeamId") Long excludeTeamId);
}
