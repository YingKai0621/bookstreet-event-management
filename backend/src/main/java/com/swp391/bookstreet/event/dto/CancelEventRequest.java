package com.swp391.bookstreet.event.dto;

import com.fasterxml.jackson.annotation.JsonAnySetter;

public record CancelEventRequest(String reason) {
    public CancelEventRequest {
        if (reason != null) {
            reason = reason.strip().replaceAll("\\s+", " ");
        }
    }

    @JsonAnySetter
    public void rejectUnknownField(String field, Object value) {
        throw new IllegalArgumentException("Unsupported cancellation request field: " + field);
    }
}
