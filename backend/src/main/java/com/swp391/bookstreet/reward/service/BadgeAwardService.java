package com.swp391.bookstreet.reward.service;

import java.time.Instant;

/**
 * Shared command boundary for scan and badge-backfill orchestration.
 * Callers provide a trusted user identity and current durable Point total.
 */
public interface BadgeAwardService {
    BadgeAwardResult awardEligibleBadges(Long userId, long totalPoints, Instant earnedAt);

    BadgeAwardResult awardBadgeIfEligible(
            Long userId, Long badgeId, long totalPoints, Instant earnedAt);
}
