package com.swp391.bookstreet.activity.service;

import com.swp391.bookstreet.activity.entity.ActivityProposalStatus;
import com.swp391.bookstreet.activity.repository.ActivityProposalRepository;
import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ActivityProposalLifecycleTransactionService {
    private final ActivityProposalRepository proposalRepository;
    private final ActivityLockService lockService;
    private final ActivityPartnerNotificationService notificationService;
    private final Clock clock;

    public ActivityProposalLifecycleTransactionService(
            ActivityProposalRepository proposalRepository,
            ActivityLockService lockService,
            ActivityPartnerNotificationService notificationService, Clock clock) {
        this.proposalRepository = proposalRepository;
        this.lockService = lockService;
        this.notificationService = notificationService;
        this.clock = clock;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public boolean closeIfDue(Long proposalId) {
        if (proposalRepository.findRouteById(proposalId).isEmpty()) return false;
        var proposal = lockService.lockProposalRoot(proposalId, java.util.List.of()).proposal();
        return closeLocked(proposalId, proposal);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public boolean closeIfDueOwned(Long proposalId, Long organizerUserId) {
        var proposal = lockService.lockOwnedProposalRoot(proposalId, organizerUserId,
                java.util.List.of()).proposal();
        return closeLocked(proposalId, proposal);
    }

    private boolean closeLocked(Long proposalId,
            com.swp391.bookstreet.activity.entity.ActivityProposal proposal) {
        Instant now = clock.instant().truncatedTo(ChronoUnit.MICROS);
        if ((proposal.getStatus() != ActivityProposalStatus.PENDING
                && proposal.getStatus() != ActivityProposalStatus.NEED_CHANGES)
                || proposal.getProposedStartAt().isAfter(now)) {
            return false;
        }
        boolean changed = proposal.cancelIfOpen(now);
        if (changed) {
            notificationService.proposalChanged(proposalId,
                    ActivityPartnerMessageType.PROPOSAL_CLOSED_BY_SYSTEM,
                    "The proposal was closed because its proposed start time was reached.", now);
        }
        return changed;
    }
}
