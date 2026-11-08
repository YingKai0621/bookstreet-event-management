package com.swp391.bookstreet.auth.service;

/** Published inside the request transaction; the mail is sent only after it commits. */
public record PasswordResetMessageRequested(Long userId, Long tokenId, String recipientEmail, String rawToken) {

    @Override
    public String toString() {
        return "PasswordResetMessageRequested[userId=" + userId + ", tokenId=" + tokenId + "]";
    }
}
