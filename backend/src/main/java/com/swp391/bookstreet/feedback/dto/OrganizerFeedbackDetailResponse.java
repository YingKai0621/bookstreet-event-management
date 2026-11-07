package com.swp391.bookstreet.feedback.dto;

import com.swp391.bookstreet.feedback.entity.GeneralFeedbackStatus;
import com.swp391.bookstreet.feedback.entity.GeneralFeedbackTargetType;
import java.time.Instant;

public record OrganizerFeedbackDetailResponse(
        Long feedbackId,
        GeneralFeedbackTargetType targetType,
        FeedbackEventBriefResponse event,
        FeedbackUserBriefResponse submitter,
        String guestName,
        String contactEmail,
        String message,
        GeneralFeedbackStatus status,
        String internalNote,
        FeedbackUserBriefResponse lastHandledBy,
        Instant submittedAt,
        Instant updatedAt,
        Instant handlingStartedAt,
        Instant resolvedAt
) {
    @Override
    public String toString() {
        return "OrganizerFeedbackDetailResponse["
                + "feedbackId=" + feedbackId
                + ", targetType=" + targetType
                + ", event=" + event
                + ", submitter=<redacted>"
                + ", guestName=<redacted>"
                + ", contactEmail=<redacted>"
                + ", message=<redacted>"
                + ", status=" + status
                + ", internalNote=<redacted>"
                + ", lastHandledBy=<redacted>"
                + ", submittedAt=" + submittedAt
                + ", updatedAt=" + updatedAt
                + ", handlingStartedAt=" + handlingStartedAt
                + ", resolvedAt=" + resolvedAt
                + ']';
    }
}
