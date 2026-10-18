package com.swp391.bookstreet.activity.service;

import com.swp391.bookstreet.activity.dto.ActivityPageResponse;
import com.swp391.bookstreet.activity.dto.ActivityProposalResponse;
import com.swp391.bookstreet.activity.dto.ApproveActivityProposalResponse;
import com.swp391.bookstreet.activity.dto.ReviewActivityProposalRequest;
import com.swp391.bookstreet.activity.entity.ActivityProposalStatus;
import com.swp391.bookstreet.activity.exception.ActivityApiException;
import com.swp391.bookstreet.activity.repository.ActivityProposalRepository;
import com.swp391.bookstreet.activity.security.ActivityCurrentUser;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class OrganizerActivityProposalService {
    private final ActivityProposalRepository proposalRepository;
    private final ActivityCurrentUser currentUser;
    private final ActivityProposalLifecycleService proposalLifecycleService;
    private final ActivityProposalLifecycleTransactionService proposalLifecycleTransactions;
    private final OrganizerActivityProposalReviewTransactionService reviewTransactions;

    public OrganizerActivityProposalService(ActivityProposalRepository proposalRepository,
            ActivityCurrentUser currentUser,
            ActivityProposalLifecycleService proposalLifecycleService,
            ActivityProposalLifecycleTransactionService proposalLifecycleTransactions,
            OrganizerActivityProposalReviewTransactionService reviewTransactions) {
        this.proposalRepository = proposalRepository;
        this.currentUser = currentUser;
        this.proposalLifecycleService = proposalLifecycleService;
        this.proposalLifecycleTransactions = proposalLifecycleTransactions;
        this.reviewTransactions = reviewTransactions;
    }

    public ActivityPageResponse<ActivityProposalResponse> list(int page, int size, String sort,
            Long eventId, String status, Long locationId, String search) {
        Long organizerUserId = currentUser.requireOrganizerId();
        proposalLifecycleService.closeDueProposals();
        requirePositiveFilter(eventId, "eventId");
        requirePositiveFilter(locationId, "locationId");
        ActivityProposalStatus statusFilter = parseStatus(status);
        var result = proposalRepository.findOrganizerProposals(organizerUserId, eventId,
                statusFilter == null ? null : statusFilter.name(), locationId,
                normalizeSearch(search), ActivityPagination.proposals(page, size, sort));
        return new ActivityPageResponse<>(result.getContent().stream()
                .map(ActivityProposalResponse::from).toList(), result.getNumber(),
                result.getSize(), result.getTotalElements(), result.getTotalPages());
    }

    public ActivityProposalResponse detail(Long proposalId) {
        Long organizerUserId = currentUser.requireOrganizerId();
        proposalLifecycleTransactions.closeIfDueOwned(proposalId, organizerUserId);
        return ownedView(proposalId, organizerUserId);
    }

    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public ActivityProposalResponse requestChanges(Long proposalId,
            ReviewActivityProposalRequest request) {
        Long organizerUserId = currentUser.requireOrganizerId();
        closeDueOwned(proposalId, organizerUserId);
        return reviewTransactions.requestChanges(proposalId, organizerUserId, request);
    }

    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public ActivityProposalResponse reject(Long proposalId,
            ReviewActivityProposalRequest request) {
        Long organizerUserId = currentUser.requireOrganizerId();
        closeDueOwned(proposalId, organizerUserId);
        return reviewTransactions.reject(proposalId, organizerUserId, request);
    }

    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public ApproveActivityProposalResponse approve(Long proposalId) {
        Long organizerUserId = currentUser.requireOrganizerId();
        closeDueOwned(proposalId, organizerUserId);
        return reviewTransactions.approve(proposalId, organizerUserId);
    }

    private ActivityProposalResponse ownedView(Long proposalId, Long organizerUserId) {
        return proposalRepository.findOwnedOrganizerView(proposalId, organizerUserId)
                .map(ActivityProposalResponse::from)
                .orElseThrow(OrganizerActivityProposalService::notFound);
    }

    private void closeDueOwned(Long proposalId, Long organizerUserId) {
        proposalLifecycleTransactions.closeIfDueOwned(proposalId, organizerUserId);
    }

    private static void requirePositiveFilter(Long value, String field) {
        if (value != null && value <= 0) {
            throw new ActivityApiException(HttpStatus.BAD_REQUEST, "INVALID_FILTER",
                    field + " must be positive.");
        }
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

    private static String normalizeSearch(String search) {
        return search == null ? "" : search.trim();
    }

    private static ActivityApiException notFound() {
        return new ActivityApiException(HttpStatus.NOT_FOUND,
                "ACTIVITY_PROPOSAL_NOT_FOUND", "Activity Proposal not found.");
    }
}
