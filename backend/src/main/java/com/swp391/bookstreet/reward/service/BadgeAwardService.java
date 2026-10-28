package com.swp391.bookstreet.reward.service;

import java.time.Instant;

/**
 * Shared command boundary for scan and badge-backfill orchestration.
 * Callers provide a trusted user identity. Scan evaluation locks active Badge rules before
 * re-reading the durable Point ledger so concurrent scans cannot miss a threshold crossing.
 */
public interface BadgeAwardService {
    BadgeAwardResult awardEligibleBadges(Long userId, Instant earnedAt);

    BadgeAwardResult awardBadgeIfEligible(
            Long userId, Long badgeId, long totalPoints, Instant earnedAt);
}
