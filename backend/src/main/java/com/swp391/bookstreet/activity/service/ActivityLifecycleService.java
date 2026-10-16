package com.swp391.bookstreet.activity.service;

import com.swp391.bookstreet.activity.entity.ActivityStatus;
import com.swp391.bookstreet.activity.repository.ActivityRepository;
import java.time.Clock;
import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class ActivityLifecycleService {
    private static final List<ActivityStatus> TIMED_STATUSES = List.of(
            ActivityStatus.PUBLISHED, ActivityStatus.ONGOING);

    private final ActivityRepository activityRepository;
    private final ActivityLifecycleTransactionService transactions;
    private final Clock clock;

    public ActivityLifecycleService(ActivityRepository activityRepository,
            ActivityLifecycleTransactionService transactions, Clock clock) {
        this.activityRepository = activityRepository;
        this.transactions = transactions;
        this.clock = clock;
    }

    public int advanceDueActivities() {
        int advanced = 0;
        for (Long activityId : activityRepository.findDueLifecycleIds(
                TIMED_STATUSES, clock.instant())) {
            if (transactions.advance(activityId)) advanced++;
        }
        return advanced;
    }
}
