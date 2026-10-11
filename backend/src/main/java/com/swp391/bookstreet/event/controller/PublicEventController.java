package com.swp391.bookstreet.event.controller;

import com.swp391.bookstreet.event.dto.EventPageResponse;
import com.swp391.bookstreet.event.dto.EventSummaryResponse;
import com.swp391.bookstreet.event.service.EventService;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/events")
public class PublicEventController {
    private final EventService service;

    public PublicEventController(EventService service) {
        this.service = service;
    }

    @GetMapping
    public EventPageResponse<EventSummaryResponse> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "startAt,asc") String sort,
            @RequestParam(required = false) String status) {
        return service.listPublic(page, size, sort, status);
    }

    @GetMapping("/{eventId}")
    public EventSummaryResponse detail(@PathVariable Long eventId) {
        return service.getPublic(eventId);
    }
}

