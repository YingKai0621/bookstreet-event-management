package com.swp391.bookstreet.notification.service;

import com.swp391.bookstreet.notification.entity.Notification;
import com.swp391.bookstreet.notification.entity.NotificationRecipientRole;
import com.swp391.bookstreet.notification.entity.NotificationType;
import com.swp391.bookstreet.notification.repository.NotificationRepository;
import java.time.Instant;
import java.util.Objects;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class NotificationWriterService implements NotificationWriter {
    private final NotificationRepository notificationRepository;
    private final ApplicationEventPublisher eventPublisher;

    public NotificationWriterService(NotificationRepository notificationRepository,
            ApplicationEventPublisher eventPublisher) {
        this.notificationRepository = notificationRepository;
        this.eventPublisher = eventPublisher;
    }

    @Override
    @Transactional
    public NotificationWriteResult write(NotificationCommand command) {
        NormalizedNotification notification = normalize(command);
        boolean created = notificationRepository.insertIfAbsent(
                notification.recipientUserId(),
                notification.recipientRole().name(),
                notification.type().name(),
                notification.eventId(),
                notification.activityId(),
                notification.certificateId(),
                notification.badgeId(),
                notification.partnerEventApplicationId(),
                notification.boothRequestId(),
                notification.activityProposalId(),
                notification.activityRequestId(),
                notification.deduplicationKey(),
                notification.title(),
                notification.message(),
                notification.createdAt()) == 1;

        Notification durableNotification = notificationRepository
                .findByRecipientUserIdAndRecipientRoleAndDeduplicationKey(
                        notification.recipientUserId(),
                        notification.recipientRole(),
                        notification.deduplicationKey())
                .orElseThrow(() -> new IllegalStateException(
                        "Notification insert completed without a durable row."));
        if (created) {
            eventPublisher.publishEvent(new NotificationCreated(
                    notification.recipientUserId(), notification.recipientRole()));
        }
        return new NotificationWriteResult(durableNotification, created);
    }

    private NormalizedNotification normalize(NotificationCommand command) {
        Objects.requireNonNull(command, "command must not be null");
        Long recipientUserId = positive(command.recipientUserId(), "recipientUserId");
        NotificationRecipientRole recipientRole = Objects.requireNonNull(
                command.recipientRole(), "recipientRole must not be null");
        NotificationType type = Objects.requireNonNull(command.type(), "type must not be null");
        if (!type.supports(recipientRole)) {
            throw new IllegalArgumentException("Notification type is not compatible with recipientRole.");
        }

        Long eventId = optionalPositive(command.eventId(), "eventId");
        Long activityId = optionalPositive(command.activityId(), "activityId");
        Long certificateId = optionalPositive(command.certificateId(), "certificateId");
        Long badgeId = optionalPositive(command.badgeId(), "badgeId");
        Long applicationId = optionalPositive(
                command.partnerEventApplicationId(), "partnerEventApplicationId");
        Long boothRequestId = optionalPositive(command.boothRequestId(), "boothRequestId");
        Long proposalId = optionalPositive(command.activityProposalId(), "activityProposalId");
        Long activityRequestId = optionalPositive(command.activityRequestId(), "activityRequestId");
        validateReference(type, eventId, activityId, certificateId, badgeId,
                applicationId, boothRequestId, proposalId, activityRequestId);

        return new NormalizedNotification(
                recipientUserId,
                recipientRole,
                type,
                eventId,
                activityId,
                certificateId,
                badgeId,
                applicationId,
                boothRequestId,
                proposalId,
                activityRequestId,
                normalizedRequired(command.deduplicationKey(), 200, "deduplicationKey"),
                normalizedRequired(command.title(), 200, "title"),
                normalizedRequired(command.message(), null, "message"),
                Objects.requireNonNull(command.createdAt(), "createdAt must not be null"));
    }

    private void validateReference(
            NotificationType type,
            Long eventId,
            Long activityId,
            Long certificateId,
            Long badgeId,
            Long applicationId,
            Long boothRequestId,
            Long proposalId,
            Long activityRequestId) {
        int referenceCount = countNonNull(eventId, activityId, certificateId, badgeId,
                applicationId, boothRequestId, proposalId, activityRequestId);
        boolean expectedReference = switch (type) {
            case ACTIVITY_SCHEDULE_OR_LOCATION_CHANGED, ACTIVITY_CANCELLED,
                    ACTIVITY_STARTING_SOON, PARTNER_ACTIVITY_CANCELLED -> activityId != null;
            case EVENT_CANCELLED, PARTNER_EVENT_CANCELLED,
                    PARTNER_EVENT_PUBLISHED -> eventId != null;
            case CERTIFICATE_ISSUED, CERTIFICATE_REVOKED -> certificateId != null;
            case BADGE_UNLOCKED -> badgeId != null;
            case PARTNER_APPLICATION_STATUS_CHANGED,
                    ORGANIZER_NEW_PARTNER_APPLICATION -> applicationId != null;
            case PARTNER_BOOTH_REQUEST_STATUS_CHANGED,
                    PARTNER_BOOTH_HOLD_EXPIRING,
                    ORGANIZER_NEW_BOOTH_REQUEST,
                    ORGANIZER_BOOTH_RESELECTION_REQUIRED,
                    ORGANIZER_BOOTH_PAYMENT_CONFIRMED -> boothRequestId != null;
            case PARTNER_ACTIVITY_PROPOSAL_STATUS_CHANGED,
                    ORGANIZER_ACTIVITY_PROPOSAL_SUBMITTED -> proposalId != null;
            case PARTNER_ACTIVITY_CHANGE_REQUEST_STATUS_CHANGED,
                    PARTNER_ACTIVITY_CANCELLATION_REQUEST_STATUS_CHANGED,
                    ORGANIZER_NEW_ACTIVITY_CHANGE_REQUEST,
                    ORGANIZER_NEW_ACTIVITY_CANCELLATION_REQUEST -> activityRequestId != null;
        };
        if (referenceCount != 1 || !expectedReference) {
            throw new IllegalArgumentException(
                    "Notification type requires exactly its approved reference.");
        }
    }

    private int countNonNull(Object... values) {
        int count = 0;
        for (Object value : values) {
            if (value != null) count++;
        }
        return count;
    }

    private Long positive(Long value, String field) {
        Objects.requireNonNull(value, field + " must not be null");
        if (value <= 0) throw new IllegalArgumentException(field + " must be positive");
        return value;
    }

    private Long optionalPositive(Long value, String field) {
        if (value == null) return null;
        if (value <= 0) throw new IllegalArgumentException(field + " must be positive");
        return value;
    }

    private String normalizedRequired(String value, Integer maxLength, String field) {
        Objects.requireNonNull(value, field + " must not be null");
        String normalized = value.trim();
        if (normalized.isEmpty()) {
            throw new IllegalArgumentException(field + " must not be blank");
        }
        if (maxLength != null && normalized.length() > maxLength) {
            throw new IllegalArgumentException(field + " exceeds " + maxLength + " characters");
        }
        return normalized;
    }

    private record NormalizedNotification(
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
}
