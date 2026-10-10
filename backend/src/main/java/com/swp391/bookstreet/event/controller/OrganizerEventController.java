package com.swp391.bookstreet.event.controller;

import com.swp391.bookstreet.event.dto.*;
import com.swp391.bookstreet.event.service.EventService;
import jakarta.validation.Valid;
import java.net.URI;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/organizer/events")
public class OrganizerEventController {
    private final EventService service;

    public OrganizerEventController(EventService service) {
        this.service = service;
    }

    @PostMapping
    public ResponseEntity<EventResponse> create(@Valid @RequestBody CreateEventRequest request) {
        EventResponse event = service.create(request);
        return ResponseEntity.created(URI.create("/api/v1/organizer/events/" + event.eventId())).body(event);
    }

    @GetMapping
    public EventPageResponse<EventResponse> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "createdAt,desc") String sort) {
        return service.listOwned(page, size, sort);
    }

    @GetMapping("/{eventId}")
    public EventResponse detail(@PathVariable Long eventId) {
        return service.getOwned(eventId);
    }

    @PatchMapping("/{eventId}")
    public EventResponse update(@PathVariable Long eventId,
            @Valid @RequestBody UpdateEventRequest request) {
        return service.update(eventId, request);
    }

    @PostMapping("/{eventId}/publish")
    public EventResponse publish(@PathVariable Long eventId) {
        return service.publish(eventId);
    }

    @DeleteMapping("/{eventId}")
    public ResponseEntity<Void> deleteDraft(@PathVariable Long eventId) {
        service.deleteDraft(eventId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{eventId}/cancel")
    public EventResponse cancel(@PathVariable Long eventId,
            @RequestBody CancelEventRequest request) {
        return service.cancel(eventId, request);
    }
}

