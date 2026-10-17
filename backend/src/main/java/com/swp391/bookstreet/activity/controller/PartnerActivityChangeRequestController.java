package com.swp391.bookstreet.activity.controller;

import com.swp391.bookstreet.activity.dto.ActivityChangeRequestResponse;
import com.swp391.bookstreet.activity.dto.ActivityPageResponse;
import com.swp391.bookstreet.activity.dto.CreateActivityChangeRequest;
import com.swp391.bookstreet.activity.service.PartnerActivityChangeRequestService;
import java.net.URI;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/partner")
public class PartnerActivityChangeRequestController {
    private final PartnerActivityChangeRequestService service;

    public PartnerActivityChangeRequestController(
            PartnerActivityChangeRequestService service) {
        this.service = service;
    }

    @PostMapping("/activities/{activityId}/change-requests")
    public ResponseEntity<ActivityChangeRequestResponse> submit(
            @PathVariable Long activityId,
            @RequestBody CreateActivityChangeRequest request) {
        ActivityChangeRequestResponse response = service.submit(activityId, request);
        return ResponseEntity.created(URI.create("/api/v1/partner/activity-change-requests/"
                + response.activityChangeRequestId())).body(response);
    }

    @GetMapping("/activity-change-requests")
    public ActivityPageResponse<ActivityChangeRequestResponse> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "submittedAt,desc") String sort,
            @RequestParam(required = false) Long eventId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String search) {
        return service.list(page, size, sort, eventId, status, search);
    }

    @GetMapping("/activity-change-requests/{requestId}")
    public ActivityChangeRequestResponse detail(@PathVariable Long requestId) {
        return service.detail(requestId);
    }

    @PostMapping("/activity-change-requests/{requestId}/withdraw")
    public ActivityChangeRequestResponse withdraw(@PathVariable Long requestId) {
        return service.withdraw(requestId);
    }
}
