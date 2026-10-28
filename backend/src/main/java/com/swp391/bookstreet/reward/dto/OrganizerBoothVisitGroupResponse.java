package com.swp391.bookstreet.reward.dto;

import com.swp391.bookstreet.booth.entity.BoothAssignmentStatus;
import java.time.Instant;

public record OrganizerBoothVisitGroupResponse(
        Long boothAssignmentId, BoothBriefResponse booth, BoothAssignmentStatus assignmentStatus,
        long visitCount, Instant lastVisitedAt) {
}
