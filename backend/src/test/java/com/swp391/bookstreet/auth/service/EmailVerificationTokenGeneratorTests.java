package com.swp391.bookstreet.auth.service;

import org.junit.jupiter.api.Test;

import java.util.Base64;

import static org.assertj.core.api.Assertions.assertThat;

class EmailVerificationTokenGeneratorTests {

    private final EmailVerificationTokenGenerator tokenGenerator =
            new EmailVerificationTokenGenerator();

    @Test
    void generatesUrlSafeTokenFromThirtyTwoRandomBytes() {
        String rawToken = tokenGenerator.generateRawToken();

        byte[] decodedToken = Base64.getUrlDecoder().decode(rawToken);

        assertThat(decodedToken).hasSize(32);
        assertThat(rawToken).hasSize(43);
        assertThat(rawToken).matches("[A-Za-z0-9_-]{43}");
        assertThat(rawToken).doesNotContain("=");
    }

    @Test
    void generatesDifferentTokensForSeparateRequests() {
        String firstToken = tokenGenerator.generateRawToken();
        String secondToken = tokenGenerator.generateRawToken();

        assertThat(firstToken).isNotEqualTo(secondToken);
    }

    @Test
    void hashesTokenWithSha256AsLowercaseHexadecimal() {
        String tokenHash = tokenGenerator.hashToken("abc");

        assertThat(tokenHash).isEqualTo(
                "ba7816bf8f01cfea414140de5dae2223"
                        + "b00361a396177a9cb410ff61f20015ad"
        );
        assertThat(tokenHash).hasSize(64);
        assertThat(tokenHash).matches("[0-9a-f]{64}");
    }

    @Test
    void rawTokenAndStoredHashAreDifferentValues() {
        String rawToken = tokenGenerator.generateRawToken();
        String tokenHash = tokenGenerator.hashToken(rawToken);

        assertThat(tokenHash).isNotEqualTo(rawToken);
    }
}
