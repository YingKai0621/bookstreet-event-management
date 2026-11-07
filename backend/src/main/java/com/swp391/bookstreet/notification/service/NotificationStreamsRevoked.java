package com.swp391.bookstreet.notification.service;

import com.swp391.bookstreet.notification.entity.NotificationRecipientRole;

/**
 * Publish inside the transaction that revokes access. Open streams close after it commits, so a
 * rollback keeps them open. A null role closes every role of that User, as a lock requires.
 */
public record NotificationStreamsRevoked(Long userId, NotificationRecipientRole role) {
}
