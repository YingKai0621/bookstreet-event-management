package com.swp391.bookstreet.event.exception;

import java.time.Instant;
import java.util.List;

public record EventErrorResponse(String code, String message, List<FieldError> fieldErrors,
        Instant timestamp, String path) {
    public record FieldError(String field, String message) {
    }
}

