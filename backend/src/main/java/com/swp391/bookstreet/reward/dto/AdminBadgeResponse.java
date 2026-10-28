package com.swp391.bookstreet.reward.dto;

import com.swp391.bookstreet.reward.entity.Badge;
import java.time.Instant;

public record AdminBadgeResponse(
        Long badgeId, String name, String description, int requiredPoints, String iconUrl,
        boolean isActive, long awardedUserCount, long remainingEligibleCount,
        Instant createdAt, Instant updatedAt) {
    public static AdminBadgeResponse from(Badge badge, long awarded, long remaining) {
        return new AdminBadgeResponse(badge.getBadgeId(), badge.getName(), badge.getDescription(),
                badge.getRequiredPoints(), badge.getIconUrl(), badge.isActive(), awarded, remaining,
                badge.getCreatedAt(), badge.getUpdatedAt());
    }
}
