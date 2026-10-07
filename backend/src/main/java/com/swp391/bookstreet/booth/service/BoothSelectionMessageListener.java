package com.swp391.bookstreet.booth.service;

import com.swp391.bookstreet.booth.config.BoothAsyncConfiguration;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
public class BoothSelectionMessageListener {
    private static final Logger LOGGER =
            LoggerFactory.getLogger(BoothSelectionMessageListener.class);

    private final BoothSelectionMailService mailService;

    public BoothSelectionMessageListener(BoothSelectionMailService mailService) {
        this.mailService = mailService;
    }

    @Async(BoothAsyncConfiguration.SELECTION_MAIL_EXECUTOR)
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void sendAfterCommit(BoothSelectionMessageRequested event) {
        if (event.recipientEmail() == null || event.recipientEmail().isBlank()) {
            LOGGER.warn("Selection email skipped because the verified recipient is missing "
                    + "for boothRequestId={}", event.boothRequestId());
            return;
        }
        try {
            mailService.sendSelectionMessage(
                    event.recipientEmail(),
                    event.eventName(),
                    event.boothCode(),
                    event.lockedRentalPrice(),
                    event.expiresAt()
            );
        } catch (RuntimeException error) {
            LOGGER.warn("Selection email delivery failed for boothRequestId={}",
                    event.boothRequestId(), error);
        }
    }
}
