package com.swp391.bookstreet.reward.repository;

import com.swp391.bookstreet.booth.entity.BoothAssignmentStatus;
import com.swp391.bookstreet.attendance.dto.ParticipationPersonResponse;
import com.swp391.bookstreet.reward.dto.*;
import com.swp391.bookstreet.reward.service.RewardManagementQuery;
import jakarta.persistence.EntityManager;
import jakarta.persistence.TypedQuery;
import java.time.Instant;
import java.util.List;
import org.springframework.stereotype.Repository;

@Repository
public class OrganizerBoothVisitQueryRepository {
    private static final String FROM = """
            from BoothVisit visit
            join EventRegistration registration on registration.eventRegistrationId = visit.eventRegistrationId
            join User participant on participant.id = registration.userId
            join BoothAssignment assignment on assignment.boothAssignmentId = visit.boothAssignmentId
            join assignment.boothHold hold
            join hold.eventBoothConfig config
            join config.booth booth
            join booth.location location
            where registration.eventId = :eventId and config.eventId = :eventId
            """;
    private final EntityManager entityManager;

    public OrganizerBoothVisitQueryRepository(EntityManager entityManager) {
        this.entityManager = entityManager;
    }

    public OrganizerBoothVisitSummaryResponse summary(Long eventId) {
        Object[] row = entityManager.createQuery("""
                select count(visit), count(distinct registration.userId),
                       count(distinct assignment.boothAssignmentId)
                """ + FROM, Object[].class).setParameter("eventId", eventId).getSingleResult();
        return new OrganizerBoothVisitSummaryResponse(eventId, (Long) row[0], (Long) row[1], (Long) row[2]);
    }

    public RewardPageResponse<OrganizerBoothVisitGroupResponse> groups(
            Long eventId, Long boothId, RewardManagementQuery options) {
        String from = FROM + filters(options, boothId, false);
        long total = bind(entityManager.createQuery(
                "select count(distinct assignment.boothAssignmentId) " + from, Long.class),
                eventId, boothId, options).getSingleResult();
        if (options.offset() >= total || options.offset() > Integer.MAX_VALUE) {
            return page(List.of(), options, total);
        }
        List<OrganizerBoothVisitGroupResponse> rows = bind(entityManager.createQuery("""
                select assignment.boothAssignmentId, booth.boothId, location.code, location.name,
                       assignment.status, count(visit), max(visit.visitedAt)
                """ + from + """
                group by assignment.boothAssignmentId, booth.boothId, location.code,
                         location.name, assignment.status
                order by
                """ + options.orderBy(), Object[].class), eventId, boothId, options)
                .setFirstResult((int) options.offset()).setMaxResults(options.size()).getResultList()
                .stream().map(row -> new OrganizerBoothVisitGroupResponse((Long) row[0],
                        new BoothBriefResponse((Long) row[1], (String) row[2], (String) row[3]),
                        (BoothAssignmentStatus) row[4], (Long) row[5], (Instant) row[6])).toList();
        return page(rows, options, total);
    }

    public RewardPageResponse<OrganizerBoothVisitResponse> visits(
            Long eventId, Long boothId, RewardManagementQuery options) {
        String from = FROM + filters(options, boothId, true);
        long total = bind(entityManager.createQuery("select count(visit) " + from, Long.class),
                eventId, boothId, options).getSingleResult();
        if (options.offset() >= total || options.offset() > Integer.MAX_VALUE) {
            return page(List.of(), options, total);
        }
        List<OrganizerBoothVisitResponse> rows = bind(entityManager.createQuery("""
                select visit.boothVisitId, visit.eventRegistrationId, visit.visitedAt,
                       participant.id, participant.fullName, assignment.boothAssignmentId,
                       booth.boothId, location.code, location.name, assignment.status
                """ + from + " order by " + options.orderBy(), Object[].class), eventId, boothId, options)
                .setFirstResult((int) options.offset()).setMaxResults(options.size()).getResultList()
                .stream().map(row -> new OrganizerBoothVisitResponse(
                        (Long) row[0], (Long) row[1], (Instant) row[2],
                        new ParticipationPersonResponse((Long) row[3], (String) row[4]),
                        (Long) row[5], new BoothBriefResponse((Long) row[6], (String) row[7], (String) row[8]),
                        (BoothAssignmentStatus) row[9])).toList();
        return page(rows, options, total);
    }

    private String filters(RewardManagementQuery options, Long boothId, boolean participants) {
        String filters = boothId == null ? "" : " and booth.boothId = :boothId";
        if (options.search() != null) {
            filters += " and (lower(location.code) like :search escape '!'"
                    + " or lower(location.name) like :search escape '!'"
                    + (participants ? " or lower(participant.fullName) like :search escape '!'" : "") + ")";
        }
        return filters;
    }

    private <T> TypedQuery<T> bind(TypedQuery<T> query, Long eventId, Long boothId,
            RewardManagementQuery options) {
        query.setParameter("eventId", eventId);
        if (boothId != null) query.setParameter("boothId", boothId);
        if (options.search() != null) query.setParameter("search", options.searchPattern());
        return query;
    }

    private <T> RewardPageResponse<T> page(List<T> content, RewardManagementQuery options, long total) {
        return new RewardPageResponse<>(content, options.page(), options.size(), total,
                (int) Math.min(Integer.MAX_VALUE, (total + options.size() - 1) / options.size()));
    }
}
