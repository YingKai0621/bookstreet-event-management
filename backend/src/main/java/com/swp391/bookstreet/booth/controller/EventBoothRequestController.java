package com.swp391.bookstreet.booth.controller;

import com.swp391.bookstreet.booth.dto.BoothRequestResponse;
import com.swp391.bookstreet.booth.dto.SubmitBoothRequest;
import com.swp391.bookstreet.booth.service.PartnerBoothRequestService;
import jakarta.validation.Valid;
import java.net.URI;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/events/{eventId}/booth-requests")
public class EventBoothRequestController {
    private final PartnerBoothRequestService service;

    public EventBoothRequestController(PartnerBoothRequestService service) {
        this.service = service;
    }

    @PostMapping
    public ResponseEntity<BoothRequestResponse> submit(
            @PathVariable Long eventId,
            @Valid @RequestBody SubmitBoothRequest request
    ) {
        BoothRequestResponse response = service.submit(eventId, request);
        return ResponseEntity.created(URI.create(
                "/api/v1/partner/booth-requests/" + response.boothRequestId()))
                .body(response);
    }
}
