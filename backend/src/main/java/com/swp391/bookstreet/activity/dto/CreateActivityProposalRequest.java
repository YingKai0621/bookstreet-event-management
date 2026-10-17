package com.swp391.bookstreet.activity.dto;

import com.fasterxml.jackson.annotation.JsonAnySetter;
import java.time.Instant;

public record CreateActivityProposalRequest(
        Long eventId,
        Long locationId,
        String title,
        String description,
        String activityType,
        Instant proposedStartAt,
        Instant proposedEndAt,
        Integer capacity
) {
    @JsonAnySetter
    public void rejectUnknownField(String field, Object value) {
        throw new IllegalArgumentException("Unknown Activity field: " + field);
    }
}
