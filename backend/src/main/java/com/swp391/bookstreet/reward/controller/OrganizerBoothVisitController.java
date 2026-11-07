package com.swp391.bookstreet.reward.controller;

import com.swp391.bookstreet.reward.dto.*;
import com.swp391.bookstreet.reward.service.OrganizerBoothVisitQueryService;
import io.swagger.v3.oas.annotations.Operation;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/organizer/events/{eventId}")
public class OrganizerBoothVisitController {
    private final OrganizerBoothVisitQueryService service;

    public OrganizerBoothVisitController(OrganizerBoothVisitQueryService service) { this.service = service; }

    @Operation(summary = "Summarize Booth visits for an owned Event")
    @GetMapping("/booth-visits/summary")
    public OrganizerBoothVisitSummaryResponse summary(@PathVariable Long eventId) {
        return service.summary(eventId);
    }

    @Operation(summary = "List historical BoothAssignment visit groups for an owned Event")
    @GetMapping("/booth-visit-groups")
    public RewardPageResponse<OrganizerBoothVisitGroupResponse> groups(
            @PathVariable Long eventId, @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size, @RequestParam(required = false) String sort,
            @RequestParam(required = false) Long boothId, @RequestParam(required = false) String search) {
        return service.groups(eventId, page, size, sort, boothId, search);
    }

    @Operation(summary = "List paginated Booth visits for an owned Event")
    @GetMapping("/booth-visits")
    public RewardPageResponse<OrganizerBoothVisitResponse> visits(
            @PathVariable Long eventId, @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size, @RequestParam(required = false) String sort,
            @RequestParam(required = false) Long boothId, @RequestParam(required = false) String search) {
        return service.visits(eventId, page, size, sort, boothId, search);
    }
}
