package com.swp391.bookstreet.registration.controller;

import com.swp391.bookstreet.registration.dto.EventRegistrationResponse;
import com.swp391.bookstreet.registration.dto.RegistrationPageResponse;
import com.swp391.bookstreet.registration.service.ParticipantEventRegistrationService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/participant")
public class ParticipantEventRegistrationController {
    private final ParticipantEventRegistrationService service;

    public ParticipantEventRegistrationController(ParticipantEventRegistrationService service) {
        this.service = service;
    }

    @GetMapping("/event-registrations")
    public RegistrationPageResponse<EventRegistrationResponse> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "activatedAt,desc") String sort,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String eventStatus,
            @RequestParam(required = false) String search) {
        return service.list(page, size, sort, status, eventStatus, search);
    }

    @GetMapping("/event-registrations/{eventRegistrationId}")
    public EventRegistrationResponse detail(@PathVariable Long eventRegistrationId) {
        return service.detail(eventRegistrationId);
    }

    @PostMapping("/events/{eventId}/join")
    public EventRegistrationResponse join(@PathVariable Long eventId) {
        return service.join(eventId);
    }

    @PostMapping("/events/{eventId}/leave")
    public EventRegistrationResponse leave(@PathVariable Long eventId) {
        return service.leave(eventId);
    }
}
