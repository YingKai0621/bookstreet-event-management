package com.swp391.bookstreet.attendance.dto;

import com.swp391.bookstreet.registration.dto.AttendanceSummaryResponse;
import com.swp391.bookstreet.registration.dto.CertificateSummaryResponse;
import java.time.Instant;

public record OrganizerParticipationResponse(Long activityRegistrationId, Long eventRegistrationId,
        Long eventId, Long activityId, ParticipationPersonResponse participant,
        String registrationStatus, String cancellationSource, String outcome, Instant registeredAt,
        Instant activatedAt, Instant cancelledAt, Instant noShowAt, AttendanceSummaryResponse attendance,
        CertificateSummaryResponse certificate, String ratingStatus, Instant latestAdjustmentAt) {}
