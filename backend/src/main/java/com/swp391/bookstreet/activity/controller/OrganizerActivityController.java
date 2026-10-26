package com.swp391.bookstreet.activity.controller;

import com.swp391.bookstreet.activity.dto.ActivityPageResponse;
import com.swp391.bookstreet.activity.dto.ActivityResponse;
import com.swp391.bookstreet.activity.dto.ActivityRevisionResponse;
import com.swp391.bookstreet.activity.dto.CancelActivityRequest;
import com.swp391.bookstreet.activity.dto.CreateActivityRequest;
import com.swp391.bookstreet.activity.dto.UpdateActivityRequest;
import com.swp391.bookstreet.activity.entity.ActivityStatus;
import com.swp391.bookstreet.activity.service.OrganizerActivityService;
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
@RequestMapping("/api/v1/organizer/activities")
public class OrganizerActivityController {
    private final OrganizerActivityService service;

    public OrganizerActivityController(OrganizerActivityService service) {
        this.service = service;
    }

    @PostMapping
    public ResponseEntity<ActivityResponse> create(@RequestBody CreateActivityRequest request) {
        ActivityResponse activity = service.create(request);
        return ResponseEntity.created(URI.create("/api/v1/organizer/activities/"
                + activity.activityId())).body(activity);
    }

    @GetMapping
    public ActivityPageResponse<ActivityResponse> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "startAt,asc") String sort,
            @RequestParam(required = false) Long eventId,
            @RequestParam(required = false) ActivityStatus status,
            @RequestParam(required = false) String search) {
        return service.list(page, size, sort, eventId, status, search);
    }

    @GetMapping("/{activityId}")
    public ResponseEntity<ActivityResponse> detail(@PathVariable Long activityId) {
        return ResponseEntity.ok().cacheControl(org.springframework.http.CacheControl.noStore())
                .body(service.detail(activityId));
    }

    @PatchMapping("/{activityId}")
    public ActivityResponse update(@PathVariable Long activityId,
            @RequestBody UpdateActivityRequest request) {
        return service.update(activityId, request);
    }

    @PostMapping("/{activityId}/publish")
    public ActivityResponse publish(@PathVariable Long activityId) {
        return service.publish(activityId);
    }

    @PostMapping("/{activityId}/cancel")
    public ActivityResponse cancel(@PathVariable Long activityId,
            @RequestBody CancelActivityRequest request) {
        return service.cancel(activityId, request);
    }

    @GetMapping("/{activityId}/revisions")
    public ActivityPageResponse<ActivityRevisionResponse> revisions(
            @PathVariable Long activityId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "changedAt,desc") String sort) {
        return service.revisions(activityId, page, size, sort);
    }
}
