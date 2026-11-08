package com.swp391.bookstreet.admin.controller;

import com.swp391.bookstreet.admin.dto.AdminPageResponse;
import com.swp391.bookstreet.admin.dto.AdminPartnerOrganizationResponse;
import com.swp391.bookstreet.admin.dto.AdminPartnerOrganizationStatusRequest;
import com.swp391.bookstreet.admin.service.AdminPartnerOrganizationService;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/partner-organizations")
@PreAuthorize("hasRole('ADMIN')")
public class AdminPartnerOrganizationController {
    private final AdminPartnerOrganizationService service;

    public AdminPartnerOrganizationController(AdminPartnerOrganizationService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<AdminPageResponse<AdminPartnerOrganizationResponse>> list(
            @RequestParam(defaultValue = "0") String page,
            @RequestParam(defaultValue = "20") String size,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String sort
    ) {
        return noStore(service.list(page, size, search, status, sort));
    }

    @GetMapping("/{partnerOrganizationId}")
    public ResponseEntity<AdminPartnerOrganizationResponse> detail(
            @PathVariable String partnerOrganizationId
    ) {
        return noStore(service.detail(partnerOrganizationId));
    }

    @PatchMapping("/{partnerOrganizationId}/status")
    public ResponseEntity<AdminPartnerOrganizationResponse> changeStatus(
            @PathVariable String partnerOrganizationId,
            @RequestBody(required = false) AdminPartnerOrganizationStatusRequest request
    ) {
        return noStore(service.changeStatus(partnerOrganizationId, request));
    }

    private static <T> ResponseEntity<T> noStore(T body) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(body);
    }
}
