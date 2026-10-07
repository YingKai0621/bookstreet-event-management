package com.swp391.bookstreet.booth.dto;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * Shared response shape for Workstream C to populate after Organizer selection.
 * Partner submission deliberately returns this field as {@code null}.
 */
public record BoothHoldResponse(
        Long boothHoldId,
        String status,
        BigDecimal lockedRentalPrice,
        Instant createdAt,
        Instant expiresAt,
        Instant releasedAt
) {
}
