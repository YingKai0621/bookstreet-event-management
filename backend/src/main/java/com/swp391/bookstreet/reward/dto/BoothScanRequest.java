package com.swp391.bookstreet.reward.dto;

import com.fasterxml.jackson.annotation.JsonAnySetter;
import jakarta.validation.constraints.NotBlank;

public record BoothScanRequest(
        @NotBlank(message = "REQUIRED") String token) {
    @JsonAnySetter
    public void rejectUnknownField(String field, Object value) {
        throw new IllegalArgumentException("Unknown Booth scan field.");
    }
}
