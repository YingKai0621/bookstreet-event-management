package com.swp391.bookstreet.booth.controller;

import com.swp391.bookstreet.booth.dto.EventBoothConfigRequest;
import com.swp391.bookstreet.booth.dto.EventBoothResponse;
import com.swp391.bookstreet.booth.service.EventBoothService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/organizer/events/{eventId}/booth-configs")
public class OrganizerEventBoothController {
    private final EventBoothService service;

    public OrganizerEventBoothController(EventBoothService service) {
        this.service = service;
    }

    @GetMapping
    public List<EventBoothResponse> list(@PathVariable Long eventId) {
        return service.listOwnedConfigurations(eventId);
    }

    @PutMapping("/{boothId}")
    public EventBoothResponse configure(@PathVariable Long eventId, @PathVariable Long boothId,
            @Valid @RequestBody EventBoothConfigRequest request) {
        return service.configure(eventId, boothId, request);
    }
}
