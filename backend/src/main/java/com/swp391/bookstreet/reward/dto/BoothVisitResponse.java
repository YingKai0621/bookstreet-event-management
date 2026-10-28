package com.swp391.bookstreet.reward.dto;

import java.time.Instant;

public record BoothVisitResponse(
        Long boothVisitId,
        Long eventRegistrationId,
        Long boothAssignmentId,
        EventBriefResponse event,
        BoothBriefResponse booth,
        Instant visitedAt) {
}
