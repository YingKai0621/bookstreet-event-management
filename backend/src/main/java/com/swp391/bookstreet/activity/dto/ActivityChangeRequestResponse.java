package com.swp391.bookstreet.activity.dto;

import com.swp391.bookstreet.activity.entity.ActivityRequest;
import com.swp391.bookstreet.activity.entity.ActivityRequestStatus;
import java.time.Instant;

public record ActivityChangeRequestResponse(
        Long activityChangeRequestId,
        Long activityId,
        ActivityRequestStatus status,
        String reason,
        String requestedTitle,
        boolean requestedDescriptionIncluded,
        String requestedDescription,
        String requestedActivityType,
        Long requestedLocationId,
        Instant requestedStartAt,
        Instant requestedEndAt,
        Integer requestedCapacity,
        boolean requestedImageUrlIncluded,
        String requestedImageUrl,
        String reviewNote,
        Instant submittedAt,
        Instant handledAt,
        Instant withdrawnAt,
        Instant cancelledAt
) {
    public static ActivityChangeRequestResponse from(ActivityRequest request) {
        return new ActivityChangeRequestResponse(request.getActivityRequestId(),
                request.getActivityId(), request.getStatus(), request.getReason(),
                request.getRequestedTitle(), request.isRequestedDescriptionPresent(),
                request.getRequestedDescription(), request.getRequestedActivityType(),
                request.getRequestedLocationId(), request.getRequestedStartAt(),
                request.getRequestedEndAt(), request.getRequestedCapacity(),
                request.isRequestedImageUrlPresent(), request.getRequestedImageUrl(),
                request.getReviewNote(), request.getSubmittedAt(), request.getHandledAt(),
                request.getWithdrawnAt(), request.getCancelledAt());
    }
}
