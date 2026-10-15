package com.swp391.bookstreet.auth.controller;

import com.swp391.bookstreet.auth.dto.ProfileResponse;
import com.swp391.bookstreet.auth.dto.UpdateProfileRequest;
import com.swp391.bookstreet.auth.service.ProfileService;
import com.swp391.bookstreet.security.authentication.AuthenticatedPrincipal;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth/profile")
public class ProfileController {
    private final ProfileService profiles;

    public ProfileController(ProfileService profiles) {
        this.profiles = profiles;
    }

    @GetMapping
    public ProfileResponse get(@AuthenticationPrincipal AuthenticatedPrincipal principal) {
        return profiles.get(principal.userId());
    }

    @PutMapping
    public ProfileResponse update(@AuthenticationPrincipal AuthenticatedPrincipal principal,
                                  @Valid @RequestBody UpdateProfileRequest request) {
        return profiles.update(principal.userId(), request);
    }
}
