package com.swp391.bookstreet.activity.controller;

import com.swp391.bookstreet.activity.dto.ActivityPageResponse;
import com.swp391.bookstreet.activity.dto.PublicActivityResponse;
import com.swp391.bookstreet.activity.service.PublicActivityService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/activities")
public class PublicActivityController {
    private final PublicActivityService service;

    public PublicActivityController(PublicActivityService service) {
        this.service = service;
    }

    @GetMapping
    public ActivityPageResponse<PublicActivityResponse> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "startAt,asc") String sort,
            @RequestParam(required = false) Long eventId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String activityType,
            @RequestParam(required = false) Long locationId,
            @RequestParam(required = false) String search) {
        return service.list(page, size, sort, eventId, status, activityType, locationId, search);
    }

    @GetMapping("/{activityId}")
    public PublicActivityResponse detail(@PathVariable Long activityId) {
        return service.detail(activityId);
    }
}
