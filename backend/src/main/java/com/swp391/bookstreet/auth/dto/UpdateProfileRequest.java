package com.swp391.bookstreet.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record UpdateProfileRequest(
        @NotBlank @Size(min = 2, max = 50) String fullName,
        @Size(max = 20) String phone,
        @Size(max = 7000000) String avatarUrl
) {
    public UpdateProfileRequest {
        fullName = fullName == null ? null : fullName.strip().replaceAll("\\s+", " ");
        phone = phone == null || phone.isBlank() ? null : phone.strip();
        avatarUrl = avatarUrl == null || avatarUrl.isBlank() ? null : avatarUrl.strip();
    }
}
