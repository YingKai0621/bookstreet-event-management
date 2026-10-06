package com.swp391.bookstreet.admin.dto;

import java.time.Instant;
import java.util.List;

public record AdminUserDto(
        Long id,
        String code,
        String username,
        String fullName,
        String email,
        String phone,
        String role,
        String primaryRole,
        List<String> roles,
        String status,
        Instant emailVerifiedAt,
        Instant lastActiveAt,
        Instant createdAt,
        String avatarUrl
) {
}
