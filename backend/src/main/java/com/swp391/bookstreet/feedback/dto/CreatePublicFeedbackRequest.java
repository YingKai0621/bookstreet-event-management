package com.swp391.bookstreet.feedback.dto;

import com.fasterxml.jackson.annotation.JsonAnySetter;
import com.swp391.bookstreet.feedback.entity.GeneralFeedbackTargetType;
import jakarta.validation.constraints.Email;

public record CreatePublicFeedbackRequest(
        GeneralFeedbackTargetType targetType,
        Long eventId,
        String guestName,
        @Email String contactEmail,
        String message
) {
    @JsonAnySetter
    public void rejectUnknownField(String field, Object value) {
        throw new IllegalArgumentException("Unknown Feedback field: " + field);
    }

    @Override
    public String toString() {
        return "CreatePublicFeedbackRequest["
                + "targetType=" + targetType
                + ", eventId=" + eventId
                + ", guestName=<redacted>"
                + ", contactEmail=<redacted>"
                + ", message=<redacted>]";
    }
}
