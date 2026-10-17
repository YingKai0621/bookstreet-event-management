package com.swp391.bookstreet.activity.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
public class ActivityPartnerMessageListener {
    private static final Logger LOGGER =
            LoggerFactory.getLogger(ActivityPartnerMessageListener.class);

    private final ActivityPartnerMailService mailService;

    public ActivityPartnerMessageListener(ActivityPartnerMailService mailService) {
        this.mailService = mailService;
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void sendAfterCommit(ActivityPartnerMessageRequested event) {
        if (event.recipientEmails().isEmpty()) {
            LOGGER.warn("Activity Partner email skipped because no verified recipient exists "
                    + "for messageType={} and referenceId={}", event.messageType(),
                    event.referenceId());
            return;
        }
        for (String recipientEmail : event.recipientEmails()) {
            try {
                mailService.sendMessage(recipientEmail, event);
            } catch (RuntimeException error) {
                LOGGER.warn("Activity Partner email delivery failed for messageType={}, "
                                + "referenceId={} and errorType={}", event.messageType(),
                        event.referenceId(), error.getClass().getSimpleName());
            }
        }
    }
}
