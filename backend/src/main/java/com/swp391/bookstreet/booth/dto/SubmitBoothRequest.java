package com.swp391.bookstreet.booth.dto;

import jakarta.validation.constraints.NotNull;

public record SubmitBoothRequest(
        @NotNull(message = "boothId is required.") Long boothId,
        String requestNote
) {
}
