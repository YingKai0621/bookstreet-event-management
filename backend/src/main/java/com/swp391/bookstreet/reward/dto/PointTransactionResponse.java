package com.swp391.bookstreet.reward.dto;

import java.time.Instant;

public record PointTransactionResponse(
        Long pointTransactionId,
        Long boothVisitId,
        Long boothAssignmentId,
        Integer points,
        Instant createdAt,
        Instant visitedAt,
        EventBriefResponse event,
        BoothBriefResponse booth) {
}
