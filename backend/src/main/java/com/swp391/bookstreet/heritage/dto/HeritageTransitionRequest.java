package com.swp391.bookstreet.heritage.dto;

import com.fasterxml.jackson.annotation.JsonAnySetter;

public record HeritageTransitionRequest(String expectedUpdatedAt) {
    @JsonAnySetter
    public void rejectUnknownField(String field, Object value) {
        throw new IllegalArgumentException("Unknown Heritage field: " + field);
    }
}
