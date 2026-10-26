package com.swp391.bookstreet.chat.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record ChatTurn(@NotBlank @Pattern(regexp = "user|assistant") String role,
        @NotBlank @Size(max = 500) String text) {
}
