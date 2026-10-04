package com.swp391.bookstreet.partner.controller;

import com.swp391.bookstreet.partner.dto.OrganizerApplicationResponse;
import com.swp391.bookstreet.partner.service.OrganizerApplicationQueryService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/organizer/applications")
@PreAuthorize("hasRole('ORGANIZER')")
public class OrganizerApplicationDetailController {

    private final OrganizerApplicationQueryService queryService;

    public OrganizerApplicationDetailController(
            OrganizerApplicationQueryService queryService
    ) {
        this.queryService = queryService;
    }

    @GetMapping("/{applicationId}")
    public ResponseEntity<OrganizerApplicationResponse> getApplication(
            @PathVariable Long applicationId,
            @AuthenticationPrincipal(expression = "userId") Long organizerUserId
    ) {
        return ResponseEntity.ok(queryService.findApplication(applicationId, organizerUserId));
    }
}
