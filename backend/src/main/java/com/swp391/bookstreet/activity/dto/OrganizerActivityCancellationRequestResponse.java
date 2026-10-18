package com.swp391.bookstreet.activity.dto;

import com.swp391.bookstreet.activity.entity.ActivityRequest;
import com.swp391.bookstreet.activity.entity.ActivityRequestStatus;
import com.swp391.bookstreet.activity.repository.ActivityRequestRepository.OrganizerRequestContextView;
import java.time.Instant;

public record OrganizerActivityCancellationRequestResponse(
        Long activityCancellationRequestId,
        Long activityId,
        ActivityRequestStatus status,
        String reason,
        boolean late,
        String reviewNote,
        Instant submittedAt,
        Instant handledAt,
        Instant withdrawnAt,
        Instant cancelledAt,
        OrganizerActivityRequestActivityResponse activity
) {
    public static OrganizerActivityCancellationRequestResponse from(ActivityRequest request,
            OrganizerRequestContextView context) {
        return new OrganizerActivityCancellationRequestResponse(
                request.getActivityRequestId(), request.getActivityId(), request.getStatus(),
                request.getReason(), request.isLate(), request.getReviewNote(),
                request.getSubmittedAt(), request.getHandledAt(), request.getWithdrawnAt(),
                request.getCancelledAt(), OrganizerActivityRequestActivityResponse.from(context));
    }
}
