package com.swp391.bookstreet.common.response;

import java.time.Instant;
import java.util.List;

public record ApiErrorResponse(
        String code,
        String message,
        List<FieldValidationError> fieldErrors,
        Instant timestamp,
        String path
) {
}
