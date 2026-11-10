package com.swp391.bookstreet.payment.controller;

import com.swp391.bookstreet.common.exception.ApiException;
import com.swp391.bookstreet.payment.dto.OrganizerBoothPaymentPage;
import com.swp391.bookstreet.payment.service.OrganizerPaymentHistoryService;
import com.swp391.bookstreet.security.authentication.AuthenticatedPrincipal;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** AC-ORG-PAY-S11-01. Read-only: the Organizer owns the Event, not the Payment flow. */
@RestController
@RequestMapping("/api/v1/organizer/booth-payments")
@PreAuthorize("hasRole('ORGANIZER')")
public class OrganizerPaymentHistoryController {
    private final OrganizerPaymentHistoryService service;

    public OrganizerPaymentHistoryController(OrganizerPaymentHistoryService service) {
        this.service = service;
    }

    @GetMapping
    public OrganizerBoothPaymentPage list(
            @AuthenticationPrincipal AuthenticatedPrincipal organizer,
            @RequestParam(defaultValue = "0") String page,
            @RequestParam(defaultValue = "20") String size,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String eventId,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            @RequestParam(required = false) String sort) {
        if (organizer == null || !organizer.emailVerified()) {
            throw new ApiException(HttpStatus.FORBIDDEN, "ACCESS_DENIED",
                    "You do not have permission to access this resource.");
        }
        return service.list(organizer.userId(), page, size, status, eventId, search, from, to, sort);
    }
}
