package com.swp391.bookstreet.activity.service;

import com.swp391.bookstreet.activity.dto.ActivityPageResponse;
import com.swp391.bookstreet.activity.dto.OrganizerActivityCancellationRequestResponse;
import com.swp391.bookstreet.activity.dto.OrganizerActivityChangeRequestResponse;
import com.swp391.bookstreet.activity.dto.ReviewActivityRequest;
import com.swp391.bookstreet.activity.entity.ActivityRequestStatus;
import com.swp391.bookstreet.activity.entity.ActivityRequestType;
import com.swp391.bookstreet.activity.exception.ActivityApiException;
import com.swp391.bookstreet.activity.repository.ActivityRequestRepository;
import com.swp391.bookstreet.activity.repository.ActivityRequestRepository.OrganizerRequestContextView;
import com.swp391.bookstreet.activity.security.ActivityCurrentUser;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.annotation.Propagation;
import java.util.Collection;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@Transactional(readOnly = true)
public class OrganizerActivityRequestService {
    private final ActivityRequestRepository requestRepository;
    private final ActivityCurrentUser currentUser;
    private final ActivityLifecycleService lifecycleService;
    private final OrganizerActivityRequestReviewTransactionService reviewTransactions;

    public OrganizerActivityRequestService(ActivityRequestRepository requestRepository,
            ActivityCurrentUser currentUser, ActivityLifecycleService lifecycleService,
            OrganizerActivityRequestReviewTransactionService reviewTransactions) {
        this.requestRepository = requestRepository;
        this.currentUser = currentUser;
        this.lifecycleService = lifecycleService;
        this.reviewTransactions = reviewTransactions;
    }

    public ActivityPageResponse<OrganizerActivityChangeRequestResponse> listChanges(int page,
            int size,
            String sort, Long eventId, String status, String search) {
        Long organizerUserId = currentUser.requireOrganizerId();
        requirePositiveEventId(eventId);
        lifecycleService.advanceDueActivities();
        var result = requestRepository.findOrganizerRequests(organizerUserId,
                ActivityRequestType.CHANGE, eventId, parseStatus(status), null,
                normalizeSearch(search), ActivityPagination.requests(page, size, sort));
        var contexts = contexts(result.getContent().stream()
                .map(request -> request.getActivityRequestId()).toList(), organizerUserId);
        return new ActivityPageResponse<>(result.getContent().stream()
                .map(request -> OrganizerActivityChangeRequestResponse.from(request,
                        requireContext(contexts, request.getActivityRequestId()))).toList(),
                result.getNumber(),
                result.getSize(), result.getTotalElements(), result.getTotalPages());
    }

    public OrganizerActivityChangeRequestResponse changeDetail(Long requestId) {
        Long organizerUserId = currentUser.requireOrganizerId();
        lifecycleService.advanceDueActivities();
        var request = requestRepository.findOrganizerRequest(requestId, organizerUserId,
                        ActivityRequestType.CHANGE)
                .orElseThrow(OrganizerActivityRequestService::changeNotFound);
        return OrganizerActivityChangeRequestResponse.from(request,
                requireContext(contexts(java.util.List.of(requestId), organizerUserId),
                        requestId));
    }

    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public OrganizerActivityChangeRequestResponse approveChange(Long requestId) {
        Long organizerUserId = currentUser.requireOrganizerId();
        reviewTransactions.approveChange(requestId, organizerUserId);
        return changeDetailForOrganizer(requestId, organizerUserId);
    }

    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public OrganizerActivityChangeRequestResponse rejectChange(Long requestId,
            ReviewActivityRequest request) {
        Long organizerUserId = currentUser.requireOrganizerId();
        reviewTransactions.rejectChange(requestId, organizerUserId, request);
        return changeDetailForOrganizer(requestId, organizerUserId);
    }

    public ActivityPageResponse<OrganizerActivityCancellationRequestResponse> listCancellations(
            int page, int size, String sort, Long eventId, String status, Boolean late,
            String search) {
        Long organizerUserId = currentUser.requireOrganizerId();
        requirePositiveEventId(eventId);
        lifecycleService.advanceDueActivities();
        var result = requestRepository.findOrganizerRequests(organizerUserId,
                ActivityRequestType.CANCELLATION, eventId, parseStatus(status), late,
                normalizeSearch(search), ActivityPagination.requests(page, size, sort));
        var contexts = contexts(result.getContent().stream()
                .map(request -> request.getActivityRequestId()).toList(), organizerUserId);
        return new ActivityPageResponse<>(result.getContent().stream()
                .map(request -> OrganizerActivityCancellationRequestResponse.from(request,
                        requireContext(contexts, request.getActivityRequestId()))).toList(),
                result.getNumber(),
                result.getSize(), result.getTotalElements(), result.getTotalPages());
    }

