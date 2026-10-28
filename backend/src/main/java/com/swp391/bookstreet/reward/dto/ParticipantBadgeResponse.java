package com.swp391.bookstreet.reward.dto;

import com.swp391.bookstreet.reward.service.AwardedBadge;
import java.time.Instant;

public record ParticipantBadgeResponse(
        Long badgeId,
        String name,
        String description,
        String iconUrl,
        Integer requiredPoints,
        boolean isActive,
        String state,
        boolean earned,
        Instant earnedAt,
        long remainingPoints,
        int progressPercent) {

    public static ParticipantBadgeResponse newlyEarned(AwardedBadge badge) {
        return new ParticipantBadgeResponse(
                badge.badgeId(), badge.name(), badge.description(), badge.iconUrl(),
                badge.requiredPoints(), true, "EARNED", true, badge.earnedAt(), 0, 100);
    }
}
