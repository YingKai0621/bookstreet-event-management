package com.swp391.bookstreet.auth.dto;

import com.swp391.bookstreet.auth.validation.Utf8ByteLength;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record LoginRequest(
        @NotBlank
        @Size(min = 3, max = 20)
        @Pattern(
                regexp = "^[A-Za-z][A-Za-z0-9]*$",
                message = "must start with a letter and contain only letters and numbers"
        )
        String username,

        @NotBlank
        @Size(max = 64)
        @Utf8ByteLength(max = 72)
        String password
) {

    @Override
    public String toString() {
        return "LoginRequest[credentials=[PROTECTED]]";
    }
}
