package com.i3hub.optima.service.impl;

import com.i3hub.optima.domain.RcmTeamGroup;
import com.i3hub.optima.enumeration.RcmDepartment;
import com.i3hub.optima.service.dto.RcmTeamDistributionAdvice;
import com.i3hub.optima.service.dto.RcmTeamDistributionAdvice.GroupProjection;
import com.i3hub.optima.service.dto.RcmTeamDistributionAdvice.Severity;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;

/**
 * Recommends how to split departments and payers across a team's groups, and warns
 * when a proposed split will overload someone.
 *
 * Both halves are driven by observed daily volume rather than by counting items:
 * splitting 18 departments 6/6/6 looks balanced but is not, because Internal Medicine
 * alone is ~24% of volume at most sites while the tail is under one item a day. The
 * advisor packs by volume so groups end up with comparable <em>work</em>.
 *
 * The warnings are the point of the feature: a configuration that looks fine in the UI
 * can quietly guarantee overflow once the nightly run starts, and that only surfaces
 * as unallocated work days later.
 */
@Service
public class RcmTeamDistributionAdvisor {

	/**
	 * Observed daily arrival volume, so recommendations reflect what actually turns
	 * up rather than an even count of labels.
	 */
	public interface VolumeSource {

		/** Mean items per day per department at a facility. */
		Map<RcmDepartment, Double> departmentVolumes(String facilityId);

		/** Mean items per day per payer at a facility. */
		Map<Long, Double> payerVolumes(String facilityId);

		/**
		 * Peak-to-median ratio for the facility (P90/P50). Claims batch heavily —
		 * observed between 1.16 and 4.66 — so a group sized to the median will
		 * overflow on a busy day. Used to project peak load.
		 */
		double burstFactor(String facilityId);
	}

	private final VolumeSource volumeSource;
	private final RcmTeamCapacityService capacityService;

	public RcmTeamDistributionAdvisor(VolumeSource volumeSource,
			RcmTeamCapacityService capacityService) {
		this.volumeSource = volumeSource;
		this.capacityService = capacityService;
	}

	/** Payers at or above this daily volume are named explicitly; the rest are tail. */
	public static final double NAMED_PAYER_THRESHOLD_PER_DAY = 10.0;

	/* ────────────────────── recommendation ────────────────────── */

	/**
	 * Distributes departments across groups by volume, using longest-processing-time
	 * first: heaviest department into the lightest group. Departments already
	 * assigned stay put, so a partly built team is topped up rather than rearranged.
	 */
	public Map<Long, List<RcmDepartment>> recommendDepartments(String facilityId,
			List<RcmTeamGroup> groups) {

		Map<RcmDepartment, Double> volumes = volumeSource.departmentVolumes(facilityId);
		List<RcmTeamGroup> active = activeGroups(groups);
		if (active.isEmpty()) {
			return Map.of();
		}

		Map<Long, List<RcmDepartment>> result = new LinkedHashMap<>();
		Map<Long, Double> load = new HashMap<>();
		Set<RcmDepartment> assigned = new java.util.HashSet<>();

		for (RcmTeamGroup group : active) {
			List<RcmDepartment> existing = new ArrayList<>(
					group.getDepartments() == null ? List.of() : group.getDepartments());
			result.put(group.getId(), existing);
			load.put(group.getId(), existing.stream()
					.mapToDouble(d -> volumes.getOrDefault(d, 0.0)).sum());
			assigned.addAll(existing);
		}

		volumes.entrySet().stream()
				.filter(e -> !assigned.contains(e.getKey()))
				.sorted(Map.Entry.<RcmDepartment, Double>comparingByValue().reversed())
				.forEach(e -> {
					Long target = lightest(load);
					result.get(target).add(e.getKey());
					load.merge(target, e.getValue(), Double::sum);
				});
		return result;
	}

