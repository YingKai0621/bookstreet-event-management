package com.swp391.bookstreet.booth.dto;

import com.fasterxml.jackson.annotation.JsonAnySetter;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
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
        @Digits(integer = 3, fraction = 2) @DecimalMin("0.00") @DecimalMax("100.00") BigDecimal mapX,
        @Digits(integer = 3, fraction = 2) @DecimalMin("0.00") @DecimalMax("100.00") BigDecimal mapY,
        @Size(max = 50) String categoryCode,
        String note,
        @Size(max = 2048) String imageUrl
) {
    @JsonAnySetter
    public void rejectUnknownField(String field, Object value) {
        throw new IllegalArgumentException("Unsupported Booth request field: " + field);
    }
}
