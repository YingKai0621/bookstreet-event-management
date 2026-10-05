package com.swp391.bookstreet.partner.controller;

import com.swp391.bookstreet.partner.dto.PartnerApiErrorResponse;
import com.swp391.bookstreet.partner.dto.PartnerApplicationResponse;
import com.swp391.bookstreet.partner.service.PartnerApplicationQueryService;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;

@RestController
@RequestMapping("/api/v1/partner/applications")
@PreAuthorize("hasRole('PARTNER')")
public class PartnerApplicationQueryController {

    private final PartnerApplicationQueryService queryService;

    public PartnerApplicationQueryController(PartnerApplicationQueryService queryService) {
        this.queryService = queryService;
    }

    @GetMapping
    public Page<PartnerApplicationResponse> listOwnApplications(
            @AuthenticationPrincipal(expression = "userId") Long currentUserId,
            @ParameterObject
            @PageableDefault(size = 20, sort = "submittedAt", direction = Sort.Direction.DESC)
            Pageable pageable
    ) {
        return queryService.findAllForRepresentative(currentUserId, pageable);
    }

    @GetMapping("/{applicationId}")
    public ResponseEntity<?> getOwnApplication(
            @PathVariable Long applicationId,
            @AuthenticationPrincipal(expression = "userId") Long currentUserId
    ) {
        return queryService.findOwnedApplication(applicationId, currentUserId)
                .<ResponseEntity<?>>map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND).body(
                        new PartnerApiErrorResponse(
                                "APPLICATION_NOT_FOUND",
                                "Application was not found.",
                                List.of(),
                                Instant.now(),
                                "/api/v1/partner/applications/" + applicationId
                        )
                ));
    }
}
