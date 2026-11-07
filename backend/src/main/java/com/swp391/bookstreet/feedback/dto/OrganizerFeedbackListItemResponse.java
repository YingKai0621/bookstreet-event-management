package com.swp391.bookstreet.feedback.dto;

import com.swp391.bookstreet.feedback.entity.GeneralFeedbackStatus;
import com.swp391.bookstreet.feedback.entity.GeneralFeedbackTargetType;
import java.time.Instant;

public record OrganizerFeedbackListItemResponse(
        Long feedbackId,
        GeneralFeedbackTargetType targetType,
        FeedbackEventBriefResponse event,
        String messagePreview,
        GeneralFeedbackStatus status,
        Instant submittedAt,
        Instant updatedAt
) {
}
