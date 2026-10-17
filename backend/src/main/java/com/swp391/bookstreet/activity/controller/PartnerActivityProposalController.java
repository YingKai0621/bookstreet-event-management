package com.swp391.bookstreet.activity.controller;

import com.swp391.bookstreet.activity.dto.ActivityPageResponse;
import com.swp391.bookstreet.activity.dto.ActivityProposalResponse;
import com.swp391.bookstreet.activity.dto.CreateActivityProposalRequest;
import com.swp391.bookstreet.activity.dto.UpdateActivityProposalRequest;
import com.swp391.bookstreet.activity.service.PartnerActivityProposalService;
import java.net.URI;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/partner/activity-proposals")
public class PartnerActivityProposalController {
    private final PartnerActivityProposalService service;

    public PartnerActivityProposalController(PartnerActivityProposalService service) {
        this.service = service;
    }

    @PostMapping
    public ResponseEntity<ActivityProposalResponse> submit(
            @RequestBody CreateActivityProposalRequest request) {
        ActivityProposalResponse proposal = service.submit(request);
        return ResponseEntity.created(URI.create("/api/v1/partner/activity-proposals/"
                + proposal.activityProposalId())).body(proposal);
    }

    @GetMapping
    public ActivityPageResponse<ActivityProposalResponse> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "submittedAt,desc") String sort,
            @RequestParam(required = false) Long eventId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String search) {
        return service.list(page, size, sort, eventId, status, search);
    }

    @GetMapping("/{proposalId}")
    public ActivityProposalResponse detail(@PathVariable Long proposalId) {
        return service.detail(proposalId);
    }

    @PatchMapping("/{proposalId}")
    public ActivityProposalResponse update(@PathVariable Long proposalId,
            @RequestBody UpdateActivityProposalRequest request) {
        return service.update(proposalId, request);
    }

    @PostMapping("/{proposalId}/resubmit")
    public ActivityProposalResponse resubmit(@PathVariable Long proposalId) {
        return service.resubmit(proposalId);
    }

    @PostMapping("/{proposalId}/withdraw")
    public ActivityProposalResponse withdraw(@PathVariable Long proposalId) {
        return service.withdraw(proposalId);
    }
}
