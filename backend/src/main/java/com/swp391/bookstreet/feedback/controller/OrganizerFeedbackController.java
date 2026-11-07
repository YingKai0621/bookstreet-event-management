package com.swp391.bookstreet.feedback.controller;

import com.swp391.bookstreet.feedback.dto.EmptyFeedbackTransitionRequest;
import com.swp391.bookstreet.feedback.dto.OrganizerFeedbackDetailResponse;
import com.swp391.bookstreet.feedback.dto.OrganizerFeedbackPageResponse;
import com.swp391.bookstreet.feedback.dto.ResolveFeedbackRequest;
import com.swp391.bookstreet.feedback.exception.FeedbackApiException;
import com.swp391.bookstreet.feedback.service.OrganizerFeedbackService;
import com.swp391.bookstreet.security.authentication.AuthenticatedPrincipal;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/organizer/feedbacks")
@PreAuthorize("hasRole('ORGANIZER')")
public class OrganizerFeedbackController {
    private final OrganizerFeedbackService service;

    public OrganizerFeedbackController(OrganizerFeedbackService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<OrganizerFeedbackPageResponse> list(
            @RequestParam(defaultValue = "0") String page,
            @RequestParam(defaultValue = "20") String size,
            @RequestParam(defaultValue = "submittedAt,desc") String sort,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String senderSearch,
            @RequestParam(required = false) String eventNameSearch,
            @RequestParam(required = false) String targetType,
            @RequestParam(required = false) String eventId,
            @RequestParam(required = false) String status
    ) {
        return noStore(service.list(
                page,
                size,
                sort,
                search,
                senderSearch,
                eventNameSearch,
                targetType,
                eventId,
                status
        ));
    }

    @GetMapping("/{feedbackId}")
    public ResponseEntity<OrganizerFeedbackDetailResponse> detail(@PathVariable String feedbackId) {
        return noStore(service.detail(feedbackId));
    }

    @PostMapping("/{feedbackId}/start-handling")
    public ResponseEntity<OrganizerFeedbackDetailResponse> startHandling(
            @PathVariable String feedbackId,
            @RequestBody(required = false) EmptyFeedbackTransitionRequest ignored,
            Authentication authentication
    ) {
        return noStore(service.startHandling(feedbackId, currentUserId(authentication)));
    }

    @PostMapping("/{feedbackId}/resolve")
    public ResponseEntity<OrganizerFeedbackDetailResponse> resolve(
            @PathVariable String feedbackId,
            @RequestBody(required = false) ResolveFeedbackRequest request,
            Authentication authentication
    ) {
        return noStore(service.resolve(feedbackId, currentUserId(authentication), request));
    }

    @PostMapping("/{feedbackId}/reopen")
    public ResponseEntity<OrganizerFeedbackDetailResponse> reopen(
            @PathVariable String feedbackId,
            @RequestBody(required = false) EmptyFeedbackTransitionRequest ignored,
            Authentication authentication
    ) {
        return noStore(service.reopen(feedbackId, currentUserId(authentication)));
    }

    private Long currentUserId(Authentication authentication) {
        if (authentication != null && authentication.getPrincipal() instanceof AuthenticatedPrincipal principal) {
            return principal.userId();
        }
        throw new FeedbackApiException(
                HttpStatus.UNAUTHORIZED,
                "AUTHENTICATION_REQUIRED",
                "Yêu cầu đăng nhập."
        );
    }

    private <T> ResponseEntity<T> noStore(T body) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(body);
    }
}
