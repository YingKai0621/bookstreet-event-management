package com.swp391.bookstreet.reward.repository;

import com.swp391.bookstreet.reward.dto.AdminBadgeResponse;
import com.swp391.bookstreet.reward.dto.RewardPageResponse;
import com.swp391.bookstreet.reward.entity.Badge;
import com.swp391.bookstreet.reward.service.RewardManagementQuery;
import jakarta.persistence.EntityManager;
import jakarta.persistence.TypedQuery;
import java.util.List;
import org.springframework.stereotype.Repository;

@Repository
public class AdminBadgeQueryRepository {
    private static final String ELIGIBLE = """
            from User candidate
            where not exists (select earned.userBadgeId from UserBadge earned
                              where earned.userId = candidate.id and earned.badgeId = :badgeId)
              and (select coalesce(sum(points.points), 0)
                   from PointTransaction points
                   join BoothVisit visit on visit.boothVisitId = points.boothVisitId
                   join EventRegistration registration
                     on registration.eventRegistrationId = visit.eventRegistrationId
                   where registration.userId = candidate.id) >= :threshold
            """;
    private final EntityManager entityManager;

    public AdminBadgeQueryRepository(EntityManager entityManager) { this.entityManager = entityManager; }

    public RewardPageResponse<AdminBadgeResponse> list(RewardManagementQuery options, Boolean active) {
        String from = "from Badge badge where 1 = 1"
                + (active == null ? "" : " and badge.active = :active")
                + (options.search() == null ? "" : " and lower(badge.name) like :search escape '!'");
        long total = bind(entityManager.createQuery("select count(badge) " + from, Long.class),
                options, active).getSingleResult();
        List<AdminBadgeResponse> rows = options.offset() >= total || options.offset() > Integer.MAX_VALUE
                ? List.of() : bind(entityManager.createQuery(
                        "select badge " + from + " order by " + options.orderBy(), Badge.class), options, active)
                        .setFirstResult((int) options.offset()).setMaxResults(options.size()).getResultList()
                        .stream().map(this::response).toList();
        return new RewardPageResponse<>(rows, options.page(), options.size(), total,
                (int) Math.min(Integer.MAX_VALUE, (total + options.size() - 1) / options.size()));
    }

    public AdminBadgeResponse response(Badge badge) {
        long awarded = entityManager.createQuery(
                "select count(earned) from UserBadge earned where earned.badgeId = :badgeId", Long.class)
                .setParameter("badgeId", badge.getBadgeId()).getSingleResult();
        return AdminBadgeResponse.from(badge, awarded, remaining(badge));
    }

    public long remaining(Badge badge) {
        if (!badge.isActive()) return 0;
        return entityManager.createQuery("select count(candidate) " + ELIGIBLE, Long.class)
                .setParameter("badgeId", badge.getBadgeId())
                .setParameter("threshold", badge.getRequiredPoints()).getSingleResult();
    }

    /** The caller holds the Badge lock; selecting never locks Event/registration rows. */
    public List<Long> candidates(Badge badge) {
        return entityManager.createQuery("select candidate.id " + ELIGIBLE + " order by candidate.id asc", Long.class)
                .setParameter("badgeId", badge.getBadgeId())
                .setParameter("threshold", badge.getRequiredPoints()).setMaxResults(100).getResultList();
    }

    public boolean nameExists(String name, Long excludingId) {
        String exclusion = excludingId == null ? "" : " and badge.badgeId <> :excludingId";
        TypedQuery<Long> query = entityManager.createQuery(
                "select count(badge) from Badge badge where lower(badge.name) = lower(:name)" + exclusion, Long.class)
                .setParameter("name", name);
        if (excludingId != null) query.setParameter("excludingId", excludingId);
        return query.getSingleResult() != 0;
    }

    private <T> TypedQuery<T> bind(TypedQuery<T> query, RewardManagementQuery options, Boolean active) {
        if (active != null) query.setParameter("active", active);
        if (options.search() != null) query.setParameter("search", options.searchPattern());
        return query;
    }
}
