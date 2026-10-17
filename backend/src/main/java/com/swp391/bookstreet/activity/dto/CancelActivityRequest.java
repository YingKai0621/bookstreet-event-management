package com.swp391.bookstreet.activity.dto;

import com.fasterxml.jackson.annotation.JsonAnySetter;

public record CancelActivityRequest(String reason) {
    @JsonAnySetter
    public void rejectUnknownField(String field, Object value) {
        throw new IllegalArgumentException("Unknown Activity field: " + field);
    }
}
