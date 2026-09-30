package com.swp391.bookstreet.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RegisterRequest(
        @NotBlank
        @Size(max = 30)
        String username,

        @NotBlank
        @Size(max = 100)
        String fullName,

        @NotBlank
        String password,

        @NotBlank
        String confirmPassword,

        @Email
        @Size(max = 255)
        String email
) {
}
