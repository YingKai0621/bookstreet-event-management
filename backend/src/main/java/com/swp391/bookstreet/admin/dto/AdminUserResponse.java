package com.swp391.bookstreet.admin.dto;

import com.swp391.bookstreet.auth.entity.AccountStatus;
import com.swp391.bookstreet.auth.entity.RoleCode;
import com.swp391.bookstreet.auth.entity.User;
import java.time.Instant;
import java.util.List;

/** Section 4.1 of the Sprint 11 API contract. Never carries a password hash or token. */
public record AdminUserResponse(
        Long userId,
        String username,
        String fullName,
        String email,
        boolean emailVerified,
        String phone,
        List<RoleCode> roles,
        AccountStatus status,
        Instant createdAt
) {
    /** Roles are listed in RoleCode declaration order: PARTICIPANT, PARTNER, ORGANIZER, ADMIN. */
    public static AdminUserResponse from(User user) {
        List<RoleCode> roles = user.getUserRoles().stream()
                .map(userRole -> userRole.getRole().getCode())
                .distinct()
                .sorted()
                .toList();
        return new AdminUserResponse(
                user.getId(),
                user.getUsername(),
                user.getFullName(),
                user.getEmail(),
                user.getEmailVerifiedAt() != null,
                user.getPhoneNumber(),
                roles,
                user.getStatus(),
                user.getCreatedAt());
    }
}
