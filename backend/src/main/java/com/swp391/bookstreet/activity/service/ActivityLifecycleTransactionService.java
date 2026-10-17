package com.swp391.bookstreet.activity.service;

import com.swp391.bookstreet.activity.entity.Activity;
import java.time.Clock;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ActivityLifecycleTransactionService {
    private final ActivityLockService lockService;
    private final ActivityLifecycleCoordinator coordinator;
    private final Clock clock;

    public ActivityLifecycleTransactionService(ActivityLockService lockService,
            ActivityLifecycleCoordinator coordinator, Clock clock) {
        this.lockService = lockService;
        this.coordinator = coordinator;
        this.clock = clock;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public boolean advance(Long activityId) {
        var locks = lockService.lockActivityRoot(activityId);
        return coordinator.advanceLocked(locks.activity(), clock.instant());
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public Activity advanceAndGet(Long activityId) {
        var locks = lockService.lockActivityRoot(activityId);
        coordinator.advanceLocked(locks.activity(), clock.instant());
        return locks.activity();
    }
}
