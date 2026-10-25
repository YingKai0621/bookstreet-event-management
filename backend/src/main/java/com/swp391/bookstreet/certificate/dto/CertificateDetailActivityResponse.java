package com.swp391.bookstreet.certificate.dto;

import java.time.Instant;

public record CertificateDetailActivityResponse(
        Long activityId,
        String title,
        Instant startAt,
        Instant endAt
) {}
