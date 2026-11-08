package com.swp391.bookstreet.booth.service;

import com.swp391.bookstreet.booth.dto.BoothPageResponse;
import com.swp391.bookstreet.booth.dto.BoothRequestResponse;
import com.swp391.bookstreet.booth.dto.SubmitBoothRequest;
import com.swp391.bookstreet.booth.entity.Booth;
import com.swp391.bookstreet.booth.entity.BoothHold;
import com.swp391.bookstreet.booth.entity.BoothHoldStatus;
import com.swp391.bookstreet.booth.entity.BoothRequest;
import com.swp391.bookstreet.booth.entity.BoothRequestStatus;
import com.swp391.bookstreet.booth.entity.EventBoothConfig;
import com.swp391.bookstreet.booth.exception.BoothApiException;
import com.swp391.bookstreet.booth.repository.BoothRequestRepository;
import com.swp391.bookstreet.booth.repository.BoothRepository;
import com.swp391.bookstreet.booth.repository.BoothHoldRepository;
import com.swp391.bookstreet.booth.repository.BoothAssignmentRepository;
import com.swp391.bookstreet.booth.repository.EventBoothConfigRepository;
import com.swp391.bookstreet.booth.security.BoothCurrentUser;
import com.swp391.bookstreet.event.entity.Event;
import com.swp391.bookstreet.event.entity.EventStatus;
import com.swp391.bookstreet.event.service.EventRootLockService;
import com.swp391.bookstreet.notification.service.OrganizerWorkItemNotificationService;
import com.swp391.bookstreet.payment.entity.BoothPayment;
import com.swp391.bookstreet.payment.entity.BoothPaymentStatus;
import com.swp391.bookstreet.payment.repository.BoothPaymentRepository;
import com.swp391.bookstreet.partner.entity.PartnerEventApplication;
import com.swp391.bookstreet.partner.repository.PartnerEventApplicationRepository;
import com.swp391.bookstreet.partner.service.PartnerOrganizationGuard;
import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Set;
import java.util.List;
import org.hibernate.exception.ConstraintViolationException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class PartnerBoothRequestService {
    private static final Set<BoothRequestStatus> OPEN_STATUSES = Set.of(
            BoothRequestStatus.PENDING,
            BoothRequestStatus.SELECTED
    );

    private final EventRootLockService eventRootLockService;
    private final BoothRepository boothRepository;
    private final BoothHoldRepository holdRepository;
    private final BoothPaymentRepository paymentRepository;
    private final PartnerEventApplicationRepository applicationRepository;
    private final PartnerOrganizationGuard organizationGuard;
    private final EventBoothConfigRepository configRepository;
    private final BoothRequestRepository requestRepository;
    private final BoothAssignmentRepository assignmentRepository;
    private final BoothCurrentUser currentUser;
    private final BoothHoldExpiryService expiryService;
    private final OrganizerWorkItemNotificationService organizerNotifications;
    private final BoothReselectionNotificationService reselectionNotifications;
    private final Clock clock;

    public PartnerBoothRequestService(
            EventRootLockService eventRootLockService,
            BoothRepository boothRepository,
            BoothHoldRepository holdRepository,
            BoothPaymentRepository paymentRepository,
            PartnerEventApplicationRepository applicationRepository,
            PartnerOrganizationGuard organizationGuard,
            EventBoothConfigRepository configRepository,
            BoothRequestRepository requestRepository,
            BoothAssignmentRepository assignmentRepository,
            BoothCurrentUser currentUser,
            BoothHoldExpiryService expiryService,
            OrganizerWorkItemNotificationService organizerNotifications,
            BoothReselectionNotificationService reselectionNotifications,
            Clock clock
    ) {
        this.eventRootLockService = eventRootLockService;
        this.boothRepository = boothRepository;
        this.holdRepository = holdRepository;
        this.paymentRepository = paymentRepository;
        this.applicationRepository = applicationRepository;
        this.organizationGuard = organizationGuard;
        this.configRepository = configRepository;
        this.requestRepository = requestRepository;
        this.assignmentRepository = assignmentRepository;
        this.currentUser = currentUser;
        this.expiryService = expiryService;
        this.organizerNotifications = organizerNotifications;
        this.reselectionNotifications = reselectionNotifications;
        this.clock = clock;
    }

    @Transactional
    public BoothRequestResponse submit(Long eventId, SubmitBoothRequest command) {
        Long partnerUserId = currentUser.requirePartnerId();
        expiryService.expireDueHolds();
        Event event = eventRootLockService.lock(eventId)
                .filter(value -> value.getStatus() == EventStatus.PUBLISHED)
                .filter(value -> clock.instant().isBefore(value.getStartAt()))
                .orElseThrow(PartnerBoothRequestService::eventNotFound);
        PartnerEventApplication application = applicationRepository
                .findByEventIdAndPartnerOrganization_RepresentativeUserId(
                        eventId, partnerUserId)
                .orElseThrow(PartnerBoothRequestService::applicationNotApproved);
        organizationGuard.requireActive(application.getPartnerOrganization());
        if (application.getStatus() != PartnerEventApplication.ApplicationStatus.APPROVED) {
            throw applicationNotApproved();
        }

        Instant now = clock.instant();
        if (event.getBoothRequestDeadlineAt() == null
                || !now.isBefore(event.getBoothRequestDeadlineAt())) {
            throw new BoothApiException(HttpStatus.CONFLICT,
                    "BOOTH_REQUEST_DEADLINE_PASSED",
                    "The Booth request deadline has passed.");
        }

        boothRepository.findByBoothIdForUpdate(command.boothId())
                .orElseThrow(PartnerBoothRequestService::eventBoothNotFound);
        EventBoothConfig config = configRepository
                .findByEventIdAndBoothIdForUpdate(eventId, command.boothId())
                .orElseThrow(PartnerBoothRequestService::eventBoothNotFound);
        Booth booth = config.getBooth();
        if (!config.isEnabled()) {
            throw new BoothApiException(HttpStatus.CONFLICT, "BOOTH_NOT_ENABLED",
                    "The Booth is not enabled for this Event.");
        }
        if (!booth.getLocation().isActive()
                || configRepository.existsCurrentOverlappingHoldForBooth(
                        booth.getBoothId(), event.getStartAt(), event.getEndAt())
                || assignmentRepository.existsOverlappingActiveAssignment(
                        booth.getBoothId(), event.getStartAt(), event.getEndAt())) {
            throw new BoothApiException(HttpStatus.CONFLICT, "BOOTH_NOT_AVAILABLE",
                    "The Booth is not available for request.");
        }

        rejectDuplicateOrRejected(application.getId(), booth.getBoothId());
        if (requestRepository.countCurrentActiveHolds(application.getId())
                + assignmentRepository.countActiveByApplication(application.getId())
                >= event.getMaxBoothsPerPartner()) {
            throw new BoothApiException(HttpStatus.CONFLICT, "BOOTH_QUOTA_EXCEEDED",
                    "The Partner has reached this Event's Booth quota.");
        }

        BoothRequest request = BoothRequest.submit(
                application, booth, normalizeNote(command.requestNote()), now);
        try {
            request = requestRepository.saveAndFlush(request);
        } catch (DataIntegrityViolationException error) {
            if (isOpenRequestConstraint(error)) {
                throw alreadyOpen();
            }
            throw error;
        }
        organizerNotifications.boothRequestSubmitted(event, request);
        return BoothRequestResponse.from(request);
    }

    public BoothPageResponse<BoothRequestResponse> list(int page, int size, String sort,
            Long eventId, BoothRequestStatus status) {
        Long partnerUserId = currentUser.requirePartnerId();
        return BoothPageResponse.from(requestRepository
                .findOwned(partnerUserId, eventId, status,
                        BoothRequestPagination.page(page, size, sort))
                .map(BoothRequestResponse::from));
    }

    public BoothRequestResponse detail(Long requestId) {
        Long partnerUserId = currentUser.requirePartnerId();
        return requestRepository.findOwnedById(requestId, partnerUserId)
                .map(BoothRequestResponse::from)
                .orElseThrow(PartnerBoothRequestService::requestNotFound);
    }

    @Transactional
    public BoothRequestResponse withdraw(Long requestId) {
        Long partnerUserId = currentUser.requirePartnerId();
        Long eventId = requestRepository.findOwnedEventIdById(requestId, partnerUserId)
                .orElseThrow(PartnerBoothRequestService::requestNotFound);
        Event event = eventRootLockService.lock(eventId)
                .orElseThrow(PartnerBoothRequestService::requestNotFound);
        // Discover and lock the optional Hold before loading/locking the request.
        BoothHold hold = holdRepository.findOwnedByRequestIdForUpdate(requestId, partnerUserId)
                .orElse(null);
        List<BoothPayment> payments = hold == null ? List.of()
                : paymentRepository.findByHoldIdForUpdate(hold.getBoothHoldId());
        BoothRequest request = requestRepository
                .findOwnedByIdForUpdate(requestId, partnerUserId)
                .orElseThrow(PartnerBoothRequestService::requestNotFound);
        if (request.getStatus() == BoothRequestStatus.WITHDRAWN) {
            return BoothRequestResponse.from(request, hold);
        }
        if (request.getStatus() != BoothRequestStatus.PENDING
                && request.getStatus() != BoothRequestStatus.SELECTED) {
            throw new BoothApiException(HttpStatus.CONFLICT,
                    "BOOTH_REQUEST_NOT_WITHDRAWABLE",
                    "Only a Pending or eligible Selected Booth request can be withdrawn.");
        }
        Instant now = clock.instant().truncatedTo(ChronoUnit.MICROS);
        boolean selectedRelease = request.getStatus() == BoothRequestStatus.SELECTED;
        if (selectedRelease) {
            requireReleasable(hold, payments, now);
            hold.release(now);
        }
        request.withdraw(now);
        requestRepository.flush();
        if (selectedRelease) {
            reselectionNotifications.notifyIfEligible(event, request, now);
        }
        return BoothRequestResponse.from(request, hold);
    }

    private void requireReleasable(BoothHold hold, List<BoothPayment> payments, Instant now) {
        if (hold == null || hold.getStatus() != BoothHoldStatus.ACTIVE) {
            throw conflict("BOOTH_HOLD_NOT_ACTIVE", "The Booth Hold is not Active.");
        }
        if (assignmentRepository.existsByBoothHoldBoothHoldId(hold.getBoothHoldId())) {
            throw conflict("BOOTH_ALREADY_ASSIGNED", "The Booth already has an Assignment.");
        }
        if (payments.stream().anyMatch(BoothPayment::isReconciliationRequired)) {
            throw conflict("PAYMENT_RESULT_UNKNOWN", "Payment evidence requires reconciliation.");
        }
        if (payments.stream().anyMatch(payment -> payment.getStatus() == BoothPaymentStatus.SUCCESS)) {
            throw conflict("PAYMENT_ALREADY_COMPLETED", "Payment is already completed.");
        }
        for (BoothPayment payment : payments) {
            if (payment.getStatus() == BoothPaymentStatus.PENDING) {
                boolean usable = payment.getCheckoutUrl() != null
                        && payment.getCheckoutExpiresAt() != null
                        && now.isBefore(payment.getCheckoutExpiresAt());
                throw conflict(usable ? "PAYMENT_ATTEMPT_ALREADY_PENDING" : "PAYMENT_RESULT_UNKNOWN",
                        "A Pending Payment prevents release of this Hold.");
            }
        }
    }

    private static BoothApiException conflict(String code, String message) {
        return new BoothApiException(HttpStatus.CONFLICT, code, message);
    }

    private void rejectDuplicateOrRejected(Long applicationId, Long boothId) {
        if (requestRepository.existsByApplication_IdAndBooth_BoothIdAndStatus(
                applicationId, boothId, BoothRequestStatus.REJECTED)) {
            throw new BoothApiException(HttpStatus.CONFLICT,
                    "BOOTH_REQUEST_RESUBMISSION_NOT_ALLOWED",
                    "A rejected Booth request cannot be resubmitted for the same Event and Booth.");
        }
        if (requestRepository.existsByApplication_IdAndBooth_BoothIdAndStatusIn(
                applicationId, boothId, OPEN_STATUSES)) {
            throw alreadyOpen();
        }
    }

    private static String normalizeNote(String note) {
        if (note == null || note.isBlank()) {
            return null;
        }
        return note.trim();
    }

    private static boolean isOpenRequestConstraint(DataIntegrityViolationException error) {
        Throwable cause = error;
        while (cause != null) {
            if (cause instanceof ConstraintViolationException violation
                    && "uk_booth_requests_open_application_booth"
                    .equals(violation.getConstraintName())) {
                return true;
            }
            cause = cause.getCause();
        }
        return false;
    }

    private static BoothApiException alreadyOpen() {
        return new BoothApiException(HttpStatus.CONFLICT, "BOOTH_REQUEST_ALREADY_OPEN",
                "An open Booth request already exists for this Event and Booth.");
    }

    private static BoothApiException eventNotFound() {
        return new BoothApiException(HttpStatus.NOT_FOUND, "EVENT_NOT_FOUND",
                "Event not found.");
    }

    private static BoothApiException eventBoothNotFound() {
        return new BoothApiException(HttpStatus.NOT_FOUND, "EVENT_BOOTH_NOT_FOUND",
                "Event Booth not found.");
    }

    private static BoothApiException applicationNotApproved() {
        return new BoothApiException(HttpStatus.FORBIDDEN,
                "PARTNER_APPLICATION_NOT_APPROVED",
                "An Active Partner with an Approved Event application is required.");
    }

    private static BoothApiException requestNotFound() {
        return new BoothApiException(HttpStatus.NOT_FOUND, "BOOTH_REQUEST_NOT_FOUND",
                "Booth request not found.");
    }
}
