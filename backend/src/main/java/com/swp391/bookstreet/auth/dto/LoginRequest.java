package com.swp391.bookstreet.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record LoginRequest(
        @NotBlank
        @Size(max = 30)
        String username,

        @NotBlank
        String password
) {
}
