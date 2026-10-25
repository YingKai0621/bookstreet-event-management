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
import java.util.Objects;

@Entity
@Table(name = "notifications")
public class ParticipantNotification {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "notification_id")
    private Long notificationId;

    @Column(name = "recipient_user_id", nullable = false, updatable = false)
    private Long recipientUserId;

    @Enumerated(EnumType.STRING)
    @Column(name = "notification_type", nullable = false, length = 60, updatable = false)
    private ParticipantNotificationType type;

    @Column(name = "event_id", updatable = false)
    private Long eventId;

    @Column(name = "activity_id", updatable = false)
    private Long activityId;

    @Column(name = "certificate_id", updatable = false)
    private Long certificateId;

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

    protected ParticipantNotification() {
    }

    public boolean markRead(Instant now) {
        Objects.requireNonNull(now, "now must not be null");
        if (readAt != null) return false;
        if (now.isBefore(createdAt)) {
            throw new IllegalArgumentException("readAt must not be before createdAt");
        }
        readAt = now.truncatedTo(java.time.temporal.ChronoUnit.MICROS);
        return true;
    }

    public ParticipantNotificationReferenceType getReferenceType() {
        if (eventId != null) return ParticipantNotificationReferenceType.EVENT;
        if (activityId != null) return ParticipantNotificationReferenceType.ACTIVITY;
        return ParticipantNotificationReferenceType.CERTIFICATE;
    }

    public Long getReferenceId() {
        if (eventId != null) return eventId;
        if (activityId != null) return activityId;
        return certificateId;
    }

    public Long getNotificationId() { return notificationId; }
    public Long getRecipientUserId() { return recipientUserId; }
    public ParticipantNotificationType getType() { return type; }
    public Long getEventId() { return eventId; }
    public Long getActivityId() { return activityId; }
    public Long getCertificateId() { return certificateId; }
    public String getDeduplicationKey() { return deduplicationKey; }
    public String getTitle() { return title; }
    public String getMessage() { return message; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getReadAt() { return readAt; }
    public boolean isRead() { return readAt != null; }
}
