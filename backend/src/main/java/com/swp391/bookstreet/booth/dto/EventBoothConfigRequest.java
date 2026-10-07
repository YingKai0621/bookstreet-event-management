package com.swp391.bookstreet.booth.dto;

import com.fasterxml.jackson.annotation.JsonAnySetter;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;

public record EventBoothConfigRequest(
        @NotNull @DecimalMin("0.00") @Digits(integer = 12, fraction = 2) BigDecimal rentalPrice,
        @NotNull Boolean enabled
) {
    @JsonAnySetter
    public void rejectUnknownField(String field, Object value) {
        throw new IllegalArgumentException("Unsupported Event Booth configuration field: " + field);
    }
}
