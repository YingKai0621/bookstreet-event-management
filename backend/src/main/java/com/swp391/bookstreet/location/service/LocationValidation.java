package com.swp391.bookstreet.location.service;

import com.swp391.bookstreet.booth.entity.LocationType;
import com.swp391.bookstreet.location.exception.LocationApiException;
import java.util.Locale;
import org.springframework.http.HttpStatus;

final class LocationValidation {
    private LocationValidation() {
    }

    static String code(String value) {
        String code = requiredText(value, "code", 30).toUpperCase(Locale.ROOT);
        if (!code.matches("[A-Z0-9_-]{1,30}")) {
            throw validation("code may contain only A-Z, 0-9, underscore or hyphen.", "code");
        }
        return code;
    }

    static String name(String value) {
        return requiredText(value, "name", 100);
    }

    static LocationType sharedType(LocationType value) {
        if (value == null || value == LocationType.BOOTH) {
            throw validation("locationType must be STAGE, WORKSHOP or AREA.", "locationType");
        }
        return value;
    }

    static Integer positiveCapacity(Integer value) {
        if (value == null || value <= 0) {
            throw validation("maxCapacity must be positive.", "maxCapacity");
        }
        return value;
    }

    static boolean requiredBoolean(Boolean value, String field) {
        if (value == null) {
            throw validation(field + " must not be null.", field);
        }
        return value;
    }

    static String optionalDescription(String value) {
        if (value == null) return null;
        String normalized = value.trim();
        if (normalized.length() > 5000) {
            throw validation("description must not exceed 5000 characters.", "description");
        }
        return normalized.isEmpty() ? null : normalized;
    }

    private static String requiredText(String value, String field, int maximum) {
        if (value == null) {
            throw validation(field + " is required.", field);
        }
        String normalized = value.trim();
        if (normalized.isEmpty() || normalized.length() > maximum) {
            throw validation(field + " is required and must not exceed " + maximum
                    + " characters.", field);
        }
        return normalized;
    }

    static LocationApiException validation(String message, String field) {
        return new LocationApiException(HttpStatus.UNPROCESSABLE_CONTENT, "VALIDATION_FAILED",
                message, field);
    }
}
