package com.swp391.bookstreet.auth.service;

import com.swp391.bookstreet.auth.dto.LoginResponse;
import org.springframework.security.core.Authentication;

public record LoginResult(
        Authentication authentication,
        LoginResponse response
) {
}
