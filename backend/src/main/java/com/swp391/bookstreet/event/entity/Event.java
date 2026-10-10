package com.swp391.bookstreet.event.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.Objects;

@Entity
@Table(name = "events")
public class Event {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "event_id")
    private Long eventId;

    @Column(name = "organizer_user_id", nullable = false, updatable = false)
    private Long organizerUserId;

    @Column(name = "name", nullable = false, length = 150)
    private String name;

    @Column(name = "description", columnDefinition = "text")
    private String description;

    @Column(name = "start_at", nullable = false)
    private Instant startAt;

    @Column(name = "end_at", nullable = false)
    private Instant endAt;

    @Column(name = "partner_application_deadline_at")
    private Instant partnerApplicationDeadlineAt;

    @Column(name = "booth_request_deadline_at")
    private Instant boothRequestDeadlineAt;

    @Column(name = "activity_proposal_deadline_at")
    private Instant activityProposalDeadlineAt;

    @Column(name = "participant_registration_deadline_at")
    private Instant participantRegistrationDeadlineAt;

    @Column(name = "partner_withdrawal_cutoff_at")
    private Instant partnerWithdrawalCutoffAt;

    @Column(name = "booth_cancellation_cutoff_at")
    private Instant boothCancellationCutoffAt;

    @Column(name = "activity_cancellation_cutoff_at")
    private Instant activityCancellationCutoffAt;

    @Column(name = "booth_payment_window_minutes", nullable = false)
    private Integer boothPaymentWindowMinutes;

    @Column(name = "max_booths_per_partner", nullable = false)
    private Integer maxBoothsPerPartner;

    @Column(name = "max_activities_per_partner", nullable = false)
    private Integer maxActivitiesPerPartner;

    @Column(name = "banner_url", columnDefinition = "text")
    private String bannerUrl;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private EventStatus status;

    @Column(name = "cancelled_at")
    private Instant cancelledAt;

    @Column(name = "cancellation_reason", columnDefinition = "text")
    private String cancellationReason;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public Event() {
    }

    public boolean advanceTimedLifecycle(Instant now) {
        Objects.requireNonNull(now, "now must not be null");

        if (status == EventStatus.PUBLISHED) {
            if (!now.isBefore(endAt)) {
                status = EventStatus.COMPLETED;
                return true;
            }
            if (!now.isBefore(startAt)) {
                status = EventStatus.ONGOING;
                return true;
            }
        } else if (status == EventStatus.ONGOING && !now.isBefore(endAt)) {
            status = EventStatus.COMPLETED;
            return true;
        }

        return false;
    }

    public void cancel(String reason, Instant now) {
        Objects.requireNonNull(reason, "reason must not be null");
        Objects.requireNonNull(now, "now must not be null");
        if (status != EventStatus.PUBLISHED) {
            throw new IllegalStateException("Only a Published Event can be cancelled.");
        }
        status = EventStatus.CANCELLED;
        cancelledAt = now;
        cancellationReason = reason;
    }

    @PrePersist
    void onCreate() {
        createdAt = Instant.now();
        updatedAt = createdAt;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }

    public Long getEventId() { return eventId; }

    public Long getOrganizerUserId() { return organizerUserId; }
    public void setOrganizerUserId(Long organizerUserId) { this.organizerUserId = organizerUserId; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public Instant getStartAt() { return startAt; }
    public void setStartAt(Instant startAt) { this.startAt = startAt; }

    public Instant getEndAt() { return endAt; }
    public void setEndAt(Instant endAt) { this.endAt = endAt; }

    public Instant getPartnerApplicationDeadlineAt() { return partnerApplicationDeadlineAt; }
    public void setPartnerApplicationDeadlineAt(Instant partnerApplicationDeadlineAt) { this.partnerApplicationDeadlineAt = partnerApplicationDeadlineAt; }

    public Instant getBoothRequestDeadlineAt() { return boothRequestDeadlineAt; }
    public void setBoothRequestDeadlineAt(Instant boothRequestDeadlineAt) { this.boothRequestDeadlineAt = boothRequestDeadlineAt; }

    public Instant getActivityProposalDeadlineAt() { return activityProposalDeadlineAt; }
    public void setActivityProposalDeadlineAt(Instant activityProposalDeadlineAt) { this.activityProposalDeadlineAt = activityProposalDeadlineAt; }

    public Instant getParticipantRegistrationDeadlineAt() { return participantRegistrationDeadlineAt; }
    public void setParticipantRegistrationDeadlineAt(Instant participantRegistrationDeadlineAt) { this.participantRegistrationDeadlineAt = participantRegistrationDeadlineAt; }

    public Instant getPartnerWithdrawalCutoffAt() { return partnerWithdrawalCutoffAt; }
    public void setPartnerWithdrawalCutoffAt(Instant partnerWithdrawalCutoffAt) { this.partnerWithdrawalCutoffAt = partnerWithdrawalCutoffAt; }

    public Instant getBoothCancellationCutoffAt() { return boothCancellationCutoffAt; }
    public void setBoothCancellationCutoffAt(Instant boothCancellationCutoffAt) { this.boothCancellationCutoffAt = boothCancellationCutoffAt; }

    public Instant getActivityCancellationCutoffAt() { return activityCancellationCutoffAt; }
    public void setActivityCancellationCutoffAt(Instant activityCancellationCutoffAt) { this.activityCancellationCutoffAt = activityCancellationCutoffAt; }

    public Integer getBoothPaymentWindowMinutes() { return boothPaymentWindowMinutes; }
    public void setBoothPaymentWindowMinutes(Integer boothPaymentWindowMinutes) { this.boothPaymentWindowMinutes = boothPaymentWindowMinutes; }

    public Integer getMaxBoothsPerPartner() { return maxBoothsPerPartner; }
    public void setMaxBoothsPerPartner(Integer maxBoothsPerPartner) { this.maxBoothsPerPartner = maxBoothsPerPartner; }

    public Integer getMaxActivitiesPerPartner() { return maxActivitiesPerPartner; }
    public void setMaxActivitiesPerPartner(Integer maxActivitiesPerPartner) { this.maxActivitiesPerPartner = maxActivitiesPerPartner; }

    public String getBannerUrl() { return bannerUrl; }
    public void setBannerUrl(String bannerUrl) { this.bannerUrl = bannerUrl; }

    public EventStatus getStatus() { return status; }
    public void setStatus(EventStatus status) { this.status = status; }

    public Instant getCancelledAt() { return cancelledAt; }

    public String getCancellationReason() { return cancellationReason; }

    public Instant getCreatedAt() { return createdAt; }

    public Instant getUpdatedAt() { return updatedAt; }
}

