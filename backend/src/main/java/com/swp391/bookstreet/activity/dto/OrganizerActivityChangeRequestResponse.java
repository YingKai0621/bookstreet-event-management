package com.swp391.bookstreet.activity.dto;

import com.swp391.bookstreet.activity.entity.ActivityRequest;
import com.swp391.bookstreet.activity.entity.ActivityRequestStatus;
import com.swp391.bookstreet.activity.repository.ActivityRequestRepository.OrganizerRequestContextView;
import com.swp391.bookstreet.booth.entity.LocationType;
import java.time.Instant;

public record OrganizerActivityChangeRequestResponse(
        Long activityChangeRequestId,
        Long activityId,
        ActivityRequestStatus status,
        String reason,
        String requestedTitle,
        boolean requestedDescriptionIncluded,
        String requestedDescription,
        String requestedActivityType,
        Long requestedLocationId,
        ActivityLocationResponse requestedLocation,
        Instant requestedStartAt,
        Instant requestedEndAt,
        Integer requestedCapacity,
        boolean requestedImageUrlIncluded,
        String requestedImageUrl,
        String reviewNote,
        Instant submittedAt,
        Instant handledAt,
        Instant withdrawnAt,
        Instant cancelledAt,
        OrganizerActivityRequestActivityResponse activity
) {
    public static OrganizerActivityChangeRequestResponse from(ActivityRequest request,
            OrganizerRequestContextView context) {
        ActivityLocationResponse requestedLocation = context.getRequestedLocationId() == null
                ? null
                : new ActivityLocationResponse(context.getRequestedLocationId(),
                        context.getRequestedLocationCode(), context.getRequestedLocationName(),
                        LocationType.valueOf(context.getRequestedLocationType()),
                        context.getRequestedLocationMaxCapacity(),
                        context.getRequestedLocationActive());
        return new OrganizerActivityChangeRequestResponse(request.getActivityRequestId(),
                request.getActivityId(), request.getStatus(), request.getReason(),
                request.getRequestedTitle(), request.isRequestedDescriptionPresent(),
                request.getRequestedDescription(), request.getRequestedActivityType(),
                request.getRequestedLocationId(), requestedLocation,
                request.getRequestedStartAt(), request.getRequestedEndAt(),
                request.getRequestedCapacity(), request.isRequestedImageUrlPresent(),
                request.getRequestedImageUrl(), request.getReviewNote(),
                request.getSubmittedAt(), request.getHandledAt(), request.getWithdrawnAt(),
                request.getCancelledAt(), OrganizerActivityRequestActivityResponse.from(context));
    }
}
