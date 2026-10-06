package com.swp391.bookstreet.admin.controller;

import com.swp391.bookstreet.admin.dto.AdminDashboardStatsDto;
import com.swp391.bookstreet.admin.service.AdminUserService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/dashboard")
public class AdminDashboardController {

    private final AdminUserService adminUserService;

    public AdminDashboardController(AdminUserService adminUserService) {
        this.adminUserService = adminUserService;
    }

    @GetMapping
    public ResponseEntity<AdminDashboardStatsDto> getDashboard() {
        return ResponseEntity.ok(adminUserService.getDashboardStats());
    }
}
