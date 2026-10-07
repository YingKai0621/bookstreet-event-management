package com.swp391.bookstreet.booth.controller;

import com.swp391.bookstreet.booth.dto.BoothPageResponse;
import com.swp391.bookstreet.booth.dto.BoothResponse;
import com.swp391.bookstreet.booth.dto.CreateBoothRequest;
import com.swp391.bookstreet.booth.dto.UpdateBoothRequest;
import com.swp391.bookstreet.booth.service.BoothCatalogService;
import jakarta.validation.Valid;
import java.net.URI;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/organizer/booths")
public class OrganizerBoothController {
    private final BoothCatalogService service;

    public OrganizerBoothController(BoothCatalogService service) {
        this.service = service;
    }

    @PostMapping
    public ResponseEntity<BoothResponse> create(@Valid @RequestBody CreateBoothRequest request) {
        BoothResponse booth = service.create(request);
        return ResponseEntity.created(URI.create("/api/v1/organizer/booths/" + booth.boothId()))
                .body(booth);
    }

    @GetMapping
    public BoothPageResponse<BoothResponse> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "code,asc") String sort,
            @RequestParam(required = false) Boolean active) {
        return service.list(page, size, sort, active);
    }

    @GetMapping("/{boothId}")
    public BoothResponse detail(@PathVariable Long boothId) {
        return service.detail(boothId);
    }

    @PatchMapping("/{boothId}")
    public BoothResponse update(@PathVariable Long boothId,
            @Valid @RequestBody UpdateBoothRequest request) {
        return service.update(boothId, request);
    }
}
