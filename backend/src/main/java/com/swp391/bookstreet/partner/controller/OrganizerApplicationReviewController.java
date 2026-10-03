package com.swp391.bookstreet.partner.controller;

import com.swp391.bookstreet.partner.dto.OrganizerApplicationResponse;
import com.swp391.bookstreet.partner.dto.ReviewPartnerApplicationRequest;
import com.swp391.bookstreet.partner.service.OrganizerApplicationReviewService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/organizer/applications")
@PreAuthorize("hasRole('ORGANIZER')")
public class OrganizerApplicationReviewController {

    private final OrganizerApplicationReviewService reviewService;

    public OrganizerApplicationReviewController(
            OrganizerApplicationReviewService reviewService
    ) {
        this.reviewService = reviewService;
    }

    @PostMapping("/{applicationId}/approve")
    public ResponseEntity<OrganizerApplicationResponse> approveApplication(
            @PathVariable Long applicationId,
            @AuthenticationPrincipal(expression = "userId") Long organizerUserId,
            @RequestBody(required = false) ReviewPartnerApplicationRequest request
    ) {
        return ResponseEntity.ok(reviewService.approve(
                applicationId,
                organizerUserId,
                request
        ));
    }

    @PostMapping("/{applicationId}/reject")
    public ResponseEntity<OrganizerApplicationResponse> rejectApplication(
            @PathVariable Long applicationId,
            @AuthenticationPrincipal(expression = "userId") Long organizerUserId,
            @RequestBody(required = false) ReviewPartnerApplicationRequest request
    ) {
        return ResponseEntity.ok(reviewService.reject(
                applicationId,
                organizerUserId,
                request
        ));
    }
}
