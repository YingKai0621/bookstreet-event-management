package com.swp391.bookstreet.payment.entity;

import com.swp391.bookstreet.booth.entity.BoothHold;
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
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "booth_payments")
public class BoothPayment {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "booth_payment_id")
    private Long boothPaymentId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "booth_hold_id", nullable = false, updatable = false)
    private BoothHold boothHold;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "original_payment_id", updatable = false)
    private BoothPayment originalPayment;

    @Enumerated(EnumType.STRING)
    @Column(name = "transaction_type", nullable = false, length = 20, updatable = false)
    private BoothPaymentTransactionType transactionType;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40, updatable = false)
    private BoothPaymentPurpose purpose;

    @Column(nullable = false, precision = 14, scale = 2, updatable = false)
    private BigDecimal amount;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private BoothPaymentStatus status;

    @Column(name = "idempotency_key", nullable = false, updatable = false, unique = true)
    private UUID idempotencyKey;

    @Column(name = "gateway_provider", nullable = false, length = 30, updatable = false)
    private String gatewayProvider;

    @Column(name = "gateway_transaction_ref", length = 150)
    private String gatewayTransactionRef;

    @Column(name = "checkout_url", columnDefinition = "text")
    private String checkoutUrl;

    @Column(name = "checkout_expires_at")
    private Instant checkoutExpiresAt;

    @Column(name = "provider_response_code", length = 10)
    private String providerResponseCode;

    @Column(name = "provider_transaction_status", length = 10)
    private String providerTransactionStatus;

    @Column(name = "last_gateway_query_at")
    private Instant lastGatewayQueryAt;

    @Column(name = "trusted_incomplete_query_count", nullable = false)
    private short trustedIncompleteQueryCount;

    @Column(name = "reconciliation_required", nullable = false)
    private boolean reconciliationRequired;

    @Column(name = "reconciliation_detail", columnDefinition = "text")
    private String reconciliationDetail;

    @Column(name = "failure_code", length = 50)
    private String failureCode;

    @Column(name = "failure_message", columnDefinition = "text")
    private String failureMessage;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "completed_at")
    private Instant completedAt;

    protected BoothPayment() {
    }

    public static BoothPayment createInitialRental(BoothHold hold, UUID idempotencyKey,
            Instant now) {
        BoothPayment payment = new BoothPayment();
        payment.boothHold = hold;
        payment.transactionType = BoothPaymentTransactionType.PAYMENT;
        payment.purpose = BoothPaymentPurpose.INITIAL_BOOTH_RENTAL;
        payment.amount = hold.getLockedRentalPrice();
        payment.status = BoothPaymentStatus.PENDING;
        payment.idempotencyKey = idempotencyKey;
        payment.gatewayProvider = "VNPAY";
        payment.trustedIncompleteQueryCount = 0;
        payment.createdAt = now;
        payment.updatedAt = now;
        return payment;
    }

    public void attachCheckout(String checkoutUrl, Instant checkoutExpiresAt, Instant now) {
        requirePending();
        if (checkoutUrl == null || checkoutUrl.isBlank() || checkoutExpiresAt == null
                || !checkoutExpiresAt.isAfter(createdAt)
                || checkoutExpiresAt.isAfter(boothHold.getExpiresAt())) {
            throw new IllegalStateException("Checkout metadata is invalid.");
        }
        this.checkoutUrl = checkoutUrl;
        this.checkoutExpiresAt = checkoutExpiresAt;
        this.reconciliationRequired = false;
        this.updatedAt = now;
    }

    public void recordProviderEvidence(String responseCode, String transactionStatus,
            String transactionRef, Instant now) {
        this.providerResponseCode = responseCode;
        this.providerTransactionStatus = transactionStatus;
        if (transactionRef != null && !transactionRef.isBlank()) {
            this.gatewayTransactionRef = transactionRef;
        }
        this.updatedAt = now;
    }

    public void requireReconciliation(String detail, Instant now) {
        requirePending();
        this.reconciliationRequired = true;
        this.reconciliationDetail = detail;
        this.updatedAt = now;
    }

    public void recordTrustedIncompleteQuery(String responseCode, String transactionStatus,
            String transactionRef, Instant queriedAt) {
        requirePending();
        recordProviderEvidence(responseCode, transactionStatus, transactionRef, queriedAt);
        this.lastGatewayQueryAt = queriedAt;
        this.trustedIncompleteQueryCount = (short) Math.min(2,
                trustedIncompleteQueryCount + 1);
        this.reconciliationRequired = true;
    }

    public void recordGatewayQuery(Instant queriedAt) {
        requirePending();
        this.lastGatewayQueryAt = queriedAt;
        this.reconciliationRequired = true;
        this.updatedAt = queriedAt;
    }

    public void succeed(String transactionRef, String responseCode,
            String transactionStatus, Instant now) {
        if (status == BoothPaymentStatus.SUCCESS) return;
        if (status != BoothPaymentStatus.PENDING && status != BoothPaymentStatus.TIMEOUT) {
            throw new IllegalStateException("Only Pending or locally timed-out Payment can succeed.");
        }
        recordProviderEvidence(responseCode, transactionStatus, transactionRef, now);
        this.status = BoothPaymentStatus.SUCCESS;
        this.reconciliationRequired = false;
        this.reconciliationDetail = null;
        this.completedAt = now;
    }

    public void fail(String code, String message, String responseCode,
            String transactionStatus, String transactionRef, Instant now) {
        requirePending();
        recordProviderEvidence(responseCode, transactionStatus, transactionRef, now);
        this.status = BoothPaymentStatus.FAILED;
        this.failureCode = code;
        this.failureMessage = message;
        this.reconciliationRequired = false;
        this.completedAt = now;
    }

    public void timeout(Instant now) {
        requirePending();
        if (trustedIncompleteQueryCount < 2) {
            throw new IllegalStateException("Two trusted incomplete QueryDR results are required.");
        }
        this.status = BoothPaymentStatus.TIMEOUT;
        this.reconciliationRequired = false;
        this.completedAt = now;
        this.updatedAt = now;
    }

    public void recordUnsafeLateSuccess(String transactionRef, String responseCode,
            String transactionStatus, Instant now) {
        recordProviderEvidence(responseCode, transactionStatus, transactionRef, now);
        this.reconciliationRequired = true;
        this.reconciliationDetail = "VERIFIED_LATE_SUCCESS_REQUIRES_MANUAL_REFUND";
    }

    private void requirePending() {
        if (status != BoothPaymentStatus.PENDING) {
            throw new IllegalStateException("Payment is not Pending.");
        }
    }

    public Long getBoothPaymentId() { return boothPaymentId; }
    public BoothHold getBoothHold() { return boothHold; }
    public BoothPayment getOriginalPayment() { return originalPayment; }
    public BoothPaymentTransactionType getTransactionType() { return transactionType; }
    public BoothPaymentPurpose getPurpose() { return purpose; }
    public BigDecimal getAmount() { return amount; }
    public BoothPaymentStatus getStatus() { return status; }
    public UUID getIdempotencyKey() { return idempotencyKey; }
    public String getGatewayProvider() { return gatewayProvider; }
    public String getGatewayTransactionRef() { return gatewayTransactionRef; }
    public String getCheckoutUrl() { return checkoutUrl; }
    public Instant getCheckoutExpiresAt() { return checkoutExpiresAt; }
    public String getProviderResponseCode() { return providerResponseCode; }
    public String getProviderTransactionStatus() { return providerTransactionStatus; }
    public Instant getLastGatewayQueryAt() { return lastGatewayQueryAt; }
    public short getTrustedIncompleteQueryCount() { return trustedIncompleteQueryCount; }
    public boolean isReconciliationRequired() { return reconciliationRequired; }
    public String getReconciliationDetail() { return reconciliationDetail; }
    public String getFailureCode() { return failureCode; }
    public String getFailureMessage() { return failureMessage; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public Instant getCompletedAt() { return completedAt; }
}
