package com.swp391.bookstreet.activity.dto;

import com.fasterxml.jackson.annotation.JsonAnySetter;

public record ReviewActivityRequest(String reviewNote) {
    @JsonAnySetter
    public void rejectUnknownField(String field, Object value) {
        throw new IllegalArgumentException("Unknown Activity request field: " + field);
    }
}
