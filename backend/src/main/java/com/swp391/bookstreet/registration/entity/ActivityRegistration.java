package com.swp391.bookstreet.registration.entity;

import com.swp391.bookstreet.activity.entity.Activity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.Objects;

@Entity
@Table(name = "activity_registrations")
public class ActivityRegistration {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "activity_registration_id")
    private Long activityRegistrationId;

    @Column(name = "event_registration_id", nullable = false, updatable = false)
    private Long eventRegistrationId;

    @Column(name = "activity_id", nullable = false, updatable = false)
    private Long activityId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "activity_id", insertable = false, updatable = false)
    private Activity activity;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ActivityRegistrationStatus status;

    @Enumerated(EnumType.STRING)
    @Column(name = "cancellation_source", length = 20)
    private ActivityRegistrationCancellationSource cancellationSource;

    @Column(name = "registered_at", nullable = false, updatable = false)
    private Instant registeredAt;

    @Column(name = "activated_at", nullable = false)
    private Instant activatedAt;

    @Column(name = "cancelled_at")
    private Instant cancelledAt;

    @Column(name = "no_show_at")
    private Instant noShowAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected ActivityRegistration() {
    }

    public static ActivityRegistration register(Long eventRegistrationId, Long activityId,
            Instant now) {
        ActivityRegistration registration = new ActivityRegistration();
        registration.eventRegistrationId = Objects.requireNonNull(
                eventRegistrationId, "eventRegistrationId must not be null");
        registration.activityId = Objects.requireNonNull(activityId, "activityId must not be null");
        registration.status = ActivityRegistrationStatus.ACTIVE;
        registration.registeredAt = Objects.requireNonNull(now, "now must not be null");
        registration.activatedAt = now;
        registration.updatedAt = now;
        return registration;
    }

    public boolean reactivateParticipantCancellation(Instant now) {
        Objects.requireNonNull(now, "now must not be null");
        if (status == ActivityRegistrationStatus.ACTIVE) return false;
        if (status != ActivityRegistrationStatus.CANCELLED
                || cancellationSource != ActivityRegistrationCancellationSource.PARTICIPANT) {
            throw new IllegalStateException("Only a Participant-cancelled registration can reactivate.");
        }
        requireNotBefore(now, cancelledAt,
                "reactivation time must not be before cancelledAt");
        status = ActivityRegistrationStatus.ACTIVE;
        cancellationSource = null;
        cancelledAt = null;
        noShowAt = null;
        activatedAt = now;
        updatedAt = now;
        return true;
    }

    public boolean cancel(ActivityRegistrationCancellationSource source, Instant now) {
        Objects.requireNonNull(source, "source must not be null");
        Objects.requireNonNull(now, "now must not be null");
        if (status == ActivityRegistrationStatus.CANCELLED) return false;
        if (status != ActivityRegistrationStatus.ACTIVE) {
            throw new IllegalStateException("Only an Active registration can be cancelled.");
        }
        requireNotBefore(now, activatedAt, "cancellation time must not be before activatedAt");
        status = ActivityRegistrationStatus.CANCELLED;
        cancellationSource = source;
        cancelledAt = now;
        noShowAt = null;
        updatedAt = now;
        return true;
    }

    public boolean markNoShow(Instant now) {
        Objects.requireNonNull(now, "now must not be null");
        if (status == ActivityRegistrationStatus.NO_SHOW) return false;
        if (status != ActivityRegistrationStatus.ACTIVE) {
            throw new IllegalStateException("Only an Active registration can become No-show.");
        }
        requireNotBefore(now, activatedAt, "no-show time must not be before activatedAt");
        status = ActivityRegistrationStatus.NO_SHOW;
        cancellationSource = null;
        cancelledAt = null;
        noShowAt = now;
        updatedAt = now;
        return true;
    }

    public void restoreAttendanceOutcome(Instant now) {
        if (status == ActivityRegistrationStatus.CANCELLED) return;
        status = ActivityRegistrationStatus.ACTIVE;
        noShowAt = null;
        updatedAt = now;
    }

    public void attendanceChanged(Instant now) {
        updatedAt = now;
    }

    private void requireNotBefore(Instant candidate, Instant boundary, String message) {
        if (boundary != null && candidate.isBefore(boundary)) {
            throw new IllegalArgumentException(message);
        }
    }

    public Long getActivityRegistrationId() { return activityRegistrationId; }
    public Long getEventRegistrationId() { return eventRegistrationId; }
    public Long getActivityId() { return activityId; }
    public Activity getActivity() { return activity; }
    public ActivityRegistrationStatus getStatus() { return status; }
    public ActivityRegistrationCancellationSource getCancellationSource() {
        return cancellationSource;
    }
    public Instant getRegisteredAt() { return registeredAt; }
    public Instant getActivatedAt() { return activatedAt; }
    public Instant getCancelledAt() { return cancelledAt; }
    public Instant getNoShowAt() { return noShowAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
