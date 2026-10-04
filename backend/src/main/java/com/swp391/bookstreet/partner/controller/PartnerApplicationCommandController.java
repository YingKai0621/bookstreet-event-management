package com.swp391.bookstreet.partner.controller;

import com.swp391.bookstreet.partner.dto.PartnerApplicationResponse;
import com.swp391.bookstreet.partner.dto.SubmitPartnerApplicationRequest;
import com.swp391.bookstreet.partner.service.PartnerApplicationService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;

@RestController
@RequestMapping("/api/v1")
@PreAuthorize("hasRole('PARTNER')")
public class PartnerApplicationCommandController {

    private final PartnerApplicationService applicationService;

    public PartnerApplicationCommandController(PartnerApplicationService applicationService) {
        this.applicationService = applicationService;
    }

    @PostMapping("/events/{eventId}/applications")
    public ResponseEntity<PartnerApplicationResponse> submitApplication(
            @PathVariable Long eventId,
            @AuthenticationPrincipal(expression = "userId") Long currentUserId,
            @RequestBody SubmitPartnerApplicationRequest request
    ) {
        PartnerApplicationResponse response = applicationService.submit(
                currentUserId,
                eventId,
                request
        );
        return ResponseEntity.created(URI.create(
                "/api/v1/partner/applications/" + response.applicationId()
        )).body(response);
    }

    @PostMapping("/partner/applications/{applicationId}/withdraw")
    public ResponseEntity<PartnerApplicationResponse> withdrawApplication(
            @PathVariable Long applicationId,
            @AuthenticationPrincipal(expression = "userId") Long currentUserId
    ) {
        return ResponseEntity.ok(applicationService.withdraw(currentUserId, applicationId));
    }
}
