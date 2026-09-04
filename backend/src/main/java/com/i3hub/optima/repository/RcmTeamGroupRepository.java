package com.i3hub.optima.repository;

import com.i3hub.optima.domain.RcmTeamGroup;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RcmTeamGroupRepository extends JpaRepository<RcmTeamGroup, Long> {

	List<RcmTeamGroup> findByRcmTeamIdOrderByRotationOrderAsc(Long rcmTeamId);

	List<RcmTeamGroup> findByRcmTeamIdInOrderByRotationOrderAsc(Collection<Long> rcmTeamIds);

	List<RcmTeamGroup> findByRcmTeamIdAndActiveTrueOrderByRotationOrderAsc(Long rcmTeamId);

	void deleteByRcmTeamId(Long rcmTeamId);

	long countByRcmTeamId(Long rcmTeamId);
}
