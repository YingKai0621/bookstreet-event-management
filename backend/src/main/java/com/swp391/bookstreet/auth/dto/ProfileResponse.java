package com.swp391.bookstreet.auth.dto;

import com.swp391.bookstreet.auth.entity.User;

public record ProfileResponse(Long id, String fullName, String email, String phone, String avatarUrl, boolean emailVerified) {
    public static ProfileResponse from(User user) {
        return new ProfileResponse(user.getId(), user.getFullName(), user.getEmail(),
                user.getPhoneNumber(), user.getAvatarUrl(), user.getEmailVerifiedAt() != null);
    }
}
