package com.swp391.bookstreet.location.controller;

import com.swp391.bookstreet.location.dto.LocationSummary;
import com.swp391.bookstreet.location.service.LocationService;
import java.time.Instant;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/partner/events/{eventId}/activity-locations")
public class PartnerActivityLocationController {
    private final LocationService service;

    public PartnerActivityLocationController(LocationService service) {
        this.service = service;
    }

    @GetMapping
    public List<LocationSummary> list(@PathVariable Long eventId,
            @RequestParam(required = false) Instant startAt,
            @RequestParam(required = false) Instant endAt) {
        return service.listEligibleForPartner(eventId, startAt, endAt);
    }
}
