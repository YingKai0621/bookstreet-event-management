package com.swp391.bookstreet.certificate.service;

import com.swp391.bookstreet.activity.entity.Activity;
import com.swp391.bookstreet.activity.entity.ActivityStatus;
import com.swp391.bookstreet.activity.repository.ActivityRepository;
import com.swp391.bookstreet.attendance.entity.Attendance;
import com.swp391.bookstreet.attendance.entity.AttendanceStatus;
import com.swp391.bookstreet.attendance.repository.AttendanceRepository;
import com.swp391.bookstreet.auth.entity.User;
import com.swp391.bookstreet.auth.repository.UserRepository;
import com.swp391.bookstreet.certificate.entity.Certificate;
import com.swp391.bookstreet.certificate.repository.CertificateRepository;
import com.swp391.bookstreet.notification.entity.Notification;
import com.swp391.bookstreet.notification.entity.ParticipantNotificationType;
import com.swp391.bookstreet.notification.service.ParticipantNotificationCommand;
import com.swp391.bookstreet.notification.service.ParticipantNotificationWriter;
import com.swp391.bookstreet.rating.entity.ActivityRating;
import com.swp391.bookstreet.rating.repository.ActivityRatingRepository;
import com.swp391.bookstreet.registration.entity.ActivityRegistration;
import com.swp391.bookstreet.registration.entity.EventRegistration;
import com.swp391.bookstreet.registration.repository.ActivityRegistrationRepository;
import com.swp391.bookstreet.registration.repository.EventRegistrationRepository;
import java.util.Objects;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ParticipationDownstreamCascadeService implements ParticipationDownstreamCascade {
    private static final int MAX_CODE_GENERATION_ATTEMPTS = 5;

    private final AttendanceRepository attendances;
    private final ActivityRegistrationRepository activityRegistrations;
    private final EventRegistrationRepository eventRegistrations;
    private final ActivityRepository activities;
    private final UserRepository users;
    private final CertificateRepository certificates;
    private final ActivityRatingRepository ratings;
    private final ParticipantNotificationWriter notifications;
    private final CertificateCodeGenerator codeGenerator;

    public ParticipationDownstreamCascadeService(
            AttendanceRepository attendances,
            ActivityRegistrationRepository activityRegistrations,
            EventRegistrationRepository eventRegistrations,
            ActivityRepository activities,
            UserRepository users,
            CertificateRepository certificates,
            ActivityRatingRepository ratings,
            ParticipantNotificationWriter notifications,
            CertificateCodeGenerator codeGenerator) {
        this.attendances = attendances;
        this.activityRegistrations = activityRegistrations;
        this.eventRegistrations = eventRegistrations;
        this.activities = activities;
        this.users = users;
        this.certificates = certificates;
        this.ratings = ratings;
        this.notifications = notifications;
        this.codeGenerator = codeGenerator;
    }

    @Override
    @Transactional
    public ParticipationDownstreamResult issueOrRestore(
            ParticipationDownstreamCommand command) {
        Objects.requireNonNull(command, "command must not be null");
        CascadeContext context = loadContext(command.attendanceId());
        requireStatus(context.activity().getStatus(), ActivityStatus.COMPLETED,
                "Certificate can only be issued for a Completed activity.");
        requireStatus(context.attendance().getStatus(), AttendanceStatus.VALID,
                "Certificate can only be issued for Valid attendance.");

        ActivityRating rating = ratings.findByAttendanceIdForUpdate(
                context.attendance().getAttendanceId()).orElse(null);
        boolean ratingChanged = rating != null && rating.restore(command.occurredAt());

        if (!context.activity().isCertificateEnabled()) {
            return new ParticipationDownstreamResult(false, null, null,
                    false, rating == null ? null : rating.getStatus(), ratingChanged, null);
        }

        Certificate certificate = certificates.findByAttendanceIdForUpdate(
                context.attendance().getAttendanceId()).orElse(null);
        boolean certificateChanged;
        if (certificate == null) {
            certificate = Certificate.issue(
                    context.attendance().getAttendanceId(),
                    nextCertificateCode(),
                    context.recipient().getFullName(),
                    command.occurredAt());
            certificate = certificates.saveAndFlush(certificate);
            certificateChanged = true;
        } else {
            certificateChanged = certificate.restore(command.occurredAt());
        }

        Long notificationId = null;
        if (certificateChanged) {
            Notification notification = notifications.write(
                    certificateNotification(context, certificate,
                            ParticipantNotificationType.CERTIFICATE_ISSUED,
                            command.transitionKey(), command.occurredAt()));
            notificationId = notification.getNotificationId();
        }

        return new ParticipationDownstreamResult(
                true,
                certificate.getCertificateId(),
                certificate.getStatus(),
                certificateChanged,
                rating == null ? null : rating.getStatus(),
                ratingChanged,
                notificationId);
    }

    @Override
    @Transactional
    public ParticipationDownstreamResult revokeAndInvalidate(
            ParticipationDownstreamCommand command) {
        Objects.requireNonNull(command, "command must not be null");
        CascadeContext context = loadContext(command.attendanceId());
        requireStatus(context.attendance().getStatus(), AttendanceStatus.VOIDED,
                "Certificate can only be revoked after attendance is Voided.");

        ActivityRating rating = ratings.findByAttendanceIdForUpdate(
                context.attendance().getAttendanceId()).orElse(null);
        boolean ratingChanged = rating != null && rating.invalidate(command.occurredAt());

        Certificate certificate = certificates.findByAttendanceIdForUpdate(
                context.attendance().getAttendanceId()).orElse(null);
        boolean certificateChanged = certificate != null
                && certificate.revoke(command.occurredAt());

        Long notificationId = null;
        if (certificateChanged) {
            Notification notification = notifications.write(
                    certificateNotification(context, certificate,
                            ParticipantNotificationType.CERTIFICATE_REVOKED,
                            command.transitionKey(), command.occurredAt()));
            notificationId = notification.getNotificationId();
        }

        return new ParticipationDownstreamResult(
                context.activity().isCertificateEnabled(),
                certificate == null ? null : certificate.getCertificateId(),
                certificate == null ? null : certificate.getStatus(),
                certificateChanged,
                rating == null ? null : rating.getStatus(),
                ratingChanged,
                notificationId);
    }

    private CascadeContext loadContext(Long attendanceId) {
        Attendance attendance = attendances.findByIdForUpdate(attendanceId)
                .orElseThrow(() -> missing("Attendance", attendanceId));
        ActivityRegistration activityRegistration = activityRegistrations
                .findById(attendance.getActivityRegistrationId())
                .orElseThrow(() -> missing("ActivityRegistration",
                        attendance.getActivityRegistrationId()));
        Activity activity = activities.findById(activityRegistration.getActivityId())
                .orElseThrow(() -> missing("Activity", activityRegistration.getActivityId()));
        EventRegistration eventRegistration = eventRegistrations
                .findById(activityRegistration.getEventRegistrationId())
                .orElseThrow(() -> missing("EventRegistration",
                        activityRegistration.getEventRegistrationId()));
        User recipient = users.findById(eventRegistration.getUserId())
                .orElseThrow(() -> missing("User", eventRegistration.getUserId()));
        return new CascadeContext(attendance, activity, recipient);
    }

    private String nextCertificateCode() {
        for (int attempt = 0; attempt < MAX_CODE_GENERATION_ATTEMPTS; attempt++) {
            String generated = codeGenerator.generate();
            String candidate = generated == null ? null : generated.trim();
            if (candidate == null || candidate.isBlank() || candidate.length() > 50) {
                throw new IllegalStateException(
                        "Certificate code generator returned an invalid value.");
            }
            if (!certificates.existsByCertificateCode(candidate)) {
                return candidate;
            }
        }
        throw new IllegalStateException(
                "Could not generate a unique certificate code after "
                        + MAX_CODE_GENERATION_ATTEMPTS + " attempts.");
    }

    private ParticipantNotificationCommand certificateNotification(
            CascadeContext context,
            Certificate certificate,
            ParticipantNotificationType type,
            String transitionKey,
            java.time.Instant occurredAt) {
        boolean issued = type == ParticipantNotificationType.CERTIFICATE_ISSUED;
        String action = issued ? "issued" : "revoked";
        String deduplicationKey = "certificate:" + certificate.getCertificateId()
                + ":" + action + ":" + transitionKey;
        if (deduplicationKey.length() > 200) {
            throw new IllegalArgumentException(
                    "Certificate notification deduplication key exceeds 200 characters.");
        }
        String title = issued
                ? "Chứng nhận tham gia đã được cấp"
                : "Chứng nhận tham gia đã bị thu hồi";
        String message = issued
                ? "Chứng nhận cho hoạt động \"" + context.activity().getTitle()
                        + "\" đã được cấp."
                : "Chứng nhận cho hoạt động \"" + context.activity().getTitle()
                        + "\" đã bị thu hồi sau khi trạng thái điểm danh được điều chỉnh.";
        return new ParticipantNotificationCommand(
                context.recipient().getId(),
                type,
                null,
                null,
                certificate.getCertificateId(),
                deduplicationKey,
                title,
                message,
                occurredAt);
    }

    private <T> void requireStatus(T actual, T expected, String message) {
        if (actual != expected) throw new IllegalStateException(message);
    }

    private IllegalStateException missing(String resource, Long id) {
        return new IllegalStateException(resource + " " + id + " was not found.");
    }

    private record CascadeContext(
            Attendance attendance,
            Activity activity,
            User recipient) {
    }
}
