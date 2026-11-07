package com.swp391.bookstreet.notification.service;

import com.swp391.bookstreet.notification.entity.NotificationRecipientRole;
import com.swp391.bookstreet.notification.entity.NotificationType;
import java.time.Instant;

public record NotificationCommand(
        Long recipientUserId,
        NotificationRecipientRole recipientRole,
        NotificationType type,
        Long eventId,
        Long activityId,
        Long certificateId,
        Long badgeId,
        Long partnerEventApplicationId,
        Long boothRequestId,
        Long activityProposalId,
        Long activityRequestId,
        String deduplicationKey,
        String title,
        String message,
        Instant createdAt) {
}