	/**
	 * Distributes payers: those at or above {@link #NAMED_PAYER_THRESHOLD_PER_DAY}
	 * are named explicitly and packed by volume; every group is then marked a
	 * catch-all so the long tail is shared rather than falling to one group.
	 *
	 * At the busiest observed site this yields groups within 2% of each other.
	 */
	public PayerPlan recommendPayers(String facilityId, List<RcmTeamGroup> groups) {
		Map<Long, Double> volumes = volumeSource.payerVolumes(facilityId);
		List<RcmTeamGroup> active = activeGroups(groups);
		if (active.isEmpty()) {
			return new PayerPlan(Map.of(), List.of(), 0, 0);
		}

		Map<Long, List<Long>> named = new LinkedHashMap<>();
		Map<Long, Double> load = new HashMap<>();
		for (RcmTeamGroup group : active) {
			named.put(group.getId(), new ArrayList<>());
			load.put(group.getId(), 0.0);
		}

		List<Map.Entry<Long, Double>> head = volumes.entrySet().stream()
				.filter(e -> e.getValue() >= NAMED_PAYER_THRESHOLD_PER_DAY)
				.sorted(Map.Entry.<Long, Double>comparingByValue().reversed())
				.toList();

		for (Map.Entry<Long, Double> entry : head) {
			Long target = lightest(load);
			named.get(target).add(entry.getKey());
			load.merge(target, entry.getValue(), Double::sum);
		}

		double tailVolume = volumes.entrySet().stream()
				.filter(e -> e.getValue() < NAMED_PAYER_THRESHOLD_PER_DAY)
				.mapToDouble(Map.Entry::getValue).sum();
		int tailCount = (int) volumes.values().stream()
				.filter(v -> v < NAMED_PAYER_THRESHOLD_PER_DAY).count();

		// Every group shares the tail, so no group becomes the dumping ground.
		return new PayerPlan(named, active.stream().map(RcmTeamGroup::getId).toList(),
				tailCount, tailVolume);
	}

	/** Named payers per group, plus which groups absorb the tail. */
	public record PayerPlan(Map<Long, List<Long>> namedPayersByGroup,
			List<Long> catchAllGroupIds, int tailPayerCount, double tailVolumePerDay) {
	}

	/* ────────────────────── overflow warnings ────────────────────── */

