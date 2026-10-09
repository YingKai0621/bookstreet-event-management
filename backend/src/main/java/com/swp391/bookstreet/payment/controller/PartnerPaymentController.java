package com.swp391.bookstreet.payment.controller;

import com.swp391.bookstreet.booth.dto.BoothPageResponse;
import com.swp391.bookstreet.booth.exception.BoothApiException;
import com.swp391.bookstreet.payment.dto.BoothAssignmentResponse;
import com.swp391.bookstreet.payment.dto.BoothPaymentResponse;
import com.swp391.bookstreet.payment.dto.PaymentInitiationResponse;
import com.swp391.bookstreet.payment.service.PartnerPaymentService;
import jakarta.servlet.http.HttpServletRequest;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/partner")
public class PartnerPaymentController {
    private final PartnerPaymentService service;

    public PartnerPaymentController(PartnerPaymentService service) {
        this.service = service;
    }

    @PostMapping("/booth-requests/{requestId}/payments")
    public ResponseEntity<PaymentInitiationResponse> initiate(
            @PathVariable Long requestId,
            @RequestHeader(value = "Idempotency-Key", required = false) String rawKey,
            HttpServletRequest request) {
        UUID key;
        try {
            key = UUID.fromString(rawKey);
        } catch (RuntimeException error) {
            throw new BoothApiException(HttpStatus.BAD_REQUEST, "INVALID_IDEMPOTENCY_KEY",
                    "Idempotency-Key must be a UUID.");
        }
        String forwarded = request.getHeader("X-Forwarded-For");
        String clientIp = forwarded == null || forwarded.isBlank()
                ? request.getRemoteAddr() : forwarded.split(",", 2)[0].trim();
        var result = service.initiate(requestId, key, clientIp);
        return ResponseEntity.status(result.status()).body(result.body());
    }

    @GetMapping("/booth-requests/{requestId}/payments")
    public BoothPageResponse<BoothPaymentResponse> list(
            @PathVariable Long requestId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "createdAt,desc") String sort) {
        return service.list(requestId, page, size, sort);
    }

    @GetMapping("/booth-payments/{paymentId}")
    public BoothPaymentResponse detail(@PathVariable Long paymentId) {
        return service.detail(paymentId);
    }

    @GetMapping("/booth-requests/{requestId}/assignment")
    public BoothAssignmentResponse assignment(@PathVariable Long requestId) {
        return service.assignment(requestId);
    }
}
