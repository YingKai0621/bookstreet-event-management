package com.swp391.bookstreet.dashboard.repository;

import com.swp391.bookstreet.event.entity.Event;
import java.util.List;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

public interface OrganizerDashboardRepository extends Repository<Event, Long> {

    @Query(value = """
            SELECT e.status AS status, COUNT(*) AS total
            FROM events e
            WHERE e.organizer_user_id = :organizerUserId
            GROUP BY e.status
            """, nativeQuery = true)
    List<DashboardStatusCountRow> countEventsByStatus(
            @Param("organizerUserId") Long organizerUserId
    );

    @Query(value = """
            SELECT a.status AS status, COUNT(*) AS total
            FROM partner_event_applications a
            JOIN events e ON e.event_id = a.event_id
            WHERE e.organizer_user_id = :organizerUserId
            GROUP BY a.status
            """, nativeQuery = true)
    List<DashboardStatusCountRow> countPartnerApplicationsByStatus(
            @Param("organizerUserId") Long organizerUserId
    );

    @Query(value = """
            SELECT COUNT(*)
            FROM booth_requests request
            JOIN partner_event_applications application
              ON application.application_id = request.application_id
            JOIN events event ON event.event_id = application.event_id
            WHERE event.organizer_user_id = :organizerUserId
              AND request.status = 'PENDING'
            """, nativeQuery = true)
    long countPendingBoothRequests(@Param("organizerUserId") Long organizerUserId);

    @Query(value = """
            SELECT pending.task_type AS taskType,
                   pending.item_id AS itemId,
                   pending.event_id AS eventId,
                   pending.event_name AS eventName,
                   pending.subject_name AS subjectName,
                   pending.submitted_at AS submittedAt
            FROM (
                SELECT 'PARTNER_APPLICATION' AS task_type,
                       application.application_id AS item_id,
                       event.event_id AS event_id,
                       event.name AS event_name,
                       organization.name AS subject_name,
                       application.submitted_at AS submitted_at
                FROM partner_event_applications application
                JOIN partner_organizations organization
                  ON organization.partner_organization_id = application.partner_organization_id
                JOIN events event ON event.event_id = application.event_id
                WHERE event.organizer_user_id = :organizerUserId
                  AND application.status = 'PENDING'

                UNION ALL

                SELECT 'BOOTH_REQUEST' AS task_type,
                       request.booth_request_id AS item_id,
                       event.event_id AS event_id,
                       event.name AS event_name,
                       CONCAT(organization.name, ' · ', location.code) AS subject_name,
                       request.submitted_at AS submitted_at
                FROM booth_requests request
                JOIN partner_event_applications application
                  ON application.application_id = request.application_id
                JOIN partner_organizations organization
                  ON organization.partner_organization_id = application.partner_organization_id
                JOIN events event ON event.event_id = application.event_id
                JOIN locations location ON location.location_id = request.booth_id
                WHERE event.organizer_user_id = :organizerUserId
                  AND request.status = 'PENDING'
            ) pending
            ORDER BY pending.submitted_at ASC, pending.task_type, pending.item_id
            LIMIT 4
            """, nativeQuery = true)
    List<DashboardTaskRow> findPriorityTasks(
            @Param("organizerUserId") Long organizerUserId
    );
}
