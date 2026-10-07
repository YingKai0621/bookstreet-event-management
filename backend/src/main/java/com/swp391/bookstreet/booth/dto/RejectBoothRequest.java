package com.swp391.bookstreet.booth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RejectBoothRequest(
        @NotBlank(message = "reviewNote is required.")
        @Size(max = 1000, message = "reviewNote must not exceed 1000 characters.")
        String reviewNote
) {
}
