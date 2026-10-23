package com.swp391.bookstreet.certificate.service;

import java.time.Instant;

public record ParticipationDownstreamCommand(
        Long attendanceId,
        String transitionKey,
        Instant occurredAt) {

    public ParticipationDownstreamCommand {
        if (attendanceId == null) {
            throw new IllegalArgumentException("attendanceId must not be null");
        }
        if (transitionKey == null || transitionKey.trim().isEmpty()) {
            throw new IllegalArgumentException("transitionKey must not be blank");
        }
        transitionKey = transitionKey.trim();
        if (transitionKey.length() > 140) {
            throw new IllegalArgumentException("transitionKey must not exceed 140 characters");
        }
        if (occurredAt == null) {
            throw new IllegalArgumentException("occurredAt must not be null");
        }
    }
}
