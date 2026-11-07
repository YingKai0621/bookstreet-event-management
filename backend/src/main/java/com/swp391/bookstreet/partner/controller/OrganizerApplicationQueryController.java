package com.swp391.bookstreet.partner.controller;

import com.swp391.bookstreet.partner.dto.OrganizerApplicationResponse;
import com.swp391.bookstreet.partner.service.OrganizerApplicationQueryService;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/organizer/events")
@PreAuthorize("hasRole('ORGANIZER')")
public class OrganizerApplicationQueryController {

    private final OrganizerApplicationQueryService queryService;

    public OrganizerApplicationQueryController(
            OrganizerApplicationQueryService queryService
    ) {
        this.queryService = queryService;
    }

    @GetMapping("/{eventId}/applications")
    public ResponseEntity<Page<OrganizerApplicationResponse>> listEventApplications(
            @PathVariable Long eventId,
            @AuthenticationPrincipal(expression = "userId") Long organizerUserId,
            @RequestParam(required = false) String status,
            @ParameterObject
            @PageableDefault(size = 20, sort = "submittedAt", direction = Sort.Direction.DESC)
            Pageable pageable
    ) {
        return ResponseEntity.ok(queryService.findEventApplications(
                eventId,
                organizerUserId,
                status,
                pageable
        ));
    }
}
