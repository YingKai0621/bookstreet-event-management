package com.swp391.bookstreet.activity.service;

import com.swp391.bookstreet.activity.dto.ActivityPageResponse;
import com.swp391.bookstreet.activity.dto.ActivityResponse;
import com.swp391.bookstreet.activity.dto.ActivityRevisionResponse;
import com.swp391.bookstreet.activity.dto.CancelActivityRequest;
import com.swp391.bookstreet.activity.dto.CreateActivityRequest;
import com.swp391.bookstreet.activity.dto.UpdateActivityRequest;
import com.swp391.bookstreet.attendance.service.ActivityParticipationLifecycleService;
import com.swp391.bookstreet.activity.entity.Activity;
import com.swp391.bookstreet.activity.entity.ActivityCancellationSource;
import com.swp391.bookstreet.activity.entity.ActivityRevision;
import com.swp391.bookstreet.activity.entity.ActivityRevisionSource;
import com.swp391.bookstreet.activity.entity.ActivityStatus;
import com.swp391.bookstreet.activity.exception.ActivityApiException;
import com.swp391.bookstreet.activity.repository.ActivityRepository;
import com.swp391.bookstreet.activity.repository.ActivityRevisionRepository;
import com.swp391.bookstreet.activity.security.ActivityCurrentUser;
import com.swp391.bookstreet.booth.entity.Location;
import com.swp391.bookstreet.booth.entity.LocationType;
import com.swp391.bookstreet.booth.repository.LocationRepository;
import com.swp391.bookstreet.event.entity.Event;
import com.swp391.bookstreet.event.entity.EventStatus;
import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class OrganizerActivityService {
    private final ActivityRepository activityRepository;
    private final ActivityRevisionRepository revisionRepository;
    private final LocationRepository locationRepository;
    private final ActivityCurrentUser currentUser;
    private final ActivityLockService lockService;
    private final ActivityValidationService validation;
    private final ActivityScheduleGuard scheduleGuard;
    private final ActivityConstraintTranslator constraintTranslator;
    private final ActivityLifecycleService lifecycleService;
    private final ActivityLifecycleTransactionService lifecycleTransactions;
    private final ActivityLifecycleCoordinator lifecycleCoordinator;
    private final ActivityParticipationLifecycleService participation;
    private final ActivityPartnerNotificationService notificationService;
    private final Clock clock;

    public OrganizerActivityService(ActivityRepository activityRepository,
            ActivityRevisionRepository revisionRepository,
            LocationRepository locationRepository, ActivityCurrentUser currentUser,
            ActivityLockService lockService, ActivityValidationService validation,
            ActivityScheduleGuard scheduleGuard,
            ActivityConstraintTranslator constraintTranslator,
            ActivityLifecycleService lifecycleService,
            ActivityLifecycleTransactionService lifecycleTransactions,
            ActivityLifecycleCoordinator lifecycleCoordinator,
            ActivityPartnerNotificationService notificationService, ActivityParticipationLifecycleService participation, Clock clock) {
        this.activityRepository = activityRepository;
        this.revisionRepository = revisionRepository;
        this.locationRepository = locationRepository;
        this.currentUser = currentUser;
        this.lockService = lockService;
        this.validation = validation;
        this.scheduleGuard = scheduleGuard;
        this.constraintTranslator = constraintTranslator;
        this.lifecycleService = lifecycleService;
        this.lifecycleTransactions = lifecycleTransactions;
        this.lifecycleCoordinator = lifecycleCoordinator;
        this.notificationService = notificationService;
        this.participation = participation;
        this.clock = clock;
    }

    @Transactional
    public ActivityResponse create(CreateActivityRequest request) {
        Long organizerId = currentUser.requireOrganizerId();
        Long eventId = requiredId(request.eventId(), "eventId");
        Long locationId = requiredId(request.locationId(), "locationId");
        var locks = lockService.lockOwnedRoot(eventId, organizerId, List.of(locationId));
        Event event = locks.event();
        Location location = locks.locations().getFirst();
        Instant now = databaseInstant();
        requireEventAccepting(event);
        requireSharedLocation(location);
        ValidatedActivityFields fields = validation.validateCore(event, location,
                request.title(), request.description(), request.activityType(), request.startAt(),
                request.endAt(), request.capacity(), request.imageUrl(), true);
        validation.validateRegistration(request.registrationRequired(),
                request.registrationDeadlineAt(), request.certificateEnabled(),
                fields.startAt(), false);
        scheduleGuard.requireAvailable(locationId, fields.startAt(), fields.endAt(), null);
        Activity activity = Activity.createDirect(eventId, locationId, fields,
                request.registrationRequired(), request.registrationDeadlineAt(),
                request.certificateEnabled(), now);
        activity.setAttendanceEarlyScanMinutes(earlyScanMinutes(request.attendanceEarlyScanMinutes()));
        try {
            activityRepository.saveAndFlush(activity);
        } catch (DataIntegrityViolationException error) {
            constraintTranslator.rethrow(error);
            throw error;
        }
        return ActivityResponse.partner(activity, location, null);
    }

    public ActivityPageResponse<ActivityResponse> list(int page, int size, String sort,
            Long eventId, ActivityStatus status, String search) {
        Long organizerId = currentUser.requireOrganizerId();
        lifecycleService.advanceDueActivities();
        String normalizedSearch = normalizeSearch(search);
        var result = activityRepository.findForOrganizer(organizerId, eventId, status,
                normalizedSearch, ActivityPagination.of(page, size, sort));
        List<ActivityResponse> content = responses(result.getContent());
        return new ActivityPageResponse<>(content, result.getNumber(), result.getSize(),
                result.getTotalElements(), result.getTotalPages());
    }

    public ActivityResponse detail(Long activityId) {
        Long organizerId = currentUser.requireOrganizerId();
        activityRepository.findOwnedById(activityId, organizerId)
                .orElseThrow(OrganizerActivityService::notFound);
        lifecycleTransactions.advance(activityId);
        Activity activity = activityRepository.findOwnedById(activityId, organizerId)
                .orElseThrow(OrganizerActivityService::notFound);
        Location location = locationRepository.findById(activity.getLocationId())
                .orElseThrow(OrganizerActivityService::locationNotFound);
        return ActivityResponse.organizer(activity, location, partnerOrganizationId(activityId));
    }

    @Transactional
    public ActivityResponse update(Long activityId, UpdateActivityRequest request) {
        Long organizerId = currentUser.requireOrganizerId();
        if (request.isEmpty()) throw validation("At least one Activity field is required.", null);
        validateTimePair(request);
        Collection<Long> requestedLocations = request.contains("locationId")
                && request.getLocationId() != null ? List.of(request.getLocationId()) : List.of();
        var locks = lockService.lockOwnedActivity(activityId, organizerId, requestedLocations);
        Activity activity = locks.activity();
        Event event = locks.event();
        lifecycleCoordinator.advanceLocked(activity, databaseInstant());
        requirePatchable(activity);
        requireEventAccepting(event);

        Long locationId = request.contains("locationId")
                ? requiredId(request.getLocationId(), "locationId") : activity.getLocationId();
        Location location = locks.location(locationId);
        String title = request.contains("title") ? request.getTitle() : activity.getTitle();
        String description = request.contains("description")
                ? request.getDescription() : activity.getDescription();
        String activityType = request.contains("activityType")
                ? request.getActivityType() : activity.getActivityType();
        Instant startAt = request.contains("startAt")
                ? request.getStartAt() : activity.getStartAt();
        Instant endAt = request.contains("endAt") ? request.getEndAt() : activity.getEndAt();
        Integer capacity = request.contains("capacity")
                ? request.getCapacity() : activity.getCapacity();
        String imageUrl = request.contains("imageUrl")
                ? request.getImageUrl() : activity.getImageUrl();
        boolean registrationRequired = request.contains("registrationRequired")
                ? requiredBoolean(request.getRegistrationRequired(), "registrationRequired")
                : activity.isRegistrationRequired();
        Instant registrationDeadlineAt = request.contains("registrationDeadlineAt")
                ? request.getRegistrationDeadlineAt() : activity.getRegistrationDeadlineAt();
        boolean certificateEnabled = request.contains("certificateEnabled")
                ? requiredBoolean(request.getCertificateEnabled(), "certificateEnabled")
                : activity.isCertificateEnabled();
        int earlyScanMinutes = request.contains("attendanceEarlyScanMinutes")
                ? earlyScanMinutes(request.getAttendanceEarlyScanMinutes())
                : activity.getAttendanceEarlyScanMinutes();

        if (activity.getStatus() == ActivityStatus.PUBLISHED
                && registrationRequired != activity.isRegistrationRequired()) {
            throw new ActivityApiException(HttpStatus.CONFLICT, "ACTIVITY_NOT_CHANGEABLE",
                    "Registration requirement is fixed after first publication.");
        }

        if (activity.getSourceProposalId() == null) requireSharedLocation(location);
        boolean coreSupplied = coreFieldSupplied(request);
        ValidatedActivityFields fields = validation.validateCore(event, location, title,
                description, activityType, startAt, endAt, capacity, imageUrl,
                activity.getStatus() == ActivityStatus.PUBLISHED && coreSupplied);
        validation.validateRegistrationUpdate(registrationRequired, registrationDeadlineAt,
                certificateEnabled, fields.startAt(), activity.getStatus() == ActivityStatus.PUBLISHED);

        Map<String, Object> oldSnapshot = snapshot(activity);
        Map<String, Object> candidateSnapshot = snapshot(locationId, fields,
                registrationRequired, registrationDeadlineAt, certificateEnabled, earlyScanMinutes);
        if (oldSnapshot.equals(candidateSnapshot)) return response(activity);
        boolean coreChanged = coreChanged(oldSnapshot, candidateSnapshot);
        if (activity.getSourceProposalId() != null && coreChanged) {
            throw new ActivityApiException(HttpStatus.CONFLICT, "ACTIVITY_NOT_CHANGEABLE",
                    "Approved Partner Activity core fields require a Partner change request.");
        }
        String changeReason = normalizeChangeReason(request, activity,
                coreChanged || earlyScanMinutes != activity.getAttendanceEarlyScanMinutes());
        scheduleGuard.requireAvailable(locationId, fields.startAt(), fields.endAt(), activityId);

        boolean scheduleChanged = participation.validateChange(activity, locationId,
                fields.startAt(), fields.endAt(), fields.capacity());
        participation.validateAttendanceWindowChange(activity, earlyScanMinutes);
        Instant now = databaseInstant();
        activity.moveToLocation(locationId);
        activity.apply(fields, registrationRequired, registrationDeadlineAt,
                certificateEnabled, now);
        activity.setAttendanceEarlyScanMinutes(earlyScanMinutes);
        ActivityRevision revision = revisionRepository.save(ActivityRevision.create(activityId, organizerId, null,
                ActivityRevisionSource.ORGANIZER_DIRECT, changeReason, oldSnapshot,
                candidateSnapshot, now));
        if (scheduleChanged) participation.scheduleChanged(activity, revision.getActivityRevisionId(), now);
        try {
            activityRepository.flush();
            revisionRepository.flush();
        } catch (DataIntegrityViolationException error) {
            constraintTranslator.rethrow(error);
            throw error;
        }
        return ActivityResponse.partner(activity, location,
                partnerOrganizationId(activityId));
    }

    @Transactional
    public ActivityResponse publish(Long activityId) {
        Long organizerId = currentUser.requireOrganizerId();
        var locks = lockService.lockOwnedActivity(activityId, organizerId, List.of());
        Activity activity = locks.activity();
        lifecycleCoordinator.advanceLocked(activity, databaseInstant());
        if (activity.getStatus() == ActivityStatus.PUBLISHED
                || activity.getStatus() == ActivityStatus.ONGOING
                || activity.getStatus() == ActivityStatus.COMPLETED) {
            return response(activity, locks.location(activity.getLocationId()));
        }
        if (activity.getStatus() == ActivityStatus.CANCELLED) {
            throw new ActivityApiException(HttpStatus.CONFLICT, "ACTIVITY_NOT_PUBLISHABLE",
                    "Cancelled Activity cannot be published.");
        }
        Event event = locks.event();
        if (event.getStatus() != EventStatus.PUBLISHED
                && event.getStatus() != EventStatus.ONGOING) {
            throw new ActivityApiException(HttpStatus.CONFLICT, "ACTIVITY_NOT_PUBLISHABLE",
                    "Activity can be published only under a Published or Ongoing Event.");
        }
        Instant now = databaseInstant();
        if (!activity.getStartAt().isAfter(now)) {
            throw new ActivityApiException(HttpStatus.CONFLICT, "ACTIVITY_ALREADY_STARTED",
                    "Activity has already started.");
        }
        Location location = locks.location(activity.getLocationId());
        ValidatedActivityFields fields = validation.validateCore(event, location,
                activity.getTitle(), activity.getDescription(), activity.getActivityType(),
                activity.getStartAt(), activity.getEndAt(), activity.getCapacity(),
                activity.getImageUrl(), true);
        validation.validateRegistration(activity.isRegistrationRequired(),
                activity.getRegistrationDeadlineAt(), activity.isCertificateEnabled(),
                fields.startAt(), true);
        scheduleGuard.requireAvailable(location.getLocationId(), fields.startAt(), fields.endAt(),
                activityId);
        activity.publish(now, activity.isRegistrationRequired() ? UUID.randomUUID() : null);
        try {
            activityRepository.flush();
        } catch (DataIntegrityViolationException error) {
            constraintTranslator.rethrow(error);
            throw error;
        }
        return response(activity, location);
    }

    @Transactional
    public ActivityResponse cancel(Long activityId, CancelActivityRequest request) {
        Long organizerId = currentUser.requireOrganizerId();
        var locks = lockService.lockOwnedActivity(activityId, organizerId, List.of());
        Activity activity = locks.activity();
        Instant now = databaseInstant();
        lifecycleCoordinator.advanceLocked(activity, now);
        if (activity.getStatus() == ActivityStatus.CANCELLED) {
            return response(activity, locks.location(activity.getLocationId()));
        }
        if (activity.getStatus() == ActivityStatus.COMPLETED) {
            throw new ActivityApiException(HttpStatus.CONFLICT, "ACTIVITY_NOT_CANCELLABLE",
                    "Completed Activity cannot be cancelled.");
        }
        String reason = validation.reason(request == null ? null : request.reason());
        activity.cancel(reason, ActivityCancellationSource.ORGANIZER, now);
        lockService.lockPendingRequestsAfterActivity(activityId)
                .forEach(pending -> pending.cancelIfPending(now));
        participation.cancel(activity, now);
        activityRepository.flush();
        notificationService.activityChanged(activityId, activityId,
                ActivityPartnerMessageType.ACTIVITY_CANCELLED_BY_ORGANIZER,
                reason, now);
        return response(activity, locks.location(activity.getLocationId()));
    }

    public ActivityPageResponse<ActivityRevisionResponse> revisions(Long activityId,
            int page, int size, String sort) {
        Long organizerId = currentUser.requireOrganizerId();
        activityRepository.findOwnedById(activityId, organizerId)
                .orElseThrow(OrganizerActivityService::notFound);
        var result = revisionRepository.findByActivityId(activityId,
                ActivityPagination.revisions(page, size, sort));
        return new ActivityPageResponse<>(result.getContent().stream()
                .map(ActivityRevisionResponse::from).toList(), result.getNumber(),
                result.getSize(), result.getTotalElements(), result.getTotalPages());
    }

    private List<ActivityResponse> responses(List<Activity> activities) {
        if (activities.isEmpty()) return List.of();
        Map<Long, Location> locations = new HashMap<>();
        locationRepository.findAllById(activities.stream().map(Activity::getLocationId)
                .distinct().toList()).forEach(value -> locations.put(value.getLocationId(), value));
        Map<Long, Long> partners = partnerOwnership(activities.stream()
                .map(Activity::getActivityId).toList());
        List<ActivityResponse> result = new ArrayList<>();
        for (Activity activity : activities) {
            Location location = locations.get(activity.getLocationId());
            if (location == null) throw locationNotFound();
            result.add(ActivityResponse.partner(activity, location,
                    partners.get(activity.getActivityId())));
        }
        return List.copyOf(result);
    }

    private Instant databaseInstant() {
        return clock.instant().truncatedTo(ChronoUnit.MICROS);
    }

    private ActivityResponse response(Activity activity) {
        Location location = locationRepository.findById(activity.getLocationId())
                .orElseThrow(OrganizerActivityService::locationNotFound);
        return response(activity, location);
    }

    private ActivityResponse response(Activity activity, Location location) {
        return ActivityResponse.partner(activity, location,
                partnerOrganizationId(activity.getActivityId()));
    }

    private Long partnerOrganizationId(Long activityId) {
        return partnerOwnership(List.of(activityId)).get(activityId);
    }

    private Map<Long, Long> partnerOwnership(List<Long> activityIds) {
        Map<Long, Long> result = new HashMap<>();
        if (!activityIds.isEmpty()) {
            activityRepository.findPartnerOwnership(activityIds).forEach(value ->
                    result.put(value.getActivityId(), value.getPartnerOrganizationId()));
        }
        return result;
    }

    private String normalizeChangeReason(UpdateActivityRequest request, Activity activity,
            boolean coreChanged) {
        if (activity.getStatus() == ActivityStatus.PUBLISHED && coreChanged) {
            return validation.reason(request.getChangeReason());
        }
        if (!request.contains("changeReason") || request.getChangeReason() == null) return null;
        return validation.reason(request.getChangeReason());
    }

    private static Map<String, Object> snapshot(Activity activity) {
        return snapshot(activity.getLocationId(), new ValidatedActivityFields(
                activity.getTitle(), activity.getDescription(), activity.getActivityType(),
                activity.getStartAt(), activity.getEndAt(), activity.getCapacity(),
                activity.getImageUrl() == null ? null : java.net.URI.create(activity.getImageUrl())),
                activity.isRegistrationRequired(), activity.getRegistrationDeadlineAt(),
                activity.isCertificateEnabled(), activity.getAttendanceEarlyScanMinutes());
    }

    private static Map<String, Object> snapshot(Long locationId, ValidatedActivityFields fields,
            boolean registrationRequired, Instant registrationDeadlineAt,
            boolean certificateEnabled, int earlyScanMinutes) {
        Map<String, Object> snapshot = new LinkedHashMap<>();
        snapshot.put("locationId", locationId);
        snapshot.put("title", fields.title());
        snapshot.put("description", fields.description());
        snapshot.put("activityType", fields.activityType());
        snapshot.put("startAt", fields.startAt().toString());
        snapshot.put("endAt", fields.endAt().toString());
        snapshot.put("capacity", fields.capacity());
        snapshot.put("imageUrl", fields.imageUrl() == null ? null : fields.imageUrl().toString());
        snapshot.put("registrationRequired", registrationRequired);
        snapshot.put("registrationDeadlineAt", registrationDeadlineAt == null
                ? null : registrationDeadlineAt.toString());
        snapshot.put("certificateEnabled", certificateEnabled);
        snapshot.put("attendanceEarlyScanMinutes", earlyScanMinutes);
        return snapshot;
    }

    private static int earlyScanMinutes(Integer value) {
        if (value == null) return 15;
        if (value < 0 || value > 1440) {
            throw new ActivityApiException(HttpStatus.UNPROCESSABLE_CONTENT,
                    "ACTIVITY_ATTENDANCE_WINDOW_INVALID",
                    "Attendance early scan minutes must be between 0 and 1440.",
                    "attendanceEarlyScanMinutes");
        }
        return value;
    }

    private static boolean coreChanged(Map<String, Object> oldSnapshot,
            Map<String, Object> newSnapshot) {
        return List.of("locationId", "title", "description", "activityType", "startAt", "endAt",
                        "capacity")
                .stream().anyMatch(key -> !Objects.equals(oldSnapshot.get(key),
                        newSnapshot.get(key)));
    }

    private static boolean coreFieldSupplied(UpdateActivityRequest request) {
        return request.contains("locationId") || request.contains("title")
                || request.contains("description") || request.contains("activityType")
                || request.contains("startAt") || request.contains("endAt")
                || request.contains("capacity");
    }

    private static void validateTimePair(UpdateActivityRequest request) {
        if (request.contains("startAt") != request.contains("endAt")) {
            throw validation("startAt and endAt must be supplied together.", "startAt");
        }
    }

    private static void requirePatchable(Activity activity) {
        if (activity.getStatus() != ActivityStatus.DRAFT
                && activity.getStatus() != ActivityStatus.PUBLISHED) {
            throw new ActivityApiException(HttpStatus.CONFLICT, "ACTIVITY_NOT_CHANGEABLE",
                    "Activity is not changeable in its current state.");
        }
    }

    private static void requireEventAccepting(Event event) {
        if (event.getStatus() == EventStatus.COMPLETED
                || event.getStatus() == EventStatus.CANCELLED) {
            throw new ActivityApiException(HttpStatus.CONFLICT,
                    "EVENT_NOT_ACCEPTING_ACTIVITIES",
                    "Event is not accepting Activity changes.");
        }
    }

    private static void requireSharedLocation(Location location) {
        if (location.getLocationType() == LocationType.BOOTH) {
            throw new ActivityApiException(HttpStatus.CONFLICT, "BOOTH_ASSIGNMENT_REQUIRED",
                    "Direct Organizer Activity cannot use a Booth Location.");
        }
    }

    private static Long requiredId(Long value, String field) {
        if (value == null || value <= 0) throw validation(field + " must be positive.", field);
        return value;
    }

    private static boolean requiredBoolean(Boolean value, String field) {
        if (value == null) throw validation(field + " must not be null.", field);
        return value;
    }

    private static String normalizeSearch(String search) {
        // Bind an empty VARCHAR instead of null. PostgreSQL can otherwise infer a null
        // parameter used by lower(concat(...)) as bytea and reject lower(bytea).
        return search == null ? "" : search.trim();
    }

    private static ActivityApiException validation(String message, String field) {
        return new ActivityApiException(HttpStatus.UNPROCESSABLE_CONTENT, "VALIDATION_FAILED",
                message, field);
    }

    private static ActivityApiException notFound() {
        return new ActivityApiException(HttpStatus.NOT_FOUND, "ACTIVITY_NOT_FOUND",
                "Activity not found.");
    }

    private static ActivityApiException locationNotFound() {
        return new ActivityApiException(HttpStatus.NOT_FOUND, "LOCATION_NOT_FOUND",
                "Location not found.");
    }
}
