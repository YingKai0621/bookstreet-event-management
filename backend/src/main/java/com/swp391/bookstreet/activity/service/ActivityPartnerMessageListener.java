package com.swp391.bookstreet.activity.service;

import com.swp391.bookstreet.activity.config.ActivityAsyncConfiguration;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
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

    @Async(ActivityAsyncConfiguration.PARTNER_MAIL_EXECUTOR)
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
