package com.swp391.bookstreet.auth.dto;

import com.swp391.bookstreet.auth.entity.RoleCode;

import java.util.List;

public record LoginUserResponse(
        Long userId,
        String username,
        String fullName,
        List<RoleCode> roles
) {
}
