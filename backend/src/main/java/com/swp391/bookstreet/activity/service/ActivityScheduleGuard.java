package com.swp391.bookstreet.activity.service;

import com.swp391.bookstreet.activity.exception.ActivityApiException;
import com.swp391.bookstreet.activity.repository.ActivityRepository;
import java.time.Instant;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@Transactional(readOnly = true)
public class ActivityScheduleGuard {
    private final ActivityRepository activityRepository;

    public ActivityScheduleGuard(ActivityRepository activityRepository) {
        this.activityRepository = activityRepository;
    }

    public void requireAvailable(Long locationId, Instant startAt, Instant endAt,
            Long excludedActivityId) {
        if (activityRepository.existsScheduleConflict(locationId, startAt, endAt,
                excludedActivityId)) {
            throw new ActivityApiException(HttpStatus.CONFLICT,
                    "ACTIVITY_LOCATION_TIME_CONFLICT",
                    "Location already has another Activity in this time interval.");
        }
    }
}
