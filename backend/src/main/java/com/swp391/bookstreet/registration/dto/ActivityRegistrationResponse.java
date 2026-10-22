package com.swp391.bookstreet.registration.dto;

import com.swp391.bookstreet.registration.entity.ActivityRegistration;
import com.swp391.bookstreet.registration.entity.ParticipationOutcome;
import java.time.Instant;
import java.util.List;

public record ActivityRegistrationResponse(
        Long activityRegistrationId,
        Long eventRegistrationId,
        ActivityRegistrationActivityResponse activity,
        String status,
        String cancellationSource,
        String outcome,
        Instant registeredAt,
        Instant activatedAt,
        Instant cancelledAt,
        Instant noShowAt,
        Instant updatedAt,
        AttendanceSummaryResponse attendance,
        CertificateSummaryResponse certificate,
        ParticipantActivityRatingResponse rating,
        List<RegistrationWarningResponse> warnings) {
    public static ActivityRegistrationResponse from(ActivityRegistration registration,
            ActivityRegistrationActivityResponse activity, ParticipationOutcome outcome,
            AttendanceSummaryResponse attendance, CertificateSummaryResponse certificate,
            ParticipantActivityRatingResponse rating,
            List<RegistrationWarningResponse> warnings) {
        return new ActivityRegistrationResponse(registration.getActivityRegistrationId(),
                registration.getEventRegistrationId(), activity,
                registration.getStatus().name(),
                registration.getCancellationSource() == null ? null
                        : registration.getCancellationSource().name(),
                outcome.name(), registration.getRegisteredAt(), registration.getActivatedAt(),
                registration.getCancelledAt(), registration.getNoShowAt(),
                registration.getUpdatedAt(), attendance, certificate, rating,
                List.copyOf(warnings));
    }
}
