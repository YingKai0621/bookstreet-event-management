package com.swp391.bookstreet.auth.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.mail.MailException;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
public class PasswordResetMessageListener {
    private static final Logger LOGGER = LoggerFactory.getLogger(PasswordResetMessageListener.class);

    private final PasswordResetMailService mailService;
    private final PasswordResetService resetService;

    public PasswordResetMessageListener(PasswordResetMailService mailService, PasswordResetService resetService) {
        this.mailService = mailService;
        this.resetService = resetService;
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void sendAfterCommit(PasswordResetMessageRequested event) {
        try {
            mailService.sendResetMessage(event.recipientEmail(), event.rawToken());
        } catch (MailException exception) {
            // A link nobody received must not stay usable. The response to the User stays neutral.
            resetService.revokeAfterDeliveryFailure(event.tokenId());
            LOGGER.warn("Password reset delivery failed for userId={} and tokenId={}", event.userId(), event.tokenId());
        }
    }
}
