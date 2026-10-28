package com.swp391.bookstreet.reward.dto;

public record RewardSummaryResponse(
        long totalPoints,
        long totalVisits,
        long earnedBadgeCount,
        long activeBadgeCount,
        ParticipantBadgeResponse nextBadge) {
}
