package com.swp391.bookstreet.notification.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "notifications")
public class Notification {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "notification_id")
    private Long notificationId;

    @Column(name = "recipient_user_id", nullable = false, updatable = false)
    private Long recipientUserId;

    @Enumerated(EnumType.STRING)
    @Column(name = "recipient_role", nullable = false, length = 20, updatable = false)
    private NotificationRecipientRole recipientRole;

    @Enumerated(EnumType.STRING)
    @Column(name = "notification_type", nullable = false, length = 60, updatable = false)
    private NotificationType type;

    @Column(name = "event_id", updatable = false)
    private Long eventId;

    @Column(name = "activity_id", updatable = false)
    private Long activityId;

    @Column(name = "certificate_id", updatable = false)
    private Long certificateId;

    @Column(name = "badge_id", updatable = false)
    private Long badgeId;

    @Column(name = "partner_event_application_id", updatable = false)
    private Long partnerEventApplicationId;

    @Column(name = "booth_request_id", updatable = false)
    private Long boothRequestId;

    @Column(name = "activity_proposal_id", updatable = false)
    private Long activityProposalId;

    @Column(name = "activity_request_id", updatable = false)
    private Long activityRequestId;

    @Column(name = "deduplication_key", nullable = false, length = 200, updatable = false)
    private String deduplicationKey;

    @Column(nullable = false, length = 200, updatable = false)
    private String title;

    @Column(nullable = false, columnDefinition = "text", updatable = false)
    private String message;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "read_at")
    private Instant readAt;

    protected Notification() {
    }

    public NotificationReferenceType getReferenceType() {
        if (eventId != null) return NotificationReferenceType.EVENT;
        if (activityId != null) return NotificationReferenceType.ACTIVITY;
        if (certificateId != null) return NotificationReferenceType.CERTIFICATE;
        if (badgeId != null) return NotificationReferenceType.BADGE;
        if (partnerEventApplicationId != null) return NotificationReferenceType.PARTNER_APPLICATION;
        if (boothRequestId != null) return NotificationReferenceType.BOOTH_REQUEST;
        if (activityProposalId != null) return NotificationReferenceType.ACTIVITY_PROPOSAL;
        return NotificationReferenceType.ACTIVITY_REQUEST;
    }

    public Long getReferenceId() {
        if (eventId != null) return eventId;
        if (activityId != null) return activityId;
        if (certificateId != null) return certificateId;
        if (badgeId != null) return badgeId;
        if (partnerEventApplicationId != null) return partnerEventApplicationId;
        if (boothRequestId != null) return boothRequestId;
        if (activityProposalId != null) return activityProposalId;
        return activityRequestId;
    }

    public Long getNotificationId() { return notificationId; }
    public Long getRecipientUserId() { return recipientUserId; }
    public NotificationRecipientRole getRecipientRole() { return recipientRole; }
    public NotificationType getType() { return type; }
    public Long getEventId() { return eventId; }
    public Long getActivityId() { return activityId; }
    public Long getCertificateId() { return certificateId; }
    public Long getBadgeId() { return badgeId; }
    public Long getPartnerEventApplicationId() { return partnerEventApplicationId; }
    public Long getBoothRequestId() { return boothRequestId; }
    public Long getActivityProposalId() { return activityProposalId; }
    public Long getActivityRequestId() { return activityRequestId; }
    public String getDeduplicationKey() { return deduplicationKey; }
    public String getTitle() { return title; }
    public String getMessage() { return message; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getReadAt() { return readAt; }
    public boolean isRead() { return readAt != null; }
}
