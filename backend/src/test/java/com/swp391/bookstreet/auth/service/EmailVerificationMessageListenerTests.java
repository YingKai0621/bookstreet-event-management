package com.swp391.bookstreet.auth.service;

import org.junit.jupiter.api.Test;
import org.springframework.mail.MailSendException;

import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

class EmailVerificationMessageListenerTests {

    @Test
    void successfulDeliveryDoesNotRevokeToken() {
        EmailVerificationMailService mailService = mock(EmailVerificationMailService.class);
        EmailVerificationTokenService tokenService = mock(EmailVerificationTokenService.class);
        EmailVerificationMessageListener listener =
                new EmailVerificationMessageListener(mailService, tokenService);
        EmailVerificationMessageRequested event = createEvent();

        listener.sendMessageAfterCommit(event);

        verify(mailService).sendVerificationMessage(
                "reader@example.com",
                "raw-token"
        );
        verify(tokenService, never()).revokeTokenAfterDeliveryFailure(12L);
    }

    @Test
    void failedDeliveryRevokesTokenWithoutRethrowingMailException() {
        EmailVerificationMailService mailService = mock(EmailVerificationMailService.class);
        EmailVerificationTokenService tokenService = mock(EmailVerificationTokenService.class);
        EmailVerificationMessageListener listener =
                new EmailVerificationMessageListener(mailService, tokenService);
        EmailVerificationMessageRequested event = createEvent();

        doThrow(new MailSendException("Simulated delivery failure"))
                .when(mailService)
                .sendVerificationMessage("reader@example.com", "raw-token");

        listener.sendMessageAfterCommit(event);

        verify(tokenService).revokeTokenAfterDeliveryFailure(12L);
    }

    private EmailVerificationMessageRequested createEvent() {
        return new EmailVerificationMessageRequested(
                7L,
                12L,
                "reader@example.com",
                "raw-token"
        );
    }
}
