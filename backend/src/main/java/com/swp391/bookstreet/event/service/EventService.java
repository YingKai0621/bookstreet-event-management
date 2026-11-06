package com.swp391.bookstreet.event.service;

import com.swp391.bookstreet.activity.repository.ActivityRepository;
import com.swp391.bookstreet.activity.service.EventActivityCascadeService;
import com.swp391.bookstreet.booth.entity.BoothHold;
import com.swp391.bookstreet.booth.entity.BoothRequestStatus;
import com.swp391.bookstreet.booth.repository.BoothAssignmentRepository;
import com.swp391.bookstreet.booth.repository.BoothHoldRepository;
import com.swp391.bookstreet.booth.repository.BoothRequestRepository;
import com.swp391.bookstreet.booth.repository.EventBoothConfigRepository;
import com.swp391.bookstreet.event.dto.*;
import com.swp391.bookstreet.event.entity.Event;
import com.swp391.bookstreet.event.entity.EventStatus;
import com.swp391.bookstreet.event.exception.EventException;
import com.swp391.bookstreet.event.repository.EventRepository;
import com.swp391.bookstreet.event.security.EventCurrentUser;
import com.swp391.bookstreet.payment.entity.BoothPayment;
import com.swp391.bookstreet.payment.entity.BoothPaymentStatus;
import com.swp391.bookstreet.payment.repository.BoothPaymentRepository;
import com.swp391.bookstreet.partner.repository.PartnerEventApplicationRepository;
import com.swp391.bookstreet.partner.service.PartnerOutcomeNotificationService;
import com.swp391.bookstreet.registration.service.EventParticipantCancellationService;
import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class EventService {
    private static final int DEFAULT_BOOTH_PAYMENT_WINDOW_MINUTES = 1440;
    private static final Set<String> OPERATIONAL_FIELDS = Set.of(
            "startAt", "endAt", "partnerApplicationDeadlineAt",
            "boothRequestDeadlineAt", "activityProposalDeadlineAt",
            "participantRegistrationDeadlineAt", "partnerWithdrawalCutoffAt",
            "boothCancellationCutoffAt", "activityCancellationCutoffAt",
            "boothPaymentWindowMinutes", "maxBoothsPerPartner",
            "maxActivitiesPerPartner");
    private static final List<EventStatus> DEFAULT_PUBLIC_STATUSES =
            List.of(EventStatus.PUBLISHED, EventStatus.ONGOING);
    private static final List<EventStatus> PUBLIC_DETAIL_STATUSES = List.of(
            EventStatus.PUBLISHED, EventStatus.ONGOING,
            EventStatus.COMPLETED, EventStatus.CANCELLED);

    private final EventRepository repository;
    private final EventCurrentUser currentUser;
    private final EventValidation validation;
    private final EventRootLockService eventRootLockService;
    private final EventBoothConfigRepository eventBoothConfigRepository;
    private final ActivityRepository activityRepository;
    private final EventActivityCascadeService activityCascadeService;
    private final BoothHoldRepository boothHoldRepository;
    private final BoothPaymentRepository boothPaymentRepository;
    private final BoothAssignmentRepository boothAssignmentRepository;
    private final BoothRequestRepository boothRequestRepository;
    private final PartnerEventApplicationRepository partnerApplicationRepository;
    private final EventParticipantCancellationService participantCancellationService;
    private final ApplicationEventPublisher eventPublisher;
    private final Clock clock;
    private final PartnerOutcomeNotificationService outcomeNotifications;

    public EventService(EventRepository repository, EventCurrentUser currentUser,
            EventValidation validation, EventRootLockService eventRootLockService,
            EventBoothConfigRepository eventBoothConfigRepository,
            ActivityRepository activityRepository,
            EventActivityCascadeService activityCascadeService,
            BoothHoldRepository boothHoldRepository,
            BoothPaymentRepository boothPaymentRepository,
            BoothAssignmentRepository boothAssignmentRepository,
            BoothRequestRepository boothRequestRepository,
            PartnerEventApplicationRepository partnerApplicationRepository,
            EventParticipantCancellationService participantCancellationService,
            ApplicationEventPublisher eventPublisher,
            PartnerOutcomeNotificationService outcomeNotifications, Clock clock) {
        this.repository = repository;
        this.currentUser = currentUser;
        this.validation = validation;
        this.eventRootLockService = eventRootLockService;
        this.eventBoothConfigRepository = eventBoothConfigRepository;
        this.activityRepository = activityRepository;
        this.activityCascadeService = activityCascadeService;
        this.boothHoldRepository = boothHoldRepository;
        this.boothPaymentRepository = boothPaymentRepository;
        this.boothAssignmentRepository = boothAssignmentRepository;
        this.boothRequestRepository = boothRequestRepository;
        this.partnerApplicationRepository = partnerApplicationRepository;
        this.participantCancellationService = participantCancellationService;
        this.eventPublisher = eventPublisher;
        this.clock = clock;
        this.outcomeNotifications = outcomeNotifications;
    }

    @Transactional
    public EventResponse create(CreateEventRequest request) {
        Long owner = currentUser.requireOrganizerId();
        Event event = new Event();
        event.setOrganizerUserId(owner);
        event.setStatus(EventStatus.DRAFT);
        event.setName(request.name());
        event.setDescription(request.description());
        event.setStartAt(request.startAt());
        event.setEndAt(request.endAt());
        event.setPartnerApplicationDeadlineAt(request.partnerApplicationDeadlineAt());
        event.setBoothRequestDeadlineAt(request.boothRequestDeadlineAt());
        event.setActivityProposalDeadlineAt(request.activityProposalDeadlineAt());
        event.setParticipantRegistrationDeadlineAt(request.participantRegistrationDeadlineAt());
        event.setPartnerWithdrawalCutoffAt(request.partnerWithdrawalCutoffAt());
        event.setBoothCancellationCutoffAt(request.boothCancellationCutoffAt());
        event.setActivityCancellationCutoffAt(request.activityCancellationCutoffAt());
        event.setBoothPaymentWindowMinutes(request.boothPaymentWindowMinutes() == null
                ? DEFAULT_BOOTH_PAYMENT_WINDOW_MINUTES
                : request.boothPaymentWindowMinutes());
        event.setMaxBoothsPerPartner(request.maxBoothsPerPartner());
        event.setMaxActivitiesPerPartner(request.maxActivitiesPerPartner());
        event.setBannerUrl(request.bannerUrl());
        validation.validate(event);
        return EventResponse.from(repository.saveAndFlush(event));
    }

    public EventPageResponse<EventResponse> listOwned(int page, int size, String sort) {
        Long owner = currentUser.requireOrganizerId();
        return EventPageResponse.from(repository.findByOrganizerUserId(owner,
                EventPagination.of(page, size, sort)).map(EventResponse::from));
    }

    public EventResponse getOwned(Long id) {
        Long owner = currentUser.requireOrganizerId();
        return EventResponse.from(repository.findByEventIdAndOrganizerUserId(id, owner)
                .orElseThrow(EventService::notFound));
    }

    @Transactional
    public EventResponse update(Long id, UpdateEventRequest request) {
        Long owner = currentUser.requireOrganizerId();
        Event event = eventRootLockService.lockOwned(id, owner).orElseThrow(EventService::notFound);
        boolean operationalPatch = request.suppliedFields().stream()
                .anyMatch(OPERATIONAL_FIELDS::contains);

        if (event.getStatus() == EventStatus.PUBLISHED && operationalPatch
                && repository.existsExternalParticipation(id)) {
            throw conflict("EVENT_OPERATIONAL_FIELDS_LOCKED",
                    "Operational Event fields are locked after external participation begins.");
        }
        if ((event.getStatus() == EventStatus.ONGOING && operationalPatch)
                || event.getStatus() == EventStatus.COMPLETED
                || event.getStatus() == EventStatus.CANCELLED) {
            throw conflict("EVENT_NOT_EDITABLE",
                    "The requested Event fields cannot be edited in its current state.");
        }

        if (request.contains("name")) event.setName(request.getName());
        if (request.contains("description")) event.setDescription(request.getDescription());
        if (request.contains("startAt")) event.setStartAt(request.getStartAt());
        if (request.contains("endAt")) event.setEndAt(request.getEndAt());
        if (request.contains("partnerApplicationDeadlineAt")) event.setPartnerApplicationDeadlineAt(request.getPartnerApplicationDeadlineAt());
        if (request.contains("boothRequestDeadlineAt")) event.setBoothRequestDeadlineAt(request.getBoothRequestDeadlineAt());
        if (request.contains("activityProposalDeadlineAt")) event.setActivityProposalDeadlineAt(request.getActivityProposalDeadlineAt());
        if (request.contains("participantRegistrationDeadlineAt")) event.setParticipantRegistrationDeadlineAt(request.getParticipantRegistrationDeadlineAt());
        if (request.contains("partnerWithdrawalCutoffAt")) event.setPartnerWithdrawalCutoffAt(request.getPartnerWithdrawalCutoffAt());
        if (request.contains("boothCancellationCutoffAt")) event.setBoothCancellationCutoffAt(request.getBoothCancellationCutoffAt());
        if (request.contains("activityCancellationCutoffAt")) event.setActivityCancellationCutoffAt(request.getActivityCancellationCutoffAt());
        if (request.contains("boothPaymentWindowMinutes")) event.setBoothPaymentWindowMinutes(request.getBoothPaymentWindowMinutes());
        if (request.contains("maxBoothsPerPartner")) event.setMaxBoothsPerPartner(request.getMaxBoothsPerPartner());
        if (request.contains("maxActivitiesPerPartner")) event.setMaxActivitiesPerPartner(request.getMaxActivitiesPerPartner());
        if (request.contains("bannerUrl")) event.setBannerUrl(request.getBannerUrl());
        if (event.getStatus() == EventStatus.PUBLISHED && operationalPatch) {
            validation.validateForOperationalUpdate(event, request.suppliedFields(), clock.instant());
        } else {
            validation.validate(event);
        }
        if (event.getStatus() == EventStatus.DRAFT
                && (request.contains("startAt") || request.contains("endAt"))
                && activityRepository.existsNonCancelledOutsideEventInterval(
                        id, event.getStartAt(), event.getEndAt())) {
            throw new EventException(HttpStatus.UNPROCESSABLE_CONTENT,
                    "ACTIVITY_TIME_OUTSIDE_EVENT",
                    "Every non-cancelled Activity must remain within the Event interval.",
                    "startAt");
        }
        repository.flush();
        return EventResponse.from(event);
    }

    @Transactional
    public EventResponse publish(Long id) {
        Event event = ownedDraftForUpdate(id);
        validation.validateForPublish(event, clock.instant());
        event.setStatus(EventStatus.PUBLISHED);
        repository.flush();
        outcomeNotifications.eventPublished(event, clock.instant());
        return EventResponse.from(event);
    }

    @Transactional
    public void deleteDraft(Long id) {
        Event event = ownedDraftForUpdate(id);
        if (activityRepository.existsByEventId(id)) {
            throw new EventException(HttpStatus.CONFLICT,
                    "EVENT_HAS_ACTIVITY_DEPENDENCIES",
                    "Draft Event has Activity history and cannot be deleted.");
        }
        try {
            eventBoothConfigRepository.deleteByEventId(id);
            repository.delete(event);
            repository.flush();
        } catch (DataIntegrityViolationException error) {
            throw new EventException(HttpStatus.CONFLICT, "EVENT_HAS_DEPENDENCIES",
                    "Draft Event has dependent business records and cannot be deleted.");
        }
    }

    @Transactional
    public EventResponse cancel(Long id, CancelEventRequest request) {
        String reason = requireCancellationReason(request);
        Long owner = currentUser.requireOrganizerId();
        Event event = eventRootLockService.lockOwned(id, owner).orElseThrow(EventService::notFound);
        if (event.getStatus() == EventStatus.CANCELLED) {
            return EventResponse.from(event);
        }
        if (event.getStatus() != EventStatus.PUBLISHED) {
            throw conflict("EVENT_NOT_CANCELLABLE", "Only a Published Event can be cancelled.");
        }

        List<BoothHold> holds = boothHoldRepository.findByEventIdForUpdate(id);
        List<BoothPayment> payments = boothPaymentRepository.findByEventIdForUpdate(id);
        rejectPaymentBlockers(payments);
        if (boothAssignmentRepository.existsByEventId(id)) {
            throw conflict("EVENT_HAS_ASSIGNMENT",
                    "An Event with a Booth Assignment cannot be cancelled.");
        }

        Instant now = clock.instant().truncatedTo(ChronoUnit.MICROS);
        var openRequests = boothRequestRepository.findByEventIdAndStatusInForUpdate(id,
                List.of(BoothRequestStatus.PENDING, BoothRequestStatus.SELECTED));
        var openRequestIds = new HashSet<Long>();
        openRequests.forEach(requestToCancel -> {
            openRequestIds.add(requestToCancel.getBoothRequestId());
            requestToCancel.cancel(now);
        });
        holds.stream()
                .filter(hold -> openRequestIds.contains(hold.getBoothRequest().getBoothRequestId()))
                .forEach(hold -> hold.release(now));
        event.cancel(reason, now);
        var seatActiveActivityIds = activityCascadeService.cancelEvent(id, reason, now);
        participantCancellationService.cancelEvent(
                id, event.getName(), seatActiveActivityIds, now);
        repository.flush();
        outcomeNotifications.eventCancelled(event);
        eventPublisher.publishEvent(new EventCancellationMessageRequested(
                event.getEventId(), event.getName(), event.getCancelledAt(),
                event.getCancellationReason(), partnerApplicationRepository
                        .findEventCancellationRecipientEmails(event.getEventId())));
        return EventResponse.from(event);
    }

    public EventPageResponse<EventSummaryResponse> listPublic(
            int page, int size, String sort, String status) {
        List<EventStatus> statuses = status == null
                ? DEFAULT_PUBLIC_STATUSES
                : List.of(publicStatusFilter(status));
        return EventPageResponse.from(repository.findByStatusIn(statuses,
                EventPagination.of(page, size, sort)).map(EventSummaryResponse::from));
    }

    public EventSummaryResponse getPublic(Long id) {
        return EventSummaryResponse.from(repository.findByEventIdAndStatusIn(
                        id, PUBLIC_DETAIL_STATUSES)
                .orElseThrow(EventService::notFound));
    }

    private static EventStatus publicStatusFilter(String status) {
        return switch (status) {
            case "PUBLISHED" -> EventStatus.PUBLISHED;
            case "ONGOING" -> EventStatus.ONGOING;
            case "COMPLETED" -> EventStatus.COMPLETED;
            default -> throw new EventException(HttpStatus.BAD_REQUEST,
                    "INVALID_EVENT_STATUS_FILTER",
                    "Status must be PUBLISHED, ONGOING or COMPLETED.");
        };
    }

    private Event ownedDraftForUpdate(Long id) {
        Long owner = currentUser.requireOrganizerId();
        Event event = eventRootLockService.lockOwned(id, owner).orElseThrow(EventService::notFound);
        if (event.getStatus() != EventStatus.DRAFT) {
            throw new EventException(HttpStatus.CONFLICT, "EVENT_NOT_DRAFT",
                    "Only a DRAFT event can be updated or published.");
        }
        return event;
    }

    private static EventException notFound() {
        // The same response hides both another Organizer's events and private drafts.
        return new EventException(HttpStatus.NOT_FOUND, "EVENT_NOT_FOUND", "Event not found.");
    }

    private static String requireCancellationReason(CancelEventRequest request) {
        String reason = request == null ? null : request.reason();
        if (reason == null || reason.length() < 10 || reason.length() > 500) {
            throw new EventException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR",
                    "Cancellation reason must contain between 10 and 500 characters.", "reason");
        }
        return reason;
    }

    private static void rejectPaymentBlockers(List<BoothPayment> payments) {
        if (payments.stream().anyMatch(payment -> payment.getStatus() == BoothPaymentStatus.PENDING)) {
            throw conflict("EVENT_PAYMENT_PENDING",
                    "An Event with a Pending Payment cannot be cancelled.");
        }
        if (payments.stream().anyMatch(BoothPayment::isReconciliationRequired)) {
            throw conflict("EVENT_PAYMENT_RECONCILIATION_REQUIRED",
                    "An Event with unresolved Payment evidence cannot be cancelled.");
        }
        if (payments.stream().anyMatch(payment -> payment.getStatus() == BoothPaymentStatus.SUCCESS)) {
            throw conflict("EVENT_HAS_SUCCESSFUL_PAYMENT",
                    "An Event with a Successful Payment cannot be cancelled.");
        }
    }

    private static EventException conflict(String code, String message) {
        return new EventException(HttpStatus.CONFLICT, code, message);
    }
}

