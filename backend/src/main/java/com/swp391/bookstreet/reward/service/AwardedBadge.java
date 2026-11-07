package com.swp391.bookstreet.reward.service;

import java.time.Instant;

public record AwardedBadge(
        Long userBadgeId,
        Long badgeId,
        String name,
        String description,
        Integer requiredPoints,
        String iconUrl,
        Instant earnedAt) {
}
