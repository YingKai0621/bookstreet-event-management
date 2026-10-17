package com.swp391.bookstreet.location.controller;

import com.swp391.bookstreet.booth.entity.LocationType;
import com.swp391.bookstreet.location.dto.CreateLocationRequest;
import com.swp391.bookstreet.location.dto.LocationPageResponse;
import com.swp391.bookstreet.location.dto.LocationSummary;
import com.swp391.bookstreet.location.dto.UpdateLocationRequest;
import com.swp391.bookstreet.location.service.LocationService;
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
@RequestMapping("/api/v1/organizer/locations")
public class OrganizerLocationController {
    private final LocationService service;

    public OrganizerLocationController(LocationService service) {
        this.service = service;
    }

    @GetMapping
    public LocationPageResponse<LocationSummary> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "code,asc") String sort,
            @RequestParam(required = false) LocationType type,
            @RequestParam(required = false) Boolean active,
            @RequestParam(required = false) String search) {
        return service.list(page, size, sort, type, active, search);
    }

    @PostMapping
    public ResponseEntity<LocationSummary> create(
            @Valid @RequestBody CreateLocationRequest request) {
        LocationSummary location = service.create(request);
        return ResponseEntity.created(URI.create("/api/v1/organizer/locations/"
                + location.locationId())).body(location);
    }

    @PatchMapping("/{locationId}")
    public LocationSummary update(@PathVariable Long locationId,
            @Valid @RequestBody UpdateLocationRequest request) {
        return service.update(locationId, request);
    }
}
