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
@Table(name = "point_transactions")
public class PointTransaction {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "point_transaction_id")
    private Long pointTransactionId;

    @Column(name = "booth_visit_id", nullable = false, updatable = false)
    private Long boothVisitId;

    @Column(nullable = false, updatable = false)
    private Integer points;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected PointTransaction() {
    }

    public static PointTransaction award(Long boothVisitId, int points, Instant createdAt) {
        PointTransaction transaction = new PointTransaction();
        transaction.boothVisitId = positive(boothVisitId, "boothVisitId");
        if (points <= 0) throw new IllegalArgumentException("points must be positive");
        transaction.points = points;
        transaction.createdAt = Objects.requireNonNull(createdAt, "createdAt must not be null")
                .truncatedTo(ChronoUnit.MICROS);
        return transaction;
    }

    private static Long positive(Long value, String field) {
        Objects.requireNonNull(value, field + " must not be null");
        if (value <= 0) throw new IllegalArgumentException(field + " must be positive");
        return value;
    }

    public Long getPointTransactionId() { return pointTransactionId; }
    public Long getBoothVisitId() { return boothVisitId; }
    public Integer getPoints() { return points; }
    public Instant getCreatedAt() { return createdAt; }
}
