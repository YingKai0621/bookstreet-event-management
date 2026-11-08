package com.swp391.bookstreet.admin.controller;

import com.swp391.bookstreet.admin.dto.AdminCreateUserRequest;
import com.swp391.bookstreet.admin.dto.AdminPageResponse;
import com.swp391.bookstreet.admin.dto.AdminStatusUpdateRequest;
import com.swp391.bookstreet.admin.dto.AdminUpdateUserRequest;
import com.swp391.bookstreet.admin.dto.AdminUserResponse;
import com.swp391.bookstreet.admin.service.AdminUserService;
import com.swp391.bookstreet.security.authentication.AuthenticatedPrincipal;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Sections 4 and 5 of the Sprint 11 API contract. Path IDs are read as text so that a malformed ID is
 * reported as an unknown account. The acting Admin always comes from the Session.
 */
@RestController
@RequestMapping("/api/v1/admin/users")
@PreAuthorize("hasRole('ADMIN')")
public class AdminUserController {

    private final AdminUserService adminUserService;

    public AdminUserController(AdminUserService adminUserService) {
        this.adminUserService = adminUserService;
    }

    @GetMapping
    public AdminPageResponse<AdminUserResponse> listUsers(
            @RequestParam(defaultValue = "0") String page,
            @RequestParam(defaultValue = "20") String size,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String role,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String sort) {
        return adminUserService.listUsers(page, size, search, role, status, sort);
    }

    @GetMapping("/{userId}")
    public AdminUserResponse getUser(@PathVariable String userId) {
        return adminUserService.getUser(userId);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public AdminUserResponse createUser(@Valid @RequestBody AdminCreateUserRequest request) {
        return adminUserService.createUser(request);
    }

    @PatchMapping("/{userId}")
    public AdminUserResponse updateUser(
            @AuthenticationPrincipal AuthenticatedPrincipal actor,
            @PathVariable String userId,
            @Valid @RequestBody AdminUpdateUserRequest request) {
        return adminUserService.updateUser(actor.userId(), userId, request);
    }

    @PatchMapping("/{userId}/status")
    public AdminUserResponse updateStatus(
            @AuthenticationPrincipal AuthenticatedPrincipal actor,
            @PathVariable String userId,
            @RequestBody AdminStatusUpdateRequest request) {
        return adminUserService.updateStatus(actor.userId(), userId, request);
    }

    @PutMapping("/{userId}/roles/{roleCode}")
    public AdminUserResponse assignRole(@PathVariable String userId, @PathVariable String roleCode) {
        return adminUserService.assignRole(userId, roleCode);
    }

    @DeleteMapping("/{userId}/roles/{roleCode}")
    public AdminUserResponse removeRole(
            @AuthenticationPrincipal AuthenticatedPrincipal actor,
            @PathVariable String userId,
            @PathVariable String roleCode) {
        return adminUserService.removeRole(actor.userId(), userId, roleCode);
    }
}
