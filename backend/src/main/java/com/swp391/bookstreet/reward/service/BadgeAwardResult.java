package com.swp391.bookstreet.reward.service;

import java.util.List;

public record BadgeAwardResult(List<AwardedBadge> awardedBadges, long totalPoints) {
    public BadgeAwardResult {
        awardedBadges = List.copyOf(awardedBadges);
        if (totalPoints < 0) throw new IllegalArgumentException("totalPoints must not be negative");
    }

    public int awardedCount() {
        return awardedBadges.size();
    }
}
