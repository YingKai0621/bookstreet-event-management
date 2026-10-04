package com.swp391.bookstreet.partner.dto;

import java.time.Instant;
import java.util.List;

public record PartnerApiErrorResponse(
        String code,
        String message,
        List<?> fieldErrors,
        Instant timestamp,
        String path
) {
}
