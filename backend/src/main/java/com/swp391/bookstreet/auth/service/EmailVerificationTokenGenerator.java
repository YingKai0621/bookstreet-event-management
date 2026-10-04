package com.swp391.bookstreet.auth.service;

import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Objects;

@Component
public class EmailVerificationTokenGenerator {

    private static final int TOKEN_BYTE_LENGTH = 32;
    private static final String HASH_ALGORITHM = "SHA-256";

    private final SecureRandom secureRandom = new SecureRandom();

    public String generateRawToken() {
        byte[] randomBytes = new byte[TOKEN_BYTE_LENGTH];
        secureRandom.nextBytes(randomBytes);

        Base64.Encoder urlEncoder = Base64.getUrlEncoder().withoutPadding();
        return urlEncoder.encodeToString(randomBytes);
    }

    public String hashToken(String rawToken) {
        Objects.requireNonNull(rawToken, "rawToken must not be null");

        try {
            MessageDigest messageDigest = MessageDigest.getInstance(HASH_ALGORITHM);
            byte[] tokenBytes = rawToken.getBytes(StandardCharsets.UTF_8);
            byte[] hashBytes = messageDigest.digest(tokenBytes);

            return HexFormat.of().formatHex(hashBytes);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is not available.", exception);
        }
    }
}
