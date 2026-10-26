package com.swp391.bookstreet.registration.service;

import com.swp391.bookstreet.activity.entity.Activity;
import com.swp391.bookstreet.activity.entity.ActivityStatus;
import com.swp391.bookstreet.activity.repository.ActivityRepository;
import com.swp391.bookstreet.attendance.entity.Attendance;
import com.swp391.bookstreet.attendance.entity.AttendanceStatus;
import com.swp391.bookstreet.attendance.repository.AttendanceRepository;
import com.swp391.bookstreet.booth.entity.Location;
import com.swp391.bookstreet.booth.repository.LocationRepository;
import com.swp391.bookstreet.certificate.entity.Certificate;
import com.swp391.bookstreet.certificate.repository.CertificateRepository;
import com.swp391.bookstreet.event.entity.Event;
import com.swp391.bookstreet.event.entity.EventStatus;
import com.swp391.bookstreet.event.service.EventRootLockService;
import com.swp391.bookstreet.rating.entity.ActivityRating;
import com.swp391.bookstreet.rating.repository.ActivityRatingRepository;
import com.swp391.bookstreet.registration.dto.ActivityRegistrationActivityResponse;
import com.swp391.bookstreet.registration.dto.ActivityRegistrationResponse;
import com.swp391.bookstreet.registration.dto.AttendanceSummaryResponse;
import com.swp391.bookstreet.registration.dto.CertificateSummaryResponse;
import com.swp391.bookstreet.registration.dto.ParticipantActivityRatingResponse;
import com.swp391.bookstreet.registration.dto.RegistrationPageResponse;
import com.swp391.bookstreet.registration.dto.RegistrationWarningResponse;
import com.swp391.bookstreet.registration.entity.ActivityRegistration;
import com.swp391.bookstreet.registration.entity.ActivityRegistrationCancellationSource;
import com.swp391.bookstreet.registration.entity.ActivityRegistrationStatus;
import com.swp391.bookstreet.registration.entity.EventRegistration;
import com.swp391.bookstreet.registration.entity.EventRegistrationStatus;
import com.swp391.bookstreet.registration.entity.ParticipationOutcome;
import com.swp391.bookstreet.registration.exception.RegistrationApiException;
import com.swp391.bookstreet.registration.repository.ActivityRegistrationRepository;
import com.swp391.bookstreet.registration.repository.EventRegistrationRepository;
import com.swp391.bookstreet.registration.security.RegistrationCurrentUser;
import com.swp391.bookstreet.activity.service.ActivityLifecycleCoordinator;
import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class ParticipantActivityRegistrationService {
    private final ActivityRegistrationRepository activityRegistrationRepository;
    private final EventRegistrationRepository eventRegistrationRepository;
    private final ActivityRepository activityRepository;
    private final LocationRepository locationRepository;
    private final AttendanceRepository attendanceRepository;
    private final CertificateRepository certificateRepository;
    private final ActivityRatingRepository activityRatingRepository;
    private final RegistrationCurrentUser currentUser;
    private final EventRootLockService eventRootLockService;
    private final ActivityLifecycleCoordinator lifecycleCoordinator;
    private final com.swp391.bookstreet.activity.service.ActivityLifecycleService lifecycleService;
    private final Clock clock;

    public ParticipantActivityRegistrationService(
            ActivityRegistrationRepository activityRegistrationRepository,
            EventRegistrationRepository eventRegistrationRepository,
            ActivityRepository activityRepository, LocationRepository locationRepository,
            AttendanceRepository attendanceRepository,
            CertificateRepository certificateRepository,
            ActivityRatingRepository activityRatingRepository,
            RegistrationCurrentUser currentUser, EventRootLockService eventRootLockService,
            ActivityLifecycleCoordinator lifecycleCoordinator,
            com.swp391.bookstreet.activity.service.ActivityLifecycleService lifecycleService, Clock clock) {
        this.activityRegistrationRepository = activityRegistrationRepository;
        this.eventRegistrationRepository = eventRegistrationRepository;
        this.activityRepository = activityRepository;
        this.locationRepository = locationRepository;
        this.attendanceRepository = attendanceRepository;
        this.certificateRepository = certificateRepository;
        this.activityRatingRepository = activityRatingRepository;
        this.currentUser = currentUser;
        this.eventRootLockService = eventRootLockService;
        this.clock = clock;
        this.lifecycleCoordinator = lifecycleCoordinator;
        this.lifecycleService = lifecycleService;
    }

    public RegistrationPageResponse<ActivityRegistrationResponse> list(int page, int size,
            String sort, Long eventId, String registrationStatus, String outcome,
            String activityStatus, String search) {
        if (eventId != null) requirePositiveId(eventId);
        Long userId = currentUser.requireParticipantId();
        lifecycleService.advanceDueActivities();
        var result = activityRegistrationRepository.findOwned(userId, eventId,
                parseRegistrationStatus(registrationStatus), parseOutcome(outcome),
                parseActivityStatus(activityStatus), normalizeSearch(search),
                RegistrationPagination.activities(page, size, sort));
        ResponseContext context = responseContext(result.getContent(), userId);
        List<ActivityRegistrationResponse> content = result.getContent().stream()
                .map(registration -> response(registration, context)).toList();
        return new RegistrationPageResponse<>(content, result.getNumber(), result.getSize(),
                result.getTotalElements(), result.getTotalPages());
    }

    public ActivityRegistrationResponse detail(Long activityRegistrationId) {
        requirePositiveId(activityRegistrationId);
        Long userId = currentUser.requireParticipantId();
        lifecycleService.advanceDueActivities();
        ActivityRegistration registration = activityRegistrationRepository
                .findOwnedById(activityRegistrationId, userId)
                .orElseThrow(ParticipantActivityRegistrationService::registrationNotFound);
        return response(registration, responseContext(List.of(registration), userId));
    }

    @Transactional
    public ActivityRegistrationResponse register(Long activityId) {
        requirePositiveId(activityId);
        Long userId = currentUser.requireParticipantId();
        ActivityRepository.ActivityRoute route = activityRepository.findRouteById(activityId)
                .orElseThrow(ParticipantActivityRegistrationService::activityNotFound);
        Event event = eventRootLockService.lock(route.getEventId())
                .orElseThrow(ParticipantActivityRegistrationService::activityNotFound);
        Activity activity = activityRepository.findByIdForUpdate(activityId)
                .filter(value -> value.getEventId().equals(event.getEventId()))
                .orElseThrow(ParticipantActivityRegistrationService::activityNotFound);

        Instant now = now();
        lifecycleCoordinator.advanceLocked(activity, now);
        requirePublished(activity);
        requireEventOpen(event);

        EventRegistration eventRegistration = eventRegistrationRepository
                .findByUserIdAndEventIdForUpdate(userId, event.getEventId()).orElse(null);
        ActivityRegistration registration = eventRegistration == null ? null
                : activityRegistrationRepository.findByIdentityForUpdate(
                        eventRegistration.getEventRegistrationId(), activityId).orElse(null);
        if (registration != null && registration.getStatus() == ActivityRegistrationStatus.ACTIVE) {
            return responseAfterFlush(registration, userId);
        }

        requireRegistrationRequired(activity);
        requireRegistrationDeadlines(event, activity, now);
        requireReactivatable(registration);
        requireCapacity(activity);

        if (eventRegistration == null) {
            eventRegistration = eventRegistrationRepository.saveAndFlush(
                    EventRegistration.join(userId, event.getEventId(), now));
        } else if (eventRegistration.getStatus() == EventRegistrationStatus.LEFT) {
            eventRegistration.reactivate(now);
            eventRegistrationRepository.flush();
        }

        if (registration == null) {
            registration = activityRegistrationRepository.saveAndFlush(
                    ActivityRegistration.register(eventRegistration.getEventRegistrationId(),
                            activityId, now));
        } else {
            registration.reactivateParticipantCancellation(now);
            activityRegistrationRepository.flush();
        }
        return responseAfterFlush(registration, userId);
    }

    @Transactional
    public ActivityRegistrationResponse cancel(Long activityId) {
        requirePositiveId(activityId);
        Long userId = currentUser.requireParticipantId();
        ActivityRepository.ActivityRoute route = activityRepository.findRouteById(activityId)
                .orElseThrow(ParticipantActivityRegistrationService::activityNotFound);
        Event event = eventRootLockService.lock(route.getEventId())
                .orElseThrow(ParticipantActivityRegistrationService::activityNotFound);
        Activity activity = activityRepository.findByIdForUpdate(activityId)
                .filter(value -> value.getEventId().equals(event.getEventId()))
                .orElseThrow(ParticipantActivityRegistrationService::activityNotFound);
        EventRegistration eventRegistration = eventRegistrationRepository
                .findByUserIdAndEventIdForUpdate(userId, event.getEventId())
                .orElseThrow(ParticipantActivityRegistrationService::registrationNotFound);
        ActivityRegistration registration = activityRegistrationRepository
                .findByIdentityForUpdate(eventRegistration.getEventRegistrationId(), activityId)
                .orElseThrow(ParticipantActivityRegistrationService::registrationNotFound);

        if (registration.getStatus() == ActivityRegistrationStatus.CANCELLED) {
            if (registration.getCancellationSource()
                    == ActivityRegistrationCancellationSource.PARTICIPANT) {
                return responseAfterFlush(registration, userId);
            }
            throw conflict("ACTIVITY_REGISTRATION_SYSTEM_CANCELLED",
                    "A system-cancelled Activity registration cannot be cancelled by Participant.");
        }
        if (registration.getStatus() == ActivityRegistrationStatus.NO_SHOW) {
            throw conflict("ACTIVITY_REGISTRATION_NO_SHOW",
                    "A No-show Activity registration cannot be cancelled.");
        }
        Instant now = now();
        if (!now.isBefore(activity.getStartAt())) {
            throw conflict("ACTIVITY_REGISTRATION_CANCELLATION_CLOSED",
                    "Activity registration cancellation is closed at Activity start.");
        }
        if (attendanceRepository.existsByActivityRegistrationIdAndStatus(
                registration.getActivityRegistrationId(), AttendanceStatus.VALID)) {
            throw conflict("ACTIVITY_REGISTRATION_HAS_ATTENDANCE",
                    "An Activity registration with valid Attendance cannot be cancelled.");
        }
        registration.cancel(ActivityRegistrationCancellationSource.PARTICIPANT, now);
        activityRegistrationRepository.flush();
        return responseAfterFlush(registration, userId);
    }

    private ActivityRegistrationResponse responseAfterFlush(ActivityRegistration registration,
            Long userId) {
        return response(registration, responseContext(List.of(registration), userId));
    }

    private ResponseContext responseContext(List<ActivityRegistration> registrations,
            Long userId) {
        if (registrations.isEmpty()) return ResponseContext.empty();
        Map<Long, Activity> activities = byId(activityRepository.findAllById(
                registrations.stream().map(ActivityRegistration::getActivityId).toList()),
                Activity::getActivityId);
        Map<Long, Location> locations = byId(locationRepository.findAllById(
                activities.values().stream().map(Activity::getLocationId).distinct().toList()),
                Location::getLocationId);
        List<Long> registrationIds = registrations.stream()
                .map(ActivityRegistration::getActivityRegistrationId).toList();
        Map<Long, Attendance> attendances = byId(
                attendanceRepository.findByActivityRegistrationIdIn(registrationIds),
                Attendance::getActivityRegistrationId);
        List<Long> attendanceIds = attendances.values().stream()
                .map(Attendance::getAttendanceId).toList();
        Map<Long, Certificate> certificates = attendanceIds.isEmpty() ? Map.of()
                : byId(certificateRepository.findByAttendanceIdIn(attendanceIds),
                        Certificate::getAttendanceId);
        Map<Long, ActivityRating> ratings = attendanceIds.isEmpty() ? Map.of()
                : byId(activityRatingRepository.findByAttendanceIdIn(attendanceIds),
                        ActivityRating::getAttendanceId);
        return new ResponseContext(activities, locations, attendances, certificates, ratings,
                activityRegistrationRepository.findActiveSchedules(userId));
    }

    private ActivityRegistrationResponse response(ActivityRegistration registration,
            ResponseContext context) {
        Activity activity = context.activities().get(registration.getActivityId());
        if (activity == null) throw activityNotFound();
        Location location = context.locations().get(activity.getLocationId());
        if (location == null) throw activityNotFound();
        Attendance attendance = context.attendances().get(
                registration.getActivityRegistrationId());
        Certificate certificate = attendance == null ? null
                : context.certificates().get(attendance.getAttendanceId());
        ActivityRating rating = attendance == null ? null
                : context.ratings().get(attendance.getAttendanceId());
        return ActivityRegistrationResponse.from(registration,
                ActivityRegistrationActivityResponse.from(activity, location),
                outcome(registration, attendance), AttendanceSummaryResponse.from(attendance),
                CertificateSummaryResponse.from(certificate),
                ParticipantActivityRatingResponse.from(rating, activity.getActivityId()),
                warnings(registration, activity, context.schedules()));
    }

    private static ParticipationOutcome outcome(ActivityRegistration registration,
            Attendance attendance) {
        return ParticipationOutcome.of(registration, attendance);
    }

    private static List<RegistrationWarningResponse> warnings(
            ActivityRegistration registration, Activity activity,
            List<ActivityRegistrationRepository.ActiveSchedule> schedules) {
        if (registration.getStatus() != ActivityRegistrationStatus.ACTIVE
                || (activity.getStatus() != ActivityStatus.PUBLISHED
                    && activity.getStatus() != ActivityStatus.ONGOING)) return List.of();
        List<Long> conflicts = schedules.stream()
                .filter(schedule -> !schedule.getActivityId().equals(activity.getActivityId()))
                .filter(schedule -> schedule.getStartAt().isBefore(activity.getEndAt())
                        && activity.getStartAt().isBefore(schedule.getEndAt()))
                .map(ActivityRegistrationRepository.ActiveSchedule::getActivityId)
                .distinct().sorted().toList();
        return conflicts.isEmpty() ? List.of()
                : List.of(RegistrationWarningResponse.scheduleOverlap(conflicts));
    }

    private void requireCapacity(Activity activity) {
        long occupied = activityRegistrationRepository.countByActivityIdAndStatus(
                activity.getActivityId(), ActivityRegistrationStatus.ACTIVE);
        if (occupied >= activity.getCapacity()) {
            throw conflict("ACTIVITY_CAPACITY_FULL", "Activity capacity is full.");
        }
    }

    private static void requirePublished(Activity activity) {
        if (activity.getStatus() != ActivityStatus.PUBLISHED) {
            throw conflict("ACTIVITY_NOT_PUBLISHED", "Activity is not Published.");
        }
    }

    private static void requireEventOpen(Event event) {
        if (event.getStatus() != EventStatus.PUBLISHED
                && event.getStatus() != EventStatus.ONGOING) {
            throw conflict("EVENT_NOT_OPEN_FOR_PARTICIPATION",
                    "Event is not open for Participant registration.");
        }
    }

    private static void requireRegistrationRequired(Activity activity) {
        if (!activity.isRegistrationRequired()) {
            throw conflict("ACTIVITY_REGISTRATION_NOT_REQUIRED",
                    "Activity does not require registration.");
        }
    }

    private static void requireRegistrationDeadlines(Event event, Activity activity,
            Instant now) {
        if (event.getParticipantRegistrationDeadlineAt() == null
                || now.isAfter(event.getParticipantRegistrationDeadlineAt())) {
            throw conflict("EVENT_REGISTRATION_DEADLINE_PASSED",
                    "Event registration deadline has passed.");
        }
        if (activity.getRegistrationDeadlineAt() == null
                || now.isAfter(activity.getRegistrationDeadlineAt())) {
            throw conflict("ACTIVITY_REGISTRATION_DEADLINE_PASSED",
                    "Activity registration deadline has passed.");
        }
    }

    private static void requireReactivatable(ActivityRegistration registration) {
        if (registration == null) return;
        if (registration.getStatus() == ActivityRegistrationStatus.NO_SHOW) {
            throw conflict("ACTIVITY_REGISTRATION_NO_SHOW",
                    "A No-show Activity registration cannot be reactivated.");
        }
        if (registration.getCancellationSource()
                != ActivityRegistrationCancellationSource.PARTICIPANT) {
            throw conflict("ACTIVITY_REGISTRATION_SYSTEM_CANCELLED",
                    "A system-cancelled Activity registration cannot be reactivated.");
        }
    }

    private static ActivityRegistrationStatus parseRegistrationStatus(String value) {
        if (value == null || value.isBlank()) return null;
        try {
            return ActivityRegistrationStatus.valueOf(value);
        } catch (IllegalArgumentException error) {
            throw invalidFilter("registrationStatus is not ACTIVE, CANCELLED or NO_SHOW.");
        }
    }

    private static String parseOutcome(String value) {
        if (value == null || value.isBlank()) return "";
        try {
            return ParticipationOutcome.valueOf(value).name();
        } catch (IllegalArgumentException error) {
            throw invalidFilter("outcome is not ACTIVE, CANCELLED, ATTENDED or NO_SHOW.");
        }
    }

    private static ActivityStatus parseActivityStatus(String value) {
        if (value == null || value.isBlank()) return null;
        try {
            return ActivityStatus.valueOf(value);
        } catch (IllegalArgumentException error) {
            throw invalidFilter("activityStatus is not a supported Activity status.");
        }
    }

    private static String normalizeSearch(String value) {
        if (value == null) return "";
        return value.trim().replaceAll("\\s+", " ");
    }

    private Instant now() {
        return clock.instant().truncatedTo(ChronoUnit.MICROS);
    }

    private static <K, V> Map<K, V> byId(Collection<V> values,
            Function<V, K> keyExtractor) {
        return values.stream().collect(Collectors.toMap(keyExtractor, Function.identity()));
    }

    private static void requirePositiveId(Long id) {
        if (id == null || id <= 0) {
            throw new RegistrationApiException(HttpStatus.BAD_REQUEST, "INVALID_IDENTIFIER",
                    "Identifier must be a positive integer.");
        }
    }

    private static RegistrationApiException invalidFilter(String message) {
        return new RegistrationApiException(HttpStatus.BAD_REQUEST, "INVALID_FILTER", message);
    }

    private static RegistrationApiException activityNotFound() {
        return new RegistrationApiException(HttpStatus.NOT_FOUND, "ACTIVITY_NOT_FOUND",
                "Activity not found.");
    }

    private static RegistrationApiException registrationNotFound() {
        return new RegistrationApiException(HttpStatus.NOT_FOUND,
                "ACTIVITY_REGISTRATION_NOT_FOUND", "Activity registration not found.");
    }

    private static RegistrationApiException conflict(String code, String message) {
        return new RegistrationApiException(HttpStatus.CONFLICT, code, message);
    }

    private record ResponseContext(
            Map<Long, Activity> activities,
            Map<Long, Location> locations,
            Map<Long, Attendance> attendances,
            Map<Long, Certificate> certificates,
            Map<Long, ActivityRating> ratings,
            List<ActivityRegistrationRepository.ActiveSchedule> schedules) {
        static ResponseContext empty() {
            return new ResponseContext(Map.of(), Map.of(), Map.of(), Map.of(), Map.of(),
                    List.of());
        }
    }
}
