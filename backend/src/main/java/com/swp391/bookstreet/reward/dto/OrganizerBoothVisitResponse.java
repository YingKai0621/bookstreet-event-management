package com.swp391.bookstreet.reward.dto;

import com.swp391.bookstreet.booth.entity.BoothAssignmentStatus;
import com.swp391.bookstreet.attendance.dto.ParticipationPersonResponse;
import java.time.Instant;

public record OrganizerBoothVisitResponse(
        Long boothVisitId, Long eventRegistrationId, Instant visitedAt,
        ParticipationPersonResponse participant, Long boothAssignmentId,
        BoothBriefResponse booth, BoothAssignmentStatus assignmentStatus) {
}
