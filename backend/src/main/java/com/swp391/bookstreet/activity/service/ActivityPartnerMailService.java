package com.swp391.bookstreet.activity.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Service
public class ActivityPartnerMailService {
    private static final String SUBJECT_PREFIX = "BookStreet Activity: ";

    private final JavaMailSender mailSender;
    private final String fromAddress;

    public ActivityPartnerMailService(JavaMailSender mailSender,
            @Value("${bookstreet.email-verification.from-address}") String fromAddress) {
        this.mailSender = mailSender;
        this.fromAddress = fromAddress;
    }

    public void sendMessage(String recipientEmail, ActivityPartnerMessageRequested event) {
        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(fromAddress);
        message.setTo(recipientEmail);
        message.setSubject(SUBJECT_PREFIX + event.messageType().summary());
        message.setText("""
                A BookStreet Activity update is available.

                Event: %s
                Activity: %s
                Update: %s
                Time: %s
                Details: %s

                Sign in to BookStreet to review the latest committed information.
                """.formatted(event.eventName(), event.activityTitle(),
                event.messageType().summary(), event.occurredAt(),
                event.detail() == null || event.detail().isBlank() ? "-" : event.detail()));
        mailSender.send(message);
    }
}
