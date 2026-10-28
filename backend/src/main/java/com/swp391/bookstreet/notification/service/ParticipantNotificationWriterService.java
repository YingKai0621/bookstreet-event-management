package com.swp391.bookstreet.notification.service;

import com.swp391.bookstreet.notification.entity.ParticipantNotification;
import com.swp391.bookstreet.notification.entity.ParticipantNotificationType;
import com.swp391.bookstreet.notification.repository.ParticipantNotificationRepository;
import java.util.Objects;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ParticipantNotificationWriterService implements ParticipantNotificationWriter {
    private final ParticipantNotificationRepository notificationRepository;

    public ParticipantNotificationWriterService(
            ParticipantNotificationRepository notificationRepository) {
        this.notificationRepository = notificationRepository;
    }

    @Override
    @Transactional
    public ParticipantNotification write(ParticipantNotificationCommand command) {
        NormalizedNotification notification = normalize(command);
        notificationRepository.insertIfAbsent(
                notification.recipientUserId(),
                notification.type().name(),
                notification.eventId(),
                notification.activityId(),
                notification.certificateId(),
                notification.badgeId(),
                notification.deduplicationKey(),
                notification.title(),
                notification.message(),
                notification.createdAt());
        return notificationRepository.findByRecipientUserIdAndDeduplicationKey(
                        notification.recipientUserId(), notification.deduplicationKey())
                .orElseThrow(() -> new IllegalStateException(
                        "Notification insert completed without a durable row."));
    }

    private NormalizedNotification normalize(ParticipantNotificationCommand command) {
        Objects.requireNonNull(command, "command must not be null");
        Long recipientUserId = positive(command.recipientUserId(), "recipientUserId");
        ParticipantNotificationType type = Objects.requireNonNull(
                command.type(), "type must not be null");
        Long eventId = optionalPositive(command.eventId(), "eventId");
        Long activityId = optionalPositive(command.activityId(), "activityId");
        Long certificateId = optionalPositive(command.certificateId(), "certificateId");
        Long badgeId = optionalPositive(command.badgeId(), "badgeId");
        validateReference(type, eventId, activityId, certificateId, badgeId);
        String deduplicationKey = normalizedRequired(
                command.deduplicationKey(), 200, "deduplicationKey");
        String title = normalizedRequired(command.title(), 200, "title");
        String message = normalizedRequired(command.message(), null, "message");
        return new NormalizedNotification(
                recipientUserId,
                type,
                eventId,
                activityId,
                certificateId,
                badgeId,
                deduplicationKey,
                title,
                message,
                Objects.requireNonNull(command.createdAt(), "createdAt must not be null"));
    }

    private void validateReference(ParticipantNotificationType type, Long eventId,
            Long activityId, Long certificateId, Long badgeId) {
        boolean valid = switch (type) {
            case ACTIVITY_SCHEDULE_OR_LOCATION_CHANGED, ACTIVITY_CANCELLED ->
                    activityId != null && eventId == null && certificateId == null
                            && badgeId == null;
            case EVENT_CANCELLED ->
                    eventId != null && activityId == null && certificateId == null
                            && badgeId == null;
            case CERTIFICATE_ISSUED, CERTIFICATE_REVOKED ->
                    certificateId != null && eventId == null && activityId == null
                            && badgeId == null;
            case BADGE_UNLOCKED ->
                    badgeId != null && eventId == null && activityId == null
                            && certificateId == null;
        };
        if (!valid) {
            throw new IllegalArgumentException(
                    "Notification type requires exactly its approved reference.");
        }
    }

    private Long positive(Long value, String field) {
        Objects.requireNonNull(value, field + " must not be null");
        if (value <= 0) throw new IllegalArgumentException(field + " must be positive");
        return value;
    }

    private Long optionalPositive(Long value, String field) {
        if (value == null) return null;
        if (value <= 0) throw new IllegalArgumentException(field + " must be positive");
        return value;
    }

    private String normalizedRequired(String value, Integer maxLength, String field) {
        Objects.requireNonNull(value, field + " must not be null");
        String normalized = value.trim();
        if (normalized.isEmpty()) {
            throw new IllegalArgumentException(field + " must not be blank");
        }
        if (maxLength != null && normalized.length() > maxLength) {
            throw new IllegalArgumentException(field + " exceeds " + maxLength + " characters");
        }
        return normalized;
    }

    private record NormalizedNotification(
            Long recipientUserId,
            ParticipantNotificationType type,
            Long eventId,
            Long activityId,
            Long certificateId,
            Long badgeId,
            String deduplicationKey,
            String title,
            String message,
            java.time.Instant createdAt) {
    }
}
