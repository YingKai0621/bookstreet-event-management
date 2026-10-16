package com.swp391.bookstreet.activity.entity;

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
@Table(name = "activity_requests")
public class ActivityRequest {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "activity_request_id")
    private Long activityRequestId;

    @Column(name = "activity_id", nullable = false, updatable = false)
    private Long activityId;

    @Enumerated(EnumType.STRING)
    @Column(name = "request_type", nullable = false, length = 20, updatable = false)
    private ActivityRequestType requestType;

    @Column(name = "requested_location_id")
    private Long requestedLocationId;

    @Column(name = "requested_title", length = 200)
    private String requestedTitle;

    @Column(name = "requested_description", columnDefinition = "text")
    private String requestedDescription;

    @Column(name = "requested_description_present", nullable = false)
    private boolean requestedDescriptionPresent;

    @Column(name = "requested_activity_type", length = 50)
    private String requestedActivityType;

    @Column(name = "requested_start_at")
    private Instant requestedStartAt;

    @Column(name = "requested_end_at")
    private Instant requestedEndAt;

    @Column(name = "requested_capacity")
    private Integer requestedCapacity;

    @Column(name = "requested_image_url", columnDefinition = "text")
    private String requestedImageUrl;

    @Column(name = "requested_image_url_present", nullable = false)
    private boolean requestedImageUrlPresent;

    @Column(nullable = false, columnDefinition = "text")
    private String reason;

    @Column(name = "is_late", nullable = false)
    private boolean late;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ActivityRequestStatus status;

    @Column(name = "review_note", columnDefinition = "text")
    private String reviewNote;

    @Column(name = "submitted_at", nullable = false, updatable = false)
    private Instant submittedAt;

    @Column(name = "handled_at")
    private Instant handledAt;

    @Column(name = "withdrawn_at")
    private Instant withdrawnAt;

    @Column(name = "cancelled_at")
    private Instant cancelledAt;

    protected ActivityRequest() {
    }

    public boolean cancelIfPending(Instant now) {
        if (status != ActivityRequestStatus.PENDING) return false;
        status = ActivityRequestStatus.CANCELLED;
        cancelledAt = now;
        return true;
    }

    public Long getActivityRequestId() { return activityRequestId; }
    public Long getActivityId() { return activityId; }
    public ActivityRequestType getRequestType() { return requestType; }
    public Long getRequestedLocationId() { return requestedLocationId; }
    public String getRequestedTitle() { return requestedTitle; }
    public String getRequestedDescription() { return requestedDescription; }
    public boolean isRequestedDescriptionPresent() { return requestedDescriptionPresent; }
    public String getRequestedActivityType() { return requestedActivityType; }
    public Instant getRequestedStartAt() { return requestedStartAt; }
    public Instant getRequestedEndAt() { return requestedEndAt; }
    public Integer getRequestedCapacity() { return requestedCapacity; }
    public String getRequestedImageUrl() { return requestedImageUrl; }
    public boolean isRequestedImageUrlPresent() { return requestedImageUrlPresent; }
    public String getReason() { return reason; }
    public boolean isLate() { return late; }
    public ActivityRequestStatus getStatus() { return status; }
    public String getReviewNote() { return reviewNote; }
    public Instant getSubmittedAt() { return submittedAt; }
    public Instant getHandledAt() { return handledAt; }
    public Instant getWithdrawnAt() { return withdrawnAt; }
    public Instant getCancelledAt() { return cancelledAt; }
}
