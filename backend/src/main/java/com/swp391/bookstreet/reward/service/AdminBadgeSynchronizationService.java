package com.swp391.bookstreet.reward.service;

import com.swp391.bookstreet.admin.entity.AdminAuditAction;
import com.swp391.bookstreet.admin.service.AdminAuditWriter;
import com.swp391.bookstreet.reward.dto.BadgeSynchronizationResponse;
import com.swp391.bookstreet.reward.repository.BadgeRepository;
import com.swp391.bookstreet.reward.security.RewardManagementCurrentUser;
import java.util.Map;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AdminBadgeSynchronizationService {
    private final RewardManagementCurrentUser currentUser;
    private final BadgeSynchronizationBatchService batches;
    private final BadgeRepository badges;
    private final AdminAuditWriter auditWriter;
    private final ApplicationEventPublisher events;

    public AdminBadgeSynchronizationService(RewardManagementCurrentUser currentUser,
            BadgeSynchronizationBatchService batches, BadgeRepository badges,
            AdminAuditWriter auditWriter, ApplicationEventPublisher events) {
        this.currentUser = currentUser;
        this.batches = batches;
        this.badges = badges;
        this.auditWriter = auditWriter;
        this.events = events;
    }

    @Transactional
    public BadgeSynchronizationResponse synchronize(Long badgeId) {
        currentUser.requireAdmin();
        RewardManagementQuery.positiveId(badgeId, true);
        var badge = badges.findById(badgeId).orElseThrow(AdminBadgeService::notFound);
        var batch = batches.process(badgeId);
        long remaining = batches.remaining(badgeId);
        boolean completed = remaining == 0;
        auditWriter.write(AdminAuditAction.BADGE_AWARDS_SYNCHRONIZED, badgeId, badge.getName(), null,
                Map.of(
                        "processedCount", batch.processedCount(),
                        "awardedCount", batch.awardedCount(),
                        "remainingEligibleCount", remaining,
                        "completed", completed));
        if (!completed) events.publishEvent(new BadgeSynchronizationRequested(badgeId));
        return new BadgeSynchronizationResponse(
                badgeId, batch.processedCount(), batch.awardedCount(), remaining, completed);
    }
}
