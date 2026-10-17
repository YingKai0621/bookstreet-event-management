package com.swp391.bookstreet.activity.dto;

import com.swp391.bookstreet.activity.entity.ActivityRequest;
import com.swp391.bookstreet.activity.entity.ActivityRequestStatus;
import java.time.Instant;

public record ActivityCancellationRequestResponse(
        Long activityCancellationRequestId,
        Long activityId,
        ActivityRequestStatus status,
        String reason,
        boolean late,
        String reviewNote,
        Instant submittedAt,
        Instant handledAt,
        Instant withdrawnAt,
        Instant cancelledAt
) {
    public static ActivityCancellationRequestResponse from(ActivityRequest request) {
        return new ActivityCancellationRequestResponse(request.getActivityRequestId(),
                request.getActivityId(), request.getStatus(), request.getReason(),
                request.isLate(), request.getReviewNote(), request.getSubmittedAt(),
                request.getHandledAt(), request.getWithdrawnAt(), request.getCancelledAt());
    }
}
