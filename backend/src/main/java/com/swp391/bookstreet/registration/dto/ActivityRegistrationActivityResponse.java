package com.swp391.bookstreet.registration.dto;

import com.swp391.bookstreet.activity.entity.Activity;
import com.swp391.bookstreet.booth.entity.Location;
import java.time.Instant;

public record ActivityRegistrationActivityResponse(
        Long activityId,
        Long eventId,
        String title,
        String locationCode,
        String locationName,
        Instant startAt,
        Instant endAt,
        String status) {
    public static ActivityRegistrationActivityResponse from(Activity activity, Location location) {
        return new ActivityRegistrationActivityResponse(activity.getActivityId(),
                activity.getEventId(), activity.getTitle(), location.getCode(),
                location.getName(), activity.getStartAt(), activity.getEndAt(),
                activity.getStatus().name());
    }
}
