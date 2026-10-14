package com.swp391.bookstreet.auth.service;

import com.swp391.bookstreet.auth.dto.ProfileResponse;
import com.swp391.bookstreet.auth.dto.UpdateProfileRequest;
import com.swp391.bookstreet.auth.entity.User;
import com.swp391.bookstreet.auth.repository.UserRepository;
import com.swp391.bookstreet.common.exception.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ProfileService {
    private final UserRepository users;

    public ProfileService(UserRepository users) {
        this.users = users;
    }

    @Transactional(readOnly = true)
    public ProfileResponse get(Long userId) {
        return ProfileResponse.from(users.findById(userId).orElseThrow(ProfileService::unauthorized));
    }

    @Transactional
    public ProfileResponse update(Long userId, UpdateProfileRequest request) {
        User user = users.findByIdForUpdate(userId).orElseThrow(ProfileService::unauthorized);
        user.setFullName(request.fullName());
        user.setPhoneNumber(request.phone());
        user.setAvatarUrl(request.avatarUrl());
        users.saveAndFlush(user);
        return ProfileResponse.from(user);
    }

    private static ApiException unauthorized() {
        return new ApiException(HttpStatus.UNAUTHORIZED, "AUTHENTICATION_REQUIRED", "Authentication is required.");
    }
}
