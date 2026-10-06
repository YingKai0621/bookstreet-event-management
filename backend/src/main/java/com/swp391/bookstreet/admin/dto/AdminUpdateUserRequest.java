package com.swp391.bookstreet.admin.dto;

public record AdminUpdateUserRequest(
        String fullName,
        String phone,
        String email,
        String role,
        String status
) {
}
