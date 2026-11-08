package com.swp391.bookstreet.booth.service;

import com.swp391.bookstreet.auth.entity.User;
import com.swp391.bookstreet.auth.repository.UserRepository;
import com.swp391.bookstreet.booth.dto.BoothPageResponse;
import com.swp391.bookstreet.booth.dto.BoothRequestResponse;
import com.swp391.bookstreet.booth.dto.RejectBoothRequest;
import com.swp391.bookstreet.booth.entity.BoothAssignment;
import com.swp391.bookstreet.booth.entity.BoothHold;
import com.swp391.bookstreet.booth.entity.BoothRequest;
import com.swp391.bookstreet.booth.entity.BoothRequestStatus;
import com.swp391.bookstreet.booth.entity.EventBoothConfig;
import com.swp391.bookstreet.booth.exception.BoothApiException;
import com.swp391.bookstreet.booth.repository.BoothHoldRepository;
import com.swp391.bookstreet.booth.repository.BoothAssignmentRepository;
import com.swp391.bookstreet.booth.repository.BoothRepository;
import com.swp391.bookstreet.booth.repository.BoothRequestRepository;
import com.swp391.bookstreet.booth.repository.EventBoothConfigRepository;
import com.swp391.bookstreet.booth.security.BoothCurrentUser;
import com.swp391.bookstreet.event.entity.Event;
import com.swp391.bookstreet.event.entity.EventStatus;
import com.swp391.bookstreet.event.repository.EventRepository;
import com.swp391.bookstreet.event.service.EventRootLockService;
import com.swp391.bookstreet.partner.service.PartnerOutcomeNotificationService;
import com.swp391.bookstreet.partner.service.PartnerOrganizationGuard;
import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import org.hibernate.exception.ConstraintViolationException;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class OrganizerBoothRequestService {
    private final EventRepository eventRepository;
    private final EventRootLockService eventRootLockService;
    private final BoothRepository boothRepository;
    private final EventBoothConfigRepository configRepository;
    private final BoothRequestRepository requestRepository;
    private final BoothHoldRepository holdRepository;
    private final BoothAssignmentRepository assignmentRepository;
    private final UserRepository userRepository;
    private final BoothCurrentUser currentUser;
    private final BoothHoldExpiryService expiryService;
    private final BoothSelectionEligibilityService selectionEligibility;
    private final PartnerOrganizationGuard organizationGuard;
    private final ApplicationEventPublisher eventPublisher;
    private final Clock clock;
    private final PartnerOutcomeNotificationService outcomeNotifications;

    public OrganizerBoothRequestService(EventRepository eventRepository,
            EventRootLockService eventRootLockService,
            BoothRepository boothRepository,
            EventBoothConfigRepository configRepository,
            BoothRequestRepository requestRepository,
            BoothHoldRepository holdRepository,
            BoothAssignmentRepository assignmentRepository,
            UserRepository userRepository,
            BoothCurrentUser currentUser,
            BoothHoldExpiryService expiryService,
            BoothSelectionEligibilityService selectionEligibility,
            PartnerOrganizationGuard organizationGuard,
            ApplicationEventPublisher eventPublisher,
            PartnerOutcomeNotificationService outcomeNotifications,
            Clock clock) {
        this.eventRepository = eventRepository;
        this.eventRootLockService = eventRootLockService;
        this.boothRepository = boothRepository;
        this.configRepository = configRepository;
        this.requestRepository = requestRepository;
        this.holdRepository = holdRepository;
        this.assignmentRepository = assignmentRepository;
        this.userRepository = userRepository;
        this.currentUser = currentUser;
        this.expiryService = expiryService;
        this.selectionEligibility = selectionEligibility;
        this.organizationGuard = organizationGuard;
        this.eventPublisher = eventPublisher;
        this.clock = clock;
        this.outcomeNotifications = outcomeNotifications;
    }

    public BoothPageResponse<BoothRequestResponse> list(Long eventId, int page, int size,
            String sort, Long boothId, BoothRequestStatus status) {
        ownedEvent(eventId);
        expiryService.expireDueHolds();
        return BoothPageResponse.from(requestRepository.findForOrganizer(
                eventId, boothId, status,
                BoothRequestPagination.organizerPage(page, size, sort))
                .map(BoothRequestResponse::from));
    }

    public BoothRequestResponse detail(Long eventId, Long requestId) {
        ownedEvent(eventId);
        expiryService.expireDueHolds();
        return requestRepository.findForOrganizerById(requestId, eventId)
                .map(BoothRequestResponse::from)
                .orElseThrow(OrganizerBoothRequestService::requestNotFound);
    }

    @Transactional
    public BoothRequestResponse reject(Long eventId, Long requestId,
            RejectBoothRequest command) {
        expiryService.expireDueHolds();
        lockReviewableEvent(eventId);
        BoothRequest request = requestRepository
                .findForOrganizerByIdForUpdate(requestId, eventId)
                .orElseThrow(OrganizerBoothRequestService::requestNotFound);
        requirePending(request);
        request.reject(command.reviewNote().trim(), clock.instant());
        outcomeNotifications.boothChanged(request);
        return BoothRequestResponse.from(requestRepository.saveAndFlush(request));
    }

    @Transactional
    public BoothRequestResponse select(Long eventId, Long requestId) {
        expiryService.expireDueHolds();
        Event event = lockReviewableEvent(eventId);

        BoothRequest candidate = requestRepository.findForOrganizerById(requestId, eventId)
                .orElseThrow(OrganizerBoothRequestService::requestNotFound);
        organizationGuard.requireActive(
                candidate.getApplication().getPartnerOrganization());
        Long boothId = candidate.getBooth().getBoothId();

        boothRepository.findByBoothIdForUpdate(boothId)
                .orElseThrow(OrganizerBoothRequestService::boothNotAvailable);
        EventBoothConfig config = configRepository
                .findByEventIdAndBoothIdForUpdate(eventId, boothId)
                .orElseThrow(OrganizerBoothRequestService::boothNotAvailable);
        // Free selection also changes competing requests; lock the whole Pending set by id.
        BoothRequest request = requestRepository.findCompetingForUpdate(
                        eventId, boothId, BoothRequestStatus.PENDING).stream()
                .filter(value -> value.getBoothRequestId().equals(requestId))
                .findFirst().orElse(candidate);

        requirePending(request);
        Instant selectedAt = clock.instant().truncatedTo(ChronoUnit.MICROS);
        selectionEligibility.requireSelectable(event, request, config, selectedAt);

        Instant expiresAt = selectedAt.plus(
                event.getBoothPaymentWindowMinutes(), ChronoUnit.MINUTES);
        request.select(selectedAt);
        BoothHold hold = BoothHold.create(config, request, config.getRentalPrice(),
                selectedAt, expiresAt);
        try {
            requestRepository.save(request);
            hold = holdRepository.saveAndFlush(hold);
            if (config.getRentalPrice().signum() == 0) {
                hold.consume(selectedAt);
                request.complete(selectedAt);
                assignmentRepository.save(BoothAssignment.create(hold, selectedAt));
                requestRepository.findCompetingForUpdate(
                                eventId, boothId, BoothRequestStatus.PENDING)
                        .forEach(competing -> {
                            competing.notSelected(selectedAt);
                            outcomeNotifications.boothChanged(competing);
                        });
                assignmentRepository.flush();
            }
        } catch (DataIntegrityViolationException error) {
            if (isActiveHoldConstraint(error)) {
                throw boothNotAvailable();
            }
            throw error;
        }

        outcomeNotifications.boothChanged(request);

        eventPublisher.publishEvent(selectionMessage(request, event, hold));
        return BoothRequestResponse.from(request, hold);
    }

    private Event ownedEvent(Long eventId) {
        Long organizerId = currentUser.requireOrganizerId();
        return eventRepository.findByEventIdAndOrganizerUserId(eventId, organizerId)
                .orElseThrow(OrganizerBoothRequestService::eventNotFound);
    }

    private Event lockReviewableEvent(Long eventId) {
        Event event = eventRootLockService.lockOwned(eventId, currentUser.requireOrganizerId())
                .orElseThrow(OrganizerBoothRequestService::eventNotFound);
        if (event.getStatus() != EventStatus.PUBLISHED
                || !clock.instant().isBefore(event.getStartAt())) {
            throw eventNotFound();
        }
        return event;
    }

    private BoothSelectionMessageRequested selectionMessage(BoothRequest request,
            Event event, BoothHold hold) {
        Long representativeId = request.getApplication().getPartnerOrganization()
                .getRepresentativeUserId();
        String recipient = userRepository.findById(representativeId)
                .filter(user -> user.getEmailVerifiedAt() != null)
                .map(User::getEmail)
                .orElse(null);
        return new BoothSelectionMessageRequested(
                request.getBoothRequestId(), recipient, event.getName(),
                request.getBooth().getLocation().getCode(), hold.getLockedRentalPrice(),
                hold.getExpiresAt());
    }

    private static void requirePending(BoothRequest request) {
        if (request.getStatus() != BoothRequestStatus.PENDING) {
            throw new BoothApiException(HttpStatus.CONFLICT,
                    "BOOTH_REQUEST_NOT_PENDING",
                    "Only a Pending Booth request can be reviewed.");
        }
    }

    private static boolean isActiveHoldConstraint(DataIntegrityViolationException error) {
        Throwable cause = error;
        while (cause != null) {
            if (cause instanceof ConstraintViolationException violation) {
                String name = violation.getConstraintName();
                if ("uk_booth_holds_active_event_booth_config".equals(name)
                        || "uk_booth_holds_booth_request".equals(name)) {
                    return true;
                }
            }
            cause = cause.getCause();
        }
        return false;
    }

    private static BoothApiException eventNotFound() {
        return new BoothApiException(HttpStatus.NOT_FOUND, "EVENT_NOT_FOUND",
                "Event not found.");
    }

    private static BoothApiException requestNotFound() {
        return new BoothApiException(HttpStatus.NOT_FOUND, "BOOTH_REQUEST_NOT_FOUND",
                "Booth request not found.");
    }

    private static BoothApiException boothNotAvailable() {
        return new BoothApiException(HttpStatus.CONFLICT, "BOOTH_NOT_AVAILABLE",
                "The Booth is not available for selection.");
    }
}
