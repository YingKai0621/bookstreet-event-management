package com.swp391.bookstreet.payment.dto;

import com.swp391.bookstreet.payment.entity.BoothPayment;
import com.swp391.bookstreet.payment.entity.BoothPaymentPurpose;
import com.swp391.bookstreet.payment.entity.BoothPaymentStatus;
import com.swp391.bookstreet.payment.entity.BoothPaymentTransactionType;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record BoothPaymentResponse(
        Long boothPaymentId,
        Long boothRequestId,
        Long boothHoldId,
        BoothPaymentTransactionType transactionType,
        BoothPaymentPurpose purpose,
        BigDecimal amount,
        BoothPaymentStatus status,
        UUID idempotencyKey,
        String gatewayProvider,
        String gatewayTransactionRef,
        String failureCode,
        String failureMessage,
        boolean reconciliationRequired,
        Instant createdAt,
        Instant updatedAt,
        Instant completedAt
) {
    public static BoothPaymentResponse from(BoothPayment payment) {
        return new BoothPaymentResponse(payment.getBoothPaymentId(),
                payment.getBoothHold().getBoothRequest().getBoothRequestId(),
                payment.getBoothHold().getBoothHoldId(), payment.getTransactionType(),
                payment.getPurpose(), payment.getAmount(), payment.getStatus(),
                payment.getIdempotencyKey(), payment.getGatewayProvider(),
                payment.getGatewayTransactionRef(), payment.getFailureCode(),
                payment.getFailureMessage(), payment.isReconciliationRequired(),
                payment.getCreatedAt(), payment.getUpdatedAt(), payment.getCompletedAt());
    }
}
