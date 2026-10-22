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

    public Long getActivityRatingId() { return activityRatingId; }
    public Long getAttendanceId() { return attendanceId; }
    public Short getScore() { return score; }
    public String getComment() { return comment; }
    public ActivityRatingStatus getStatus() { return status; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public Instant getInvalidatedAt() { return invalidatedAt; }
}
