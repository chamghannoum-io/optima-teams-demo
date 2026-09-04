package com.i3hub.optima.repository;

import com.i3hub.optima.domain.RcmTeamV2;
import com.i3hub.optima.enumeration.RcmTeamDivision;
import com.i3hub.optima.enumeration.RcmTeamEncounterScope;
import java.util.Collection;
import java.util.Set;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

public interface RcmTeamV2Repository
		extends JpaRepository<RcmTeamV2, Long>, JpaSpecificationExecutor<RcmTeamV2> {

	static Specification<RcmTeamV2> conjunction() {
		return (root, query, cb) -> cb.conjunction();
	}

	static Specification<RcmTeamV2> idIn(Set<Long> ids) {
		if (ids == null || ids.isEmpty()) {
			return conjunction();
		}
		return (root, query, cb) -> root.get("id").in(ids);
	}

	static Specification<RcmTeamV2> nameLike(String name) {
		if (name == null || name.isBlank()) {
			return conjunction();
		}
		return (root, query, cb) -> cb.like(
				cb.lower(root.get("name")), "%" + name.toLowerCase() + "%");
	}

	static Specification<RcmTeamV2> isActive(Boolean active) {
		if (active == null) {
			return conjunction();
		}
		return (root, query, cb) -> cb.equal(root.get("active"), active);
	}

	static Specification<RcmTeamV2> vendorIdEq(Long vendorId) {
		if (vendorId == null) {
			return conjunction();
		}
		return (root, query, cb) -> cb.equal(root.get("vendorId"), vendorId);
	}

	static Specification<RcmTeamV2> facilityIdEq(String facilityId) {
		if (facilityId == null || facilityId.isBlank()) {
			return conjunction();
		}
		return (root, query, cb) -> cb.equal(root.get("facilityId"), facilityId);
	}

	static Specification<RcmTeamV2> divisionEq(RcmTeamDivision division) {
		if (division == null) {
			return conjunction();
		}
		return (root, query, cb) -> cb.equal(root.get("division"), division);
	}

	/**
	 * Teams whose scope can serve the given encounter — an OP item is servable by
	 * an OP team or a BOTH team.
	 */
	static Specification<RcmTeamV2> encounterScopeCovers(RcmTeamEncounterScope scope) {
		if (scope == null || scope == RcmTeamEncounterScope.BOTH) {
			return conjunction();
		}
		return (root, query, cb) -> root.get("encounterScope")
				.in(scope, RcmTeamEncounterScope.BOTH);
	}

	static Specification<RcmTeamV2> branchIdIn(Collection<Long> branchIds) {
		if (branchIds == null || branchIds.isEmpty()) {
			return conjunction();
		}
		return (root, query, cb) -> {
			if (query != null) {
				query.distinct(true);
			}
			return root.join("branchIds").in(branchIds);
		};
	}
}
