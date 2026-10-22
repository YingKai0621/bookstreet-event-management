package com.swp391.bookstreet.registration.dto;

import com.swp391.bookstreet.event.entity.Event;
import com.swp391.bookstreet.event.entity.EventStatus;
import java.time.Instant;

public record EventRegistrationEventSummary(Long eventId, String name, Instant startAt,
        Instant endAt, EventStatus status) {
    public static EventRegistrationEventSummary from(Event event) {
        return new EventRegistrationEventSummary(event.getEventId(), event.getName(),
                event.getStartAt(), event.getEndAt(), event.getStatus());
    }
}
