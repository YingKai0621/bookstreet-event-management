package com.swp391.bookstreet.auth.service;

import com.swp391.bookstreet.auth.config.EmailVerificationMailProperties;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

@Service
public class EmailVerificationMailService {

    private static final String EMAIL_SUBJECT = "Verify your BookStreet email";

    private final JavaMailSender mailSender;
    private final EmailVerificationMailProperties mailProperties;

    public EmailVerificationMailService(
            JavaMailSender mailSender,
            EmailVerificationMailProperties mailProperties
    ) {
        this.mailSender = mailSender;
        this.mailProperties = mailProperties;
    }

    public void sendVerificationMessage(String recipientEmail, String rawToken) {
        String verificationLink = buildVerificationLink(rawToken);

        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(mailProperties.getFromAddress());
        message.setTo(recipientEmail);
        message.setSubject(EMAIL_SUBJECT);
        message.setText(buildEmailBody(verificationLink));

        mailSender.send(message);
    }

    private String buildVerificationLink(String rawToken) {
        String baseUrl = removeTrailingSlashes(mailProperties.getFrontendBaseUrl());
        String encodedToken = URLEncoder.encode(rawToken, StandardCharsets.UTF_8);

        return baseUrl + "/verify-email?token=" + encodedToken;
    }

    private String removeTrailingSlashes(String value) {
        String normalizedValue = value;

        while (normalizedValue.endsWith("/")) {
            normalizedValue = normalizedValue.substring(0, normalizedValue.length() - 1);
        }

        return normalizedValue;
    }

    private String buildEmailBody(String verificationLink) {
        return """
                Welcome to BookStreet.

                Verify your email by opening this link:
                %s

                This link expires in 60 minutes and can be used only once.
                If you did not create this account, you can ignore this email.
                """.formatted(verificationLink);
    }
}
