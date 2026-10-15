package com.swp391.bookstreet.event.service;

import java.time.Instant;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Service
public class EventCancellationMailService {
    private static final String SUBJECT = "A BookStreet Event has been cancelled";

    private final JavaMailSender mailSender;
    private final String fromAddress;

    public EventCancellationMailService(JavaMailSender mailSender,
            @Value("${bookstreet.email-verification.from-address}") String fromAddress) {
        this.mailSender = mailSender;
        this.fromAddress = fromAddress;
    }

    public void sendCancellationMessage(String recipientEmail, String eventName,
            Instant cancelledAt, String cancellationReason) {
        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(fromAddress);
        message.setTo(recipientEmail);
        message.setSubject(SUBJECT);
        message.setText("""
                The following BookStreet Event has been cancelled.

                Event: %s
                Cancelled at: %s
                Reason: %s

                Your Partner application and related Booth activity for this Event are no longer actionable.
                """.formatted(eventName, cancelledAt, cancellationReason));
        mailSender.send(message);
    }
}
