package com.swp391.bookstreet.feedback.controller;

import com.swp391.bookstreet.feedback.dto.CreatePublicFeedbackRequest;
import com.swp391.bookstreet.feedback.dto.PublicFeedbackReceiptResponse;
import com.swp391.bookstreet.feedback.service.PublicFeedbackService;
import com.swp391.bookstreet.security.authentication.AuthenticatedPrincipal;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/public/feedbacks")
public class PublicFeedbackController {
    private final PublicFeedbackService service;

    public PublicFeedbackController(PublicFeedbackService service) {
        this.service = service;
    }

    @PostMapping
    public ResponseEntity<PublicFeedbackReceiptResponse> submit(
            @RequestBody CreatePublicFeedbackRequest request,
            Authentication authentication,
            HttpServletRequest servletRequest
    ) {
        Long userId = authentication != null
                && authentication.getPrincipal() instanceof AuthenticatedPrincipal principal
                ? principal.userId()
                : null;
        PublicFeedbackReceiptResponse response = service.submit(request, userId, servletRequest.getRemoteAddr());
        return ResponseEntity.status(HttpStatus.CREATED)
                .cacheControl(CacheControl.noStore())
                .body(response);
    }
}