    public OrganizerActivityCancellationRequestResponse cancellationDetail(Long requestId) {
        Long organizerUserId = currentUser.requireOrganizerId();
        lifecycleService.advanceDueActivities();
        var request = requestRepository.findOrganizerRequest(requestId, organizerUserId,
                        ActivityRequestType.CANCELLATION)
                .orElseThrow(OrganizerActivityRequestService::cancellationNotFound);
        return OrganizerActivityCancellationRequestResponse.from(request,
                requireContext(contexts(java.util.List.of(requestId), organizerUserId),
                        requestId));
    }

    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public OrganizerActivityCancellationRequestResponse approveCancellation(Long requestId) {
        Long organizerUserId = currentUser.requireOrganizerId();
        reviewTransactions.approveCancellation(requestId, organizerUserId);
        return cancellationDetailForOrganizer(requestId, organizerUserId);
    }

    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public OrganizerActivityCancellationRequestResponse rejectCancellation(Long requestId,
            ReviewActivityRequest request) {
        Long organizerUserId = currentUser.requireOrganizerId();
        reviewTransactions.rejectCancellation(requestId, organizerUserId, request);
        return cancellationDetailForOrganizer(requestId, organizerUserId);
    }

    private OrganizerActivityChangeRequestResponse changeDetailForOrganizer(Long requestId,
            Long organizerUserId) {
        var request = requestRepository.findOrganizerRequest(requestId, organizerUserId,
                        ActivityRequestType.CHANGE)
                .orElseThrow(OrganizerActivityRequestService::changeNotFound);
        return OrganizerActivityChangeRequestResponse.from(request,
                requireContext(contexts(java.util.List.of(requestId), organizerUserId),
                        requestId));
    }

    private OrganizerActivityCancellationRequestResponse cancellationDetailForOrganizer(
            Long requestId, Long organizerUserId) {
        var request = requestRepository.findOrganizerRequest(requestId, organizerUserId,
                        ActivityRequestType.CANCELLATION)
                .orElseThrow(OrganizerActivityRequestService::cancellationNotFound);
        return OrganizerActivityCancellationRequestResponse.from(request,
                requireContext(contexts(java.util.List.of(requestId), organizerUserId),
                        requestId));
    }

    private Map<Long, OrganizerRequestContextView> contexts(Collection<Long> requestIds,
            Long organizerUserId) {
        if (requestIds.isEmpty()) return Map.of();
        return requestRepository.findOrganizerRequestContexts(requestIds, organizerUserId)
                .stream().collect(Collectors.toMap(OrganizerRequestContextView::getRequestId,
                        Function.identity()));
    }

    private static OrganizerRequestContextView requireContext(
            Map<Long, OrganizerRequestContextView> contexts, Long requestId) {
        var context = contexts.get(requestId);
        if (context == null) {
            throw new IllegalStateException("Missing Organizer Activity Request context.");
        }
        return context;
    }

    private static void requirePositiveEventId(Long eventId) {
        if (eventId != null && eventId <= 0) {
            throw new ActivityApiException(HttpStatus.BAD_REQUEST, "INVALID_FILTER",
                    "eventId must be positive.");
        }
    }

    private static ActivityRequestStatus parseStatus(String status) {
        if (status == null || status.isBlank()) return null;
        try {
            return ActivityRequestStatus.valueOf(status);
        } catch (IllegalArgumentException error) {
            throw new ActivityApiException(HttpStatus.BAD_REQUEST, "INVALID_FILTER",
                    "status is not a supported Activity Request status.");
        }
    }

    private static String normalizeSearch(String search) {
        return search == null ? "" : search.trim();
    }

    private static ActivityApiException changeNotFound() {
        return new ActivityApiException(HttpStatus.NOT_FOUND,
                "ACTIVITY_CHANGE_REQUEST_NOT_FOUND", "Activity Change Request not found.");
    }

    private static ActivityApiException cancellationNotFound() {
        return new ActivityApiException(HttpStatus.NOT_FOUND,
                "ACTIVITY_CANCELLATION_REQUEST_NOT_FOUND",
                "Activity Cancellation Request not found.");
    }
}
