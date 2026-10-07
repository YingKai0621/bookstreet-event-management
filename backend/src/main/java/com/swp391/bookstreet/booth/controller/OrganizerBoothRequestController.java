package com.swp391.bookstreet.booth.controller;

import com.swp391.bookstreet.booth.dto.BoothPageResponse;
import com.swp391.bookstreet.booth.dto.BoothRequestResponse;
import com.swp391.bookstreet.booth.dto.RejectBoothRequest;
import com.swp391.bookstreet.booth.entity.BoothRequestStatus;
import com.swp391.bookstreet.booth.service.OrganizerBoothRequestService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/organizer/events/{eventId}/booth-requests")
public class OrganizerBoothRequestController {
    private final OrganizerBoothRequestService service;

    public OrganizerBoothRequestController(OrganizerBoothRequestService service) {
        this.service = service;
    }

    @GetMapping
    public BoothPageResponse<BoothRequestResponse> list(
            @PathVariable Long eventId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "submittedAt,asc") String sort,
            @RequestParam(required = false) Long boothId,
            @RequestParam(required = false) BoothRequestStatus status) {
        return service.list(eventId, page, size, sort, boothId, status);
    }

    @GetMapping("/{boothRequestId}")
    public BoothRequestResponse detail(@PathVariable Long eventId,
            @PathVariable Long boothRequestId) {
        return service.detail(eventId, boothRequestId);
    }

    @PostMapping("/{boothRequestId}/select")
    public BoothRequestResponse select(@PathVariable Long eventId,
            @PathVariable Long boothRequestId) {
        return service.select(eventId, boothRequestId);
    }

    @PostMapping("/{boothRequestId}/reject")
    public BoothRequestResponse reject(@PathVariable Long eventId,
            @PathVariable Long boothRequestId,
            @Valid @RequestBody RejectBoothRequest request) {
        return service.reject(eventId, boothRequestId, request);
    }
}
