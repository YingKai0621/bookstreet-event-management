package com.swp391.bookstreet.auth.service;

import com.swp391.bookstreet.common.exception.ApiException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.mail.MailSendException;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.fail;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class EmailVerificationResendServiceTests {

    private static final Long USER_ID = 42L;
    private static final Long TOKEN_ID = 91L;
    private static final String EMAIL = "reader@example.com";
    private static final String RAW_TOKEN = "raw-email-verification-token";

    private EmailVerificationTokenService tokenService;
    private EmailVerificationMailService mailService;
    private EmailVerificationResendService resendService;

    @BeforeEach
    void setUp() {
        tokenService = mock(EmailVerificationTokenService.class);
        mailService = mock(EmailVerificationMailService.class);
        resendService = new EmailVerificationResendService(tokenService, mailService);
    }

    @Test
    void sendsPreparedVerificationMessage() {
        EmailVerificationMessageRequested message = createMessage();
        when(tokenService.prepareResend(USER_ID)).thenReturn(Optional.of(message));

        resendService.resend(USER_ID);

        verify(mailService).sendVerificationMessage(EMAIL, RAW_TOKEN);
        verify(tokenService, never()).revokeTokenAfterDeliveryFailure(TOKEN_ID);
    }

    @Test
    void alreadyVerifiedUserDoesNotReceiveMessage() {
        when(tokenService.prepareResend(USER_ID)).thenReturn(Optional.empty());

        resendService.resend(USER_ID);

        verify(mailService, never()).sendVerificationMessage(EMAIL, RAW_TOKEN);
    }

    @Test
    void deliveryFailureRevokesTokenAndReturnsServiceUnavailable() {
        EmailVerificationMessageRequested message = createMessage();
        when(tokenService.prepareResend(USER_ID)).thenReturn(Optional.of(message));
        doThrow(new MailSendException("Simulated delivery failure"))
                .when(mailService)
                .sendVerificationMessage(EMAIL, RAW_TOKEN);

        ApiException exception;

        try {
            resendService.resend(USER_ID);
            fail("Expected resend delivery failure.");
            return;
        } catch (ApiException caughtException) {
            exception = caughtException;
        }

        assertThat(exception.getStatus()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
        assertThat(exception.getCode()).isEqualTo("EMAIL_DELIVERY_UNAVAILABLE");
        verify(tokenService).revokeTokenAfterDeliveryFailure(TOKEN_ID);
    }

    private EmailVerificationMessageRequested createMessage() {
        return new EmailVerificationMessageRequested(
                USER_ID,
                TOKEN_ID,
                EMAIL,
                RAW_TOKEN
        );
    }
}
