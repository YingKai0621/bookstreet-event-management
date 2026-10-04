package com.swp391.bookstreet.auth.service;

public class EmailVerificationMessageRequested {

    private final Long userId;
    private final Long tokenId;
    private final String recipientEmail;
    private final String rawToken;

    public EmailVerificationMessageRequested(
            Long userId,
            Long tokenId,
            String recipientEmail,
            String rawToken
    ) {
        this.userId = userId;
        this.tokenId = tokenId;
        this.recipientEmail = recipientEmail;
        this.rawToken = rawToken;
    }

    public Long getUserId() {
        return userId;
    }

    public Long getTokenId() {
        return tokenId;
    }

    public String getRecipientEmail() {
        return recipientEmail;
    }

    public String getRawToken() {
        return rawToken;
    }
}
