package com.swp391.bookstreet.activity.controller;

import com.swp391.bookstreet.activity.dto.ActivityPageResponse;
import com.swp391.bookstreet.activity.dto.ActivityResponse;
import com.swp391.bookstreet.activity.dto.PartnerActivityRevisionResponse;
import com.swp391.bookstreet.activity.service.PartnerActivityService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/partner/activities")
public class PartnerActivityController {
    private final PartnerActivityService service;

    public PartnerActivityController(PartnerActivityService service) {
        this.service = service;
    }

    @GetMapping
    public ActivityPageResponse<ActivityResponse> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "startAt,asc") String sort,
            @RequestParam(required = false) Long eventId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String search) {
        return service.list(page, size, sort, eventId, status, search);
    }

    @GetMapping("/{activityId}")
    public ActivityResponse detail(@PathVariable Long activityId) {
        return service.detail(activityId);
    }

    @GetMapping("/{activityId}/revisions")
    public ActivityPageResponse<PartnerActivityRevisionResponse> revisions(
            @PathVariable Long activityId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "changedAt,desc") String sort) {
        return service.revisions(activityId, page, size, sort);
    }
}
