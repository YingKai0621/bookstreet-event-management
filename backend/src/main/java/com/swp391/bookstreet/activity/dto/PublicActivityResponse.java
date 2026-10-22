package com.swp391.bookstreet.activity.dto;

import com.swp391.bookstreet.activity.entity.Activity;
import com.swp391.bookstreet.activity.entity.ActivityCancellationSource;
import com.swp391.bookstreet.activity.entity.ActivityStatus;
import com.swp391.bookstreet.booth.entity.Location;
import com.swp391.bookstreet.event.entity.Event;
import com.swp391.bookstreet.event.entity.EventStatus;
import java.time.Instant;

public record PublicActivityResponse(
        Long activityId,
        Long eventId,
        String eventName,
        PublicActivityLocationResponse location,
        String title,
        String description,
        String activityType,
        Instant startAt,
        Instant endAt,
        Integer capacity,
        String imageUrl,
        boolean registrationRequired,
        Instant registrationDeadlineAt,
        boolean registrationOpen,
        Long registeredCount,
        Long availableSeats,
        boolean certificateEnabled,
        boolean attendanceQrAvailable,
        ActivityRatingSummaryResponse ratingSummary,
        ActivityStatus status,
        Instant publishedAt,
        Instant completedAt,
        Instant cancelledAt,
        String cancellationReason,
        ActivityCancellationSource cancellationSource
) {
    public static PublicActivityResponse from(Activity activity, Event event, Location location,
            long seatCount, ActivityRatingSummaryResponse ratingSummary, Instant now) {
        boolean registrationRequired = activity.isRegistrationRequired();
        Long registeredCount = registrationRequired ? seatCount : null;
        Long availableSeats = registrationRequired
                ? Math.max(0L, activity.getCapacity().longValue() - seatCount) : null;
        boolean registrationOpen = registrationRequired
                && activity.getStatus() == ActivityStatus.PUBLISHED
                && (event.getStatus() == EventStatus.PUBLISHED
                    || event.getStatus() == EventStatus.ONGOING)
                && activity.getRegistrationDeadlineAt() != null
                && !now.isAfter(activity.getRegistrationDeadlineAt())
                && event.getParticipantRegistrationDeadlineAt() != null
                && !now.isAfter(event.getParticipantRegistrationDeadlineAt())
                && availableSeats > 0;
        return new PublicActivityResponse(activity.getActivityId(), activity.getEventId(),
                event.getName(), PublicActivityLocationResponse.from(location),
                activity.getTitle(), activity.getDescription(), activity.getActivityType(),
                activity.getStartAt(), activity.getEndAt(), activity.getCapacity(),
                activity.getImageUrl(), registrationRequired,
                activity.getRegistrationDeadlineAt(), registrationOpen, registeredCount,
                availableSeats, activity.isCertificateEnabled(),
                activity.getAttendanceQrToken() != null, ratingSummary, activity.getStatus(),
                activity.getPublishedAt(), activity.getCompletedAt(), activity.getCancelledAt(),
                activity.getCancellationReason(), activity.getCancellationSource());
    }
}
