package com.swp391.bookstreet.activity.controller;

import com.swp391.bookstreet.activity.dto.ActivityPageResponse;
import com.swp391.bookstreet.activity.dto.ActivityProposalResponse;
import com.swp391.bookstreet.activity.dto.ApproveActivityProposalResponse;
import com.swp391.bookstreet.activity.dto.ReviewActivityProposalRequest;
import com.swp391.bookstreet.activity.service.OrganizerActivityProposalService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/organizer/activity-proposals")
public class OrganizerActivityProposalController {
    private final OrganizerActivityProposalService service;

    public OrganizerActivityProposalController(OrganizerActivityProposalService service) {
        this.service = service;
    }

    @GetMapping
    public ActivityPageResponse<ActivityProposalResponse> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "submittedAt,asc") String sort,
            @RequestParam(required = false) Long eventId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Long locationId,
            @RequestParam(required = false) String search) {
        return service.list(page, size, sort, eventId, status, locationId, search);
    }

    @GetMapping("/{proposalId}")
    public ActivityProposalResponse detail(@PathVariable Long proposalId) {
        return service.detail(proposalId);
    }

    @PostMapping("/{proposalId}/request-changes")
    public ActivityProposalResponse requestChanges(@PathVariable Long proposalId,
            @RequestBody(required = false) ReviewActivityProposalRequest request) {
        return service.requestChanges(proposalId, request);
    }

    @PostMapping("/{proposalId}/reject")
    public ActivityProposalResponse reject(@PathVariable Long proposalId,
            @RequestBody(required = false) ReviewActivityProposalRequest request) {
        return service.reject(proposalId, request);
    }

    @PostMapping("/{proposalId}/approve")
    public ApproveActivityProposalResponse approve(@PathVariable Long proposalId) {
        return service.approve(proposalId);
    }
}
