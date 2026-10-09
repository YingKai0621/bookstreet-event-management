package com.swp391.bookstreet.payment.dto;

import java.time.Instant;

public record PaymentInitiationResponse(
        BoothPaymentResponse payment,
        String checkoutUrl,
        Instant sessionExpiresAt,
        String resolution
) {
}
