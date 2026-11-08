package com.swp391.bookstreet.reward.service;

import com.swp391.bookstreet.common.exception.ApiException;
import com.swp391.bookstreet.reward.entity.Badge;
import com.swp391.bookstreet.reward.repository.AdminBadgeQueryRepository;
import com.swp391.bookstreet.reward.repository.BadgeRepository;
import com.swp391.bookstreet.reward.repository.PointTransactionRepository;
import java.time.Clock;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class BadgeSynchronizationBatchService {
    private final BadgeRepository badges;
    private final AdminBadgeQueryRepository queries;
    private final PointTransactionRepository points;
    private final BadgeAwardService awards;
    private final Clock clock;

    public BadgeSynchronizationBatchService(BadgeRepository badges, AdminBadgeQueryRepository queries,
            PointTransactionRepository points, BadgeAwardService awards, Clock clock) {
        this.badges = badges;
        this.queries = queries;
        this.points = points;
        this.awards = awards;
        this.clock = clock;
    }

    @Transactional
    public BatchResult process(Long badgeId) {
        Badge badge = badges.findByBadgeIdForUpdate(badgeId).orElseThrow(AdminBadgeService::notFound);
        if (!badge.isActive()) throw new ApiException(HttpStatus.CONFLICT, "BADGE_NOT_ACTIVE",
                "Huy hiệu đang tạm dừng, không thể đồng bộ phần thưởng.");
        var candidates = queries.candidates(badge);
        int awarded = 0;
        for (Long userId : candidates) {
            long totalPoints = points.sumPointsByUserId(userId);
            awarded += awards.awardBadgeIfEligible(userId, badgeId, totalPoints, clock.instant()).awardedCount();
        }
        return new BatchResult(candidates.size(), awarded);
    }

    @Transactional(readOnly = true)
    public long remaining(Long badgeId) {
        return queries.remaining(badges.findById(badgeId).orElseThrow(AdminBadgeService::notFound));
    }

    public record BatchResult(int processedCount, int awardedCount) { }
}
