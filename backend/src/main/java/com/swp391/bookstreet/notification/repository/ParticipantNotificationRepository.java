package com.swp391.bookstreet.notification.repository;

import com.swp391.bookstreet.notification.entity.ParticipantNotification;
import com.swp391.bookstreet.notification.entity.ParticipantNotificationType;
import java.time.Instant;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ParticipantNotificationRepository
        extends JpaRepository<ParticipantNotification, Long> {
    Optional<ParticipantNotification> findByRecipientUserIdAndDeduplicationKey(
            Long recipientUserId, String deduplicationKey);

    @Query("""
            SELECT n FROM ParticipantNotification n
            WHERE n.recipientUserId = :recipientUserId
              AND (:type IS NULL OR n.type = :type)
              AND (:read IS NULL
                   OR (:read = TRUE AND n.readAt IS NOT NULL)
                   OR (:read = FALSE AND n.readAt IS NULL))
            """)
    Page<ParticipantNotification> findNotifications(
            @Param("recipientUserId") Long recipientUserId,
            @Param("type") ParticipantNotificationType type,
            @Param("read") Boolean read,
            Pageable pageable);

    long countByRecipientUserIdAndReadAtIsNull(Long recipientUserId);

    Optional<ParticipantNotification> findByNotificationIdAndRecipientUserId(
            Long notificationId, Long recipientUserId);

    /**
     * NOTE: Chức năng 'read-all' (đánh dấu đã đọc tất cả thông báo) đã được cấp phép
     * bổ sung theo yêu cầu dự án để đồng bộ với Participant UI.
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            UPDATE ParticipantNotification n
            SET n.readAt = :readAt
            WHERE n.recipientUserId = :recipientUserId
              AND n.readAt IS NULL
            """)
    int markAllAsRead(
            @Param("recipientUserId") Long recipientUserId,
            @Param("readAt") Instant readAt);

    @Modifying(flushAutomatically = true)
    @Query(value = """
            INSERT INTO notifications (
                recipient_user_id,
                notification_type,
                event_id,
                activity_id,
                certificate_id,
                deduplication_key,
                title,
                message,
                created_at
            ) VALUES (
                :recipientUserId,
                :notificationType,
                :eventId,
                :activityId,
                :certificateId,
                :deduplicationKey,
                :title,
                :message,
                :createdAt
            )
            ON CONFLICT (recipient_user_id, deduplication_key) DO NOTHING
            """, nativeQuery = true)
    int insertIfAbsent(
            @Param("recipientUserId") Long recipientUserId,
            @Param("notificationType") String notificationType,
            @Param("eventId") Long eventId,
            @Param("activityId") Long activityId,
            @Param("certificateId") Long certificateId,
            @Param("deduplicationKey") String deduplicationKey,
            @Param("title") String title,
            @Param("message") String message,
            @Param("createdAt") Instant createdAt);
}
