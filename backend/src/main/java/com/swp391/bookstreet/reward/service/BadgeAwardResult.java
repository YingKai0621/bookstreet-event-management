package com.swp391.bookstreet.reward.service;

import java.util.List;

public record BadgeAwardResult(List<AwardedBadge> awardedBadges) {
    public BadgeAwardResult {
        awardedBadges = List.copyOf(awardedBadges);
    }

    public int awardedCount() {
        return awardedBadges.size();
    }
}
