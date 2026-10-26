package com.swp391.bookstreet.activity.service;

import com.swp391.bookstreet.attendance.service.ActivityParticipationLifecycleService;
import com.swp391.bookstreet.activity.entity.Activity;
import com.swp391.bookstreet.activity.entity.ActivityRequestType;
import com.swp391.bookstreet.activity.entity.ActivityStatus;
import java.time.Instant;
import org.springframework.stereotype.Component;

@Component
public class ActivityLifecycleCoordinator {
    private final ActivityLockService lockService;
    private final ActivityParticipationLifecycleService participation;
    private final ActivityPartnerNotificationService notificationService;

    public ActivityLifecycleCoordinator(ActivityLockService lockService,
            ActivityPartnerNotificationService notificationService, ActivityParticipationLifecycleService participation) {
        this.lockService = lockService;
        this.notificationService = notificationService;
        this.participation = participation;
    }

    public boolean advanceLocked(Activity activity, Instant now) {
        boolean advanced = activity.advanceTimedLifecycle(now);
        ActivityStatus status = activity.getStatus();
        if (advanced) lockService.lockPendingRequestsAfterActivity(activity.getActivityId()).forEach(request -> {
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
        if (status == ActivityStatus.COMPLETED) participation.finalizeCompleted(activity, now);
        return advanced;
    }
}
