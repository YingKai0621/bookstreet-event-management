package com.swp391.bookstreet.reward.dto;

public record BadgeSynchronizationResponse(
        Long badgeId, int processedCount, int awardedCount, long remainingEligibleCount,
        boolean completed) {
}
