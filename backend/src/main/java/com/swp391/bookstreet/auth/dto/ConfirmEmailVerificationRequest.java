package com.swp391.bookstreet.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public class ConfirmEmailVerificationRequest {

    @NotBlank
    @Size(min = 43, max = 43)
    @Pattern(
            regexp = "^[A-Za-z0-9_-]+$",
            message = "must be a valid email verification token"
    )
    private String token;

    public ConfirmEmailVerificationRequest() {
    }

    public String getToken() {
        return token;
    }

    public void setToken(String token) {
        this.token = token;
    }

    @Override
    public String toString() {
        return "ConfirmEmailVerificationRequest[token=[PROTECTED]]";
    }
}