	/**
	 * Projects each group's daily load against its capacity and reports where the
	 * configuration will not hold.
	 *
	 * Checks, in order of how much they cost when missed:
	 * <ul>
	 *   <li>a group with volume but no members — that work can never be assigned;</li>
	 *   <li>projected peak above capacity — overflow on busy days;</li>
	 *   <li>mean above capacity — permanent backlog, not just spikes;</li>
	 *   <li>badly uneven load between groups.</li>
	 * </ul>
	 */
	public RcmTeamDistributionAdvice analyse(com.i3hub.optima.domain.RcmTeamV2 team,
			List<RcmTeamGroup> groups) {

		RcmTeamDistributionAdvice advice = new RcmTeamDistributionAdvice();
		List<RcmTeamGroup> active = activeGroups(groups);
		if (active.isEmpty()) {
			return advice;
		}

		String facilityId = team.getFacilityId();
		Map<RcmDepartment, Double> deptVolumes = volumeSource.departmentVolumes(facilityId);
		Map<Long, Double> payerVolumes = volumeSource.payerVolumes(facilityId);
		double burst = Math.max(1.0, volumeSource.burstFactor(facilityId));

		double tailVolume = payerVolumes.entrySet().stream()
				.filter(e -> e.getValue() < NAMED_PAYER_THRESHOLD_PER_DAY)
				.mapToDouble(Map.Entry::getValue).sum();
		long catchAllCount = active.stream()
				.filter(g -> Boolean.TRUE.equals(g.getPayerCatchAll())).count();

		for (RcmTeamGroup group : active) {
			double mean = switch (team.getLogicAxis()) {
				case DEPARTMENT -> (group.getDepartments() == null ? List.<RcmDepartment>of()
						: group.getDepartments()).stream()
						.mapToDouble(d -> deptVolumes.getOrDefault(d, 0.0)).sum();
				case PAYER -> {
					double named = (group.getPayers() == null ? List.<Long>of()
							: group.getPayers()).stream()
							.mapToDouble(p -> payerVolumes.getOrDefault(p, 0.0)).sum();
					// The tail is split evenly between the catch-all groups.
					yield named + (Boolean.TRUE.equals(group.getPayerCatchAll()) && catchAllCount > 0
							? tailVolume / catchAllCount : 0.0);
				}
			};

			int capacity = capacityService.forGroup(team, group).getTotalCapacity();
			int members = capacityService.forGroup(team, group).getMemberCount();
			double peak = mean * burst;

			advice.getProjections().add(new GroupProjection(group.getId(), group.getName(),
					round(mean), round(peak), capacity, members));

			if (mean > 0 && members == 0) {
				advice.add(Severity.BLOCKER, group.getId(), String.format(
						"Group '%s' is projected %.0f items/day but has no members — that work "
								+ "cannot be assigned to anyone.",
						group.getName(), mean));
			} else if (capacity > 0 && mean > capacity) {
				advice.add(Severity.BLOCKER, group.getId(), String.format(
						"Group '%s' is projected %.0f items/day against capacity %d. This "
								+ "overflows every day, not just at peak — move some %s to "
								+ "another group or add members.",
						group.getName(), mean, capacity,
						team.getLogicAxis() == com.i3hub.optima.enumeration.RcmTeamLogicAxis.DEPARTMENT
								? "departments" : "payers"));
			} else if (capacity > 0 && peak > capacity) {
				advice.add(Severity.WARNING, group.getId(), String.format(
						"Group '%s' fits on an average day (%.0f/day against capacity %d) but is "
								+ "projected %.0f at peak — busy days will overflow.",
						group.getName(), mean, capacity, peak));
			}
		}

		// Uneven load between groups, judged on mean volume.
		List<GroupProjection> withLoad = advice.getProjections().stream()
				.filter(p -> p.meanPerDay() > 0).toList();
		if (withLoad.size() > 1) {
			double max = withLoad.stream().mapToDouble(GroupProjection::meanPerDay).max().orElse(0);
			double min = withLoad.stream().mapToDouble(GroupProjection::meanPerDay).min().orElse(0);
			if (min > 0 && max / min >= 2.0) {
				advice.add(Severity.WARNING, null, String.format(
						"Load is uneven: the busiest group is projected %.0f items/day and the "
								+ "quietest %.0f (%.1fx). Rebalancing would even out the queues.",
						max, min, max / min));
			}
		}

		// A PAYER team with no catch-all silently drops unnamed and new payers.
		if (team.getLogicAxis() == com.i3hub.optima.enumeration.RcmTeamLogicAxis.PAYER
				&& catchAllCount == 0) {
			Set<Long> namedPayers = active.stream()
					.flatMap(g -> (g.getPayers() == null ? List.<Long>of() : g.getPayers()).stream())
					.collect(Collectors.toSet());
			long unnamed = payerVolumes.keySet().stream()
					.filter(p -> !namedPayers.contains(p)).count();
			if (unnamed > 0) {
				advice.add(Severity.BLOCKER, null, String.format(
						"%d payers seen at this facility are not named by any group, and no group "
								+ "is a catch-all — their work will not be allocated. Mark at least "
								+ "one group as a catch-all.",
						unnamed));
			}
		}
		return advice;
	}

	/* ────────────────────── helpers ────────────────────── */

	private static List<RcmTeamGroup> activeGroups(List<RcmTeamGroup> groups) {
		return groups.stream().filter(g -> Boolean.TRUE.equals(g.getActive())).toList();
	}

	private static Long lightest(Map<Long, Double> load) {
		return load.entrySet().stream()
				.min(Map.Entry.<Long, Double>comparingByValue()
						.thenComparing(Map.Entry::getKey))
				.map(Map.Entry::getKey)
				.orElseThrow();
	}

	private static double round(double v) {
		return Math.round(v * 10.0) / 10.0;
	}
}
