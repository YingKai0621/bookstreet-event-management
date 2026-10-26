package com.swp391.bookstreet.attendance.service;

import com.swp391.bookstreet.activity.entity.Activity;
import com.swp391.bookstreet.activity.entity.ActivityStatus;
import com.swp391.bookstreet.activity.exception.ActivityApiException;
import com.swp391.bookstreet.activity.repository.ActivityRepository;
import com.swp391.bookstreet.activity.service.ActivityLockService;
import com.swp391.bookstreet.activity.service.ActivityLifecycleCoordinator;
import com.swp391.bookstreet.attendance.dto.AttendanceScanResponse;
import com.swp391.bookstreet.attendance.entity.Attendance;
import com.swp391.bookstreet.attendance.entity.AttendanceRecordedSource;
import com.swp391.bookstreet.attendance.entity.AttendanceStatus;
import com.swp391.bookstreet.attendance.repository.AttendanceRepository;
import com.swp391.bookstreet.event.entity.EventStatus;
import com.swp391.bookstreet.registration.dto.AttendanceSummaryResponse;
import com.swp391.bookstreet.registration.entity.ActivityRegistrationStatus;
import com.swp391.bookstreet.registration.entity.EventRegistrationStatus;
import com.swp391.bookstreet.registration.repository.ActivityRegistrationRepository;
import com.swp391.bookstreet.registration.repository.EventRegistrationRepository;
import com.swp391.bookstreet.registration.security.RegistrationCurrentUser;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

@Service
public class ParticipantAttendanceService {
    private final ActivityRepository activities;
    private final ActivityLockService locks;
    private final ActivityLifecycleCoordinator lifecycle;
    private final EventRegistrationRepository events;
    private final ActivityRegistrationRepository registrations;
    private final AttendanceRepository attendances;
    private final RegistrationCurrentUser currentUser;
    private final Clock clock;
    private final TransactionTemplate transactions;

    public ParticipantAttendanceService(ActivityRepository activities, ActivityLockService locks,
            ActivityLifecycleCoordinator lifecycle, EventRegistrationRepository events,
            ActivityRegistrationRepository registrations, AttendanceRepository attendances,
            RegistrationCurrentUser currentUser, Clock clock, PlatformTransactionManager transactionManager) {
        this.activities = activities;
        this.locks = locks;
        this.lifecycle = lifecycle;
        this.events = events;
        this.registrations = registrations;
        this.attendances = attendances;
        this.currentUser = currentUser;
        this.clock = clock;
        this.transactions = new TransactionTemplate(transactionManager);
    }

    public AttendanceScanResponse scan(String token) {
        Long userId = currentUser.requireParticipantId();
        UUID parsed = parseToken(token);
        Long activityId = activities.findIdByAttendanceQrToken(parsed).orElseThrow(
                ParticipantAttendanceService::tokenNotFound);
        ScanResult result = transactions.execute(status -> {
            var root = locks.lockActivityRoot(activityId);
            Activity activity = root.activity();
            if (activity.getAttendanceQrToken() == null || !MessageDigest.isEqual(
                    activity.getAttendanceQrToken().toString().getBytes(StandardCharsets.UTF_8),
                    token.getBytes(StandardCharsets.UTF_8))) throw tokenNotFound();
            Instant now = clock.instant().truncatedTo(ChronoUnit.MICROS);
            // Finalization commits even when the subsequent late scan returns a business conflict.
            lifecycle.advanceLocked(activity, now);
            try { return new ScanResult(recordScan(root, userId, now), null); }
            catch (ActivityApiException error) { return new ScanResult(null, error); }
        });
        if (result.error() != null) throw result.error();
        return result.response();
    }

    private AttendanceScanResponse recordScan(ActivityLockService.ActivityLocks root, Long userId, Instant now) {
        Activity activity = root.activity();
        Long activityId = activity.getActivityId();
        if (root.event().getStatus() == EventStatus.CANCELLED
                || activity.getStatus() == ActivityStatus.CANCELLED
                || activity.getStatus() == ActivityStatus.DRAFT || !activity.isRegistrationRequired()) {
            throw conflict("ATTENDANCE_ACTIVITY_INELIGIBLE", "Activity is not eligible for self-scan.");
        }
        if (!now.isBefore(activity.getEndAt())) {
            throw conflict("ATTENDANCE_WINDOW_CLOSED", "The Attendance window is closed.");
        }
        if (activity.getStatus() == ActivityStatus.COMPLETED) {
            throw conflict("ATTENDANCE_ACTIVITY_INELIGIBLE", "Activity is already completed.");
        }
        if (now.isBefore(AttendanceWindow.opensAt(activity))) {
            throw conflict("ATTENDANCE_WINDOW_NOT_OPEN", "The Attendance window has not opened.");
        }
        var eventRegistration = events.findByUserIdAndEventIdForUpdate(userId, activity.getEventId())
                .filter(r -> r.getStatus() == EventRegistrationStatus.ACTIVE)
                .orElseThrow(ParticipantAttendanceService::ineligibleRegistration);
        var registration = registrations.findByIdentityForUpdate(
                        eventRegistration.getEventRegistrationId(), activityId)
                .filter(r -> r.getStatus() == ActivityRegistrationStatus.ACTIVE)
                .orElseThrow(ParticipantAttendanceService::ineligibleRegistration);
        Attendance attendance = attendances.findByActivityRegistrationIdForUpdate(
                registration.getActivityRegistrationId()).orElse(null);
        boolean repeat = attendance != null;
        if (repeat && attendance.getStatus() != AttendanceStatus.VALID) throw ineligibleRegistration();
        if (!repeat) {
            attendance = attendances.saveAndFlush(Attendance.record(registration.getActivityRegistrationId(),
                    AttendanceRecordedSource.SELF_SCAN, now, now));
            registration.attendanceChanged(now);
        }
        return new AttendanceScanResponse(registration.getActivityRegistrationId(), activityId,
                activity.getTitle(), AttendanceSummaryResponse.from(attendance), repeat);
    }

    private record ScanResult(AttendanceScanResponse response, ActivityApiException error) {}

    private static UUID parseToken(String value) {
        try {
            if (value == null || value.length() != 36) throw tokenNotFound();
            UUID token = UUID.fromString(value);
            if (!token.toString().equals(value)) throw tokenNotFound();
            return token;
        } catch (IllegalArgumentException error) { throw tokenNotFound(); }
    }

    private static ActivityApiException tokenNotFound() {
        return new ActivityApiException(HttpStatus.NOT_FOUND, "ATTENDANCE_QR_NOT_FOUND",
                "Attendance QR not found.");
    }

    private static ActivityApiException ineligibleRegistration() {
        return conflict("ATTENDANCE_REGISTRATION_INELIGIBLE", "An active registration is required.");
    }

    private static ActivityApiException conflict(String code, String message) {
        return new ActivityApiException(HttpStatus.CONFLICT, code, message);
    }
}
