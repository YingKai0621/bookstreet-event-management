package com.swp391.bookstreet.activity.dto;

import com.fasterxml.jackson.annotation.JsonAnySetter;
import java.time.Instant;

public record CreateActivityRequest(
        Long eventId,
        Long locationId,
        String title,
        String description,
        String activityType,
        Instant startAt,
        Instant endAt,
        Integer capacity,
        String imageUrl,
        boolean registrationRequired,
        Instant registrationDeadlineAt,
        boolean certificateEnabled,
        Integer attendanceEarlyScanMinutes
) {
    public CreateActivityRequest(Long eventId, Long locationId, String title, String description,
            String activityType, Instant startAt, Instant endAt, Integer capacity,
            String imageUrl, boolean registrationRequired, Instant registrationDeadlineAt,
            boolean certificateEnabled) {
        this(eventId, locationId, title, description, activityType, startAt, endAt,
                capacity, imageUrl, registrationRequired, registrationDeadlineAt,
                certificateEnabled, null);
    }

    @JsonAnySetter
    public void rejectUnknownField(String field, Object value) {
        throw new IllegalArgumentException("Unknown Activity field: " + field);
    }
}
