package com.swp391.bookstreet.reward.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Objects;

@Entity
@Table(name = "booth_visits")
public class BoothVisit {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "booth_visit_id")
    private Long boothVisitId;

    @Column(name = "event_registration_id", nullable = false, updatable = false)
    private Long eventRegistrationId;

    @Column(name = "booth_assignment_id", nullable = false, updatable = false)
    private Long boothAssignmentId;

    @Column(name = "visited_at", nullable = false, updatable = false)
    private Instant visitedAt;

    protected BoothVisit() {
    }

    public static BoothVisit record(Long eventRegistrationId, Long boothAssignmentId,
            Instant visitedAt) {
        BoothVisit visit = new BoothVisit();
        visit.eventRegistrationId = positive(eventRegistrationId, "eventRegistrationId");
        visit.boothAssignmentId = positive(boothAssignmentId, "boothAssignmentId");
        visit.visitedAt = Objects.requireNonNull(visitedAt, "visitedAt must not be null")
                .truncatedTo(ChronoUnit.MICROS);
        return visit;
    }

    private static Long positive(Long value, String field) {
        Objects.requireNonNull(value, field + " must not be null");
        if (value <= 0) throw new IllegalArgumentException(field + " must be positive");
        return value;
    }

    public Long getBoothVisitId() { return boothVisitId; }
    public Long getEventRegistrationId() { return eventRegistrationId; }
    public Long getBoothAssignmentId() { return boothAssignmentId; }
    public Instant getVisitedAt() { return visitedAt; }
}
