package com.swp391.bookstreet.notification.dto;

import com.swp391.bookstreet.notification.entity.ParticipantNotification;
import com.swp391.bookstreet.notification.entity.ParticipantNotificationReferenceType;
import com.swp391.bookstreet.notification.entity.ParticipantNotificationType;
import java.time.Instant;

public record ParticipantNotificationResponse(
        Long notificationId,
        ParticipantNotificationType type,
        String title,
        String message,
        ParticipantNotificationReferenceType referenceType,
        Long referenceId,
        Instant createdAt,
        Instant readAt,
        boolean read
) {
    public static ParticipantNotificationResponse from(ParticipantNotification entity) {
        return new ParticipantNotificationResponse(
                entity.getNotificationId(),
                entity.getType(),
                entity.getTitle(),
                entity.getMessage(),
                entity.getReferenceType(),
                entity.getReferenceId(),
                entity.getCreatedAt(),
                entity.getReadAt(),
                entity.isRead()
        );
    }
}
