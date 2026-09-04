package com.i3hub.optima.domain;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class RcmTeamUserUnavailabilityTest {

	private RcmTeamUserUnavailability window(LocalDate start, LocalDate end, boolean cancelled) {
		RcmTeamUserUnavailability unavailability = new RcmTeamUserUnavailability();
		unavailability.setStartDate(start);
		unavailability.setEndDate(end);
		unavailability.setCancelled(cancelled);
		return unavailability;
	}

	@Test
	void activeToday_trueWhenTodayInsideWindow() {
		LocalDate today = LocalDate.now();
		assertTrue(window(today.minusDays(1), today.plusDays(1), false).getActiveToday());
		assertTrue(window(today, today, false).getActiveToday());
	}

	@Test
	void activeToday_falseOutsideWindow() {
		LocalDate today = LocalDate.now();
		assertFalse(window(today.plusDays(1), today.plusDays(5), false).getActiveToday());
		assertFalse(window(today.minusDays(5), today.minusDays(1), false).getActiveToday());
	}

	@Test
	void activeToday_falseWhenCancelled() {
		LocalDate today = LocalDate.now();
		assertFalse(window(today.minusDays(1), today.plusDays(1), true).getActiveToday());
	}
}
