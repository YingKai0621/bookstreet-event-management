package com.swp391.bookstreet.common.response;

public record FieldValidationError(
        String field,
        String message
) {
}
