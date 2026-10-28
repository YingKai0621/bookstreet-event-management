package com.swp391.bookstreet.notification.service;

import com.swp391.bookstreet.notification.entity.ParticipantNotificationType;
import java.time.Instant;

public record ParticipantNotificationCommand(
        Long recipientUserId,
        ParticipantNotificationType type,
        Long eventId,
        Long activityId,
        Long certificateId,
        Long badgeId,
        String deduplicationKey,
        String title,
        String message,
        Instant createdAt) {
    public ParticipantNotificationCommand(
            Long recipientUserId,
            ParticipantNotificationType type,
            Long eventId,
            Long activityId,
            Long certificateId,
            String deduplicationKey,
            String title,
            String message,
            Instant createdAt) {
        this(recipientUserId, type, eventId, activityId, certificateId, null,
                deduplicationKey, title, message, createdAt);
    }
}
