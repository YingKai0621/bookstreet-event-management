package com.swp391.bookstreet.reward.dto;

public record OrganizerBoothVisitSummaryResponse(
        Long eventId, long totalVisits, long uniqueParticipants, long visitedBoothAssignments) {
}
