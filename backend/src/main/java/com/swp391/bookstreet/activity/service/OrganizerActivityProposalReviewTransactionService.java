package com.swp391.bookstreet.activity.service;

import com.swp391.bookstreet.activity.dto.ActivityProposalResponse;
import com.swp391.bookstreet.activity.dto.ActivityResponse;
import com.swp391.bookstreet.activity.dto.ApproveActivityProposalResponse;
import com.swp391.bookstreet.activity.dto.ReviewActivityProposalRequest;
import com.swp391.bookstreet.activity.entity.Activity;
import com.swp391.bookstreet.activity.entity.ActivityProposal;
import com.swp391.bookstreet.activity.entity.ActivityProposalStatus;
import com.swp391.bookstreet.activity.exception.ActivityApiException;
import com.swp391.bookstreet.activity.repository.ActivityProposalRepository;
import com.swp391.bookstreet.activity.repository.ActivityRepository;
import com.swp391.bookstreet.booth.entity.Location;
import com.swp391.bookstreet.booth.entity.LocationType;
import com.swp391.bookstreet.booth.repository.BoothAssignmentRepository;
import com.swp391.bookstreet.event.entity.Event;
import com.swp391.bookstreet.event.entity.EventStatus;
import com.swp391.bookstreet.partner.entity.PartnerEventApplication;
import com.swp391.bookstreet.partner.repository.PartnerEventApplicationRepository;
import com.swp391.bookstreet.partner.service.PartnerOrganizationGuard;
import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class OrganizerActivityProposalReviewTransactionService {
    private final ActivityProposalRepository proposalRepository;
    private final ActivityRepository activityRepository;
    private final PartnerEventApplicationRepository applicationRepository;
    private final PartnerOrganizationGuard organizationGuard;
    private final BoothAssignmentRepository assignmentRepository;
    private final ActivityLockService lockService;
    private final ActivityValidationService validation;
    private final ActivityScheduleGuard scheduleGuard;
    private final ActivityConstraintTranslator constraintTranslator;
    private final ActivityPartnerNotificationService notificationService;
    private final Clock clock;

    public OrganizerActivityProposalReviewTransactionService(
            ActivityProposalRepository proposalRepository,
            ActivityRepository activityRepository,
            PartnerEventApplicationRepository applicationRepository,
            PartnerOrganizationGuard organizationGuard,
            BoothAssignmentRepository assignmentRepository,
            ActivityLockService lockService, ActivityValidationService validation,
            ActivityScheduleGuard scheduleGuard,
            ActivityConstraintTranslator constraintTranslator,
            ActivityPartnerNotificationService notificationService, Clock clock) {
        this.proposalRepository = proposalRepository;
        this.activityRepository = activityRepository;
        this.applicationRepository = applicationRepository;
        this.organizationGuard = organizationGuard;
        this.assignmentRepository = assignmentRepository;
        this.lockService = lockService;
        this.validation = validation;
        this.scheduleGuard = scheduleGuard;
        this.constraintTranslator = constraintTranslator;
        this.notificationService = notificationService;
        this.clock = clock;
    }

    @Transactional
    public ActivityProposalResponse requestChanges(Long proposalId, Long organizerUserId,
            ReviewActivityProposalRequest request) {
        var locks = lockService.lockOwnedProposalRoot(proposalId, organizerUserId, List.of());
        requireActiveOrganization(locks.proposal());
        requireReviewable(locks.proposal().getStatus());
        String note = validation.reviewNote(request == null ? null : request.reviewNote());
        Instant now = now();
        locks.proposal().requestChanges(note, now);
        proposalRepository.flush();
        notificationService.proposalChanged(proposalId,
                ActivityPartnerMessageType.PROPOSAL_NEEDS_CHANGES, note, now);
        return ownedView(proposalId, organizerUserId);
    }

    @Transactional
    public ActivityProposalResponse reject(Long proposalId, Long organizerUserId,
            ReviewActivityProposalRequest request) {
        var locks = lockService.lockOwnedProposalRoot(proposalId, organizerUserId, List.of());
        requireReviewable(locks.proposal().getStatus());
        String note = validation.reviewNote(request == null ? null : request.reviewNote());
        Instant now = now();
        locks.proposal().reject(note, now);
        proposalRepository.flush();
        notificationService.proposalChanged(proposalId,
                ActivityPartnerMessageType.PROPOSAL_REJECTED, note, now);
        return ownedView(proposalId, organizerUserId);
    }

    @Transactional
    public ApproveActivityProposalResponse approve(Long proposalId, Long organizerUserId) {
        var locks = lockService.lockOwnedProposalRoot(proposalId, organizerUserId, List.of());
        ActivityProposal proposal = locks.proposal();
        if (proposal.getStatus() == ActivityProposalStatus.APPROVED) {
            Activity existing = activityRepository.findBySourceProposalId(proposalId)
                    .orElseThrow(OrganizerActivityProposalReviewTransactionService::notReviewable);
            return approvalResponse(proposalId, organizerUserId, existing,
                    locks.location(existing.getLocationId()), partnerOrganizationId(proposal));
        }
        requireActiveOrganization(proposal);
        requireReviewable(proposal.getStatus());

        Event event = locks.event();
        requireEventAccepting(event);
        PartnerEventApplication application = approvedApplication(proposal.getApplicationId(),
                event.getEventId());
        Long partnerOrganizationId = application.getPartnerOrganization().getId();
        Location location = locks.location(proposal.getLocationId());
        ValidatedActivityFields fields = validation.validateCore(event, location,
                proposal.getTitle(), proposal.getDescription(), proposal.getActivityType(),
                proposal.getProposedStartAt(), proposal.getProposedEndAt(),
                proposal.getCapacity(), null, true);
        requireQuota(event, partnerOrganizationId);
        requireEligibleLocation(event.getEventId(), location, partnerOrganizationId);
        scheduleGuard.requireAvailable(location.getLocationId(), fields.startAt(),
                fields.endAt(), null);

        Instant now = now();
        Activity activity = Activity.createFromProposal(event.getEventId(),
                location.getLocationId(), proposalId, fields, now);
        proposal.approve(now);
        try {
            activityRepository.saveAndFlush(activity);
            proposalRepository.flush();
        } catch (DataIntegrityViolationException error) {
            constraintTranslator.rethrow(error);
            throw error;
        }
        notificationService.proposalChanged(proposalId,
                ActivityPartnerMessageType.PROPOSAL_APPROVED,
                "A Draft Activity was created from the approved proposal.", now);
        return approvalResponse(proposalId, organizerUserId, activity, location,
                partnerOrganizationId);
    }

    private ActivityProposalResponse ownedView(Long proposalId, Long organizerUserId) {
        return proposalRepository.findOwnedOrganizerView(proposalId, organizerUserId)
                .map(ActivityProposalResponse::from)
                .orElseThrow(OrganizerActivityProposalReviewTransactionService::notFound);
    }

    private ApproveActivityProposalResponse approvalResponse(Long proposalId,
            Long organizerUserId, Activity activity, Location location,
            Long partnerOrganizationId) {
        return new ApproveActivityProposalResponse(ownedView(proposalId, organizerUserId),
                ActivityResponse.organizer(activity, location, partnerOrganizationId));
    }

    private PartnerEventApplication approvedApplication(Long applicationId, Long eventId) {
        PartnerEventApplication application = applicationRepository.findWithLockById(applicationId)
                .filter(value -> value.getEventId().equals(eventId))
                .orElseThrow(OrganizerActivityProposalReviewTransactionService::notFound);
        if (application.getStatus() != PartnerEventApplication.ApplicationStatus.APPROVED) {
            throw new ActivityApiException(HttpStatus.CONFLICT,
                    "PARTNER_APPLICATION_NOT_APPROVED",
                    "Partner application must be approved for this Event.");
        }
        return application;
    }

    private Long partnerOrganizationId(ActivityProposal proposal) {
        return applicationRepository.findById(proposal.getApplicationId())
                .map(value -> value.getPartnerOrganization().getId())
                .orElseThrow(OrganizerActivityProposalReviewTransactionService::notFound);
    }

    private void requireActiveOrganization(ActivityProposal proposal) {
        PartnerEventApplication application = applicationRepository
                .findById(proposal.getApplicationId())
                .orElseThrow(OrganizerActivityProposalReviewTransactionService::notFound);
        organizationGuard.requireActive(application.getPartnerOrganization());
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

    private static void requireEventAccepting(Event event) {
        if (event.getStatus() != EventStatus.PUBLISHED
                && event.getStatus() != EventStatus.ONGOING) {
            throw new ActivityApiException(HttpStatus.CONFLICT,
                    "EVENT_NOT_ACCEPTING_ACTIVITIES",
                    "Event is not accepting Activity changes.");
        }
    }

    private static void requireReviewable(ActivityProposalStatus status) {
        if (status != ActivityProposalStatus.PENDING) throw notReviewable();
    }

    private Instant now() {
        return clock.instant().truncatedTo(ChronoUnit.MICROS);
    }

    private static ActivityApiException notFound() {
        return new ActivityApiException(HttpStatus.NOT_FOUND,
                "ACTIVITY_PROPOSAL_NOT_FOUND", "Activity Proposal not found.");
    }

    private static ActivityApiException notReviewable() {
        return new ActivityApiException(HttpStatus.CONFLICT, "PROPOSAL_NOT_REVIEWABLE",
                "Activity Proposal is not reviewable in its current state.");
    }
}
