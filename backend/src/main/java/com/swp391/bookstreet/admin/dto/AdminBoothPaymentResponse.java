package com.swp391.bookstreet.admin.dto;

import com.swp391.bookstreet.payment.dto.BoothPaymentHistoryRow;
import com.swp391.bookstreet.payment.entity.BoothPaymentStatus;
import com.swp391.bookstreet.payment.entity.BoothPaymentTransactionType;
import java.math.BigDecimal;
import java.time.Instant;

/**
 * AC-OPT-S11-01: one Booth Payment as Admin sees it, read-only. It carries no checkout URL, idempotency key,
 * provider response code, reconciliation detail or failure text, so no gateway secret or raw callback data leaves
 * the backend.
 */
public record AdminBoothPaymentResponse(
        Long boothPaymentId,
        EventRef event,
        OrganizationRef partnerOrganization,
        BoothRef booth,
        BoothPaymentTransactionType transactionType,
        BigDecimal amount,
        BoothPaymentStatus status,
        boolean reconciliationRequired,
        String gatewayProvider,
        String gatewayTransactionRef,
        String failureCode,
        Instant createdAt,
        Instant completedAt
) {
    public record EventRef(Long eventId, String name) {
    }

    public record OrganizationRef(Long partnerOrganizationId, String name) {
    }

    public record BoothRef(Long boothId, String code, String name) {
    }

    public static AdminBoothPaymentResponse from(BoothPaymentHistoryRow row) {
        return new AdminBoothPaymentResponse(
                row.boothPaymentId(),
                new EventRef(row.eventId(), row.eventName()),
                new OrganizationRef(row.partnerOrganizationId(), row.partnerOrganizationName()),
                new BoothRef(row.boothId(), row.boothCode(), row.boothName()),
                row.transactionType(),
                row.amount(),
                row.status(),
                row.reconciliationRequired(),
                row.gatewayProvider(),
                row.gatewayTransactionRef(),
                row.failureCode(),
                row.createdAt(),
                row.completedAt());
    }
}
