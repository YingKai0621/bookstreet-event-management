package com.swp391.bookstreet.notification.dto;

import com.swp391.bookstreet.notification.entity.Notification;
import com.swp391.bookstreet.notification.entity.NotificationReferenceType;
import com.swp391.bookstreet.notification.entity.NotificationType;
import java.time.Instant;

public record NotificationResponse(
        Long notificationId,
        NotificationType type,
        String title,
        String message,
        NotificationReferenceType referenceType,
        Long referenceId,
        Long contextEventId,
        Instant createdAt,
        Instant readAt,
        boolean read) {

    public static NotificationResponse from(Notification entity, Long contextEventId) {
        return new NotificationResponse(
                entity.getNotificationId(),
                entity.getType(),
                entity.getTitle(),
                entity.getMessage(),
                entity.getReferenceType(),
                entity.getReferenceId(),
                contextEventId,
                entity.getCreatedAt(),
                entity.getReadAt(),
                entity.isRead());
    }
}
