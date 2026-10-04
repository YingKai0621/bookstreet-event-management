package com.swp391.bookstreet.auth.service;

import com.swp391.bookstreet.common.exception.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.mail.MailException;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
public class EmailVerificationResendService {

    private final EmailVerificationTokenService tokenService;
    private final EmailVerificationMailService mailService;

    public EmailVerificationResendService(
            EmailVerificationTokenService tokenService,
            EmailVerificationMailService mailService
    ) {
        this.tokenService = tokenService;
        this.mailService = mailService;
    }

    public void resend(Long userId) {
        Optional<EmailVerificationMessageRequested> messageResult =
                tokenService.prepareResend(userId);

        if (messageResult.isEmpty()) {
            return;
        }

        EmailVerificationMessageRequested message = messageResult.get();

        try {
            mailService.sendVerificationMessage(
                    message.getRecipientEmail(),
                    message.getRawToken()
            );
        } catch (MailException exception) {
            tokenService.revokeTokenAfterDeliveryFailure(message.getTokenId());
            throw deliveryUnavailable();
        }
    }

    private ApiException deliveryUnavailable() {
        return new ApiException(
                HttpStatus.SERVICE_UNAVAILABLE,
                "EMAIL_DELIVERY_UNAVAILABLE",
                "The verification email could not be sent. Please try again later."
        );
    }
}
