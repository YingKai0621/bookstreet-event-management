package com.swp391.bookstreet.admin.dto;

import com.swp391.bookstreet.auth.validation.Utf8ByteLength;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * Section 4.3 of the Sprint 11 API contract. Username, full name and password follow BR-64. There is no
 * role or status field: a created account is always ACTIVE with only PARTICIPANT, and any such input is ignored.
 */
public record AdminCreateUserRequest(
        @NotBlank
        @Size(min = 3, max = 20)
        @Pattern(regexp = "^[A-Za-z][A-Za-z0-9]*$",
                message = "must start with a letter and contain only letters and numbers")
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
        String email,

        @Size(max = 20)
        String phone
) {
    public AdminCreateUserRequest {
        fullName = fullName == null ? null : fullName.strip().replaceAll("\\s+", " ");
        email = email == null || email.isBlank() ? null : email.strip();
        phone = phone == null || phone.isBlank() ? null : phone.strip();
    }

    @Override
    public String toString() {
        return "AdminCreateUserRequest[accountData=[PROTECTED]]";
    }
}
