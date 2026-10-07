package com.swp391.bookstreet.booth.service;

import java.math.BigDecimal;
import java.time.Instant;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Service
public class BoothSelectionMailService {
    private static final String SUBJECT = "Your BookStreet Booth request was selected";

    private final JavaMailSender mailSender;
    private final String fromAddress;

    public BoothSelectionMailService(JavaMailSender mailSender,
            @Value("${bookstreet.email-verification.from-address}") String fromAddress) {
        this.mailSender = mailSender;
        this.fromAddress = fromAddress;
    }

    public void sendSelectionMessage(String recipientEmail, String eventName, String boothCode,
            BigDecimal lockedRentalPrice, Instant expiresAt) {
        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(fromAddress);
        message.setTo(recipientEmail);
        message.setSubject(SUBJECT);
        message.setText("""
                Your Booth request has been selected.

                Event: %s
                Booth: %s
                Locked rental price: %s
                Hold expires at: %s

                Payment will be available in a later Sprint.
                """.formatted(eventName, boothCode, lockedRentalPrice.toPlainString(), expiresAt));
        mailSender.send(message);
    }
}
