package com.swp391.bookstreet.registration.dto;

import com.swp391.bookstreet.event.entity.Event;
import com.swp391.bookstreet.registration.entity.EventRegistration;
import com.swp391.bookstreet.registration.entity.EventRegistrationStatus;
import java.time.Instant;

public record EventRegistrationResponse(Long eventRegistrationId,
        EventRegistrationEventSummary event, EventRegistrationStatus status,
        Instant registeredAt, Instant activatedAt, Instant leftAt, Instant updatedAt,
        long seatActiveActivityCount) {
    public static EventRegistrationResponse from(EventRegistration registration, Event event,
            long seatActiveActivityCount) {
        return new EventRegistrationResponse(registration.getEventRegistrationId(),
                EventRegistrationEventSummary.from(event), registration.getStatus(),
                registration.getRegisteredAt(), registration.getActivatedAt(),
                registration.getLeftAt(), registration.getUpdatedAt(),
                seatActiveActivityCount);
    }
}
