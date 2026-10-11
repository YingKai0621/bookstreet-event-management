package com.swp391.bookstreet.event.service;

import java.time.Instant;
import java.util.List;
import java.util.Locale;

public record EventCancellationMessageRequested(
        Long eventId,
        String eventName,
        Instant cancelledAt,
        String cancellationReason,
        List<String> recipientEmails
) {
    public EventCancellationMessageRequested {
        recipientEmails = recipientEmails == null
                ? List.of()
                : recipientEmails.stream()
                        .filter(email -> email != null && !email.isBlank())
                        .map(email -> email.trim().toLowerCase(Locale.ROOT))
                        .distinct()
                        .toList();
    }
}
