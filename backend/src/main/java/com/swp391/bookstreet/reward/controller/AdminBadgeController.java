package com.swp391.bookstreet.reward.controller;

import com.swp391.bookstreet.reward.dto.*;
import com.swp391.bookstreet.reward.service.AdminBadgeService;
import com.swp391.bookstreet.reward.service.AdminBadgeSynchronizationService;
import io.swagger.v3.oas.annotations.Operation;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/admin/badges")
public class AdminBadgeController {
    private final AdminBadgeService service;
    private final AdminBadgeSynchronizationService synchronization;

    public AdminBadgeController(AdminBadgeService service, AdminBadgeSynchronizationService synchronization) {
        this.service = service;
        this.synchronization = synchronization;
    }

    @Operation(summary = "List and search the Admin Badge catalog")
    @GetMapping
    public RewardPageResponse<AdminBadgeResponse> list(
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String sort, @RequestParam(required = false) String active,
            @RequestParam(required = false) String search) {
        return service.list(page, size, sort, active, search);
    }

    @Operation(summary = "Read a Badge and its current synchronization progress")
    @GetMapping("/{badgeId}")
    public AdminBadgeResponse detail(@PathVariable Long badgeId) { return service.detail(badgeId); }

    @Operation(summary = "Create a Badge; active definitions schedule synchronization after commit")
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public AdminBadgeMutationResponse create(@Valid @RequestBody AdminBadgeRequest request) {
        return service.create(request);
    }

    @Operation(summary = "Replace mutable Badge fields without revoking earned history")
    @PutMapping("/{badgeId}")
    public AdminBadgeMutationResponse update(@PathVariable Long badgeId, @Valid @RequestBody AdminBadgeRequest request) {
        return service.update(badgeId, request);
    }

    @Operation(summary = "Commit one batch of at most 100 eligible Users and resume remaining awards")
    @PostMapping("/{badgeId}/synchronize-awards")
    public BadgeSynchronizationResponse synchronize(@PathVariable Long badgeId) {
        return synchronization.synchronize(badgeId);
    }
}
