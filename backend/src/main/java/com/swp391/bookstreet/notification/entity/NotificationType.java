package com.swp391.bookstreet.notification.entity;

import java.util.EnumSet;
import java.util.Set;

public enum NotificationType {
    ACTIVITY_SCHEDULE_OR_LOCATION_CHANGED(NotificationRecipientRole.PARTICIPANT),
    ACTIVITY_CANCELLED(NotificationRecipientRole.PARTICIPANT),
    EVENT_CANCELLED(NotificationRecipientRole.PARTICIPANT),
    CERTIFICATE_ISSUED(NotificationRecipientRole.PARTICIPANT),
    CERTIFICATE_REVOKED(NotificationRecipientRole.PARTICIPANT),
    BADGE_UNLOCKED(NotificationRecipientRole.PARTICIPANT),
    ACTIVITY_STARTING_SOON(NotificationRecipientRole.PARTICIPANT),

    PARTNER_APPLICATION_STATUS_CHANGED(NotificationRecipientRole.PARTNER),
    PARTNER_BOOTH_REQUEST_STATUS_CHANGED(NotificationRecipientRole.PARTNER),
    PARTNER_ACTIVITY_PROPOSAL_STATUS_CHANGED(NotificationRecipientRole.PARTNER),
    PARTNER_ACTIVITY_CHANGE_REQUEST_STATUS_CHANGED(NotificationRecipientRole.PARTNER),
    PARTNER_ACTIVITY_CANCELLATION_REQUEST_STATUS_CHANGED(NotificationRecipientRole.PARTNER),
    PARTNER_EVENT_CANCELLED(NotificationRecipientRole.PARTNER),
    PARTNER_ACTIVITY_CANCELLED(NotificationRecipientRole.PARTNER),
    PARTNER_EVENT_PUBLISHED(NotificationRecipientRole.PARTNER),
    PARTNER_BOOTH_HOLD_EXPIRING(NotificationRecipientRole.PARTNER),

    ORGANIZER_NEW_PARTNER_APPLICATION(NotificationRecipientRole.ORGANIZER),
    ORGANIZER_NEW_BOOTH_REQUEST(NotificationRecipientRole.ORGANIZER),
    ORGANIZER_ACTIVITY_PROPOSAL_SUBMITTED(NotificationRecipientRole.ORGANIZER),
    ORGANIZER_NEW_ACTIVITY_CHANGE_REQUEST(NotificationRecipientRole.ORGANIZER),
    ORGANIZER_NEW_ACTIVITY_CANCELLATION_REQUEST(NotificationRecipientRole.ORGANIZER),
    ORGANIZER_BOOTH_RESELECTION_REQUIRED(NotificationRecipientRole.ORGANIZER),
    ORGANIZER_BOOTH_PAYMENT_CONFIRMED(NotificationRecipientRole.ORGANIZER);

    private final NotificationRecipientRole recipientRole;

    NotificationType(NotificationRecipientRole recipientRole) {
        this.recipientRole = recipientRole;
    }

    public boolean supports(NotificationRecipientRole role) {
        return recipientRole == role;
    }

    public static Set<NotificationType> forRole(NotificationRecipientRole role) {
        EnumSet<NotificationType> result = EnumSet.noneOf(NotificationType.class);
        for (NotificationType type : values()) {
            if (type.supports(role)) result.add(type);
        }
        return Set.copyOf(result);
    }
}
