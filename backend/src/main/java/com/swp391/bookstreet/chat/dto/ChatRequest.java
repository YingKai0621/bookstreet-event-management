package com.swp391.bookstreet.chat.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import jakarta.validation.Valid;
import java.util.List;

public record ChatRequest(@NotBlank @Size(max = 500) String message,
        @Size(max = 6) List<@Valid ChatTurn> history) {
}
