package com.swp391.bookstreet.payment.dto;

import com.swp391.bookstreet.payment.entity.BoothPaymentStatus;
import com.swp391.bookstreet.payment.entity.BoothPaymentTransactionType;
import java.math.BigDecimal;
import java.time.Instant;

/**
 * One Booth Payment with the Event, organization and Booth it belongs to, read in a single query.
 * It never holds the checkout URL, idempotency key, provider response codes, reconciliation detail or
 * failure text, so neither history view can expose them by mistake.
 */
public record BoothPaymentHistoryRow(
        Long boothPaymentId,
        Long eventId,
        String eventName,
        Long partnerOrganizationId,
        String partnerOrganizationName,
        Long boothId,
        String boothCode,
        String boothName,
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
}
