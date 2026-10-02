package com.swp391.bookstreet.partner.controller;

import com.swp391.bookstreet.partner.dto.PartnerApiErrorResponse;
import com.swp391.bookstreet.partner.dto.PartnerOrganizationRequest;
import com.swp391.bookstreet.partner.dto.PartnerOrganizationResponse;
import com.swp391.bookstreet.partner.service.PartnerOrganizationService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;

@RestController
@RequestMapping("/api/v1/partner/organization")
@PreAuthorize("hasRole('PARTNER')")
public class PartnerOrganizationController {

    private final PartnerOrganizationService organizationService;

    public PartnerOrganizationController(PartnerOrganizationService organizationService) {
        this.organizationService = organizationService;
    }

    @GetMapping
    public ResponseEntity<?> getOwnOrganization(
            @AuthenticationPrincipal(expression = "userId") Long currentUserId
    ) {
        return organizationService.findForRepresentative(currentUserId)
                .<ResponseEntity<?>>map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND).body(
                        new PartnerApiErrorResponse(
                                "PARTNER_ORGANIZATION_NOT_FOUND",
                                "Partner organization was not found.",
                                List.of(),
                                Instant.now(),
                                "/api/v1/partner/organization"
                        )
                ));
    }

    @PutMapping
    public ResponseEntity<PartnerOrganizationResponse> createOrUpdateOwnOrganization(
            @AuthenticationPrincipal(expression = "userId") Long currentUserId,
            @Valid @RequestBody PartnerOrganizationRequest request
    ) {
        PartnerOrganizationService.SaveResult result = organizationService
                .createOrUpdate(currentUserId, request);

        return ResponseEntity.status(result.created() ? HttpStatus.CREATED : HttpStatus.OK)
                .body(result.organization());
    }
}
