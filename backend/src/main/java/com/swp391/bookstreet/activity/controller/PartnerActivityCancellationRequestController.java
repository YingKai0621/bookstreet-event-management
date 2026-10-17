package com.swp391.bookstreet.activity.controller;

import com.swp391.bookstreet.activity.dto.ActivityCancellationRequestResponse;
import com.swp391.bookstreet.activity.dto.ActivityPageResponse;
import com.swp391.bookstreet.activity.dto.CreateActivityCancellationRequest;
import com.swp391.bookstreet.activity.service.PartnerActivityCancellationRequestService;
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
public class PartnerActivityCancellationRequestController {
    private final PartnerActivityCancellationRequestService service;

    public PartnerActivityCancellationRequestController(
            PartnerActivityCancellationRequestService service) {
        this.service = service;
    }

    @PostMapping("/activities/{activityId}/cancellation-requests")
    public ResponseEntity<ActivityCancellationRequestResponse> submit(
            @PathVariable Long activityId,
            @RequestBody CreateActivityCancellationRequest request) {
        ActivityCancellationRequestResponse response = service.submit(activityId, request);
        return ResponseEntity.created(URI.create(
                "/api/v1/partner/activity-cancellation-requests/"
                        + response.activityCancellationRequestId())).body(response);
    }

    @GetMapping("/activity-cancellation-requests")
    public ActivityPageResponse<ActivityCancellationRequestResponse> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "submittedAt,desc") String sort,
            @RequestParam(required = false) Long eventId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Boolean late,
            @RequestParam(required = false) String search) {
        return service.list(page, size, sort, eventId, status, late, search);
    }

    @GetMapping("/activity-cancellation-requests/{requestId}")
    public ActivityCancellationRequestResponse detail(@PathVariable Long requestId) {
        return service.detail(requestId);
    }

    @PostMapping("/activity-cancellation-requests/{requestId}/withdraw")
    public ActivityCancellationRequestResponse withdraw(@PathVariable Long requestId) {
        return service.withdraw(requestId);
    }
}
