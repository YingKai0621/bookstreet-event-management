package com.swp391.bookstreet.heritage.dto;

import com.fasterxml.jackson.annotation.JsonAnySetter;

public record CreateHeritageRequest(
        String title,
        String summary,
        String content,
        String imageUrl,
        String locationText
) {
    @JsonAnySetter
    public void rejectUnknownField(String field, Object value) {
        throw new IllegalArgumentException("Unknown Heritage field: " + field);
    }
}
