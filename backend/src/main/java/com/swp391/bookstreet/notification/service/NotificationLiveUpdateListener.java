package com.swp391.bookstreet.notification.service;

import com.swp391.bookstreet.notification.config.NotificationAsyncConfiguration;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
public class NotificationLiveUpdateListener {
    private final NotificationLiveUpdateHub hub;

    public NotificationLiveUpdateListener(NotificationLiveUpdateHub hub) {
        this.hub = hub;
    }

    // Runs only after commit and off the caller's thread, so a slow client cannot affect the transition.
    @Async(NotificationAsyncConfiguration.LIVE_UPDATE_EXECUTOR)
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void signalAfterCommit(NotificationCreated event) {
        hub.signal(event.recipientUserId(), event.recipientRole());
    }

    @Async(NotificationAsyncConfiguration.LIVE_UPDATE_EXECUTOR)
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void closeAfterCommit(NotificationStreamsRevoked event) {
        hub.close(event.userId(), event.role());
    }
}
