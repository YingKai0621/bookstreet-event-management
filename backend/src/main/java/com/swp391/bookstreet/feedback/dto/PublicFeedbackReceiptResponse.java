package com.swp391.bookstreet.feedback.dto;

import java.time.Instant;

public record PublicFeedbackReceiptResponse(
        Long feedbackId,
        Instant receivedAt
) {
}
