package com.i3hub.optima.service.dto;

import java.util.ArrayList;
import java.util.List;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Projected load per group, plus warnings about a configuration that will not hold.
 *
 * Advisory by default: a WARNING is worth showing but does not stop a save. BLOCKERs
 * describe configurations that guarantee unallocated work — a group with volume and no
 * members, or a PAYER team with no catch-all — and the UI should require an explicit
 * override before continuing.
 */
@Data
@NoArgsConstructor
public class RcmTeamDistributionAdvice {

	public enum Severity {
		/** Work will not be allocated at all under this configuration. */
		BLOCKER,
		/** Will overflow at peak, or is badly unbalanced. */
		WARNING,
		/** Informational. */
		INFO
	}

	/**
	 * One group's projected load.
	 *
	 * @param meanPerDay observed mean daily volume for this group's criteria
	 * @param peakPerDay mean scaled by the facility's P90/P50 burst factor
	 * @param capacity summed member capacity
	 * @param memberCount distinct members
	 */
	public record GroupProjection(Long groupId, String groupName, double meanPerDay,
			double peakPerDay, int capacity, int memberCount) {

		/** Fraction of capacity consumed on an average day; null when uncapped. */
		public Double utilisation() {
			return capacity <= 0 ? null : meanPerDay / capacity;
		}

		public boolean overflowsAtPeak() {
			return capacity > 0 && peakPerDay > capacity;
		}
	}

	@Data
	public static class Finding {
		private Severity severity;
		private Long groupId;
		private String message;

		public Finding(Severity severity, Long groupId, String message) {
			this.severity = severity;
			this.groupId = groupId;
			this.message = message;
		}
	}

	private List<GroupProjection> projections = new ArrayList<>();
	private List<Finding> findings = new ArrayList<>();

	public void add(Severity severity, Long groupId, String message) {
		findings.add(new Finding(severity, groupId, message));
	}

	public boolean hasBlockers() {
		return findings.stream().anyMatch(f -> f.getSeverity() == Severity.BLOCKER);
	}

	public boolean isHealthy() {
		return findings.isEmpty();
	}
}
