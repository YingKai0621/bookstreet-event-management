package com.swp391.bookstreet.auth.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.mail.MailException;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
public class EmailVerificationMessageListener {

    private static final Logger LOGGER =
            LoggerFactory.getLogger(EmailVerificationMessageListener.class);

    private final EmailVerificationMailService mailService;
    private final EmailVerificationTokenService tokenService;

    public EmailVerificationMessageListener(
            EmailVerificationMailService mailService,
            EmailVerificationTokenService tokenService
    ) {
        this.mailService = mailService;
        this.tokenService = tokenService;
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void sendMessageAfterCommit(EmailVerificationMessageRequested event) {
        try {
            mailService.sendVerificationMessage(
                    event.getRecipientEmail(),
                    event.getRawToken()
            );
        } catch (MailException exception) {
            tokenService.revokeTokenAfterDeliveryFailure(event.getTokenId());

            LOGGER.warn(
                    "Email verification delivery failed for userId={} and tokenId={}",
                    event.getUserId(),
                    event.getTokenId()
            );
        }
    }
}
