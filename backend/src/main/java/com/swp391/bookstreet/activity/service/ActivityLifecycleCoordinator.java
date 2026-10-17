package com.swp391.bookstreet.activity.service;

import com.swp391.bookstreet.activity.entity.Activity;
import com.swp391.bookstreet.activity.entity.ActivityRequestType;
import com.swp391.bookstreet.activity.entity.ActivityStatus;
import java.time.Instant;
import org.springframework.stereotype.Component;

@Component
public class ActivityLifecycleCoordinator {
    private final ActivityLockService lockService;

    public ActivityLifecycleCoordinator(ActivityLockService lockService) {
        this.lockService = lockService;
    }

    public boolean advanceLocked(Activity activity, Instant now) {
        if (!activity.advanceTimedLifecycle(now)) return false;
        ActivityStatus status = activity.getStatus();
        lockService.lockPendingRequestsAfterActivity(activity.getActivityId()).forEach(request -> {
            if (status == ActivityStatus.COMPLETED
                    || request.getRequestType() == ActivityRequestType.CHANGE) {
                request.cancelIfPending(now);
            }
        });
        return true;
    }
}
