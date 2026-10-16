package com.swp391.bookstreet.location.dto;

import com.fasterxml.jackson.annotation.JsonAnySetter;
import com.swp391.bookstreet.booth.entity.LocationType;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;

public record CreateLocationRequest(
        @NotBlank @Size(max = 30) String code,
        @NotBlank @Size(max = 100) String name,
        @NotNull LocationType locationType,
        @Size(max = 5000) String description,
        @NotNull @Positive Integer maxCapacity,
        @Digits(integer = 3, fraction = 2)
        @DecimalMin("0.00") @DecimalMax("100.00") BigDecimal mapX,
        @Digits(integer = 3, fraction = 2)
        @DecimalMin("0.00") @DecimalMax("100.00") BigDecimal mapY
) {
    @JsonAnySetter
    public void rejectUnknownField(String field, Object value) {
        throw new IllegalArgumentException("Unknown Location field: " + field);
    }
}
