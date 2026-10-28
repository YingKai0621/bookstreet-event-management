package com.swp391.bookstreet.reward.service;

import com.swp391.bookstreet.reward.dto.BadgeSynchronizationResponse;
import com.swp391.bookstreet.reward.security.RewardManagementCurrentUser;
import org.springframework.stereotype.Service;

@Service
public class AdminBadgeSynchronizationService {
    private final RewardManagementCurrentUser currentUser;
    private final BadgeSynchronizationBatchService batches;
    private final BadgeSynchronizationProcessor processor;

    public AdminBadgeSynchronizationService(RewardManagementCurrentUser currentUser,
            BadgeSynchronizationBatchService batches, BadgeSynchronizationProcessor processor) {
        this.currentUser = currentUser;
        this.batches = batches;
        this.processor = processor;
    }

    public BadgeSynchronizationResponse synchronize(Long badgeId) {
        currentUser.requireAdmin();
        RewardManagementQuery.positiveId(badgeId, true);
        var batch = batches.process(badgeId);
        long remaining = batches.remaining(badgeId);
        if (remaining > 0) processor.schedule(badgeId);
        return new BadgeSynchronizationResponse(badgeId, batch.processedCount(), batch.awardedCount(),
                remaining, remaining == 0);
    }
}
