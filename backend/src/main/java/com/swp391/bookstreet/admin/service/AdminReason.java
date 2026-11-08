package com.swp391.bookstreet.admin.service;

import com.swp391.bookstreet.common.exception.ApiException;
import org.springframework.http.HttpStatus;

/** The reason that BR-113 and BR-116 require for a lock or unlock. */
public final class AdminReason {
    private static final int MIN_LENGTH = 10;
    private static final int MAX_LENGTH = 500;

    private AdminReason() {
    }

    public static String normalize(String reason) {
        String normalized = reason == null ? "" : reason.strip().replaceAll("\\s+", " ");
        int length = normalized.codePointCount(0, normalized.length());
        if (length < MIN_LENGTH || length > MAX_LENGTH) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_CONTENT, "VALIDATION_FAILED",
                    "The reason must contain " + MIN_LENGTH + " to " + MAX_LENGTH + " characters.");
        }
        return normalized;
    }
}
