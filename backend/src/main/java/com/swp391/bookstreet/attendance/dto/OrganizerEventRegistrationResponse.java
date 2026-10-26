package com.swp391.bookstreet.attendance.dto;

import java.time.Instant;

public record OrganizerEventRegistrationResponse(Long eventRegistrationId, Long eventId,
        ParticipationPersonResponse participant, String status, Instant registeredAt, Instant activatedAt,
        Instant leftAt, Instant updatedAt, long seatActiveActivityCount, long activityRegistrationCount,
        long attendedActivityCount, long noShowActivityCount) {}
