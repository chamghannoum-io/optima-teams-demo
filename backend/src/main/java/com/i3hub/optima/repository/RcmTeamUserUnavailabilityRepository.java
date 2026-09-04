package com.i3hub.optima.repository;

import com.i3hub.optima.domain.RcmTeamUserUnavailability;
import java.time.LocalDate;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface RcmTeamUserUnavailabilityRepository extends JpaRepository<RcmTeamUserUnavailability, Long> {

	List<RcmTeamUserUnavailability> findByRcmTeamIdAndCancelledFalseAndEndDateGreaterThanEqual(Long rcmTeamId, LocalDate date);

	// Overlap check: existing.startDate <= windowEnd AND existing.endDate >= windowStart
	boolean existsByRcmTeamIdAndUserIdAndCancelledFalseAndStartDateLessThanEqualAndEndDateGreaterThanEqual(
			Long rcmTeamId, Long userId, LocalDate windowEnd, LocalDate windowStart);
}
