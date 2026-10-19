package com.swp391.bookstreet.notification.service;

import com.swp391.bookstreet.notification.entity.ParticipantNotificationType;
import java.time.Instant;

public record ParticipantNotificationCommand(
        Long recipientUserId,
        ParticipantNotificationType type,
        Long eventId,
        Long activityId,
        Long certificateId,
        String deduplicationKey,
        String title,
        String message,
        Instant createdAt) {
}
