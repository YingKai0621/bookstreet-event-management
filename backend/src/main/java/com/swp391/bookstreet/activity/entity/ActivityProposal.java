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
@Table(name = "activity_proposals")
public class ActivityProposal {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "activity_proposal_id")
    private Long activityProposalId;

    @Column(name = "application_id", nullable = false, updatable = false)
    private Long applicationId;

    @Column(name = "location_id", nullable = false)
    private Long locationId;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(columnDefinition = "text")
    private String description;

    @Column(name = "activity_type", nullable = false, length = 50)
    private String activityType;

    @Column(name = "proposed_start_at", nullable = false)
    private Instant proposedStartAt;

    @Column(name = "proposed_end_at", nullable = false)
    private Instant proposedEndAt;

    @Column(nullable = false)
    private Integer capacity;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ActivityProposalStatus status;

    @Column(name = "review_note", columnDefinition = "text")
    private String reviewNote;

    @Column(name = "submitted_at", nullable = false, updatable = false)
    private Instant submittedAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "reviewed_at")
    private Instant reviewedAt;

    @Column(name = "withdrawn_at")
    private Instant withdrawnAt;

    @Column(name = "cancelled_at")
    private Instant cancelledAt;

    protected ActivityProposal() {
    }

    public Long getActivityProposalId() { return activityProposalId; }
    public Long getApplicationId() { return applicationId; }
    public Long getLocationId() { return locationId; }
    public String getTitle() { return title; }
    public String getDescription() { return description; }
    public String getActivityType() { return activityType; }
    public Instant getProposedStartAt() { return proposedStartAt; }
    public Instant getProposedEndAt() { return proposedEndAt; }
    public Integer getCapacity() { return capacity; }
    public ActivityProposalStatus getStatus() { return status; }
    public String getReviewNote() { return reviewNote; }
    public Instant getSubmittedAt() { return submittedAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public Instant getReviewedAt() { return reviewedAt; }
    public Instant getWithdrawnAt() { return withdrawnAt; }
    public Instant getCancelledAt() { return cancelledAt; }
}
