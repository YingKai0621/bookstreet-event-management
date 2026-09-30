package com.swp391.bookstreet.auth.dto;

import com.swp391.bookstreet.auth.entity.AccountStatus;
import com.swp391.bookstreet.auth.entity.RoleCode;

import java.util.List;

public record AccountResponse(
        Long userId,
        String username,
        String fullName,
        String email,
        boolean emailVerified,
        AccountStatus status,
        List<RoleCode> roles
) {
}
