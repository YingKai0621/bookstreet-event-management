package com.swp391.bookstreet.admin.controller;

import com.swp391.bookstreet.admin.dto.AdminDashboardStatsDto;
import com.swp391.bookstreet.admin.service.AdminDashboardService;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/dashboard")
@PreAuthorize("hasRole('ADMIN')")
public class AdminDashboardController {

    private final AdminDashboardService adminDashboardService;

    public AdminDashboardController(AdminDashboardService adminDashboardService) {
        this.adminDashboardService = adminDashboardService;
    }

    @GetMapping
    public ResponseEntity<AdminDashboardStatsDto> getDashboard() {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(adminDashboardService.getStats());
    }
}
