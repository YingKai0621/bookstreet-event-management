package com.swp391.bookstreet.reward.repository;

import com.swp391.bookstreet.reward.dto.BoothBriefResponse;
import com.swp391.bookstreet.reward.dto.EventBriefResponse;
import com.swp391.bookstreet.reward.dto.ParticipantBadgeResponse;
import com.swp391.bookstreet.reward.dto.PointTransactionResponse;
import com.swp391.bookstreet.reward.dto.RewardPageResponse;
import com.swp391.bookstreet.reward.entity.Badge;
import jakarta.persistence.EntityManager;
import jakarta.persistence.TypedQuery;
import java.time.Instant;
import java.util.List;
import org.springframework.stereotype.Repository;

@Repository
public class ParticipantRewardQueryRepository {
    private static final String POINT_FROM = """
            from PointTransaction pointTransaction
            join BoothVisit visit
              on pointTransaction.boothVisitId = visit.boothVisitId
            join EventRegistration registration
              on visit.eventRegistrationId = registration.eventRegistrationId
            join Event event
              on registration.eventId = event.eventId
            join BoothAssignment assignment
              on visit.boothAssignmentId = assignment.boothAssignmentId
            join assignment.boothHold hold
            join hold.eventBoothConfig config
            join config.booth booth
            join booth.location location
            where registration.userId = :userId
            """;

    private final EntityManager entityManager;

    public ParticipantRewardQueryRepository(EntityManager entityManager) {
        this.entityManager = entityManager;
    }

    public RewardPageResponse<PointTransactionResponse> pointTransactions(
            Long userId, int page, int size, long offset, String orderBy,
            Long eventId, Long boothId) {
        String filters = pointFilters(eventId, boothId);
        long total = entityManager.createQuery(
                        "select count(pointTransaction) " + POINT_FROM + filters, Long.class)
                .setParameter("userId", userId)
                .setParameter("eventId", eventId)
                .setParameter("boothId", boothId)
                .getSingleResult();
        if (offset >= total || offset > Integer.MAX_VALUE) {
            return page(List.of(), page, size, total);
        }

        List<Object[]> rows = entityManager.createQuery("""
                        select pointTransaction.pointTransactionId,
                               visit.boothVisitId,
                               visit.boothAssignmentId,
                               pointTransaction.points,
                               pointTransaction.createdAt,
                               visit.visitedAt,
                               event.eventId,
                               event.name,
                               booth.boothId,
                               location.code,
                               location.name
                        """ + POINT_FROM + filters + " order by " + orderBy, Object[].class)
                .setParameter("userId", userId)
                .setParameter("eventId", eventId)
                .setParameter("boothId", boothId)
                .setFirstResult((int) offset)
                .setMaxResults(size)
                .getResultList();
        List<PointTransactionResponse> content = rows.stream()
                .map(ParticipantRewardQueryRepository::pointResponse)
                .toList();
        return page(content, page, size, total);
    }

    public RewardPageResponse<ParticipantBadgeResponse> badges(
            Long userId, long totalPoints, int page, int size, long offset,
            String state, String orderBy) {
        String from = badgeFrom(state);
        long total = entityManager.createQuery("select count(badge) " + from, Long.class)
                .setParameter("userId", userId)
                .getSingleResult();
        if (offset >= total || offset > Integer.MAX_VALUE) {
            return page(List.of(), page, size, total);
        }

        TypedQuery<Object[]> query = entityManager.createQuery(
                "select badge, userBadge.earnedAt " + from + " order by " + orderBy,
                Object[].class);
        List<ParticipantBadgeResponse> content = query.setParameter("userId", userId)
                .setFirstResult((int) offset)
                .setMaxResults(size)
                .getResultList().stream()
                .map(row -> badgeResponse((Badge) row[0], (Instant) row[1], totalPoints))
                .toList();
        return page(content, page, size, total);
    }

    public Badge nextBadge(Long userId) {
        return entityManager.createQuery("""
                        select badge
                        from Badge badge
                        where badge.active = true
                          and not exists (
                              select userBadge.userBadgeId
                              from UserBadge userBadge
                              where userBadge.userId = :userId
                                and userBadge.badgeId = badge.badgeId
                          )
                        order by badge.requiredPoints asc, badge.badgeId asc
                        """, Badge.class)
                .setParameter("userId", userId)
                .setMaxResults(1)
                .getResultStream()
                .findFirst()
                .orElse(null);
    }

    private static String pointFilters(Long eventId, Long boothId) {
        return " and (:eventId is null or event.eventId = :eventId)"
                + " and (:boothId is null or booth.boothId = :boothId)";
    }

    private static String badgeFrom(String state) {
        String visibility = switch (state) {
            case "EARNED" -> "userBadge.userBadgeId is not null";
            case "IN_PROGRESS" -> "userBadge.userBadgeId is null and badge.active = true";
            default -> "userBadge.userBadgeId is not null or badge.active = true";
        };
        return """
                from Badge badge
                left join UserBadge userBadge
                  on userBadge.badgeId = badge.badgeId
                 and userBadge.userId = :userId
                where (
                """ + visibility + ")";
    }

    private static PointTransactionResponse pointResponse(Object[] row) {
        return new PointTransactionResponse(
                (Long) row[0], (Long) row[1], (Long) row[2], (Integer) row[3],
                (Instant) row[4], (Instant) row[5],
                new EventBriefResponse((Long) row[6], (String) row[7]),
                new BoothBriefResponse((Long) row[8], (String) row[9], (String) row[10]));
    }

    private static ParticipantBadgeResponse badgeResponse(
            Badge badge, Instant earnedAt, long totalPoints) {
        if (earnedAt != null) {
            return new ParticipantBadgeResponse(
                    badge.getBadgeId(), badge.getName(), badge.getDescription(), badge.getIconUrl(),
                    badge.getRequiredPoints(), badge.isActive(), "EARNED", true,
                    earnedAt, 0, 100);
        }
        long remaining = Math.max(0, (long) badge.getRequiredPoints() - totalPoints);
        int progress = ParticipantBadgeResponse.calculateProgressPercent(
                totalPoints, badge.getRequiredPoints());
        return new ParticipantBadgeResponse(
                badge.getBadgeId(), badge.getName(), badge.getDescription(), badge.getIconUrl(),
                badge.getRequiredPoints(), badge.isActive(), "IN_PROGRESS", false,
                null, remaining, progress);
    }

    private static <T> RewardPageResponse<T> page(
            List<T> content, int page, int size, long total) {
        long calculatedPages = total == 0 ? 0 : (total + size - 1) / size;
        int totalPages = (int) Math.min(Integer.MAX_VALUE, calculatedPages);
        return new RewardPageResponse<>(content, page, size, total, totalPages);
    }
}
