package com.swp391.bookstreet.booth.entity;

import com.swp391.bookstreet.partner.entity.PartnerEventApplication;
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
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "booth_requests")
public class BoothRequest {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "booth_request_id")
    private Long boothRequestId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "application_id", nullable = false, updatable = false)
    private PartnerEventApplication application;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "booth_id", nullable = false, updatable = false)
    private Booth booth;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private BoothRequestStatus status;

    @Column(name = "request_note", columnDefinition = "text")
    private String requestNote;

    @Column(name = "review_note", columnDefinition = "text")
    private String reviewNote;

    @Column(name = "submitted_at", nullable = false)
    private Instant submittedAt;

    @Column(name = "reviewed_at")
    private Instant reviewedAt;

    @Column(name = "selected_at")
    private Instant selectedAt;

    @Column(name = "completed_at")
    private Instant completedAt;

    @Column(name = "payment_expired_at")
    private Instant paymentExpiredAt;

    @Column(name = "withdrawn_at")
    private Instant withdrawnAt;

    @Column(name = "cancelled_at")
    private Instant cancelledAt;

    @OneToOne(mappedBy = "boothRequest", fetch = FetchType.LAZY)
    private BoothHold hold;

    protected BoothRequest() {
    }

    public static BoothRequest submit(PartnerEventApplication application, Booth booth,
            String requestNote, Instant submittedAt) {
        BoothRequest request = new BoothRequest();
        request.application = application;
        request.booth = booth;
        request.status = BoothRequestStatus.PENDING;
        request.requestNote = requestNote;
        request.submittedAt = submittedAt;
        return request;
    }

    public void withdraw(Instant now) {
        this.status = BoothRequestStatus.WITHDRAWN;
        this.withdrawnAt = now;
    }

    public void reject(String reviewNote, Instant now) {
        this.status = BoothRequestStatus.REJECTED;
        this.reviewNote = reviewNote;
        this.reviewedAt = now;
    }

    public void select(Instant now) {
        this.status = BoothRequestStatus.SELECTED;
        this.reviewedAt = now;
        this.selectedAt = now;
    }

    void attachHold(BoothHold hold) {
        this.hold = hold;
    }

    void paymentExpired(Instant now) {
        if (status == BoothRequestStatus.SELECTED) {
            status = BoothRequestStatus.PAYMENT_EXPIRED;
            paymentExpiredAt = now;
        }
    }

    public void complete(Instant now) {
        if (status != BoothRequestStatus.SELECTED) {
            throw new IllegalStateException("Only a Selected Booth request can be completed.");
        }
        status = BoothRequestStatus.COMPLETED;
        completedAt = now;
    }

    public void notSelected(Instant now) {
        if (status != BoothRequestStatus.PENDING) {
            return;
        }
        status = BoothRequestStatus.NOT_SELECTED;
        completedAt = now;
    }

    public boolean cancel(Instant now) {
        if (status != BoothRequestStatus.PENDING && status != BoothRequestStatus.SELECTED) {
            return false;
        }
        status = BoothRequestStatus.CANCELLED;
        cancelledAt = now;
        return true;
    }

    public Long getBoothRequestId() {
        return boothRequestId;
    }

    public PartnerEventApplication getApplication() {
        return application;
    }

    public Booth getBooth() {
        return booth;
    }

    public BoothRequestStatus getStatus() {
        return status;
    }

    public String getRequestNote() {
        return requestNote;
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

    public Instant getSelectedAt() {
        return selectedAt;
    }

    public Instant getCompletedAt() {
        return completedAt;
    }

    public Instant getPaymentExpiredAt() {
        return paymentExpiredAt;
    }

    public Instant getWithdrawnAt() {
        return withdrawnAt;
    }

    public Instant getCancelledAt() {
        return cancelledAt;
    }

    public BoothHold getHold() {
        return hold;
    }
}
