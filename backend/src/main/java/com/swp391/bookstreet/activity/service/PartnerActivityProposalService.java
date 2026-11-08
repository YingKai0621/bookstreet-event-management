package com.swp391.bookstreet.activity.service;

import com.swp391.bookstreet.activity.dto.ActivityPageResponse;
import com.swp391.bookstreet.activity.dto.ActivityProposalResponse;
import com.swp391.bookstreet.activity.dto.CreateActivityProposalRequest;
import com.swp391.bookstreet.activity.dto.UpdateActivityProposalRequest;
import com.swp391.bookstreet.activity.entity.ActivityProposal;
import com.swp391.bookstreet.activity.entity.ActivityProposalStatus;
import com.swp391.bookstreet.activity.exception.ActivityApiException;
import com.swp391.bookstreet.activity.repository.ActivityProposalRepository;
import com.swp391.bookstreet.activity.repository.ActivityRepository;
import com.swp391.bookstreet.activity.security.ActivityCurrentUser;
import com.swp391.bookstreet.booth.entity.Location;
import com.swp391.bookstreet.booth.entity.LocationType;
import com.swp391.bookstreet.booth.repository.BoothAssignmentRepository;
import com.swp391.bookstreet.event.entity.Event;
import com.swp391.bookstreet.event.entity.EventStatus;
import com.swp391.bookstreet.notification.service.OrganizerWorkItemNotificationService;
import com.swp391.bookstreet.partner.entity.PartnerEventApplication;
import com.swp391.bookstreet.partner.repository.PartnerEventApplicationRepository;
import com.swp391.bookstreet.partner.service.PartnerOrganizationGuard;
import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class PartnerActivityProposalService {
    private final ActivityProposalRepository proposalRepository;
    private final ActivityRepository activityRepository;
    private final PartnerEventApplicationRepository applicationRepository;
    private final PartnerOrganizationGuard organizationGuard;
    private final BoothAssignmentRepository assignmentRepository;
    private final ActivityCurrentUser currentUser;
    private final ActivityLockService lockService;
    private final ActivityValidationService validation;
    private final ActivityProposalLifecycleService proposalLifecycleService;
    private final ActivityProposalLifecycleTransactionService proposalLifecycleTransactions;
    private final OrganizerWorkItemNotificationService organizerNotifications;
    private final Clock clock;

    public PartnerActivityProposalService(ActivityProposalRepository proposalRepository,
            ActivityRepository activityRepository,
            PartnerEventApplicationRepository applicationRepository,
            PartnerOrganizationGuard organizationGuard,
            BoothAssignmentRepository assignmentRepository,
            ActivityCurrentUser currentUser, ActivityLockService lockService,
            ActivityValidationService validation,
            ActivityProposalLifecycleService proposalLifecycleService,
            ActivityProposalLifecycleTransactionService proposalLifecycleTransactions,
            OrganizerWorkItemNotificationService organizerNotifications,
            Clock clock) {
        this.proposalRepository = proposalRepository;
        this.activityRepository = activityRepository;
        this.applicationRepository = applicationRepository;
        this.organizationGuard = organizationGuard;
        this.assignmentRepository = assignmentRepository;
        this.currentUser = currentUser;
        this.lockService = lockService;
        this.validation = validation;
        this.proposalLifecycleService = proposalLifecycleService;
        this.proposalLifecycleTransactions = proposalLifecycleTransactions;
        this.organizerNotifications = organizerNotifications;
        this.clock = clock;
    }

    @Transactional
    public ActivityProposalResponse submit(CreateActivityProposalRequest request) {
        Long representativeUserId = currentUser.requirePartnerId();
        if (request == null) {
            throw validation("Activity Proposal body is required.", null);
        }
        Long eventId = requiredId(request.eventId(), "eventId");
        Long locationId = requiredId(request.locationId(), "locationId");
        var locks = lockService.lockRoot(eventId, List.of(locationId));
        Event event = locks.event();
        Location location = locks.locations().getFirst();
        PartnerEventApplication application = applicationForEvent(eventId,
                representativeUserId);
        organizationGuard.requireActive(application.getPartnerOrganization());
        requireApproved(application);
        Instant now = now();

        requireInitialSubmissionWindow(event, now);
        requireQuota(event, application.getPartnerOrganization().getId());
        ValidatedActivityFields fields = validation.validateCore(event, location,
                request.title(), request.description(), request.activityType(),
                request.proposedStartAt(), request.proposedEndAt(), request.capacity(),
                null, true);
        requireEligibleLocation(eventId, location,
                application.getPartnerOrganization().getId());

        ActivityProposal proposal = ActivityProposal.submit(application.getId(), locationId,
                fields.title(), fields.description(), fields.activityType(), fields.startAt(),
                fields.endAt(), fields.capacity(), now);
        proposalRepository.saveAndFlush(proposal);
        organizerNotifications.activityProposalSubmitted(event, proposal, false);
        return ownedView(proposal.getActivityProposalId(), representativeUserId);
    }

    public ActivityPageResponse<ActivityProposalResponse> list(int page, int size, String sort,
            Long eventId, String status, String search) {
        Long representativeUserId = currentUser.requirePartnerId();
        proposalLifecycleService.closeDueProposals();
        if (eventId != null && eventId <= 0) {
            throw new ActivityApiException(HttpStatus.BAD_REQUEST, "INVALID_FILTER",
                    "eventId must be positive.");
        }
        ActivityProposalStatus statusFilter = parseStatus(status);
        String normalizedSearch = normalizeSearch(search);
        var result = proposalRepository.findPartnerProposals(representativeUserId, eventId,
                statusFilter == null ? null : statusFilter.name(), normalizedSearch,
                ActivityPagination.proposals(page, size, sort));
        return new ActivityPageResponse<>(result.getContent().stream()
                .map(ActivityProposalResponse::from).toList(), result.getNumber(),
                result.getSize(), result.getTotalElements(), result.getTotalPages());
    }

    public ActivityProposalResponse detail(Long proposalId) {
        Long representativeUserId = currentUser.requirePartnerId();
        proposalLifecycleTransactions.closeIfDue(proposalId);
        return ownedView(proposalId, representativeUserId);
    }

    @Transactional
    public ActivityProposalResponse update(Long proposalId,
            UpdateActivityProposalRequest request) {
        Long representativeUserId = currentUser.requirePartnerId();
        if (request == null || request.isEmpty()) {
            throw validation("At least one Proposal field is required.", null);
        }
        validateTimePair(request);
        proposalLifecycleTransactions.closeIfDue(proposalId);
        var ownedRoute = ownedRoute(proposalId, representativeUserId);
        List<Long> additionalLocations = request.contains("locationId")
                && request.getLocationId() != null
                ? List.of(requiredId(request.getLocationId(), "locationId")) : List.of();
        var locks = lockService.lockProposalRoot(proposalId, additionalLocations);
        ActivityProposal proposal = locks.proposal();
        requireSameApplication(proposal, ownedRoute.getApplicationId());
        PartnerEventApplication application = applicationById(proposal.getApplicationId(),
                representativeUserId);
        organizationGuard.requireActive(application.getPartnerOrganization());
        requireApproved(application);
        Instant now = now();
        requireEditableWindow(proposal, locks.event(), now);

        Long locationId = request.contains("locationId")
                ? requiredId(request.getLocationId(), "locationId") : proposal.getLocationId();
        Location location = locks.location(locationId);
        String title = request.contains("title") ? request.getTitle() : proposal.getTitle();
        String description = request.contains("description")
                ? request.getDescription() : proposal.getDescription();
        String activityType = request.contains("activityType")
                ? request.getActivityType() : proposal.getActivityType();
        Instant startAt = request.contains("proposedStartAt")
                ? request.getProposedStartAt() : proposal.getProposedStartAt();
        Instant endAt = request.contains("proposedEndAt")
                ? request.getProposedEndAt() : proposal.getProposedEndAt();
        Integer capacity = request.contains("capacity")
                ? request.getCapacity() : proposal.getCapacity();
        ValidatedActivityFields fields = validation.validateCore(locks.event(), location,
                title, description, activityType, startAt, endAt, capacity, null, true);
        requireQuota(locks.event(), application.getPartnerOrganization().getId());
        requireEligibleLocation(locks.event().getEventId(), location,
                application.getPartnerOrganization().getId());

        proposal.revise(locationId, fields.title(), fields.description(), fields.activityType(),
                fields.startAt(), fields.endAt(), fields.capacity(), now);
        proposalRepository.flush();
        return ownedView(proposalId, representativeUserId);
    }

    @Transactional
    public ActivityProposalResponse resubmit(Long proposalId) {
        Long representativeUserId = currentUser.requirePartnerId();
        proposalLifecycleTransactions.closeIfDue(proposalId);
        var ownedRoute = ownedRoute(proposalId, representativeUserId);
        var locks = lockService.lockProposalRoot(proposalId, List.of());
        ActivityProposal proposal = locks.proposal();
        requireSameApplication(proposal, ownedRoute.getApplicationId());
        PartnerEventApplication application = applicationById(proposal.getApplicationId(),
                representativeUserId);
        organizationGuard.requireActive(application.getPartnerOrganization());
        requireApproved(application);
        if (proposal.getStatus() != ActivityProposalStatus.NEED_CHANGES
                || (locks.event().getStatus() != EventStatus.PUBLISHED
                    && locks.event().getStatus() != EventStatus.ONGOING)) {
            throw notEditable();
        }
        Location location = locks.location(proposal.getLocationId());
        ValidatedActivityFields fields = validation.validateCore(locks.event(), location,
                proposal.getTitle(), proposal.getDescription(), proposal.getActivityType(),
                proposal.getProposedStartAt(), proposal.getProposedEndAt(),
                proposal.getCapacity(), null, true);
        requireQuota(locks.event(), application.getPartnerOrganization().getId());
        requireEligibleLocation(locks.event().getEventId(), location,
                application.getPartnerOrganization().getId());
        proposal.resubmit(now());
        proposalRepository.flush();
        organizerNotifications.activityProposalSubmitted(locks.event(), proposal, true);
        return ownedView(proposalId, representativeUserId);
    }

    @Transactional
    public ActivityProposalResponse withdraw(Long proposalId) {
        Long representativeUserId = currentUser.requirePartnerId();
        proposalLifecycleTransactions.closeIfDue(proposalId);
        var ownedRoute = ownedRoute(proposalId, representativeUserId);
        var locks = lockService.lockProposalRoot(proposalId, List.of());
        ActivityProposal proposal = locks.proposal();
        requireSameApplication(proposal, ownedRoute.getApplicationId());
        approvedApplicationById(proposal.getApplicationId(), representativeUserId);
        if (proposal.getStatus() != ActivityProposalStatus.PENDING
                && proposal.getStatus() != ActivityProposalStatus.NEED_CHANGES
                && proposal.getStatus() != ActivityProposalStatus.WITHDRAWN) {
            throw notEditable();
        }
        proposal.withdrawIfOpen(now());
        proposalRepository.flush();
        return ownedView(proposalId, representativeUserId);
    }

    private PartnerEventApplication approvedApplicationForEvent(Long eventId,
            Long representativeUserId) {
        return requireApproved(applicationForEvent(eventId, representativeUserId));
    }

    private PartnerEventApplication applicationForEvent(Long eventId,
            Long representativeUserId) {
        return applicationRepository
                .findByEventIdAndPartnerOrganization_RepresentativeUserId(
                        eventId, representativeUserId)
                .orElseThrow(() -> new ActivityApiException(HttpStatus.CONFLICT,
                        "PARTNER_APPLICATION_NOT_APPROVED",
                        "Partner application must be approved for this Event."));
    }

    private PartnerEventApplication approvedApplicationById(Long applicationId,
            Long representativeUserId) {
        return requireApproved(applicationById(applicationId, representativeUserId));
    }

    private PartnerEventApplication applicationById(Long applicationId,
            Long representativeUserId) {
        return applicationRepository
                .findByIdAndPartnerOrganization_RepresentativeUserId(
                        applicationId, representativeUserId)
                .orElseThrow(() -> new ActivityApiException(HttpStatus.CONFLICT,
                        "PARTNER_APPLICATION_NOT_APPROVED",
                        "Partner application must be approved for this Event."));
    }

    private static PartnerEventApplication requireApproved(
            PartnerEventApplication application) {
        if (application.getStatus() != PartnerEventApplication.ApplicationStatus.APPROVED) {
            throw new ActivityApiException(HttpStatus.CONFLICT,
                    "PARTNER_APPLICATION_NOT_APPROVED",
                    "Partner application must be approved for this Event.");
        }
        return application;
    }

    private void requireQuota(Event event, Long partnerOrganizationId) {
        Integer maximum = event.getMaxActivitiesPerPartner();
        long current = activityRepository.countOfficialPartnerActivities(
                event.getEventId(), partnerOrganizationId);
        if (maximum == null || maximum <= 0 || current >= maximum) {
            throw new ActivityApiException(HttpStatus.CONFLICT, "ACTIVITY_QUOTA_REACHED",
                    "Partner Activity quota has been reached for this Event.");
        }
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

    private static void requireInitialSubmissionWindow(Event event, Instant now) {
        if (event.getStatus() != EventStatus.PUBLISHED) {
            throw new ActivityApiException(HttpStatus.CONFLICT,
                    "EVENT_NOT_ACCEPTING_ACTIVITY_PROPOSALS",
                    "Event is not accepting Activity Proposals.");
        }
        Instant deadline = event.getActivityProposalDeadlineAt();
        if (deadline == null || now.isAfter(deadline)) {
            throw new ActivityApiException(HttpStatus.CONFLICT,
                    "ACTIVITY_PROPOSAL_DEADLINE_PASSED",
                    "Activity Proposal deadline has passed.");
        }
    }

    private ActivityProposalResponse ownedView(Long proposalId, Long representativeUserId) {
        return proposalRepository.findOwnedPartnerView(proposalId, representativeUserId)
                .map(ActivityProposalResponse::from)
                .orElseThrow(PartnerActivityProposalService::notFound);
    }

    private ActivityProposalRepository.ProposalRoute ownedRoute(Long proposalId,
            Long representativeUserId) {
        return proposalRepository.findOwnedRoute(proposalId, representativeUserId)
                .orElseThrow(PartnerActivityProposalService::notFound);
    }

    private static void requireSameApplication(ActivityProposal proposal,
            Long expectedApplicationId) {
        if (!proposal.getApplicationId().equals(expectedApplicationId)) throw notFound();
    }

    private static void requireEditableWindow(ActivityProposal proposal, Event event,
            Instant now) {
        if (proposal.getStatus() == ActivityProposalStatus.PENDING) {
            requireInitialSubmissionWindow(event, now);
            return;
        }
        if (proposal.getStatus() != ActivityProposalStatus.NEED_CHANGES
                || (event.getStatus() != EventStatus.PUBLISHED
                    && event.getStatus() != EventStatus.ONGOING)
                || !now.isBefore(proposal.getProposedStartAt())) {
            throw notEditable();
        }
    }

    private static void validateTimePair(UpdateActivityProposalRequest request) {
        if (request.contains("proposedStartAt") != request.contains("proposedEndAt")) {
            throw validation("proposedStartAt and proposedEndAt must be supplied together.",
                    "proposedStartAt");
        }
    }

    private Instant now() {
        return clock.instant().truncatedTo(ChronoUnit.MICROS);
    }

    private static Long requiredId(Long value, String field) {
        if (value == null || value <= 0) {
            throw new ActivityApiException(HttpStatus.UNPROCESSABLE_CONTENT,
                    "VALIDATION_FAILED", field + " must be positive.", field);
        }
        return value;
    }

    private static String normalizeSearch(String search) {
        return search == null ? "" : search.trim();
    }

    private static ActivityProposalStatus parseStatus(String status) {
        if (status == null || status.isBlank()) return null;
        try {
            return ActivityProposalStatus.valueOf(status);
        } catch (IllegalArgumentException error) {
            throw new ActivityApiException(HttpStatus.BAD_REQUEST, "INVALID_FILTER",
                    "status is not a supported Activity Proposal status.");
        }
    }

    private static ActivityApiException validation(String message, String field) {
        return new ActivityApiException(HttpStatus.UNPROCESSABLE_CONTENT,
                "VALIDATION_FAILED", message, field);
    }

    private static ActivityApiException notEditable() {
        return new ActivityApiException(HttpStatus.CONFLICT, "PROPOSAL_NOT_EDITABLE",
                "Activity Proposal is not editable in its current state.");
    }

    private static ActivityApiException notFound() {
        return new ActivityApiException(HttpStatus.NOT_FOUND,
                "ACTIVITY_PROPOSAL_NOT_FOUND", "Activity Proposal not found.");
    }
}
