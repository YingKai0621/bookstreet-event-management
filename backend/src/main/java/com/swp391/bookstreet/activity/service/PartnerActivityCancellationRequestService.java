package com.swp391.bookstreet.activity.service;

import com.swp391.bookstreet.activity.dto.ActivityCancellationRequestResponse;
import com.swp391.bookstreet.activity.dto.ActivityPageResponse;
import com.swp391.bookstreet.activity.dto.CreateActivityCancellationRequest;
import com.swp391.bookstreet.activity.entity.Activity;
import com.swp391.bookstreet.activity.entity.ActivityRequest;
import com.swp391.bookstreet.activity.entity.ActivityRequestStatus;
import com.swp391.bookstreet.activity.entity.ActivityRequestType;
import com.swp391.bookstreet.activity.entity.ActivityStatus;
import com.swp391.bookstreet.activity.exception.ActivityApiException;
import com.swp391.bookstreet.activity.repository.ActivityRepository;
import com.swp391.bookstreet.activity.repository.ActivityRequestRepository;
import com.swp391.bookstreet.activity.security.ActivityCurrentUser;
import com.swp391.bookstreet.notification.service.OrganizerWorkItemNotificationService;
import com.swp391.bookstreet.partner.repository.PartnerOrganizationRepository;
import com.swp391.bookstreet.partner.service.PartnerOrganizationGuard;
import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class PartnerActivityCancellationRequestService {
    private final ActivityRepository activityRepository;
    private final ActivityRequestRepository requestRepository;
    private final PartnerOrganizationRepository organizationRepository;
    private final PartnerOrganizationGuard organizationGuard;
    private final ActivityCurrentUser currentUser;
    private final ActivityLockService lockService;
    private final ActivityLifecycleCoordinator lifecycleCoordinator;
    private final ActivityLifecycleService lifecycleService;
    private final ActivityValidationService validation;
    private final ActivityConstraintTranslator constraintTranslator;
    private final OrganizerWorkItemNotificationService organizerNotifications;
    private final Clock clock;

    public PartnerActivityCancellationRequestService(ActivityRepository activityRepository,
            ActivityRequestRepository requestRepository,
            PartnerOrganizationRepository organizationRepository,
            PartnerOrganizationGuard organizationGuard, ActivityCurrentUser currentUser,
            ActivityLockService lockService,
            ActivityLifecycleCoordinator lifecycleCoordinator,
            ActivityLifecycleService lifecycleService, ActivityValidationService validation,
            ActivityConstraintTranslator constraintTranslator,
            OrganizerWorkItemNotificationService organizerNotifications, Clock clock) {
        this.activityRepository = activityRepository;
        this.requestRepository = requestRepository;
        this.organizationRepository = organizationRepository;
        this.organizationGuard = organizationGuard;
        this.currentUser = currentUser;
        this.lockService = lockService;
        this.lifecycleCoordinator = lifecycleCoordinator;
        this.lifecycleService = lifecycleService;
        this.validation = validation;
        this.constraintTranslator = constraintTranslator;
        this.organizerNotifications = organizerNotifications;
        this.clock = clock;
    }

    @Transactional
    public ActivityCancellationRequestResponse submit(Long activityId,
            CreateActivityCancellationRequest request) {
        Long representativeUserId = currentUser.requirePartnerId();
        var ownedRoute = activityRepository.findPartnerRoute(activityId, representativeUserId)
                .orElseThrow(PartnerActivityCancellationRequestService::activityNotFound);
        organizationGuard.requireActive(organizationRepository
                .findById(ownedRoute.getPartnerOrganizationId())
                .orElseThrow(PartnerActivityCancellationRequestService::activityNotFound));
        var locks = lockService.lockActivityRoot(activityId);
        Activity activity = locks.activity();
        Instant now = now();
        lifecycleCoordinator.advanceLocked(activity, now);
        requireCancellable(activity);
        if (!lockService.lockPendingRequestsAfterActivity(activityId).isEmpty()) {
            throw alreadyPending();
        }
        String reason = validation.reason(request == null ? null : request.reason());
        Instant cutoff = locks.event().getActivityCancellationCutoffAt();
        boolean late = isLate(now, cutoff);
        ActivityRequest cancellation = ActivityRequest.submitCancellation(activityId,
                reason, late, now);
        try {
            requestRepository.saveAndFlush(cancellation);
        } catch (DataIntegrityViolationException error) {
            constraintTranslator.rethrow(error);
            throw error;
        }
        organizerNotifications.activityCancellationRequestSubmitted(locks.event(), cancellation);
        return ActivityCancellationRequestResponse.from(cancellation);
    }

    public ActivityPageResponse<ActivityCancellationRequestResponse> list(int page, int size,
            String sort, Long eventId, String status, Boolean late, String search) {
        Long representativeUserId = currentUser.requirePartnerId();
        if (eventId != null && eventId <= 0) {
            throw new ActivityApiException(HttpStatus.BAD_REQUEST, "INVALID_FILTER",
                    "eventId must be positive.");
        }
        lifecycleService.advanceDueActivities();
        var result = requestRepository.findOwnedRequests(representativeUserId,
                ActivityRequestType.CANCELLATION, eventId, parseStatus(status), late,
                normalizeSearch(search), ActivityPagination.requests(page, size, sort));
        return new ActivityPageResponse<>(result.getContent().stream()
                .map(ActivityCancellationRequestResponse::from).toList(), result.getNumber(),
                result.getSize(), result.getTotalElements(), result.getTotalPages());
    }

    public ActivityCancellationRequestResponse detail(Long requestId) {
        Long representativeUserId = currentUser.requirePartnerId();
        lifecycleService.advanceDueActivities();
        return requestRepository.findOwnedRequest(requestId, representativeUserId,
                        ActivityRequestType.CANCELLATION)
                .map(ActivityCancellationRequestResponse::from)
                .orElseThrow(PartnerActivityCancellationRequestService::requestNotFound);
    }

    @Transactional
    public ActivityCancellationRequestResponse withdraw(Long requestId) {
        Long representativeUserId = currentUser.requirePartnerId();
        var route = requestRepository.findOwnedRequestRoute(requestId, representativeUserId,
                        ActivityRequestType.CANCELLATION)
                .orElseThrow(PartnerActivityCancellationRequestService::requestNotFound);
        var locks = lockService.lockActivityRoot(route.getActivityId());
        Instant now = now();
        lifecycleCoordinator.advanceLocked(locks.activity(), now);
        ActivityRequest request = lockService.lockRequestAfterActivity(requestId);
        if (!request.getActivityId().equals(route.getActivityId())
                || request.getRequestType() != ActivityRequestType.CANCELLATION) {
            throw requestNotFound();
        }
        if (request.getStatus() != ActivityRequestStatus.PENDING
                && request.getStatus() != ActivityRequestStatus.WITHDRAWN) {
            throw new ActivityApiException(HttpStatus.CONFLICT,
                    "ACTIVITY_REQUEST_NOT_REVIEWABLE",
                    "Activity Cancellation Request is no longer withdrawable.");
        }
        request.withdrawIfPending(now);
        requestRepository.flush();
        return ActivityCancellationRequestResponse.from(request);
    }

    private static void requireCancellable(Activity activity) {
        if (activity.getStatus() == ActivityStatus.CANCELLED) {
            throw new ActivityApiException(HttpStatus.CONFLICT,
                    "ACTIVITY_ALREADY_CANCELLED", "Activity is already cancelled.");
        }
        if (activity.getStatus() == ActivityStatus.COMPLETED) {
            throw new ActivityApiException(HttpStatus.CONFLICT,
                    "ACTIVITY_NOT_CANCELLABLE",
                    "Completed Activity cannot receive a Cancellation Request.");
        }
    }

    private Instant now() {
        return clock.instant().truncatedTo(ChronoUnit.MICROS);
    }

    static boolean isLate(Instant now, Instant cutoff) {
        return cutoff != null && now.isAfter(cutoff);
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

    private static ActivityApiException alreadyPending() {
        return new ActivityApiException(HttpStatus.CONFLICT,
                "ACTIVITY_REQUEST_ALREADY_PENDING",
                "Activity already has a Pending change or cancellation request.");
    }

    private static ActivityApiException activityNotFound() {
        return new ActivityApiException(HttpStatus.NOT_FOUND,
                "ACTIVITY_NOT_FOUND", "Activity not found.");
    }

    private static ActivityApiException requestNotFound() {
        return new ActivityApiException(HttpStatus.NOT_FOUND,
                "ACTIVITY_CANCELLATION_REQUEST_NOT_FOUND",
                "Activity Cancellation Request not found.");
    }
}
