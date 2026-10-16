package com.swp391.bookstreet.activity.service;

import java.net.URI;
import java.time.Instant;

public record ValidatedActivityFields(
        String title,
        String description,
        String activityType,
        Instant startAt,
        Instant endAt,
        Integer capacity,
        URI imageUrl
) {
}
