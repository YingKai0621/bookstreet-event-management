package com.swp391.bookstreet.feedback.dto;

import com.fasterxml.jackson.annotation.JsonAnySetter;

public record ResolveFeedbackRequest(String internalNote) {
    @JsonAnySetter
    public void rejectUnknownField(String field, Object value) {
        throw new IllegalArgumentException("Unknown Feedback field: " + field);
    }

    @Override
    public String toString() {
        return "ResolveFeedbackRequest[internalNote=<redacted>]";
    }
}
