package com.swp391.bookstreet.activity.service;

import com.swp391.bookstreet.activity.dto.ActivityChangeRequestResponse;
import com.swp391.bookstreet.activity.dto.ActivityPageResponse;
import com.swp391.bookstreet.activity.dto.CreateActivityChangeRequest;
import com.swp391.bookstreet.activity.entity.Activity;
import com.swp391.bookstreet.activity.entity.ActivityRequest;
import com.swp391.bookstreet.activity.entity.ActivityRequestStatus;
import com.swp391.bookstreet.activity.entity.ActivityRequestType;
import com.swp391.bookstreet.activity.entity.ActivityStatus;
import com.swp391.bookstreet.activity.exception.ActivityApiException;
import com.swp391.bookstreet.activity.repository.ActivityRepository;
import com.swp391.bookstreet.activity.repository.ActivityRequestRepository;
import com.swp391.bookstreet.activity.security.ActivityCurrentUser;
import com.swp391.bookstreet.booth.entity.Location;
import com.swp391.bookstreet.booth.entity.LocationType;
import com.swp391.bookstreet.booth.repository.BoothAssignmentRepository;
import com.swp391.bookstreet.notification.service.OrganizerWorkItemNotificationService;
import com.swp391.bookstreet.partner.repository.PartnerOrganizationRepository;
import com.swp391.bookstreet.partner.service.PartnerOrganizationGuard;
import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Objects;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class PartnerActivityChangeRequestService {
    private final ActivityRepository activityRepository;
    private final ActivityRequestRepository requestRepository;
    private final BoothAssignmentRepository assignmentRepository;
    private final PartnerOrganizationRepository organizationRepository;
    private final PartnerOrganizationGuard organizationGuard;
    private final ActivityCurrentUser currentUser;
    private final ActivityLockService lockService;
    private final ActivityLifecycleCoordinator lifecycleCoordinator;
    private final ActivityLifecycleService lifecycleService;
    private final ActivityValidationService validation;
    private final ActivityScheduleGuard scheduleGuard;
    private final ActivityConstraintTranslator constraintTranslator;
    private final OrganizerWorkItemNotificationService organizerNotifications;
    private final Clock clock;

    public PartnerActivityChangeRequestService(ActivityRepository activityRepository,
            ActivityRequestRepository requestRepository,
            BoothAssignmentRepository assignmentRepository,
            PartnerOrganizationRepository organizationRepository,
            PartnerOrganizationGuard organizationGuard,
            ActivityCurrentUser currentUser, ActivityLockService lockService,
            ActivityLifecycleCoordinator lifecycleCoordinator,
            ActivityLifecycleService lifecycleService, ActivityValidationService validation,
            ActivityScheduleGuard scheduleGuard,
            ActivityConstraintTranslator constraintTranslator,
            OrganizerWorkItemNotificationService organizerNotifications, Clock clock) {
        this.activityRepository = activityRepository;
        this.requestRepository = requestRepository;
        this.assignmentRepository = assignmentRepository;
        this.organizationRepository = organizationRepository;
        this.organizationGuard = organizationGuard;
        this.currentUser = currentUser;
        this.lockService = lockService;
        this.lifecycleCoordinator = lifecycleCoordinator;
        this.lifecycleService = lifecycleService;
        this.validation = validation;
        this.scheduleGuard = scheduleGuard;
        this.constraintTranslator = constraintTranslator;
        this.organizerNotifications = organizerNotifications;
        this.clock = clock;
    }

    @Transactional
    public ActivityChangeRequestResponse submit(Long activityId,
            CreateActivityChangeRequest request) {
        Long representativeUserId = currentUser.requirePartnerId();
        if (request == null) {
            throw validation("Activity Change Request body is required.", null);
        }
        var ownedRoute = activityRepository.findPartnerRoute(activityId, representativeUserId)
                .orElseThrow(PartnerActivityChangeRequestService::activityNotFound);
        organizationGuard.requireActive(organizationRepository
                .findById(ownedRoute.getPartnerOrganizationId())
                .orElseThrow(PartnerActivityChangeRequestService::activityNotFound));
        validateTimePair(request);
        List<Long> additionalLocations = request.contains("requestedLocationId")
                ? List.of(requiredId(request.getRequestedLocationId(),
                        "requestedLocationId"))
                : List.of();
        var locks = lockService.lockActivityRoot(activityId, additionalLocations);
        Activity activity = locks.activity();
        Instant now = now();
        lifecycleCoordinator.advanceLocked(activity, now);
        requireChangeable(activity);
        if (!lockService.lockPendingRequestsAfterActivity(activityId).isEmpty()) {
            throw alreadyPending();
        }

        String reason = validation.reason(request.getReason());
        Long locationId = request.contains("requestedLocationId")
                ? requiredId(request.getRequestedLocationId(), "requestedLocationId")
                : activity.getLocationId();
        Location location = locks.location(locationId);
        String title = request.contains("requestedTitle")
                ? request.getRequestedTitle() : activity.getTitle();
        String description = request.contains("requestedDescription")
                ? request.getRequestedDescription() : activity.getDescription();
        String activityType = request.contains("requestedActivityType")
                ? request.getRequestedActivityType() : activity.getActivityType();
        Instant startAt = request.contains("requestedStartAt")
                ? request.getRequestedStartAt() : activity.getStartAt();
        Instant endAt = request.contains("requestedEndAt")
                ? request.getRequestedEndAt() : activity.getEndAt();
        Integer capacity = request.contains("requestedCapacity")
                ? request.getRequestedCapacity() : activity.getCapacity();
        String imageUrl = request.contains("requestedImageUrl")
                ? request.getRequestedImageUrl() : activity.getImageUrl();

        ValidatedActivityFields fields = validation.validateCore(locks.event(), location,
                title, description, activityType, startAt, endAt, capacity, imageUrl, true);
        validation.validateRegistrationUpdate(activity.isRegistrationRequired(),
                activity.getRegistrationDeadlineAt(), activity.isCertificateEnabled(),
                fields.startAt(), activity.getStatus() == ActivityStatus.PUBLISHED);
        requireEligibleLocation(activity.getEventId(), location,
                ownedRoute.getPartnerOrganizationId());
        scheduleGuard.requireAvailable(locationId, fields.startAt(), fields.endAt(), activityId);
        requireEffect(activity, locationId, fields);

        ActivityRequest change = ActivityRequest.submitChange(activityId,
                request.contains("requestedLocationId") ? locationId : null,
                request.contains("requestedTitle") ? fields.title() : null,
                request.contains("requestedDescription"),
                request.contains("requestedDescription") ? fields.description() : null,
                request.contains("requestedActivityType") ? fields.activityType() : null,
                request.contains("requestedStartAt") ? fields.startAt() : null,
                request.contains("requestedEndAt") ? fields.endAt() : null,
                request.contains("requestedCapacity") ? fields.capacity() : null,
                request.contains("requestedImageUrl"),
                request.contains("requestedImageUrl")
                        ? uriText(fields) : null,
                reason, now);
        try {
            requestRepository.saveAndFlush(change);
        } catch (DataIntegrityViolationException error) {
            constraintTranslator.rethrow(error);
            throw error;
        }
        organizerNotifications.activityChangeRequestSubmitted(locks.event(), change);
        return ActivityChangeRequestResponse.from(change);
    }

    public ActivityPageResponse<ActivityChangeRequestResponse> list(int page, int size,
            String sort, Long eventId, String status, String search) {
        Long representativeUserId = currentUser.requirePartnerId();
        if (eventId != null && eventId <= 0) {
            throw new ActivityApiException(HttpStatus.BAD_REQUEST, "INVALID_FILTER",
                    "eventId must be positive.");
        }
        lifecycleService.advanceDueActivities();
        var result = requestRepository.findOwnedRequests(representativeUserId,
                ActivityRequestType.CHANGE, eventId, parseStatus(status),
                null, normalizeSearch(search), ActivityPagination.requests(page, size, sort));
        return new ActivityPageResponse<>(result.getContent().stream()
                .map(ActivityChangeRequestResponse::from).toList(), result.getNumber(),
                result.getSize(), result.getTotalElements(), result.getTotalPages());
    }

    public ActivityChangeRequestResponse detail(Long requestId) {
        Long representativeUserId = currentUser.requirePartnerId();
        lifecycleService.advanceDueActivities();
        return requestRepository.findOwnedRequest(requestId, representativeUserId,
                        ActivityRequestType.CHANGE)
                .map(ActivityChangeRequestResponse::from)
                .orElseThrow(PartnerActivityChangeRequestService::requestNotFound);
    }

    @Transactional
    public ActivityChangeRequestResponse withdraw(Long requestId) {
        Long representativeUserId = currentUser.requirePartnerId();
        var route = requestRepository.findOwnedRequestRoute(requestId, representativeUserId,
                        ActivityRequestType.CHANGE)
                .orElseThrow(PartnerActivityChangeRequestService::requestNotFound);
        var locks = lockService.lockActivityRoot(route.getActivityId());
        Instant now = now();
        lifecycleCoordinator.advanceLocked(locks.activity(), now);
        ActivityRequest request = lockService.lockRequestAfterActivity(requestId);
        if (!request.getActivityId().equals(route.getActivityId())
                || request.getRequestType() != ActivityRequestType.CHANGE) {
            throw requestNotFound();
        }
        if (request.getStatus() != ActivityRequestStatus.PENDING
                && request.getStatus() != ActivityRequestStatus.WITHDRAWN) {
            throw new ActivityApiException(HttpStatus.CONFLICT,
                    "ACTIVITY_REQUEST_NOT_REVIEWABLE",
                    "Activity Change Request is no longer withdrawable.");
        }
        request.withdrawIfPending(now);
        requestRepository.flush();
        return ActivityChangeRequestResponse.from(request);
    }

    private void requireEligibleLocation(Long eventId, Location location,
            Long partnerOrganizationId) {
        if (location.getLocationType() != LocationType.BOOTH) return;
        if (assignmentRepository.existsActiveOwnedForEventAndBooth(eventId,
                location.getLocationId(), partnerOrganizationId)) return;
        if (assignmentRepository.existsActiveForEventAndBooth(eventId,
                location.getLocationId())) {
            throw new ActivityApiException(HttpStatus.CONFLICT,
                    "BOOTH_NOT_ASSIGNED_TO_PARTNER",
                    "Booth is assigned to a different Partner for this Event.");
        }
        throw new ActivityApiException(HttpStatus.CONFLICT, "BOOTH_ASSIGNMENT_REQUIRED",
                "An Active Booth Assignment is required for this Event.");
    }

    private static void requireChangeable(Activity activity) {
        if (activity.getStatus() != ActivityStatus.DRAFT
                && activity.getStatus() != ActivityStatus.PUBLISHED) {
            throw new ActivityApiException(HttpStatus.CONFLICT, "ACTIVITY_NOT_CHANGEABLE",
                    "Activity is not changeable in its current state.");
        }
    }

    private static void requireEffect(Activity activity, Long locationId,
            ValidatedActivityFields fields) {
        if (Objects.equals(activity.getLocationId(), locationId)
                && Objects.equals(activity.getTitle(), fields.title())
                && Objects.equals(activity.getDescription(), fields.description())
                && Objects.equals(activity.getActivityType(), fields.activityType())
                && Objects.equals(activity.getStartAt(), fields.startAt())
                && Objects.equals(activity.getEndAt(), fields.endAt())
                && Objects.equals(activity.getCapacity(), fields.capacity())
                && Objects.equals(activity.getImageUrl(), uriText(fields))) {
            throw new ActivityApiException(HttpStatus.UNPROCESSABLE_CONTENT,
                    "ACTIVITY_CHANGE_HAS_NO_EFFECT",
                    "At least one requested field must change the Activity.");
        }
    }

    private static String uriText(ValidatedActivityFields fields) {
        return fields.imageUrl() == null ? null : fields.imageUrl().toString();
    }

    private static void validateTimePair(CreateActivityChangeRequest request) {
        if (request.contains("requestedStartAt") != request.contains("requestedEndAt")) {
            throw validation("requestedStartAt and requestedEndAt must be supplied together.",
                    "requestedStartAt");
        }
    }

    private Instant now() {
        return clock.instant().truncatedTo(ChronoUnit.MICROS);
    }

    private static Long requiredId(Long value, String field) {
        if (value == null || value <= 0) {
            throw validation(field + " must be positive.", field);
        }
        return value;
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

    private static ActivityApiException validation(String message, String field) {
        return new ActivityApiException(HttpStatus.UNPROCESSABLE_CONTENT,
                "VALIDATION_FAILED", message, field);
    }

    private static ActivityApiException activityNotFound() {
        return new ActivityApiException(HttpStatus.NOT_FOUND,
                "ACTIVITY_NOT_FOUND", "Activity not found.");
    }

    private static ActivityApiException requestNotFound() {
        return new ActivityApiException(HttpStatus.NOT_FOUND,
                "ACTIVITY_CHANGE_REQUEST_NOT_FOUND", "Activity Change Request not found.");
    }
}
