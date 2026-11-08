package com.swp391.bookstreet.activity.service;

import com.swp391.bookstreet.activity.dto.ActivityCancellationRequestResponse;
import com.swp391.bookstreet.activity.dto.ActivityChangeRequestResponse;
import com.swp391.bookstreet.activity.dto.ReviewActivityRequest;
import com.swp391.bookstreet.attendance.service.ActivityParticipationLifecycleService;
import com.swp391.bookstreet.activity.entity.Activity;
import com.swp391.bookstreet.activity.entity.ActivityCancellationSource;
import com.swp391.bookstreet.activity.entity.ActivityRequest;
import com.swp391.bookstreet.activity.entity.ActivityRequestStatus;
import com.swp391.bookstreet.activity.entity.ActivityRequestType;
import com.swp391.bookstreet.activity.entity.ActivityRevision;
import com.swp391.bookstreet.activity.entity.ActivityRevisionSource;
import com.swp391.bookstreet.activity.entity.ActivityStatus;
import com.swp391.bookstreet.activity.exception.ActivityApiException;
import com.swp391.bookstreet.activity.repository.ActivityRepository;
import com.swp391.bookstreet.activity.repository.ActivityRequestRepository;
import com.swp391.bookstreet.activity.repository.ActivityRevisionRepository;
import com.swp391.bookstreet.booth.entity.Location;
import com.swp391.bookstreet.booth.entity.LocationType;
import com.swp391.bookstreet.booth.repository.BoothAssignmentRepository;
import com.swp391.bookstreet.partner.repository.PartnerOrganizationRepository;
import com.swp391.bookstreet.partner.service.PartnerOrganizationGuard;
import java.net.URI;
import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class OrganizerActivityRequestReviewTransactionService {
    private final ActivityRequestRepository requestRepository;
    private final ActivityRepository activityRepository;
    private final ActivityRevisionRepository revisionRepository;
    private final BoothAssignmentRepository assignmentRepository;
    private final PartnerOrganizationRepository organizationRepository;
    private final PartnerOrganizationGuard organizationGuard;
    private final ActivityLockService lockService;
    private final ActivityLifecycleCoordinator lifecycleCoordinator;
    private final ActivityValidationService validation;
    private final ActivityScheduleGuard scheduleGuard;
    private final ActivityConstraintTranslator constraintTranslator;
    private final ActivityParticipationLifecycleService participation;
    private final ActivityPartnerNotificationService notificationService;
    private final Clock clock;

    public OrganizerActivityRequestReviewTransactionService(
            ActivityRequestRepository requestRepository,
            ActivityRepository activityRepository,
            ActivityRevisionRepository revisionRepository,
            BoothAssignmentRepository assignmentRepository,
            PartnerOrganizationRepository organizationRepository,
            PartnerOrganizationGuard organizationGuard,
            ActivityLockService lockService,
            ActivityLifecycleCoordinator lifecycleCoordinator,
            ActivityValidationService validation,
            ActivityScheduleGuard scheduleGuard,
            ActivityConstraintTranslator constraintTranslator,
            ActivityPartnerNotificationService notificationService,
            ActivityParticipationLifecycleService participation, Clock clock) {
        this.requestRepository = requestRepository;
        this.activityRepository = activityRepository;
        this.revisionRepository = revisionRepository;
        this.assignmentRepository = assignmentRepository;
        this.organizationRepository = organizationRepository;
        this.organizationGuard = organizationGuard;
        this.lockService = lockService;
        this.lifecycleCoordinator = lifecycleCoordinator;
        this.validation = validation;
        this.scheduleGuard = scheduleGuard;
        this.constraintTranslator = constraintTranslator;
        this.notificationService = notificationService;
        this.participation = participation;
        this.clock = clock;
    }

    @Transactional
    public ActivityChangeRequestResponse approveChange(Long requestId,
            Long organizerUserId) {
        var route = changeRoute(requestId, organizerUserId);
        List<Long> additionalLocations = route.getRequestedLocationId() == null
                ? List.of() : List.of(route.getRequestedLocationId());
        var locks = lockService.lockOwnedActivity(route.getActivityId(), organizerUserId,
                additionalLocations);
        Long partnerOrganizationId = requireActiveOrganization(locks.activity().getActivityId());
        Instant now = now();
        lifecycleCoordinator.advanceLocked(locks.activity(), now);
        ActivityRequest request = lockRequest(route, ActivityRequestType.CHANGE);
        requireReviewable(request);

        Activity activity = locks.activity();
        requireChangeable(activity);
        Long locationId = request.getRequestedLocationId() == null
                ? activity.getLocationId() : request.getRequestedLocationId();
        Location location = locks.location(locationId);
        ValidatedActivityFields fields = validation.validateCore(locks.event(), location,
                request.getRequestedTitle() == null
                        ? activity.getTitle() : request.getRequestedTitle(),
                request.isRequestedDescriptionPresent()
                        ? request.getRequestedDescription() : activity.getDescription(),
                request.getRequestedActivityType() == null
                        ? activity.getActivityType() : request.getRequestedActivityType(),
                request.getRequestedStartAt() == null
                        ? activity.getStartAt() : request.getRequestedStartAt(),
                request.getRequestedEndAt() == null
                        ? activity.getEndAt() : request.getRequestedEndAt(),
                request.getRequestedCapacity() == null
                        ? activity.getCapacity() : request.getRequestedCapacity(),
                request.isRequestedImageUrlPresent()
                        ? request.getRequestedImageUrl() : activity.getImageUrl(),
                true);
        validation.validateRegistrationUpdate(activity.isRegistrationRequired(),
                activity.getRegistrationDeadlineAt(), activity.isCertificateEnabled(),
                fields.startAt(), activity.getStatus() == ActivityStatus.PUBLISHED);
        requireEligibleLocation(activity.getEventId(), location, partnerOrganizationId);
        scheduleGuard.requireAvailable(locationId, fields.startAt(), fields.endAt(),
                activity.getActivityId());

        Map<String, Object> oldSnapshot = snapshot(activity);
        Map<String, Object> newSnapshot = snapshot(locationId, fields, activity);
        if (oldSnapshot.equals(newSnapshot)) {
            throw new ActivityApiException(HttpStatus.UNPROCESSABLE_CONTENT,
                    "ACTIVITY_CHANGE_HAS_NO_EFFECT",
                    "The requested values no longer change the Activity.");
        }

        boolean scheduleChanged = participation.validateChange(activity, locationId,
                fields.startAt(), fields.endAt(), fields.capacity());
        activity.moveToLocation(locationId);
        activity.apply(fields, activity.isRegistrationRequired(),
                activity.getRegistrationDeadlineAt(), activity.isCertificateEnabled(), now);
        if (!request.approveIfPending(now)) throw notReviewable();
        ActivityRevision revision = revisionRepository.save(ActivityRevision.create(activity.getActivityId(),
                organizerUserId, requestId, ActivityRevisionSource.PARTNER_REQUEST,
                request.getReason(), oldSnapshot, newSnapshot, now));
        if (scheduleChanged) participation.scheduleChanged(activity, revision.getActivityRevisionId(), now);
        try {
            activityRepository.flush();
            requestRepository.flush();
            revisionRepository.flush();
        } catch (DataIntegrityViolationException error) {
            constraintTranslator.rethrow(error);
            throw error;
        }
        notificationService.activityChanged(activity.getActivityId(), requestId,
                ActivityPartnerMessageType.CHANGE_REQUEST_APPROVED,
                "Your requested Activity changes were applied.", now);
        return ActivityChangeRequestResponse.from(request);
    }

    @Transactional
    public ActivityChangeRequestResponse rejectChange(Long requestId, Long organizerUserId,
            ReviewActivityRequest command) {
        var route = changeRoute(requestId, organizerUserId);
        var locks = lockService.lockOwnedActivity(route.getActivityId(), organizerUserId,
                List.of());
        Instant now = now();
        lifecycleCoordinator.advanceLocked(locks.activity(), now);
        ActivityRequest request = lockRequest(route, ActivityRequestType.CHANGE);
        requireReviewable(request);
        String note = validation.reviewNote(command == null ? null : command.reviewNote());
        if (!request.rejectIfPending(note, now)) throw notReviewable();
        requestRepository.flush();
        notificationService.activityChanged(request.getActivityId(), requestId,
                ActivityPartnerMessageType.CHANGE_REQUEST_REJECTED, note, now);
        return ActivityChangeRequestResponse.from(request);
    }

    @Transactional
    public ActivityCancellationRequestResponse approveCancellation(Long requestId,
            Long organizerUserId) {
        var route = cancellationRoute(requestId, organizerUserId);
        var locks = lockService.lockOwnedActivity(route.getActivityId(), organizerUserId,
                List.of());
        requireActiveOrganization(locks.activity().getActivityId());
        Instant now = now();
        lifecycleCoordinator.advanceLocked(locks.activity(), now);
        ActivityRequest request = lockRequest(route, ActivityRequestType.CANCELLATION);
        requireReviewable(request);
        Activity activity = locks.activity();
        requireCancellable(activity);
        if (!activity.cancel(request.getReason(), ActivityCancellationSource.PARTNER_REQUEST,
                now) || !request.approveIfPending(now)) {
            throw notReviewable();
        }
        participation.cancel(activity, now);
        activityRepository.flush();
        requestRepository.flush();
        notificationService.activityChanged(activity.getActivityId(), requestId,
                ActivityPartnerMessageType.CANCELLATION_REQUEST_APPROVED,
                request.getReason(), now);
        return ActivityCancellationRequestResponse.from(request);
    }

    @Transactional
    public ActivityCancellationRequestResponse rejectCancellation(Long requestId,
            Long organizerUserId, ReviewActivityRequest command) {
        var route = cancellationRoute(requestId, organizerUserId);
        var locks = lockService.lockOwnedActivity(route.getActivityId(), organizerUserId,
                List.of());
        Instant now = now();
        lifecycleCoordinator.advanceLocked(locks.activity(), now);
        ActivityRequest request = lockRequest(route, ActivityRequestType.CANCELLATION);
        requireReviewable(request);
        String note = validation.reviewNote(command == null ? null : command.reviewNote());
        if (!request.rejectIfPending(note, now)) throw notReviewable();
        requestRepository.flush();
        notificationService.activityChanged(request.getActivityId(), requestId,
                ActivityPartnerMessageType.CANCELLATION_REQUEST_REJECTED, note, now);
        return ActivityCancellationRequestResponse.from(request);
    }

    private ActivityRequestRepository.OrganizerRequestRoute changeRoute(Long requestId,
            Long organizerUserId) {
        return requestRepository.findOrganizerRequestRoute(requestId, organizerUserId,
                        ActivityRequestType.CHANGE)
                .orElseThrow(OrganizerActivityRequestReviewTransactionService::changeNotFound);
    }

    private ActivityRequestRepository.OrganizerRequestRoute cancellationRoute(Long requestId,
            Long organizerUserId) {
        return requestRepository.findOrganizerRequestRoute(requestId, organizerUserId,
                        ActivityRequestType.CANCELLATION)
                .orElseThrow(
                        OrganizerActivityRequestReviewTransactionService::cancellationNotFound);
    }

    private ActivityRequest lockRequest(
            ActivityRequestRepository.OrganizerRequestRoute route,
            ActivityRequestType requestType) {
        ActivityRequest request = lockService.lockRequestAfterActivity(route.getRequestId());
        if (!Objects.equals(request.getActivityId(), route.getActivityId())
                || request.getRequestType() != requestType) {
            throw requestType == ActivityRequestType.CHANGE
                    ? changeNotFound() : cancellationNotFound();
        }
        return request;
    }

    private Long partnerOrganizationId(Long activityId) {
        return activityRepository.findPartnerOwnership(List.of(activityId)).stream()
                .filter(value -> value.getActivityId().equals(activityId))
                .map(ActivityRepository.PartnerOwnership::getPartnerOrganizationId)
                .findFirst()
                .orElseThrow(() -> new ActivityApiException(HttpStatus.CONFLICT,
                        "ACTIVITY_PARTNER_OWNERSHIP_REQUIRED",
                        "Activity is no longer linked to a Partner organization."));
    }

    private Long requireActiveOrganization(Long activityId) {
        Long organizationId = partnerOrganizationId(activityId);
        organizationGuard.requireActive(organizationRepository.findById(organizationId)
                .orElseThrow(() -> new ActivityApiException(HttpStatus.CONFLICT,
                        "ACTIVITY_PARTNER_OWNERSHIP_REQUIRED",
                        "Activity is no longer linked to a Partner organization.")));
        return organizationId;
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

    private static Map<String, Object> snapshot(Activity activity) {
        return snapshot(activity.getLocationId(), new ValidatedActivityFields(
                activity.getTitle(), activity.getDescription(), activity.getActivityType(),
                activity.getStartAt(), activity.getEndAt(), activity.getCapacity(),
                activity.getImageUrl() == null ? null : URI.create(activity.getImageUrl())),
                activity);
    }

    private static Map<String, Object> snapshot(Long locationId,
            ValidatedActivityFields fields, Activity activity) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("locationId", locationId);
        result.put("title", fields.title());
        result.put("description", fields.description());
        result.put("activityType", fields.activityType());
        result.put("startAt", fields.startAt().toString());
        result.put("endAt", fields.endAt().toString());
        result.put("capacity", fields.capacity());
        result.put("imageUrl", fields.imageUrl() == null ? null : fields.imageUrl().toString());
        result.put("registrationRequired", activity.isRegistrationRequired());
        result.put("registrationDeadlineAt", activity.getRegistrationDeadlineAt() == null
                ? null : activity.getRegistrationDeadlineAt().toString());
        result.put("certificateEnabled", activity.isCertificateEnabled());
        return result;
    }

    private static void requireReviewable(ActivityRequest request) {
        if (request.getStatus() != ActivityRequestStatus.PENDING) throw notReviewable();
    }

    private static void requireChangeable(Activity activity) {
        if (activity.getStatus() != ActivityStatus.DRAFT
                && activity.getStatus() != ActivityStatus.PUBLISHED) {
            throw notReviewable();
        }
    }

    private static void requireCancellable(Activity activity) {
        if (activity.getStatus() == ActivityStatus.COMPLETED
                || activity.getStatus() == ActivityStatus.CANCELLED) {
            throw notReviewable();
        }
    }

    private Instant now() {
        return clock.instant().truncatedTo(ChronoUnit.MICROS);
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

    private static ActivityApiException notReviewable() {
        return new ActivityApiException(HttpStatus.CONFLICT,
                "ACTIVITY_REQUEST_NOT_REVIEWABLE",
                "Activity Request is not reviewable in its current state.");
    }
}
