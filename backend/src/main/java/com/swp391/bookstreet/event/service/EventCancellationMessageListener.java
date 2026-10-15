package com.swp391.bookstreet.event.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
public class EventCancellationMessageListener {
    private static final Logger LOGGER =
            LoggerFactory.getLogger(EventCancellationMessageListener.class);

    private final EventCancellationMailService mailService;

    public EventCancellationMessageListener(EventCancellationMailService mailService) {
        this.mailService = mailService;
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void sendAfterCommit(EventCancellationMessageRequested event) {
        for (String recipientEmail : event.recipientEmails()) {
            try {
                mailService.sendCancellationMessage(
                        recipientEmail,
                        event.eventName(),
                        event.cancelledAt(),
                        event.cancellationReason());
            } catch (RuntimeException error) {
                LOGGER.warn(
                        "Event cancellation email delivery failed for eventId={} and errorType={}",
                        event.eventId(), error.getClass().getSimpleName());
            }
        }
    }
}
