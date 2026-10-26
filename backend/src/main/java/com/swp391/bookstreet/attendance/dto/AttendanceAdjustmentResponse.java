package com.swp391.bookstreet.attendance.dto;

import com.swp391.bookstreet.attendance.entity.AttendanceAdjustment;
import java.time.Instant;
import java.util.UUID;

public record AttendanceAdjustmentResponse(Long attendanceAdjustmentId, Long activityRegistrationId,
        ParticipationPersonResponse actor, UUID idempotencyKey, AttendanceStateResponse previousState,
        AttendanceStateResponse newState, Instant effectiveAttendedAt, String reason, Instant adjustedAt) {
    public static AttendanceAdjustmentResponse from(AttendanceAdjustment a, String actorName) {
        return new AttendanceAdjustmentResponse(a.getAttendanceAdjustmentId(), a.getActivityRegistrationId(),
                new ParticipationPersonResponse(a.getActorUserId(), actorName), a.getIdempotencyKey(),
                AttendanceStateResponse.from(a.getPreviousState()), AttendanceStateResponse.from(a.getNewState()),
                a.getEffectiveAttendedAt(), a.getReason(), a.getAdjustedAt());
    }
}
