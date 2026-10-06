package com.swp391.bookstreet.admin.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record AdminCreateUserRequest(
        @NotBlank(message = "Username is required")
        @Size(min = 3, max = 20, message = "Username must be between 3 and 20 characters")
        String username,

        @NotBlank(message = "Full name is required")
        @Size(min = 2, max = 50, message = "Full name must be between 2 and 50 characters")
        String fullName,

        String email,
        String phone,
        String role,
        String status,
        String password
) {
}
