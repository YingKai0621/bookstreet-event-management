package com.swp391.bookstreet.admin.controller;

import com.swp391.bookstreet.admin.dto.AdminBoothPaymentResponse;
import com.swp391.bookstreet.admin.dto.AdminPageResponse;
import com.swp391.bookstreet.admin.service.AdminBoothPaymentService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** AC-OPT-S11-01. Read-only by design: Admin does not change a Payment (BR-119). */
@RestController
@RequestMapping("/api/v1/admin/booth-payments")
@PreAuthorize("hasRole('ADMIN')")
public class AdminBoothPaymentController {
    private final AdminBoothPaymentService service;

    public AdminBoothPaymentController(AdminBoothPaymentService service) {
        this.service = service;
    }

    @GetMapping
    public AdminPageResponse<AdminBoothPaymentResponse> list(
            @RequestParam(defaultValue = "0") String page,
            @RequestParam(defaultValue = "20") String size,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String eventId,
            @RequestParam(required = false) String reconciliationRequired,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            @RequestParam(required = false) String sort) {
        return service.list(page, size, status, eventId, reconciliationRequired, search, from, to, sort);
    }
}
