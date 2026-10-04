package com.swp391.bookstreet.auth.service;

import java.time.Instant;

public class IssuedEmailVerificationToken {

    private final Long tokenId;
    private final String rawToken;
    private final Instant expiresAt;

    public IssuedEmailVerificationToken(Long tokenId, String rawToken, Instant expiresAt) {
        this.tokenId = tokenId;
        this.rawToken = rawToken;
        this.expiresAt = expiresAt;
    }

    public Long getTokenId() {
        return tokenId;
    }

    public String getRawToken() {
        return rawToken;
    }

    public Instant getExpiresAt() {
        return expiresAt;
    }
}
