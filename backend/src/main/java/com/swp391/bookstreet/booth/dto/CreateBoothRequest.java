package com.swp391.bookstreet.booth.dto;

import com.fasterxml.jackson.annotation.JsonAnySetter;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;

public record CreateBoothRequest(
        @NotBlank @Size(max = 30) String code,
        @NotBlank @Size(max = 100) String name,
        String description,
        @NotNull @Positive Integer maxCapacity,
        @Digits(integer = 8, fraction = 2) BigDecimal mapX,
        @Digits(integer = 8, fraction = 2) BigDecimal mapY,
        @Size(max = 50) String categoryCode,
        String note
) {
    @JsonAnySetter
    public void rejectUnknownField(String field, Object value) {
        throw new IllegalArgumentException("Unsupported Booth request field: " + field);
    }
}
