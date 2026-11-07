package com.swp391.bookstreet.reward.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.core.task.TaskExecutor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Service
public class BadgeSynchronizationProcessor {
    private static final Logger log = LoggerFactory.getLogger(BadgeSynchronizationProcessor.class);
    private final BadgeSynchronizationBatchService batches;
    private final TaskExecutor executor;

    public BadgeSynchronizationProcessor(BadgeSynchronizationBatchService batches,
            @Qualifier("badgeSynchronizationExecutor") TaskExecutor executor) {
        this.batches = batches;
        this.executor = executor;
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void afterBadgeCommit(BadgeSynchronizationRequested event) { schedule(event.badgeId()); }

    public void schedule(Long badgeId) {
        try { executor.execute(() -> run(badgeId)); }
        catch (RuntimeException error) {
            // The mutation has committed. The derived remaining count exposes work for explicit retry.
            log.warn("Badge synchronization could not be scheduled for badgeId={}; Admin may retry.", badgeId);
        }
    }

    private void run(Long badgeId) {
        try {
            do {
                batches.process(badgeId);
            } while (!Thread.currentThread().isInterrupted() && batches.remaining(badgeId) > 0);
        } catch (RuntimeException error) {
            // Do not include SQL details, user context or Notification payloads in background logs.
            log.warn("Badge synchronization stopped for badgeId={}; Admin may resume. failureType={}",
                    badgeId, error.getClass().getSimpleName());
        }
    }
}
