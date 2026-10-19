package com.swp391.bookstreet.notification.repository;

import com.swp391.bookstreet.notification.entity.ParticipantNotification;
import java.time.Instant;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ParticipantNotificationRepository
        extends JpaRepository<ParticipantNotification, Long> {
    Optional<ParticipantNotification> findByRecipientUserIdAndDeduplicationKey(
            Long recipientUserId, String deduplicationKey);

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
