package com.i3hub.optima.repository;

import com.i3hub.optima.domain.RcmTeam;
import com.i3hub.optima.domain.RcmTeamTag;
import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Predicate;
import java.util.Collection;
import java.util.List;
import java.util.Set;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface RcmTeamRepository extends JpaRepository<RcmTeam, Long>, JpaSpecificationExecutor<RcmTeam> {
	static Specification<RcmTeam> conjunction() {
		return (root, criteriaQuery, criteriaBuilder) -> criteriaBuilder.conjunction();
	}

	static Specification<RcmTeam> idIn(Set<Long> ids) {
		if (ids == null || ids.isEmpty()) {
			return conjunction();
		}
		return (root, criteriaQuery, criteriaBuilder) -> root.get("id").in(ids);
	}

	static Specification<RcmTeam> nameLike(String name) {
		if (name == null || name.isBlank()) {
			return conjunction();
		}
		return (root, criteriaQuery, criteriaBuilder) -> criteriaBuilder.like(
				criteriaBuilder.lower(root.get("name")),
				"%" + name.toLowerCase() + "%");
	}

	static Specification<RcmTeam> tagContainsAny(List<String> tags) {
		if (tags == null || tags.isEmpty()) {
			return conjunction();
		}
		return (root, criteriaQuery, criteriaBuilder) -> {
			if (criteriaQuery != null) {
				criteriaQuery.distinct(true);
			}
			Join<RcmTeam, RcmTeamTag> tagJoin = root.join("tags", JoinType.LEFT);
			Predicate[] predicates = tags.stream()
					.map(tag -> {
						String normalizedTag = "%" + tag.toLowerCase() + "%";
						Predicate legacyTagMatch = criteriaBuilder.like(
								criteriaBuilder.lower(root.get("tag")),
								normalizedTag);
						Predicate structuredTagMatch = criteriaBuilder.like(
								criteriaBuilder.lower(tagJoin.get("tag")),
								normalizedTag);
						return criteriaBuilder.or(legacyTagMatch, structuredTagMatch);
					})
					.toArray(Predicate[]::new);
			return criteriaBuilder.or(predicates);
		};
	}

	static Specification<RcmTeam> isActive(Boolean active) {
		if (active == null) {
			return conjunction();
		}
		return (root, criteriaQuery, criteriaBuilder) -> criteriaBuilder.equal(root.get("active"), active);
	}

	static Specification<RcmTeam> vendorIdEq(Long vendorId) {
		if (vendorId == null) {
			return conjunction();
		}
		return (root, criteriaQuery, criteriaBuilder) -> criteriaBuilder.equal(root.get("vendorId"), vendorId);
	}

	@Query("SELECT t FROM RcmTeam t JOIN t.users u WHERE u = :userId")
	List<RcmTeam> findTeamsByUserId(@Param("userId") Long userId);

	static Specification<RcmTeam> branchIdIn(Collection<Long> branchIds) {
		if (branchIds == null || branchIds.isEmpty()) {
			return conjunction();
		}
		return (root, criteriaQuery, criteriaBuilder) -> {
			if (criteriaQuery != null) {
				criteriaQuery.distinct(true);
			}
			return root.join("branchIds").in(branchIds);
		};
	}
}
