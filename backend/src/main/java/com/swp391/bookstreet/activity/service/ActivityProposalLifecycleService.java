package com.swp391.bookstreet.activity.service;

import com.swp391.bookstreet.activity.repository.ActivityProposalRepository;
import java.time.Clock;
import org.springframework.stereotype.Service;

@Service
public class ActivityProposalLifecycleService {
    private final ActivityProposalRepository proposalRepository;
    private final ActivityProposalLifecycleTransactionService transactions;
    private final Clock clock;

    public ActivityProposalLifecycleService(ActivityProposalRepository proposalRepository,
            ActivityProposalLifecycleTransactionService transactions, Clock clock) {
        this.proposalRepository = proposalRepository;
        this.transactions = transactions;
        this.clock = clock;
    }

    public int closeDueProposals() {
        int closed = 0;
        for (Long proposalId : proposalRepository.findDueOpenProposalIds(clock.instant())) {
            if (transactions.closeIfDue(proposalId)) closed++;
        }
        return closed;
    }
}
