package com.swp391.bookstreet.attendance.service;

import com.swp391.bookstreet.activity.entity.Activity;
import com.swp391.bookstreet.activity.entity.ActivityStatus;
import com.swp391.bookstreet.activity.exception.ActivityApiException;
import com.swp391.bookstreet.attendance.entity.Attendance;
import com.swp391.bookstreet.attendance.entity.AttendanceStatus;
import com.swp391.bookstreet.attendance.repository.AttendanceRepository;
import com.swp391.bookstreet.certificate.service.ParticipationDownstreamCascade;
import com.swp391.bookstreet.certificate.service.ParticipationDownstreamCommand;
import com.swp391.bookstreet.notification.entity.ParticipantNotificationType;
import com.swp391.bookstreet.notification.service.ParticipantNotificationCommand;
import com.swp391.bookstreet.notification.service.ParticipantNotificationWriter;
import com.swp391.bookstreet.registration.entity.ActivityRegistration;
import com.swp391.bookstreet.registration.entity.ActivityRegistrationStatus;
import com.swp391.bookstreet.registration.entity.ActivityRegistrationCancellationSource;
import com.swp391.bookstreet.registration.entity.EventRegistration;
import com.swp391.bookstreet.registration.repository.ActivityRegistrationRepository;
import com.swp391.bookstreet.registration.repository.EventRegistrationRepository;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** Called only after the caller has locked the Event and affected Activities. */
@Service
@Transactional(propagation = Propagation.MANDATORY)
public class ActivityParticipationLifecycleService {
    private final EventRegistrationRepository events;
    private final ActivityRegistrationRepository registrations;
    private final AttendanceRepository attendances;
    private final ParticipationDownstreamCascade downstream;
    private final ParticipantNotificationWriter notifications;

    public ActivityParticipationLifecycleService(EventRegistrationRepository events,
            ActivityRegistrationRepository registrations, AttendanceRepository attendances,
            ParticipationDownstreamCascade downstream, ParticipantNotificationWriter notifications) {
        this.events = events;
        this.registrations = registrations;
        this.attendances = attendances;
        this.downstream = downstream;
        this.notifications = notifications;
    }

    public void finalizeCompleted(Activity activity, Instant now) {
        if (activity.getStatus() != ActivityStatus.COMPLETED || now.isBefore(activity.getEndAt())) return;
        events.findByEventIdForUpdate(activity.getEventId());
        List<ActivityRegistration> rows = registrations.findByActivityIdForUpdate(activity.getActivityId());
        if (rows.isEmpty()) return;
        Map<Long, Attendance> evidence = attendances.findAllForUpdate(rows.stream()
                .map(ActivityRegistration::getActivityRegistrationId).toList()).stream()
                .collect(Collectors.toMap(Attendance::getActivityRegistrationId, Function.identity()));
        for (ActivityRegistration row : rows) {
            Attendance attendance = evidence.get(row.getActivityRegistrationId());
            boolean valid = attendance != null && attendance.getStatus() == AttendanceStatus.VALID;
            if (row.getStatus() == ActivityRegistrationStatus.ACTIVE && !valid) row.markNoShow(now);
        }
        registrations.flush();
        evidence.values().stream().filter(a -> a.getStatus() == AttendanceStatus.VALID)
                .sorted(java.util.Comparator.comparing(Attendance::getAttendanceId))
                .forEach(a -> downstream.issueOrRestore(new ParticipationDownstreamCommand(
                        a.getAttendanceId(), "activity-completed-" + activity.getActivityId(), now)));
    }

    public boolean validateChange(Activity activity, Long locationId, Instant startAt,
            Instant endAt, int capacity) {
        boolean changed = !Objects.equals(activity.getLocationId(), locationId)
                || !activity.getStartAt().equals(startAt) || !activity.getEndAt().equals(endAt);
        if (changed && attendances.existsValidByActivityId(activity.getActivityId())) {
            throw new ActivityApiException(HttpStatus.CONFLICT,
                    "ACTIVITY_ATTENDANCE_FREEZES_SCHEDULE_OR_LOCATION",
                    "Schedule and Location cannot change after valid Attendance.");
        }
        if ((activity.getStatus() == ActivityStatus.PUBLISHED || activity.getStatus() == ActivityStatus.ONGOING)
                && capacity < registrations.countByActivityIdAndStatus(activity.getActivityId(),
                        ActivityRegistrationStatus.ACTIVE)) {
            throw new ActivityApiException(HttpStatus.CONFLICT,
                    "ACTIVITY_CAPACITY_BELOW_ACTIVE_REGISTRATIONS",
                    "Capacity cannot be lower than the active registration count.");
        }
        return changed;
    }

    public void validateAttendanceWindowChange(Activity activity, int earlyScanMinutes) {
        if (activity.getAttendanceEarlyScanMinutes() != earlyScanMinutes
                && attendances.existsValidByActivityId(activity.getActivityId())) {
            throw new ActivityApiException(HttpStatus.CONFLICT,
                    "ACTIVITY_ATTENDANCE_WINDOW_FROZEN",
                    "Attendance window cannot change after valid Attendance.");
        }
    }

    public void scheduleChanged(Activity activity, Long revisionId, Instant now) {
        Map<Long, EventRegistration> owners = lockOwners(activity);
        for (ActivityRegistration row : registrations.findByActivityIdForUpdate(activity.getActivityId())) {
            if (row.getStatus() == ActivityRegistrationStatus.ACTIVE
                    && (activity.getStatus() == ActivityStatus.PUBLISHED || activity.getStatus() == ActivityStatus.ONGOING)) {
                notify(owners.get(row.getEventRegistrationId()).getUserId(), activity,
                        ParticipantNotificationType.ACTIVITY_SCHEDULE_OR_LOCATION_CHANGED,
                        "activity-revision-" + revisionId,
                        "Lịch hoạt động đã thay đổi", "Thời gian hoặc địa điểm hoạt động đã được cập nhật.", now);
            }
        }
    }

    public void cancel(Activity activity, Instant now) {
        Map<Long, EventRegistration> owners = lockOwners(activity);
        for (ActivityRegistration row : registrations.findByActivityIdForUpdate(activity.getActivityId())) {
            if (row.getStatus() != ActivityRegistrationStatus.ACTIVE) continue;
            row.cancel(ActivityRegistrationCancellationSource.ACTIVITY, now);
            notify(owners.get(row.getEventRegistrationId()).getUserId(), activity,
                    ParticipantNotificationType.ACTIVITY_CANCELLED,
                    "activity-cancelled-" + activity.getActivityId(),
                    "Hoạt động đã bị hủy", "Hoạt động bạn đăng ký đã bị hủy.", now);
        }
    }

    private Map<Long, EventRegistration> lockOwners(Activity activity) {
        return events.findByEventIdForUpdate(activity.getEventId()).stream().collect(Collectors.toMap(
                EventRegistration::getEventRegistrationId, Function.identity()));
    }

    private void notify(Long userId, Activity activity, ParticipantNotificationType type,
            String key, String title, String message, Instant now) {
        notifications.write(new ParticipantNotificationCommand(userId, type, null,
                activity.getActivityId(), null, key, title, message, now));
    }
}
