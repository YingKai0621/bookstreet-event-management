package com.swp391.bookstreet.booth.service;

import java.math.BigDecimal;
import java.time.Instant;

public record BoothSelectionMessageRequested(
        Long boothRequestId,
        String recipientEmail,
        String eventName,
        String boothCode,
        BigDecimal lockedRentalPrice,
        Instant expiresAt
) {
}
