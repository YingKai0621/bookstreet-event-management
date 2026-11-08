package com.swp391.bookstreet.auth.dto;

import com.swp391.bookstreet.auth.validation.Utf8ByteLength;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * The token has no format rule here on purpose: any wrong token, malformed or not, must get the same
 * generic error, which the service returns.
 */
public record PasswordResetConfirmRequest(
        String token,
        @NotBlank
        @Size(min = 8, max = 64)
        @Utf8ByteLength(max = 72)
        String newPassword,
        @NotBlank
        @Size(min = 8, max = 64)
        @Utf8ByteLength(max = 72)
        String confirmPassword
) {
}
