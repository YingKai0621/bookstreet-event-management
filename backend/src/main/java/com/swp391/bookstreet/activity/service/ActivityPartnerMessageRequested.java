package com.swp391.bookstreet.activity.service;

import java.time.Instant;
import java.util.List;
import java.util.Locale;

public record ActivityPartnerMessageRequested(
        Long referenceId,
        ActivityPartnerMessageType messageType,
        List<String> recipientEmails,
        String eventName,
        String activityTitle,
        String detail,
        Instant occurredAt
) {
    public ActivityPartnerMessageRequested {
        recipientEmails = recipientEmails == null
                ? List.of()
                : recipientEmails.stream()
                        .filter(email -> email != null && !email.isBlank())
                        .map(email -> email.trim().toLowerCase(Locale.ROOT))
                        .distinct()
                        .toList();
    }
}
