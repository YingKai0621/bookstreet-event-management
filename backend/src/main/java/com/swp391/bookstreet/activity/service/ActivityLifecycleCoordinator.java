package com.swp391.bookstreet.activity.service;

import com.swp391.bookstreet.activity.entity.Activity;
import com.swp391.bookstreet.activity.entity.ActivityRequestType;
import com.swp391.bookstreet.activity.entity.ActivityStatus;
import java.time.Instant;
import org.springframework.stereotype.Component;

@Component
public class ActivityLifecycleCoordinator {
    private final ActivityLockService lockService;
    private final ActivityPartnerNotificationService notificationService;

    public ActivityLifecycleCoordinator(ActivityLockService lockService,
            ActivityPartnerNotificationService notificationService) {
        this.lockService = lockService;
        this.notificationService = notificationService;
    }

    public boolean advanceLocked(Activity activity, Instant now) {
        if (!activity.advanceTimedLifecycle(now)) return false;
        ActivityStatus status = activity.getStatus();
        lockService.lockPendingRequestsAfterActivity(activity.getActivityId()).forEach(request -> {
            if (status == ActivityStatus.COMPLETED
                    || request.getRequestType() == ActivityRequestType.CHANGE) {
                if (request.cancelIfPending(now)) {
                    notificationService.activityChanged(activity.getActivityId(),
                            request.getActivityRequestId(),
                            ActivityPartnerMessageType.REQUEST_CLOSED_BY_SYSTEM,
                            "The request was closed because the Activity lifecycle advanced to "
                                    + status + ".", now);
                }
            }
        });
        return true;
    }
}
