package com.swp391.bookstreet.attendance.service;

import com.swp391.bookstreet.activity.entity.Activity;
import com.swp391.bookstreet.activity.entity.ActivityStatus;
import com.swp391.bookstreet.activity.exception.ActivityApiException;
import com.swp391.bookstreet.activity.security.ActivityCurrentUser;
import com.swp391.bookstreet.activity.service.ActivityLockService;
import com.swp391.bookstreet.activity.service.ActivityLifecycleCoordinator;
import com.swp391.bookstreet.attendance.dto.*;
import com.swp391.bookstreet.attendance.entity.*;
import com.swp391.bookstreet.attendance.repository.*;
import com.swp391.bookstreet.auth.repository.UserRepository;
import com.swp391.bookstreet.certificate.service.ParticipationDownstreamCascade;
import com.swp391.bookstreet.certificate.service.ParticipationDownstreamCommand;
import com.swp391.bookstreet.event.entity.EventStatus;
import com.swp391.bookstreet.registration.entity.*;
import com.swp391.bookstreet.registration.repository.*;
import jakarta.persistence.EntityManager;
import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class OrganizerAttendanceCorrectionService {
    private final ActivityCurrentUser currentUser;
    private final OrganizerParticipationQueryRepository queries;
    private final ActivityLockService locks;
    private final ActivityLifecycleCoordinator lifecycle;
    private final EventRegistrationRepository events;
    private final ActivityRegistrationRepository registrations;
    private final AttendanceRepository attendances;
    private final AttendanceAdjustmentRepository adjustments;
    private final ParticipationDownstreamCascade downstream;
    private final UserRepository users;
    private final JdbcTemplate jdbc;
    private final EntityManager entityManager;
    private final Clock clock;

    public OrganizerAttendanceCorrectionService(ActivityCurrentUser currentUser,
            OrganizerParticipationQueryRepository queries, ActivityLockService locks,
            ActivityLifecycleCoordinator lifecycle, EventRegistrationRepository events,
            ActivityRegistrationRepository registrations, AttendanceRepository attendances,
            AttendanceAdjustmentRepository adjustments, ParticipationDownstreamCascade downstream,
            UserRepository users, JdbcTemplate jdbc, EntityManager entityManager, Clock clock) {
        this.currentUser = currentUser; this.queries = queries; this.locks = locks;
        this.lifecycle = lifecycle; this.events = events; this.registrations = registrations;
        this.attendances = attendances; this.adjustments = adjustments; this.downstream = downstream;
        this.users = users; this.jdbc = jdbc; this.entityManager = entityManager; this.clock = clock;
    }

    @Transactional
    public AttendanceCorrectionResponse correct(Long registrationId, String rawKey, AttendanceCorrectionRequest request) {
        Long actor = currentUser.requireOrganizerId();
        UUID key = parseKey(rawKey);
        if (request == null) throw error(HttpStatus.UNPROCESSABLE_CONTENT,
                "VALIDATION_FAILED", "Correction request is required.");
        String reason = reason(request.reason());
        AttendanceStatus target = request.targetAttendanceStatus();
        if (target == null) throw error(HttpStatus.UNPROCESSABLE_CONTENT, "VALIDATION_FAILED", "targetAttendanceStatus is required.");
        Instant effective = request.effectiveAttendedAt() == null ? null
                : request.effectiveAttendedAt().truncatedTo(ChronoUnit.MICROS);
        if (target == AttendanceStatus.VOIDED && effective != null) {
            throw error(HttpStatus.UNPROCESSABLE_CONTENT, "VALIDATION_FAILED", "VOIDED requires null effectiveAttendedAt.");
        }
        var route = queries.detail(actor, registrationId);
        if (route == null) throw OrganizerParticipationService.missing("ACTIVITY_REGISTRATION_NOT_FOUND");
        var root = locks.lockOwnedActivity(route.activityId(), actor, List.of());
        Activity activity = root.activity();
        Instant now = clock.instant().truncatedTo(ChronoUnit.MICROS);
        lifecycle.advanceLocked(activity, now);
        var eventRegistration = events.findByUserIdAndEventIdForUpdate(route.participant().userId(), root.event().getEventId())
                .orElseThrow(() -> OrganizerParticipationService.missing("ACTIVITY_REGISTRATION_NOT_FOUND"));
        var registration = registrations.findByIdentityForUpdate(eventRegistration.getEventRegistrationId(), activity.getActivityId())
                .filter(r -> r.getActivityRegistrationId().equals(registrationId))
                .orElseThrow(() -> OrganizerParticipationService.missing("ACTIVITY_REGISTRATION_NOT_FOUND"));
        Attendance attendance = attendances.findByActivityRegistrationIdForUpdate(registrationId).orElse(null);

        // The key is globally unique, including when two different Event roots reuse it concurrently.
        jdbc.query("select pg_advisory_xact_lock(hashtextextended(?, 0))", rs -> { }, key.toString());
        var existing = adjustments.findByIdempotencyKey(key).orElse(null);
        if (existing != null) {
            if (!existing.getActivityRegistrationId().equals(registrationId)
                    || !existing.getActorUserId().equals(actor)
                    || !existing.getReason().equals(reason)
                    || !Objects.equals(existing.getEffectiveAttendedAt(), effective)
                    || !target.name().equals(existing.getNewState().get("attendance_status"))) {
                throw error(HttpStatus.CONFLICT, "IDEMPOTENCY_KEY_REUSED", "Idempotency key already belongs to a different correction.");
            }
            return response(actor, registrationId, existing, true);
        }
        boolean cancelled = activity.getStatus() == ActivityStatus.CANCELLED
                || root.event().getStatus() == EventStatus.CANCELLED;
        if (activity.getStatus() == ActivityStatus.DRAFT || !activity.isRegistrationRequired()
                || (registration.getStatus() == ActivityRegistrationStatus.CANCELLED && !cancelled)) {
            throw conflict("ATTENDANCE_CORRECTION_NOT_ALLOWED");
        }
        if (cancelled && attendance == null) throw conflict("ATTENDANCE_HISTORY_REQUIRED");
        if (target == AttendanceStatus.VALID && !AttendanceWindow.contains(activity, effective)) {
            throw new ActivityApiException(HttpStatus.UNPROCESSABLE_CONTENT, "ATTENDANCE_EFFECTIVE_TIME_OUTSIDE_WINDOW",
                    "Effective Attendance time must be inside the Attendance window.", "effectiveAttendedAt");
        }
        if (target == AttendanceStatus.VOIDED && attendance == null) throw conflict("ATTENDANCE_CORRECTION_NOT_ALLOWED");
        if (attendance != null && attendance.getStatus() == target
                && (target == AttendanceStatus.VOIDED || attendance.getAttendedAt().equals(effective))) {
            throw conflict("ATTENDANCE_CORRECTION_HAS_NO_EFFECT");
        }
        var before = AttendanceStateResponse.from(registration, attendance).snapshot();
        if (attendance == null) {
            attendance = attendances.saveAndFlush(Attendance.record(registrationId,
                    AttendanceRecordedSource.ORGANIZER_CORRECTION, effective, now));
        } else attendance.correct(target, effective, now);
        if (target == AttendanceStatus.VALID) registration.restoreAttendanceOutcome(now);
        else if (registration.getStatus() != ActivityRegistrationStatus.CANCELLED
                && activity.getStatus() == ActivityStatus.COMPLETED) registration.markNoShow(now);
        registration.attendanceChanged(now);
        var adjustment = adjustments.save(AttendanceAdjustment.create(registrationId, actor, key,
                before, AttendanceStateResponse.from(registration, attendance).snapshot(), effective, reason, now));
        entityManager.flush();
        var command = new ParticipationDownstreamCommand(attendance.getAttendanceId(), "attendance-adjustment-" + key, now);
        if (target == AttendanceStatus.VOIDED) downstream.revokeAndInvalidate(command);
        else if (activity.getStatus() == ActivityStatus.COMPLETED) downstream.issueOrRestore(command);
        entityManager.flush();
        return response(actor, registrationId, adjustment, false);
    }

    private AttendanceCorrectionResponse response(Long actor, Long registrationId, AttendanceAdjustment adjustment, boolean replay) {
        var row = queries.detail(actor, registrationId);
        var certificate = row.certificate() == null ? null : new AttendanceCorrectionResponse.Certificate(
                row.certificate().certificateId(), row.certificate().status());
        return new AttendanceCorrectionResponse(new AttendanceCorrectionResponse.Participation(registrationId,
                row.registrationStatus(), row.cancellationSource(), row.outcome()), row.attendance(),
                AttendanceAdjustmentResponse.from(adjustment, users.findById(adjustment.getActorUserId()).orElseThrow().getFullName()),
                certificate, row.ratingStatus(), replay);
    }

    private static UUID parseKey(String value) {
        try {
            if (value == null || value.length() != 36) throw new IllegalArgumentException();
            UUID key = UUID.fromString(value);
            if (!key.toString().equalsIgnoreCase(value)) throw new IllegalArgumentException();
            return key;
        } catch (IllegalArgumentException error) {
            throw error(HttpStatus.BAD_REQUEST, "INVALID_IDEMPOTENCY_KEY", "Idempotency-Key must be a UUID.");
        }
    }

    private static String reason(String value) {
        String normalized = value == null ? "" : value.replaceAll("(?U)\\s+", " ").strip();
        int length = normalized.codePointCount(0, normalized.length());
        if (length < 10 || length > 500) throw new ActivityApiException(HttpStatus.UNPROCESSABLE_CONTENT,
                "ATTENDANCE_CORRECTION_REASON_INVALID", "Correction reason must contain 10 to 500 characters.", "reason");
        return normalized;
    }

    private static ActivityApiException conflict(String code) {
        return error(HttpStatus.CONFLICT, code, "Attendance correction is incompatible with the current state.");
    }
    private static ActivityApiException error(HttpStatus status, String code, String message) {
        return new ActivityApiException(status, code, message);
    }
}
