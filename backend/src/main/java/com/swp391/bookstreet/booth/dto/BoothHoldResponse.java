package com.swp391.bookstreet.booth.dto;

import com.swp391.bookstreet.booth.entity.BoothHold;
import com.swp391.bookstreet.booth.entity.BoothHoldStatus;
import java.math.BigDecimal;
import java.time.Instant;

public record BoothHoldResponse(
        Long boothHoldId,
        BoothHoldStatus status,
        BigDecimal lockedRentalPrice,
        Instant createdAt,
        Instant expiresAt,
        Instant releasedAt
) {
    public static BoothHoldResponse from(BoothHold hold) {
        if (hold == null) {
            return null;
        }
        return new BoothHoldResponse(
                hold.getBoothHoldId(),
                hold.getStatus(),
                hold.getLockedRentalPrice(),
                hold.getCreatedAt(),
                hold.getExpiresAt(),
                hold.getReleasedAt()
        );
    }
}
