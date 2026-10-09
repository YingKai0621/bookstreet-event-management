package com.swp391.bookstreet.payment.service;

import java.math.BigDecimal;
import java.time.Instant;

public record PaymentQueryClaim(
        Long paymentId,
        BigDecimal amount,
        Instant paymentCreatedAt,
        Instant queriedAt
) {
}
