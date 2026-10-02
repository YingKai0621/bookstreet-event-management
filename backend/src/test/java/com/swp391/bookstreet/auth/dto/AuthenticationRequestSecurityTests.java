package com.swp391.bookstreet.auth.dto;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class AuthenticationRequestSecurityTests {

    @Test
    void loginRequestToStringDoesNotExposeCredentials() {
        String rawPassword = "login-secret-password";
        LoginRequest request = new LoginRequest("booklover", rawPassword);

        String requestText = request.toString();

        assertThat(requestText).isEqualTo("LoginRequest[credentials=[PROTECTED]]");
        assertThat(requestText).doesNotContain(rawPassword);
    }

    @Test
    void registerRequestToStringDoesNotExposeAccountData() {
        String rawPassword = "register-secret-password";
        String confirmPassword = "confirm-secret-password";
        RegisterRequest request = new RegisterRequest(
                "booklover",
                "Nguyen Van An",
                rawPassword,
                confirmPassword,
                "booklover@example.com"
        );

        String requestText = request.toString();

        assertThat(requestText).isEqualTo("RegisterRequest[accountData=[PROTECTED]]");
        assertThat(requestText).doesNotContain(rawPassword);
        assertThat(requestText).doesNotContain(confirmPassword);
        assertThat(requestText).doesNotContain("booklover@example.com");
    }
}
