package com.swp391.bookstreet.attendance.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import org.hibernate.annotations.Immutable;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Immutable
@Table(name = "attendance_adjustments")
public class AttendanceAdjustment {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "attendance_adjustment_id")
    private Long attendanceAdjustmentId;
    @Column(name = "activity_registration_id", nullable = false, updatable = false)
    private Long activityRegistrationId;
    @Column(name = "actor_user_id", nullable = false, updatable = false)
    private Long actorUserId;
    @Column(name = "idempotency_key", nullable = false, updatable = false)
    private UUID idempotencyKey;
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "previous_state", nullable = false, columnDefinition = "jsonb", updatable = false)
    private Map<String, Object> previousState;
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "new_state", nullable = false, columnDefinition = "jsonb", updatable = false)
    private Map<String, Object> newState;
    @Column(name = "effective_attended_at", updatable = false)
    private Instant effectiveAttendedAt;
    @Column(nullable = false, length = 500, updatable = false)
    private String reason;
    @Column(name = "adjusted_at", nullable = false, updatable = false)
    private Instant adjustedAt;

    protected AttendanceAdjustment() {}

    public static AttendanceAdjustment create(Long registrationId, Long actorId, UUID key,
            Map<String, Object> before, Map<String, Object> after, Instant effectiveAt,
            String reason, Instant now) {
        AttendanceAdjustment adjustment = new AttendanceAdjustment();
        adjustment.activityRegistrationId = registrationId;
        adjustment.actorUserId = actorId;
        adjustment.idempotencyKey = key;
        adjustment.previousState = Collections.unmodifiableMap(new LinkedHashMap<>(before));
        adjustment.newState = Collections.unmodifiableMap(new LinkedHashMap<>(after));
        adjustment.effectiveAttendedAt = effectiveAt;
        adjustment.reason = reason;
        adjustment.adjustedAt = now;
        return adjustment;
    }

    public Long getAttendanceAdjustmentId() { return attendanceAdjustmentId; }
    public Long getActivityRegistrationId() { return activityRegistrationId; }
    public Long getActorUserId() { return actorUserId; }
    public UUID getIdempotencyKey() { return idempotencyKey; }
    public Map<String, Object> getPreviousState() { return previousState; }
    public Map<String, Object> getNewState() { return newState; }
    public Instant getEffectiveAttendedAt() { return effectiveAttendedAt; }
    public String getReason() { return reason; }
    public Instant getAdjustedAt() { return adjustedAt; }
}
