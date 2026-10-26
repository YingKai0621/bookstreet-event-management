package com.swp391.bookstreet.activity.dto;

import com.swp391.bookstreet.activity.entity.Activity;
import com.swp391.bookstreet.activity.entity.ActivityCancellationSource;
import com.swp391.bookstreet.activity.entity.ActivityStatus;
import com.swp391.bookstreet.booth.entity.Location;
import java.time.Instant;
import java.util.UUID;

public record ActivityResponse(
        Long activityId,
        Long eventId,
        Long sourceProposalId,
        Long partnerOrganizationId,
        ActivityLocationResponse location,
        String title,
        String description,
        String activityType,
        Instant startAt,
        Instant endAt,
        Integer capacity,
        String imageUrl,
        boolean registrationRequired,
        Instant registrationDeadlineAt,
        boolean certificateEnabled,
        int attendanceEarlyScanMinutes,
        boolean attendanceQrAvailable,
        UUID attendanceQrToken,
        ActivityStatus status,
        Instant createdAt,
        Instant updatedAt,
        Instant publishedAt,
        Instant completedAt,
        Instant cancelledAt,
        String cancellationReason,
        ActivityCancellationSource cancellationSource
) {
    @Override
    public String toString() {
        return "ActivityResponse[activityId=" + activityId + ", status=" + status + "]";
    }

    public static ActivityResponse organizer(Activity activity, Location location,
            Long partnerOrganizationId) {
        return new ActivityResponse(activity.getActivityId(), activity.getEventId(),
                activity.getSourceProposalId(), partnerOrganizationId,
                ActivityLocationResponse.from(location), activity.getTitle(),
                activity.getDescription(), activity.getActivityType(), activity.getStartAt(),
                activity.getEndAt(), activity.getCapacity(), activity.getImageUrl(),
                activity.isRegistrationRequired(), activity.getRegistrationDeadlineAt(),
                activity.isCertificateEnabled(), activity.getAttendanceEarlyScanMinutes(),
                activity.getAttendanceQrToken() != null,
                activity.getAttendanceQrToken(), activity.getStatus(), activity.getCreatedAt(),
                activity.getUpdatedAt(), activity.getPublishedAt(), activity.getCompletedAt(),
                activity.getCancelledAt(), activity.getCancellationReason(),
                activity.getCancellationSource());
    }

    public static ActivityResponse partner(Activity activity, Location location,
            Long partnerOrganizationId) {
        return new ActivityResponse(activity.getActivityId(), activity.getEventId(),
                activity.getSourceProposalId(), partnerOrganizationId,
                ActivityLocationResponse.from(location), activity.getTitle(),
                activity.getDescription(), activity.getActivityType(), activity.getStartAt(),
                activity.getEndAt(), activity.getCapacity(), activity.getImageUrl(),
                activity.isRegistrationRequired(), activity.getRegistrationDeadlineAt(),
                activity.isCertificateEnabled(), activity.getAttendanceEarlyScanMinutes(),
                activity.getAttendanceQrToken() != null,
                null, activity.getStatus(), activity.getCreatedAt(), activity.getUpdatedAt(),
                activity.getPublishedAt(), activity.getCompletedAt(),
                activity.getCancelledAt(), activity.getCancellationReason(),
                activity.getCancellationSource());
    }
}
