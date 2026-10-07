package com.swp391.bookstreet.booth.controller;

import com.swp391.bookstreet.booth.dto.BoothPageResponse;
import com.swp391.bookstreet.booth.dto.BoothRequestResponse;
import com.swp391.bookstreet.booth.entity.BoothRequestStatus;
import com.swp391.bookstreet.booth.service.PartnerBoothRequestService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/partner/booth-requests")
public class PartnerBoothRequestController {
    private final PartnerBoothRequestService service;

    public PartnerBoothRequestController(PartnerBoothRequestService service) {
        this.service = service;
    }

    @GetMapping
    public BoothPageResponse<BoothRequestResponse> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "submittedAt,desc") String sort,
            @RequestParam(required = false) Long eventId,
            @RequestParam(required = false) BoothRequestStatus status
    ) {
        return service.list(page, size, sort, eventId, status);
    }

    @GetMapping("/{boothRequestId}")
    public BoothRequestResponse detail(@PathVariable Long boothRequestId) {
        return service.detail(boothRequestId);
    }

    @PostMapping("/{boothRequestId}/withdraw")
    public BoothRequestResponse withdraw(@PathVariable Long boothRequestId) {
        return service.withdraw(boothRequestId);
    }
}
