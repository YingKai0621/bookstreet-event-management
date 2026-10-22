package com.swp391.bookstreet.registration.entity;

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
@Table(name = "event_registrations")
public class EventRegistration {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "event_registration_id")
    private Long eventRegistrationId;

    @Column(name = "user_id", nullable = false, updatable = false)
    private Long userId;

    @Column(name = "event_id", nullable = false, updatable = false)
    private Long eventId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "event_id", insertable = false, updatable = false)
    private Event event;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private EventRegistrationStatus status;

    @Column(name = "registered_at", nullable = false, updatable = false)
    private Instant registeredAt;

    @Column(name = "activated_at", nullable = false)
    private Instant activatedAt;

    @Column(name = "left_at")
    private Instant leftAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected EventRegistration() {
    }

    public static EventRegistration join(Long userId, Long eventId, Instant now) {
        EventRegistration registration = new EventRegistration();
        registration.userId = Objects.requireNonNull(userId, "userId must not be null");
        registration.eventId = Objects.requireNonNull(eventId, "eventId must not be null");
        registration.status = EventRegistrationStatus.ACTIVE;
        registration.registeredAt = Objects.requireNonNull(now, "now must not be null");
        registration.activatedAt = now;
        registration.updatedAt = now;
        return registration;
    }

    public boolean reactivate(Instant now) {
        Objects.requireNonNull(now, "now must not be null");
        if (status == EventRegistrationStatus.ACTIVE) return false;
        requireNotBefore(now, leftAt, "reactivation time must not be before leftAt");
        status = EventRegistrationStatus.ACTIVE;
        activatedAt = now;
        leftAt = null;
        updatedAt = now;
        return true;
    }

    public boolean leave(Instant now) {
        Objects.requireNonNull(now, "now must not be null");
        if (status == EventRegistrationStatus.LEFT) return false;
        requireNotBefore(now, activatedAt, "leave time must not be before activatedAt");
        status = EventRegistrationStatus.LEFT;
        leftAt = now;
        updatedAt = now;
        return true;
    }

    private void requireNotBefore(Instant candidate, Instant boundary, String message) {
        if (boundary != null && candidate.isBefore(boundary)) {
            throw new IllegalArgumentException(message);
        }
    }

    public Long getEventRegistrationId() { return eventRegistrationId; }
    public Long getUserId() { return userId; }
    public Long getEventId() { return eventId; }
    public Event getEvent() { return event; }
    public EventRegistrationStatus getStatus() { return status; }
    public Instant getRegisteredAt() { return registeredAt; }
    public Instant getActivatedAt() { return activatedAt; }
    public Instant getLeftAt() { return leftAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
