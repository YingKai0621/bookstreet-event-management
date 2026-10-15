package com.swp391.bookstreet.event.service;

import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

class EventCancellationMailServiceTests {

    @Test
    void buildsCancellationEmailFromCommittedEventData() {
        JavaMailSender mailSender = mock(JavaMailSender.class);
        EventCancellationMailService service =
                new EventCancellationMailService(mailSender, "no-reply@bookstreet.local");
        Instant cancelledAt = Instant.parse("2026-10-11T10:00:00Z");

        service.sendCancellationMessage(
                "partner@example.com",
                "BookStreet Festival",
                cancelledAt,
                "Venue is no longer available.");

        ArgumentCaptor<SimpleMailMessage> messageCaptor =
                ArgumentCaptor.forClass(SimpleMailMessage.class);
        verify(mailSender).send(messageCaptor.capture());
        SimpleMailMessage message = messageCaptor.getValue();
        assertThat(message.getFrom()).isEqualTo("no-reply@bookstreet.local");
        assertThat(message.getTo()).containsExactly("partner@example.com");
        assertThat(message.getSubject()).isEqualTo(
                "A BookStreet Event has been cancelled");
        assertThat(message.getText())
                .contains("BookStreet Festival")
                .contains(cancelledAt.toString())
                .contains("Venue is no longer available.");
    }
}
