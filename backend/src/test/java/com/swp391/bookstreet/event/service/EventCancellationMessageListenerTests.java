package com.swp391.bookstreet.event.service;

import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.mail.MailSendException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

class EventCancellationMessageListenerTests {

    @Test
    void messageNormalizesAndDeduplicatesRecipientEmailsCaseInsensitively() {
        var message = new EventCancellationMessageRequested(
                7L,
                "BookStreet Festival",
                Instant.parse("2026-10-11T10:00:00Z"),
                "Venue is no longer available.",
                List.of(" Partner@Example.com ", "partner@example.com", "OTHER@example.com"));

        assertThat(message.recipientEmails())
                .containsExactly("partner@example.com", "other@example.com");
    }

    @Test
    void oneDeliveryFailureDoesNotSkipRemainingRecipients() {
        EventCancellationMailService mailService = mock(EventCancellationMailService.class);
        EventCancellationMessageListener listener =
                new EventCancellationMessageListener(mailService);
        Instant cancelledAt = Instant.parse("2026-10-11T10:00:00Z");
        var message = new EventCancellationMessageRequested(
                7L,
                "BookStreet Festival",
                cancelledAt,
                "Venue is no longer available.",
                List.of("first@example.com", "second@example.com"));

        doThrow(new MailSendException("Simulated delivery failure"))
                .when(mailService).sendCancellationMessage(
                        "first@example.com", "BookStreet Festival", cancelledAt,
                        "Venue is no longer available.");

        listener.sendAfterCommit(message);

        verify(mailService).sendCancellationMessage(
                "first@example.com", "BookStreet Festival", cancelledAt,
                "Venue is no longer available.");
        verify(mailService).sendCancellationMessage(
                "second@example.com", "BookStreet Festival", cancelledAt,
                "Venue is no longer available.");
    }
}
