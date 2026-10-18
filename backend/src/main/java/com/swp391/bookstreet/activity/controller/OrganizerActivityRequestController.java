package com.swp391.bookstreet.activity.controller;

import com.swp391.bookstreet.activity.dto.ActivityPageResponse;
import com.swp391.bookstreet.activity.dto.OrganizerActivityCancellationRequestResponse;
import com.swp391.bookstreet.activity.dto.OrganizerActivityChangeRequestResponse;
import com.swp391.bookstreet.activity.dto.ReviewActivityRequest;
import com.swp391.bookstreet.activity.service.OrganizerActivityRequestService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/organizer")
public class OrganizerActivityRequestController {
    private final OrganizerActivityRequestService service;

    public OrganizerActivityRequestController(OrganizerActivityRequestService service) {
        this.service = service;
    }

    @GetMapping("/activity-change-requests")
    public ActivityPageResponse<OrganizerActivityChangeRequestResponse> listChanges(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "submittedAt,asc") String sort,
            @RequestParam(required = false) Long eventId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String search) {
        return service.listChanges(page, size, sort, eventId, status, search);
    }

    @GetMapping("/activity-change-requests/{requestId}")
    public OrganizerActivityChangeRequestResponse changeDetail(@PathVariable Long requestId) {
        return service.changeDetail(requestId);
    }

    @PostMapping("/activity-change-requests/{requestId}/approve")
    public OrganizerActivityChangeRequestResponse approveChange(@PathVariable Long requestId) {
        return service.approveChange(requestId);
    }

    @PostMapping("/activity-change-requests/{requestId}/reject")
    public OrganizerActivityChangeRequestResponse rejectChange(@PathVariable Long requestId,
            @RequestBody(required = false) ReviewActivityRequest request) {
        return service.rejectChange(requestId, request);
    }

    @GetMapping("/activity-cancellation-requests")
    public ActivityPageResponse<OrganizerActivityCancellationRequestResponse> listCancellations(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "submittedAt,asc") String sort,
            @RequestParam(required = false) Long eventId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Boolean late,
            @RequestParam(required = false) String search) {
        return service.listCancellations(page, size, sort, eventId, status, late, search);
    }

    @GetMapping("/activity-cancellation-requests/{requestId}")
    public OrganizerActivityCancellationRequestResponse cancellationDetail(
            @PathVariable Long requestId) {
        return service.cancellationDetail(requestId);
    }

    @PostMapping("/activity-cancellation-requests/{requestId}/approve")
    public OrganizerActivityCancellationRequestResponse approveCancellation(
            @PathVariable Long requestId) {
        return service.approveCancellation(requestId);
    }

    @PostMapping("/activity-cancellation-requests/{requestId}/reject")
    public OrganizerActivityCancellationRequestResponse rejectCancellation(
            @PathVariable Long requestId,
            @RequestBody(required = false) ReviewActivityRequest request) {
        return service.rejectCancellation(requestId, request);
    }
}
