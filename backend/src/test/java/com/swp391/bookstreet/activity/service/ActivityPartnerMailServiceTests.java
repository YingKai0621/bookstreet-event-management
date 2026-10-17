package com.swp391.bookstreet.activity.service;

import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

class ActivityPartnerMailServiceTests {

    @Test
    void buildsEmailOnlyFromCommittedEventData() {
        JavaMailSender mailSender = mock(JavaMailSender.class);
        ActivityPartnerMailService service =
                new ActivityPartnerMailService(mailSender, "no-reply@bookstreet.local");
        Instant occurredAt = Instant.parse("2026-10-17T04:00:00Z");
        var event = new ActivityPartnerMessageRequested(42L,
                ActivityPartnerMessageType.PROPOSAL_NEEDS_CHANGES,
                List.of("partner@example.com"), "BookStreet Festival", "Author Talk",
                "Please clarify the schedule.", occurredAt);

        service.sendMessage("partner@example.com", event);

        ArgumentCaptor<SimpleMailMessage> captor =
                ArgumentCaptor.forClass(SimpleMailMessage.class);
        verify(mailSender).send(captor.capture());
        SimpleMailMessage message = captor.getValue();
        assertThat(message.getFrom()).isEqualTo("no-reply@bookstreet.local");
        assertThat(message.getTo()).containsExactly("partner@example.com");
        assertThat(message.getSubject()).contains("needs changes");
        assertThat(message.getText())
                .contains("BookStreet Festival")
                .contains("Author Talk")
                .contains("Please clarify the schedule.")
                .contains(occurredAt.toString());
    }
}
