package com.swp391.bookstreet.booth.controller;

import com.swp391.bookstreet.booth.dto.BoothPageResponse;
import com.swp391.bookstreet.booth.dto.EventBoothResponse;
import com.swp391.bookstreet.booth.entity.BoothAvailability;
import com.swp391.bookstreet.booth.service.EventBoothService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/events/{eventId}/booths")
public class PublicEventBoothController {
    private final EventBoothService service;

    public PublicEventBoothController(EventBoothService service) {
        this.service = service;
    }

    @GetMapping
    public BoothPageResponse<EventBoothResponse> list(
            @PathVariable Long eventId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "code,asc") String sort,
            @RequestParam(required = false) BoothAvailability availability,
            @RequestParam(required = false) String categoryCode) {
        return service.listPublic(eventId, page, size, sort, availability, categoryCode);
    }

    @GetMapping("/{boothId}")
    public EventBoothResponse detail(@PathVariable Long eventId, @PathVariable Long boothId) {
        return service.publicDetail(eventId, boothId);
    }
}
