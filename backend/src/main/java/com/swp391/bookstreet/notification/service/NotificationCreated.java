package com.swp391.bookstreet.notification.service;

import com.swp391.bookstreet.notification.entity.NotificationRecipientRole;

/** Published when a new durable row is inserted; a deduplicated retry publishes nothing. */
public record NotificationCreated(Long recipientUserId, NotificationRecipientRole recipientRole) {
}
