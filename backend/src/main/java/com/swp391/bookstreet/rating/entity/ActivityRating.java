package com.swp391.bookstreet.rating.entity;

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
@Table(name = "activity_ratings")
public class ActivityRating {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "activity_rating_id")
    private Long activityRatingId;

    @Column(name = "attendance_id", nullable = false, updatable = false)
    private Long attendanceId;

    @Column(name = "rating_score", nullable = false)
    private Short score;

    @Column(length = 1000)
    private String comment;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ActivityRatingStatus status;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "invalidated_at")
    private Instant invalidatedAt;

    protected ActivityRating() {
    }

    public static ActivityRating create(Long attendanceId, Short score, String comment, Instant now) {
        Objects.requireNonNull(attendanceId, "attendanceId must not be null");
        Objects.requireNonNull(now, "now must not be null");
        validateScore(score);
        String normalizedComment = normalizeComment(comment);

        ActivityRating rating = new ActivityRating();
        rating.attendanceId = attendanceId;
        rating.score = score;
        rating.comment = normalizedComment;
        rating.status = ActivityRatingStatus.ACTIVE;
        rating.createdAt = now;
        rating.updatedAt = now;
        rating.invalidatedAt = null;
        return rating;
    }

    public void update(Short score, String comment, Instant now) {
        Objects.requireNonNull(now, "now must not be null");
        requireNotBefore(now, createdAt, "updatedAt must not be before createdAt");
        validateScore(score);
        this.score = score;
        this.comment = normalizeComment(comment);
        this.updatedAt = now;
    }

    private static void validateScore(Short score) {
        if (score == null || score < 1 || score > 5) {
            throw new IllegalArgumentException("score must be between 1 and 5");
        }
    }

    private static String normalizeComment(String comment) {
        if (comment == null) {
            return null;
        }
        String trimmed = comment.trim();
        if (trimmed.isEmpty()) {
            return null;
        }
        if (trimmed.length() > 1000) {
            throw new IllegalArgumentException("comment length must not exceed 1000 characters");
        }
        return trimmed;
    }

    public boolean invalidate(Instant now) {
        Objects.requireNonNull(now, "now must not be null");
        if (status == ActivityRatingStatus.INVALIDATED) return false;
        requireNotBefore(now, createdAt, "invalidatedAt must not be before createdAt");
        status = ActivityRatingStatus.INVALIDATED;
        invalidatedAt = now;
        updatedAt = now;
        return true;
    }

    public boolean restore(Instant now) {
        Objects.requireNonNull(now, "now must not be null");
        if (status == ActivityRatingStatus.ACTIVE) return false;
        requireNotBefore(now, invalidatedAt, "restore time must not be before invalidatedAt");
        status = ActivityRatingStatus.ACTIVE;
        invalidatedAt = null;
        updatedAt = now;
        return true;
    }

    private void requireNotBefore(Instant candidate, Instant boundary, String message) {
        if (boundary != null && candidate.isBefore(boundary)) {
            throw new IllegalArgumentException(message);
        }
    }

    public Long getActivityRatingId() { return activityRatingId; }
    public Long getAttendanceId() { return attendanceId; }
    public Short getScore() { return score; }
    public String getComment() { return comment; }
    public ActivityRatingStatus getStatus() { return status; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public Instant getInvalidatedAt() { return invalidatedAt; }
}
