package com.swp391.bookstreet.dashboard.controller;

import com.swp391.bookstreet.dashboard.dto.OrganizerDashboardResponse;
import com.swp391.bookstreet.dashboard.service.OrganizerDashboardService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/organizer/dashboard")
@PreAuthorize("hasRole('ORGANIZER')")
public class OrganizerDashboardController {
    private final OrganizerDashboardService service;

    public OrganizerDashboardController(OrganizerDashboardService service) {
        this.service = service;
    }

    @GetMapping
    public OrganizerDashboardResponse getOverview(
            @AuthenticationPrincipal(expression = "userId") Long organizerUserId
    ) {
        return service.getOverview(organizerUserId);
    }
}
