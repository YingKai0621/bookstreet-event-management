package com.swp391.bookstreet.feedback.entity;

import com.swp391.bookstreet.auth.entity.User;
import com.swp391.bookstreet.event.entity.Event;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.Objects;

@Entity
@Table(name = "general_feedbacks")
public class GeneralFeedback {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "general_feedback_id")
    private Long generalFeedbackId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "submitted_by_user_id")
    private User submittedBy;

    @Enumerated(EnumType.STRING)
    @Column(name = "target_type", nullable = false, length = 20)
    private GeneralFeedbackTargetType targetType;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "event_id")
    private Event event;

    @Column(name = "guest_name", length = 100)
    private String guestName;

    @Column(name = "contact_email", length = 255)
    private String contactEmail;

    @Column(name = "message", nullable = false, columnDefinition = "text")
    private String message;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private GeneralFeedbackStatus status;

    @Column(name = "internal_note", length = 1000)
    private String internalNote;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "last_handled_by_user_id")
    private User lastHandledBy;

    @Column(name = "handling_started_at")
    private Instant handlingStartedAt;

    @Column(name = "submitted_at", nullable = false, updatable = false)
    private Instant submittedAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "resolved_at")
    private Instant resolvedAt;

    protected GeneralFeedback() {
    }

    public static GeneralFeedback create(
            User submittedBy,
            GeneralFeedbackTargetType targetType,
            Event event,
            String guestName,
            String contactEmail,
            String message,
            Instant now
    ) {
        Objects.requireNonNull(targetType, "targetType must not be null");
        Objects.requireNonNull(message, "message must not be null");
        Objects.requireNonNull(now, "now must not be null");
        if ((targetType == GeneralFeedbackTargetType.BOOK_STREET) != (event == null)) {
            throw new IllegalArgumentException("targetType and event do not form a supported target");
        }

        GeneralFeedback feedback = new GeneralFeedback();
        feedback.submittedBy = submittedBy;
        feedback.targetType = targetType;
        feedback.event = event;
        feedback.guestName = guestName;
        feedback.contactEmail = contactEmail;
        feedback.message = message;
        feedback.status = GeneralFeedbackStatus.NEW;
        feedback.submittedAt = now;
        feedback.updatedAt = now;
        return feedback;
    }

    public void startHandling(User organizer, Instant now) {
        requireState(GeneralFeedbackStatus.NEW);
        this.status = GeneralFeedbackStatus.IN_PROGRESS;
        this.lastHandledBy = Objects.requireNonNull(organizer, "organizer must not be null");
        this.handlingStartedAt = requireTransitionTime(now);
        this.updatedAt = now;
    }

    public void resolve(User organizer, String normalizedInternalNote, Instant now) {
        requireState(GeneralFeedbackStatus.IN_PROGRESS);
        if (normalizedInternalNote == null || normalizedInternalNote.isBlank()) {
            throw new IllegalArgumentException("internalNote must not be blank");
        }
        this.status = GeneralFeedbackStatus.RESOLVED;
        this.lastHandledBy = Objects.requireNonNull(organizer, "organizer must not be null");
        this.internalNote = normalizedInternalNote;
        this.resolvedAt = requireTransitionTime(now);
        this.updatedAt = now;
    }

    public void reopen(User organizer, Instant now) {
        requireState(GeneralFeedbackStatus.RESOLVED);
        this.status = GeneralFeedbackStatus.IN_PROGRESS;
        this.lastHandledBy = Objects.requireNonNull(organizer, "organizer must not be null");
        this.handlingStartedAt = requireTransitionTime(now);
        this.resolvedAt = null;
        this.updatedAt = now;
    }

    private Instant requireTransitionTime(Instant now) {
        Objects.requireNonNull(now, "now must not be null");
        if (now.isBefore(submittedAt)) {
            throw new IllegalArgumentException("transition time must not be before submission");
        }
        return now;
    }

    private void requireState(GeneralFeedbackStatus required) {
        if (status != required) {
            throw new IllegalStateException("unsupported feedback state transition");
        }
    }

    public Long getGeneralFeedbackId() { return generalFeedbackId; }
    public User getSubmittedBy() { return submittedBy; }
    public GeneralFeedbackTargetType getTargetType() { return targetType; }
    public Event getEvent() { return event; }
    public String getGuestName() { return guestName; }
    public String getContactEmail() { return contactEmail; }
    public String getMessage() { return message; }
    public GeneralFeedbackStatus getStatus() { return status; }
    public String getInternalNote() { return internalNote; }
    public User getLastHandledBy() { return lastHandledBy; }
    public Instant getHandlingStartedAt() { return handlingStartedAt; }
    public Instant getSubmittedAt() { return submittedAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public Instant getResolvedAt() { return resolvedAt; }
}
