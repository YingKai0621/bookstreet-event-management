package com.swp391.bookstreet.registration.service;

import com.swp391.bookstreet.event.entity.Event;
import com.swp391.bookstreet.event.entity.EventStatus;
import com.swp391.bookstreet.event.service.EventRootLockService;
import com.swp391.bookstreet.registration.dto.EventRegistrationResponse;
import com.swp391.bookstreet.registration.dto.RegistrationPageResponse;
import com.swp391.bookstreet.registration.entity.EventRegistration;
import com.swp391.bookstreet.registration.entity.EventRegistrationStatus;
import com.swp391.bookstreet.registration.exception.RegistrationApiException;
import com.swp391.bookstreet.registration.repository.ActivityRegistrationRepository;
import com.swp391.bookstreet.registration.repository.EventRegistrationRepository;
import com.swp391.bookstreet.registration.security.RegistrationCurrentUser;
import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class ParticipantEventRegistrationService {
    private final EventRegistrationRepository eventRegistrationRepository;
    private final ActivityRegistrationRepository activityRegistrationRepository;
    private final RegistrationCurrentUser currentUser;
    private final EventRootLockService eventRootLockService;
    private final com.swp391.bookstreet.activity.service.ActivityLifecycleService lifecycleService;
    private final Clock clock;

    public ParticipantEventRegistrationService(
            EventRegistrationRepository eventRegistrationRepository,
            ActivityRegistrationRepository activityRegistrationRepository,
            RegistrationCurrentUser currentUser, EventRootLockService eventRootLockService,
            com.swp391.bookstreet.activity.service.ActivityLifecycleService lifecycleService, Clock clock) {
        this.eventRegistrationRepository = eventRegistrationRepository;
        this.activityRegistrationRepository = activityRegistrationRepository;
        this.currentUser = currentUser;
        this.eventRootLockService = eventRootLockService;
        this.clock = clock;
        this.lifecycleService = lifecycleService;
    }

    public RegistrationPageResponse<EventRegistrationResponse> list(int page, int size,
            String sort, String status, String eventStatus, String search) {
        Long userId = currentUser.requireParticipantId();
        lifecycleService.advanceDueActivities();
        var result = eventRegistrationRepository.findOwned(userId,
                parseRegistrationStatus(status), parseEventStatus(eventStatus),
                normalizeSearch(search), RegistrationPagination.events(page, size, sort));
        Map<Long, Long> counts = seatActiveCounts(result.getContent());
        List<EventRegistrationResponse> content = result.getContent().stream()
                .map(registration -> response(registration, registration.getEvent(), counts))
                .toList();
        return new RegistrationPageResponse<>(content, result.getNumber(), result.getSize(),
                result.getTotalElements(), result.getTotalPages());
    }

    public EventRegistrationResponse detail(Long eventRegistrationId) {
        requirePositiveId(eventRegistrationId);
        Long userId = currentUser.requireParticipantId();
        lifecycleService.advanceDueActivities();
        EventRegistration registration = eventRegistrationRepository
                .findOwnedById(eventRegistrationId, userId)
                .orElseThrow(ParticipantEventRegistrationService::registrationNotFound);
        return response(registration, registration.getEvent(),
                seatActiveCounts(List.of(registration)));
    }

    @Transactional
    public EventRegistrationResponse join(Long eventId) {
        requirePositiveId(eventId);
        Long userId = currentUser.requireParticipantId();
        lifecycleService.advanceDueActivities();
        Event event = eventRootLockService.lock(eventId)
                .orElseThrow(ParticipantEventRegistrationService::eventNotFound);
        EventRegistration registration = eventRegistrationRepository
                .findByUserIdAndEventIdForUpdate(userId, eventId).orElse(null);
        if (registration != null && registration.getStatus() == EventRegistrationStatus.ACTIVE) {
            return response(registration, event, seatActiveCounts(List.of(registration)));
        }

        Instant now = now();
        requireOpenForParticipation(event, now);
        if (registration == null) {
            registration = eventRegistrationRepository.saveAndFlush(
                    EventRegistration.join(userId, eventId, now));
        } else {
            registration.reactivate(now);
            eventRegistrationRepository.flush();
        }
        return response(registration, event, seatActiveCounts(List.of(registration)));
    }

    @Transactional
    public EventRegistrationResponse leave(Long eventId) {
        requirePositiveId(eventId);
        Long userId = currentUser.requireParticipantId();
        lifecycleService.advanceDueActivities();
        Event event = eventRootLockService.lock(eventId)
                .orElseThrow(ParticipantEventRegistrationService::eventNotFound);
        EventRegistration registration = eventRegistrationRepository
                .findByUserIdAndEventIdForUpdate(userId, eventId)
                .orElseThrow(ParticipantEventRegistrationService::registrationNotFound);
        if (registration.getStatus() == EventRegistrationStatus.LEFT) {
            return response(registration, event, seatActiveCounts(List.of(registration)));
        }

        activityRegistrationRepository.findByEventRegistrationIdForUpdate(
                registration.getEventRegistrationId());
        if (activityRegistrationRepository.existsSeatActiveByEventRegistrationId(
                registration.getEventRegistrationId())) {
            throw conflict("EVENT_LEAVE_BLOCKED_BY_ACTIVE_ACTIVITY",
                    "Leave Event is blocked while an Activity registration still consumes a seat.");
        }
        registration.leave(now());
        eventRegistrationRepository.flush();
        return response(registration, event, Map.of());
    }

    private Map<Long, Long> seatActiveCounts(List<EventRegistration> registrations) {
        if (registrations.isEmpty()) return Map.of();
        List<Long> ids = registrations.stream().map(EventRegistration::getEventRegistrationId)
                .toList();
        Map<Long, Long> counts = new HashMap<>();
        activityRegistrationRepository.countSeatActiveByEventRegistrationIds(ids)
                .forEach(value -> counts.put(value.getEventRegistrationId(),
                        value.getSeatActiveActivityCount()));
        return counts;
    }

    private static EventRegistrationResponse response(EventRegistration registration, Event event,
            Map<Long, Long> counts) {
        return EventRegistrationResponse.from(registration, event,
                counts.getOrDefault(registration.getEventRegistrationId(), 0L));
    }

    private static EventRegistrationStatus parseRegistrationStatus(String value) {
        if (value == null || value.isBlank()) return null;
        try {
            return EventRegistrationStatus.valueOf(value);
        } catch (IllegalArgumentException error) {
            throw invalidFilter("status is not ACTIVE or LEFT.");
        }
    }

    private static EventStatus parseEventStatus(String value) {
        if (value == null || value.isBlank()) return null;
        try {
            return EventStatus.valueOf(value);
        } catch (IllegalArgumentException error) {
            throw invalidFilter("eventStatus is not a supported Event status.");
        }
    }

    private static String normalizeSearch(String value) {
        if (value == null) return "";
        return value.trim().replaceAll("\\s+", " ");
    }

    private static void requireOpenForParticipation(Event event, Instant now) {
        if (event.getStatus() != EventStatus.PUBLISHED
                && event.getStatus() != EventStatus.ONGOING) {
            throw conflict("EVENT_NOT_OPEN_FOR_PARTICIPATION",
                    "Event is not open for Participant registration.");
        }
        Instant deadline = event.getParticipantRegistrationDeadlineAt();
        if (deadline == null || now.isAfter(deadline)) {
            throw conflict("EVENT_REGISTRATION_DEADLINE_PASSED",
                    "Event registration deadline has passed.");
        }
    }

    private Instant now() {
        return clock.instant().truncatedTo(ChronoUnit.MICROS);
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

    private static RegistrationApiException eventNotFound() {
        return new RegistrationApiException(HttpStatus.NOT_FOUND, "EVENT_NOT_FOUND",
                "Event not found.");
    }

    private static RegistrationApiException registrationNotFound() {
        return new RegistrationApiException(HttpStatus.NOT_FOUND,
                "EVENT_REGISTRATION_NOT_FOUND", "Event registration not found.");
    }

    private static RegistrationApiException conflict(String code, String message) {
        return new RegistrationApiException(HttpStatus.CONFLICT, code, message);
    }
}
