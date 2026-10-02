package com.swp391.bookstreet.auth.dto;

import com.swp391.bookstreet.auth.validation.Utf8ByteLength;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record RegisterRequest(
        @NotBlank
        @Size(min = 3, max = 20)
        @Pattern(
                regexp = "^[A-Za-z][A-Za-z0-9]*$",
                message = "must start with a letter and contain only letters and numbers"
        )
        String username,

        @NotBlank
        @Size(min = 2, max = 50)
        String fullName,

        @NotBlank
        @Size(min = 8, max = 64)
        @Utf8ByteLength(max = 72)
        String password,

        @NotBlank
        @Size(min = 8, max = 64)
        @Utf8ByteLength(max = 72)
        String confirmPassword,

        @Email
        @Size(max = 255)
        String email
) {

    public RegisterRequest {
        fullName = normalizeFullName(fullName);
        email = normalizeOptionalEmail(email);
    }

    private static String normalizeFullName(String fullName) {
        if (fullName == null) {
            return null;
        }

        return fullName.strip().replaceAll("\\s+", " ");
    }

    private static String normalizeOptionalEmail(String email) {
        if (email == null || email.isBlank()) {
            return null;
        }

        return email.strip();
    }

    @Override
    public String toString() {
        return "RegisterRequest[accountData=[PROTECTED]]";
    }
}
