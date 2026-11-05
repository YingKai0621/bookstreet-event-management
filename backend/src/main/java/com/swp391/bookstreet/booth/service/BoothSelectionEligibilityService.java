package com.swp391.bookstreet.booth.service;

import com.swp391.bookstreet.booth.entity.BoothRequest;
import com.swp391.bookstreet.booth.entity.BoothRequestStatus;
import com.swp391.bookstreet.booth.entity.EventBoothConfig;
import com.swp391.bookstreet.booth.exception.BoothApiException;
import com.swp391.bookstreet.booth.repository.BoothAssignmentRepository;
import com.swp391.bookstreet.booth.repository.BoothRequestRepository;
import com.swp391.bookstreet.booth.repository.EventBoothConfigRepository;
import com.swp391.bookstreet.event.entity.Event;
import com.swp391.bookstreet.event.entity.EventStatus;
import com.swp391.bookstreet.partner.entity.PartnerEventApplication;
import com.swp391.bookstreet.partner.entity.PartnerOrganization;
import java.time.Instant;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** Keeps Organizer selection and re-selection work-item eligibility on one predicate. */
@Service
public class BoothSelectionEligibilityService {
    private final EventBoothConfigRepository configRepository;
    private final BoothRequestRepository requestRepository;
    private final BoothAssignmentRepository assignmentRepository;

    public BoothSelectionEligibilityService(EventBoothConfigRepository configRepository,
            BoothRequestRepository requestRepository,
            BoothAssignmentRepository assignmentRepository) {
        this.configRepository = configRepository;
        this.requestRepository = requestRepository;
        this.assignmentRepository = assignmentRepository;
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void requireSelectable(Event event, BoothRequest request,
            EventBoothConfig config, Instant selectedAt) {
        if (!eligible(request.getApplication())) {
            throw new BoothApiException(HttpStatus.CONFLICT,
                    "PARTNER_APPLICATION_NOT_APPROVED",
                    "The Partner application is no longer Approved.");
        }
        if (!selectionWindowOpen(event, selectedAt)) {
            throw new BoothApiException(HttpStatus.CONFLICT,
                    "BOOTH_REQUEST_DEADLINE_PASSED",
                    "The Booth request deadline has passed.");
        }
        if (!boothAvailable(event, config)) throw boothNotAvailable();
        if (!withinQuota(event, request)) {
            throw new BoothApiException(HttpStatus.CONFLICT, "BOOTH_QUOTA_EXCEEDED",
                    "The Partner has reached this Event's Booth quota.");
        }
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public boolean hasEligibleAlternative(Event event, BoothRequest releasedRequest,
            Instant releasedAt) {
        if (!selectionWindowOpen(event, releasedAt)) return false;
        Long boothId = releasedRequest.getBooth().getBoothId();
        EventBoothConfig config = configRepository
                .findByEventIdAndBoothBoothId(event.getEventId(), boothId)
                .orElse(null);
        if (config == null || !boothAvailable(event, config)) return false;

        return requestRepository.findCompetingForUpdate(
                        event.getEventId(), boothId, BoothRequestStatus.PENDING).stream()
                .filter(candidate -> !candidate.getBoothRequestId()
                        .equals(releasedRequest.getBoothRequestId()))
                .anyMatch(candidate -> eligible(candidate.getApplication())
                        && withinQuota(event, candidate));
    }

    boolean selectionWindowOpen(Event event, Instant at) {
        Instant deadline = event.getBoothRequestDeadlineAt();
        return event.getStatus() == EventStatus.PUBLISHED
                && at.isBefore(event.getStartAt())
                && deadline != null
                && !at.isAfter(deadline);
    }

    private boolean boothAvailable(Event event, EventBoothConfig config) {
        Long boothId = config.getBooth().getBoothId();
        return config.isEnabled()
                && config.getBooth().getLocation().isActive()
                && !configRepository.existsCurrentOverlappingHoldForBooth(
                        boothId, event.getStartAt(), event.getEndAt())
                && !assignmentRepository.existsOverlappingActiveAssignment(
                        boothId, event.getStartAt(), event.getEndAt());
    }

    private boolean withinQuota(Event event, BoothRequest request) {
        Long applicationId = request.getApplication().getId();
        return requestRepository.countCurrentActiveHolds(applicationId)
                + assignmentRepository.countActiveByApplication(applicationId)
                < event.getMaxBoothsPerPartner();
    }

    private static boolean eligible(PartnerEventApplication application) {
        return application.getStatus() == PartnerEventApplication.ApplicationStatus.APPROVED
                && application.getPartnerOrganization().getStatus()
                == PartnerOrganization.OrganizationStatus.ACTIVE;
    }

    private static BoothApiException boothNotAvailable() {
        return new BoothApiException(HttpStatus.CONFLICT, "BOOTH_NOT_AVAILABLE",
                "The Booth is not available for selection.");
    }
}
