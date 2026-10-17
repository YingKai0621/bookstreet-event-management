package com.swp391.bookstreet.activity.service;

import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.mail.MailSendException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

class ActivityPartnerMessageListenerTests {

    @Test
    void messageNormalizesAndDeduplicatesRecipientsCaseInsensitively() {
        var event = message(List.of(" Partner@Example.com ", "partner@example.com",
                "OTHER@example.com"));

        assertThat(event.recipientEmails())
                .containsExactly("partner@example.com", "other@example.com");
    }

    @Test
    void oneDeliveryFailureDoesNotSkipRemainingRecipients() {
        ActivityPartnerMailService mailService = mock(ActivityPartnerMailService.class);
        ActivityPartnerMessageListener listener =
                new ActivityPartnerMessageListener(mailService);
        var event = message(List.of("first@example.com", "second@example.com"));
        doThrow(new MailSendException("Simulated delivery failure"))
                .when(mailService).sendMessage("first@example.com", event);

        listener.sendAfterCommit(event);

        verify(mailService).sendMessage("first@example.com", event);
        verify(mailService).sendMessage("second@example.com", event);
    }

    @Test
    void missingVerifiedRecipientSkipsDelivery() {
        ActivityPartnerMailService mailService = mock(ActivityPartnerMailService.class);
        ActivityPartnerMessageListener listener =
                new ActivityPartnerMessageListener(mailService);

        listener.sendAfterCommit(message(List.of()));

        verifyNoInteractions(mailService);
    }

    private static ActivityPartnerMessageRequested message(List<String> recipients) {
        return new ActivityPartnerMessageRequested(42L,
                ActivityPartnerMessageType.PROPOSAL_APPROVED, recipients,
                "BookStreet Festival", "Author Talk", "Approved by the Organizer.",
                Instant.parse("2026-10-17T04:00:00Z"));
    }
}
