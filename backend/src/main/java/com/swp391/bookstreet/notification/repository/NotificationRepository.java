package com.swp391.bookstreet.notification.repository;

import com.swp391.bookstreet.notification.entity.Notification;
import com.swp391.bookstreet.notification.entity.NotificationRecipientRole;
import com.swp391.bookstreet.notification.entity.NotificationType;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface NotificationRepository extends JpaRepository<Notification, Long> {
    Optional<Notification> findByRecipientUserIdAndRecipientRoleAndDeduplicationKey(
            Long recipientUserId,
            NotificationRecipientRole recipientRole,
            String deduplicationKey);

    @Query("""
            SELECT n FROM Notification n
            WHERE n.recipientUserId = :recipientUserId
              AND n.recipientRole = :recipientRole
              AND (:type IS NULL OR n.type = :type)
              AND (:read IS NULL
                   OR (:read = TRUE AND n.readAt IS NOT NULL)
                   OR (:read = FALSE AND n.readAt IS NULL))
            """)
    Page<Notification> findNotifications(
            @Param("recipientUserId") Long recipientUserId,
            @Param("recipientRole") NotificationRecipientRole recipientRole,
            @Param("type") NotificationType type,
            @Param("read") Boolean read,
            Pageable pageable);

    long countByRecipientUserIdAndRecipientRoleAndReadAtIsNull(
            Long recipientUserId, NotificationRecipientRole recipientRole);

    Optional<Notification> findByNotificationIdAndRecipientUserIdAndRecipientRole(
            Long notificationId,
            Long recipientUserId,
            NotificationRecipientRole recipientRole);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            UPDATE Notification n
            SET n.readAt = :readAt
            WHERE n.notificationId = :notificationId
              AND n.recipientUserId = :recipientUserId
              AND n.recipientRole = :recipientRole
              AND n.readAt IS NULL
            """)
    int markOneAsRead(
            @Param("notificationId") Long notificationId,
            @Param("recipientUserId") Long recipientUserId,
            @Param("recipientRole") NotificationRecipientRole recipientRole,
            @Param("readAt") Instant readAt);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            UPDATE Notification n
            SET n.readAt = :readAt
            WHERE n.recipientUserId = :recipientUserId
              AND n.recipientRole = :recipientRole
              AND n.readAt IS NULL
            """)
    int markAllAsRead(
            @Param("recipientUserId") Long recipientUserId,
            @Param("recipientRole") NotificationRecipientRole recipientRole,
            @Param("readAt") Instant readAt);

    @Query(value = """
            SELECT n.notification_id AS "notificationId",
                   COALESCE(
                       n.event_id,
                       direct_activity.event_id,
                       certificate_activity.event_id,
                       partner_application.event_id,
                       booth_application.event_id,
                       proposal_application.event_id,
                       request_activity.event_id
                   ) AS "contextEventId"
            FROM {h-schema}notifications n
            LEFT JOIN {h-schema}activities direct_activity
                ON direct_activity.activity_id = n.activity_id
            LEFT JOIN {h-schema}certificates certificate
                ON certificate.certificate_id = n.certificate_id
            LEFT JOIN {h-schema}attendances attendance
                ON attendance.attendance_id = certificate.attendance_id
            LEFT JOIN {h-schema}activity_registrations certificate_registration
                ON certificate_registration.activity_registration_id = attendance.activity_registration_id
            LEFT JOIN {h-schema}activities certificate_activity
                ON certificate_activity.activity_id = certificate_registration.activity_id
            LEFT JOIN {h-schema}partner_event_applications partner_application
                ON partner_application.application_id = n.partner_event_application_id
            LEFT JOIN {h-schema}booth_requests booth_request
                ON booth_request.booth_request_id = n.booth_request_id
            LEFT JOIN {h-schema}partner_event_applications booth_application
                ON booth_application.application_id = booth_request.application_id
            LEFT JOIN {h-schema}activity_proposals proposal
                ON proposal.activity_proposal_id = n.activity_proposal_id
            LEFT JOIN {h-schema}partner_event_applications proposal_application
                ON proposal_application.application_id = proposal.application_id
            LEFT JOIN {h-schema}activity_requests activity_request
                ON activity_request.activity_request_id = n.activity_request_id
            LEFT JOIN {h-schema}activities request_activity
                ON request_activity.activity_id = activity_request.activity_id
            WHERE n.notification_id IN (:notificationIds)
            """, nativeQuery = true)
    List<NotificationContextEvent> findContextEventIds(
            @Param("notificationIds") Collection<Long> notificationIds);

    @Modifying(flushAutomatically = true)
    @Query(value = """
            INSERT INTO {h-schema}notifications (
                recipient_user_id,
                recipient_role,
                notification_type,
                event_id,
                activity_id,
                certificate_id,
                badge_id,
                partner_event_application_id,
                booth_request_id,
                activity_proposal_id,
                activity_request_id,
                deduplication_key,
                title,
                message,
                created_at
            ) VALUES (
                :recipientUserId,
                :recipientRole,
                :notificationType,
                :eventId,
                :activityId,
                :certificateId,
                :badgeId,
                :partnerEventApplicationId,
                :boothRequestId,
                :activityProposalId,
                :activityRequestId,
                :deduplicationKey,
                :title,
                :message,
                :createdAt
            )
            ON CONFLICT (recipient_user_id, recipient_role, deduplication_key) DO NOTHING
            """, nativeQuery = true)
    int insertIfAbsent(
            @Param("recipientUserId") Long recipientUserId,
            @Param("recipientRole") String recipientRole,
            @Param("notificationType") String notificationType,
            @Param("eventId") Long eventId,
            @Param("activityId") Long activityId,
            @Param("certificateId") Long certificateId,
            @Param("badgeId") Long badgeId,
            @Param("partnerEventApplicationId") Long partnerEventApplicationId,
            @Param("boothRequestId") Long boothRequestId,
            @Param("activityProposalId") Long activityProposalId,
            @Param("activityRequestId") Long activityRequestId,
            @Param("deduplicationKey") String deduplicationKey,
            @Param("title") String title,
            @Param("message") String message,
            @Param("createdAt") Instant createdAt);
}
