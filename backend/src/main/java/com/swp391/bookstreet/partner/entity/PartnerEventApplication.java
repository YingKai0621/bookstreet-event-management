package com.swp391.bookstreet.partner.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.time.Instant;

@Entity
@Table(
        name = "partner_event_applications",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_partner_event_applications_partner_event",
                columnNames = {"partner_organization_id", "event_id"}
        )
)
public class PartnerEventApplication {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "application_id")
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "partner_organization_id", nullable = false)
    private PartnerOrganization partnerOrganization;

    // Event belongs to the event module; keep the foreign-key value here to avoid
    // coupling this module to another member's entity implementation.
    @Column(name = "event_id", nullable = false)
    private Long eventId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ApplicationStatus status;

    @Column(name = "application_note", columnDefinition = "TEXT")
    private String applicationNote;

    @Column(name = "review_note", columnDefinition = "TEXT")
    private String reviewNote;

    @Column(name = "submitted_at", nullable = false)
    private Instant submittedAt;

    @Column(name = "reviewed_at")
    private Instant reviewedAt;

    @Column(name = "withdrawn_at")
    private Instant withdrawnAt;

    protected PartnerEventApplication() {
    }

    public static PartnerEventApplication submit(
            PartnerOrganization partnerOrganization,
            Long eventId,
            String applicationNote,
            Instant submittedAt
    ) {
        PartnerEventApplication application = new PartnerEventApplication();
        application.partnerOrganization = partnerOrganization;
        application.eventId = eventId;
        application.status = ApplicationStatus.PENDING;
        application.applicationNote = applicationNote;
        application.submittedAt = submittedAt;
        return application;
    }

    public void withdraw(Instant withdrawnAt) {
        this.status = ApplicationStatus.WITHDRAWN;
        this.withdrawnAt = withdrawnAt;
    }

    public void approve(String reviewNote, Instant reviewedAt) {
        this.status = ApplicationStatus.APPROVED;
        this.reviewNote = reviewNote;
        this.reviewedAt = reviewedAt;
    }

    public void reject(String reviewNote, Instant reviewedAt) {
        this.status = ApplicationStatus.REJECTED;
        this.reviewNote = reviewNote;
        this.reviewedAt = reviewedAt;
    }

    public Long getId() {
        return id;
    }

    public PartnerOrganization getPartnerOrganization() {
        return partnerOrganization;
    }

    public Long getEventId() {
        return eventId;
    }

    public ApplicationStatus getStatus() {
        return status;
    }

    public String getApplicationNote() {
        return applicationNote;
    }

    public String getReviewNote() {
        return reviewNote;
    }

    public Instant getSubmittedAt() {
        return submittedAt;
    }

    public Instant getReviewedAt() {
        return reviewedAt;
    }

    public Instant getWithdrawnAt() {
        return withdrawnAt;
    }

    public enum ApplicationStatus {
        PENDING,
        APPROVED,
        REJECTED,
        WITHDRAWN
    }
}
