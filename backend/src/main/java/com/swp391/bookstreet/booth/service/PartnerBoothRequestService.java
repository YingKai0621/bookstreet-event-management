package com.swp391.bookstreet.booth.service;

import com.swp391.bookstreet.booth.dto.BoothPageResponse;
import com.swp391.bookstreet.booth.dto.BoothRequestResponse;
import com.swp391.bookstreet.booth.dto.SubmitBoothRequest;
import com.swp391.bookstreet.booth.entity.Booth;
import com.swp391.bookstreet.booth.entity.BoothRequest;
import com.swp391.bookstreet.booth.entity.BoothRequestStatus;
import com.swp391.bookstreet.booth.entity.EventBoothConfig;
import com.swp391.bookstreet.booth.exception.BoothApiException;
import com.swp391.bookstreet.booth.repository.BoothRequestRepository;
import com.swp391.bookstreet.booth.repository.EventBoothConfigRepository;
import com.swp391.bookstreet.booth.security.BoothCurrentUser;
import com.swp391.bookstreet.event.entity.Event;
import com.swp391.bookstreet.event.entity.EventStatus;
import com.swp391.bookstreet.event.repository.EventRepository;
import com.swp391.bookstreet.partner.entity.PartnerEventApplication;
import com.swp391.bookstreet.partner.entity.PartnerOrganization;
import com.swp391.bookstreet.partner.repository.PartnerEventApplicationRepository;
import java.time.Clock;
import java.time.Instant;
import java.util.Set;
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

    private final EventRepository eventRepository;
    private final PartnerEventApplicationRepository applicationRepository;
    private final EventBoothConfigRepository configRepository;
    private final BoothRequestRepository requestRepository;
    private final BoothCurrentUser currentUser;
    private final Clock clock;

    public PartnerBoothRequestService(
            EventRepository eventRepository,
            PartnerEventApplicationRepository applicationRepository,
            EventBoothConfigRepository configRepository,
            BoothRequestRepository requestRepository,
            BoothCurrentUser currentUser,
            Clock clock
    ) {
        this.eventRepository = eventRepository;
        this.applicationRepository = applicationRepository;
        this.configRepository = configRepository;
        this.requestRepository = requestRepository;
        this.currentUser = currentUser;
        this.clock = clock;
    }

    @Transactional
    public BoothRequestResponse submit(Long eventId, SubmitBoothRequest command) {
        Long partnerUserId = currentUser.requirePartnerId();
        Event event = eventRepository.findByEventIdAndStatus(eventId, EventStatus.PUBLISHED)
                .orElseThrow(PartnerBoothRequestService::eventNotFound);
        PartnerEventApplication application = applicationRepository
                .findByEventIdAndPartnerOrganization_RepresentativeUserId(
                        eventId, partnerUserId)
                .filter(this::isEligible)
                .orElseThrow(PartnerBoothRequestService::applicationNotApproved);

        Instant now = clock.instant();
        if (event.getBoothRequestDeadlineAt() == null
                || !now.isBefore(event.getBoothRequestDeadlineAt())) {
            throw new BoothApiException(HttpStatus.CONFLICT,
                    "BOOTH_REQUEST_DEADLINE_PASSED",
                    "The Booth request deadline has passed.");
        }

        EventBoothConfig config = configRepository
                .findByEventIdAndBoothBoothId(eventId, command.boothId())
                .orElseThrow(PartnerBoothRequestService::eventBoothNotFound);
        Booth booth = config.getBooth();
        if (!config.isEnabled()) {
            throw new BoothApiException(HttpStatus.CONFLICT, "BOOTH_NOT_ENABLED",
                    "The Booth is not enabled for this Event.");
        }
        if (!booth.getLocation().isActive()
                || configRepository.existsCurrentOverlappingHoldForBooth(
                        booth.getBoothId(), event.getStartAt(), event.getEndAt(), now)) {
            throw new BoothApiException(HttpStatus.CONFLICT, "BOOTH_NOT_AVAILABLE",
                    "The Booth is not available for request.");
        }

        rejectDuplicateOrRejected(application.getId(), booth.getBoothId());
        if (requestRepository.countCurrentActiveHolds(application.getId(), now)
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
        BoothRequest request = requestRepository
                .findOwnedByIdForUpdate(requestId, partnerUserId)
                .orElseThrow(PartnerBoothRequestService::requestNotFound);
        if (request.getStatus() != BoothRequestStatus.PENDING) {
            throw new BoothApiException(HttpStatus.CONFLICT,
                    "BOOTH_REQUEST_NOT_PENDING",
                    "Only a Pending Booth request can be withdrawn.");
        }
        request.withdraw(clock.instant());
        return BoothRequestResponse.from(requestRepository.saveAndFlush(request));
    }

    private boolean isEligible(PartnerEventApplication application) {
        return application.getStatus() == PartnerEventApplication.ApplicationStatus.APPROVED
                && application.getPartnerOrganization().getStatus()
                == PartnerOrganization.OrganizationStatus.ACTIVE;
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
