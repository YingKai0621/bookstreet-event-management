package com.swp391.bookstreet.event.dto;

import com.swp391.bookstreet.event.entity.Event;
import com.swp391.bookstreet.event.entity.EventStatus;
import java.time.Instant;

public record EventSummaryResponse(Long eventId, String name, String description,
        Instant startAt, Instant endAt, Instant partnerApplicationDeadlineAt,
        String bannerUrl, EventStatus status, Instant cancelledAt, String cancellationReason) {
    public static EventSummaryResponse from(Event event) {
        return new EventSummaryResponse(event.getEventId(), event.getName(), event.getDescription(),
                event.getStartAt(), event.getEndAt(), event.getPartnerApplicationDeadlineAt(),
                event.getBannerUrl(), event.getStatus(), event.getCancelledAt(),
                event.getCancellationReason());
    }
}

