package com.swp391.bookstreet.booth.service;

import com.swp391.bookstreet.auth.entity.User;
import com.swp391.bookstreet.auth.repository.UserRepository;
import com.swp391.bookstreet.booth.dto.BoothPageResponse;
import com.swp391.bookstreet.booth.dto.BoothRequestResponse;
import com.swp391.bookstreet.booth.dto.RejectBoothRequest;
import com.swp391.bookstreet.booth.entity.Booth;
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
import com.swp391.bookstreet.event.repository.EventRepository;
import com.swp391.bookstreet.partner.entity.PartnerEventApplication;
import com.swp391.bookstreet.partner.entity.PartnerOrganization;
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
    private final BoothRepository boothRepository;
    private final EventBoothConfigRepository configRepository;
    private final BoothRequestRepository requestRepository;
    private final BoothHoldRepository holdRepository;
    private final BoothAssignmentRepository assignmentRepository;
    private final UserRepository userRepository;
    private final BoothCurrentUser currentUser;
    private final BoothHoldExpiryService expiryService;
    private final ApplicationEventPublisher eventPublisher;
    private final Clock clock;

    public OrganizerBoothRequestService(EventRepository eventRepository,
            BoothRepository boothRepository,
            EventBoothConfigRepository configRepository,
            BoothRequestRepository requestRepository,
            BoothHoldRepository holdRepository,
            BoothAssignmentRepository assignmentRepository,
            UserRepository userRepository,
            BoothCurrentUser currentUser,
            BoothHoldExpiryService expiryService,
            ApplicationEventPublisher eventPublisher,
            Clock clock) {
        this.eventRepository = eventRepository;
        this.boothRepository = boothRepository;
        this.configRepository = configRepository;
        this.requestRepository = requestRepository;
        this.holdRepository = holdRepository;
        this.assignmentRepository = assignmentRepository;
        this.userRepository = userRepository;
        this.currentUser = currentUser;
        this.expiryService = expiryService;
        this.eventPublisher = eventPublisher;
        this.clock = clock;
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
        ownedEvent(eventId);
        expiryService.expireDueHolds();
        BoothRequest request = requestRepository
                .findForOrganizerByIdForUpdate(requestId, eventId)
                .orElseThrow(OrganizerBoothRequestService::requestNotFound);
        requirePending(request);
        request.reject(command.reviewNote().trim(), clock.instant());
        return BoothRequestResponse.from(requestRepository.saveAndFlush(request));
    }

    @Transactional
    public BoothRequestResponse select(Long eventId, Long requestId) {
        Event event = ownedEvent(eventId);
        expiryService.expireDueHolds();

        BoothRequest candidate = requestRepository.findForOrganizerById(requestId, eventId)
                .orElseThrow(OrganizerBoothRequestService::requestNotFound);
        Long boothId = candidate.getBooth().getBoothId();

        Booth booth = boothRepository.findByBoothIdForUpdate(boothId)
                .orElseThrow(OrganizerBoothRequestService::boothNotAvailable);
        EventBoothConfig config = configRepository
                .findByEventIdAndBoothIdForUpdate(eventId, boothId)
                .orElseThrow(OrganizerBoothRequestService::boothNotAvailable);
        BoothRequest request = requestRepository
                .findForOrganizerByIdForUpdate(requestId, eventId)
                .orElseThrow(OrganizerBoothRequestService::requestNotFound);

        requirePending(request);
        PartnerEventApplication application = request.getApplication();
        if (!eligible(application)) {
            throw new BoothApiException(HttpStatus.CONFLICT,
                    "PARTNER_APPLICATION_NOT_APPROVED",
                    "The Partner application is no longer Approved.");
        }

        Instant selectedAt = clock.instant().truncatedTo(ChronoUnit.MICROS);
        if (event.getBoothRequestDeadlineAt() == null
                || !selectedAt.isBefore(event.getBoothRequestDeadlineAt())) {
            throw new BoothApiException(HttpStatus.CONFLICT,
                    "BOOTH_REQUEST_DEADLINE_PASSED",
                    "The Booth request deadline has passed.");
        }
        if (!config.isEnabled() || !booth.getLocation().isActive()
                || configRepository.existsCurrentOverlappingHoldForBooth(
                        boothId, event.getStartAt(), event.getEndAt())
                || assignmentRepository.existsOverlappingActiveAssignment(
                        boothId, event.getStartAt(), event.getEndAt())) {
            throw boothNotAvailable();
        }
        if (requestRepository.countCurrentActiveHolds(application.getId())
                + assignmentRepository.countActiveByApplication(application.getId())
                >= event.getMaxBoothsPerPartner()) {
            throw new BoothApiException(HttpStatus.CONFLICT, "BOOTH_QUOTA_EXCEEDED",
                    "The Partner has reached this Event's Booth quota.");
        }

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
                        .forEach(competing -> competing.notSelected(selectedAt));
                assignmentRepository.flush();
            }
        } catch (DataIntegrityViolationException error) {
            if (isActiveHoldConstraint(error)) {
                throw boothNotAvailable();
            }
            throw error;
        }

        eventPublisher.publishEvent(selectionMessage(request, event, hold));
        return BoothRequestResponse.from(request, hold);
    }

    private Event ownedEvent(Long eventId) {
        Long organizerId = currentUser.requireOrganizerId();
        return eventRepository.findByEventIdAndOrganizerUserId(eventId, organizerId)
                .orElseThrow(OrganizerBoothRequestService::eventNotFound);
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

    private static boolean eligible(PartnerEventApplication application) {
        return application.getStatus() == PartnerEventApplication.ApplicationStatus.APPROVED
                && application.getPartnerOrganization().getStatus()
                == PartnerOrganization.OrganizationStatus.ACTIVE;
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
