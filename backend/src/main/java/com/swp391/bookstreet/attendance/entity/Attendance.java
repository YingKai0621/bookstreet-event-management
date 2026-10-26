package com.swp391.bookstreet.attendance.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "attendances")
public class Attendance {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "attendance_id")
    private Long attendanceId;

    @Column(name = "activity_registration_id", nullable = false, updatable = false)
    private Long activityRegistrationId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private AttendanceStatus status;

    @Enumerated(EnumType.STRING)
    @Column(name = "recorded_source", nullable = false, length = 30)
    private AttendanceRecordedSource recordedSource;

    @Column(name = "attended_at", nullable = false)
    private Instant attendedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "voided_at")
    private Instant voidedAt;

    protected Attendance() {
    }

    public static Attendance record(Long registrationId, AttendanceRecordedSource source,
            Instant attendedAt, Instant now) {
        Attendance attendance = new Attendance();
        attendance.activityRegistrationId = java.util.Objects.requireNonNull(registrationId);
        attendance.recordedSource = java.util.Objects.requireNonNull(source);
        attendance.attendedAt = java.util.Objects.requireNonNull(attendedAt);
        attendance.status = AttendanceStatus.VALID;
        attendance.createdAt = java.util.Objects.requireNonNull(now);
        attendance.updatedAt = now;
        return attendance;
    }

    public void correct(AttendanceStatus target, Instant effectiveAttendedAt, Instant now) {
        status = java.util.Objects.requireNonNull(target);
        if (target == AttendanceStatus.VALID) {
            attendedAt = java.util.Objects.requireNonNull(effectiveAttendedAt);
            voidedAt = null;
        } else {
            voidedAt = now;
        }
        updatedAt = now;
    }

    public Long getAttendanceId() { return attendanceId; }
    public Long getActivityRegistrationId() { return activityRegistrationId; }
    public AttendanceStatus getStatus() { return status; }
    public AttendanceRecordedSource getRecordedSource() { return recordedSource; }
    public Instant getAttendedAt() { return attendedAt; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public Instant getVoidedAt() { return voidedAt; }
}
