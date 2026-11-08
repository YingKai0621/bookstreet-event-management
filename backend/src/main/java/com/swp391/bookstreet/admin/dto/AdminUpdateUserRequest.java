package com.swp391.bookstreet.admin.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * Section 4.4 of the Sprint 11 API contract. Every field is optional and an absent field stays unchanged.
 * A blank phone clears the phone. There is no role or status field: those have their own commands.
 */
public record AdminUpdateUserRequest(
        @Size(min = 2, max = 50)
        String fullName,

        @Size(max = 20)
        String phone,

        @Email
        @Pattern(regexp = ".*\\S.*", message = "must not be blank")
        @Size(max = 255)
        String email
) {
    public AdminUpdateUserRequest {
        fullName = fullName == null ? null : fullName.strip().replaceAll("\\s+", " ");
        phone = phone == null ? null : phone.strip();
        email = email == null ? null : email.strip();
    }
}
