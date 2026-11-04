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
import com.swp391.bookstreet.certificate.entity.CertificateStatus;
import com.swp391.bookstreet.certificate.repository.CertificateRepository;
import com.swp391.bookstreet.notification.entity.Notification;
import com.swp391.bookstreet.notification.entity.ParticipantNotificationType;
import com.swp391.bookstreet.notification.service.ParticipantNotificationCommand;
import com.swp391.bookstreet.notification.service.ParticipantNotificationWriter;
import com.swp391.bookstreet.rating.entity.ActivityRating;
import com.swp391.bookstreet.rating.entity.ActivityRatingStatus;
import com.swp391.bookstreet.rating.repository.ActivityRatingRepository;
import com.swp391.bookstreet.registration.entity.ActivityRegistration;
import com.swp391.bookstreet.registration.entity.EventRegistration;
import com.swp391.bookstreet.registration.repository.ActivityRegistrationRepository;
import com.swp391.bookstreet.registration.repository.EventRegistrationRepository;
import java.time.Instant;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.beans.BeanUtils;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatIllegalStateException;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ParticipationDownstreamCascadeServiceTests {
    private static final Instant NOW = Instant.parse("2026-10-23T08:00:00Z");
    private static final Long ATTENDANCE_ID = 12L;
    private static final Long ACTIVITY_REGISTRATION_ID = 22L;
    private static final Long EVENT_REGISTRATION_ID = 32L;
    private static final Long ACTIVITY_ID = 42L;
    private static final Long EVENT_ID = 52L;
    private static final Long USER_ID = 62L;

    @Mock AttendanceRepository attendances;
    @Mock ActivityRegistrationRepository activityRegistrations;
    @Mock EventRegistrationRepository eventRegistrations;
    @Mock ActivityRepository activities;
    @Mock UserRepository users;
    @Mock CertificateRepository certificates;
    @Mock ActivityRatingRepository ratings;
    @Mock ParticipantNotificationWriter notifications;
    @Mock CertificateCodeGenerator codeGenerator;
    @Mock Attendance attendance;
    @Mock ActivityRegistration activityRegistration;
    @Mock EventRegistration eventRegistration;
    @Mock Activity activity;
    @Mock User user;
    @Mock Notification notification;

    ParticipationDownstreamCascadeService service;

    @BeforeEach
    void setup() {
        service = new ParticipationDownstreamCascadeService(
                attendances, activityRegistrations, eventRegistrations, activities, users,
                certificates, ratings, notifications, codeGenerator);
        when(attendances.findByIdForUpdate(ATTENDANCE_ID)).thenReturn(Optional.of(attendance));
        when(attendance.getAttendanceId()).thenReturn(ATTENDANCE_ID);
        when(attendance.getActivityRegistrationId()).thenReturn(ACTIVITY_REGISTRATION_ID);
        when(activityRegistrations.findById(ACTIVITY_REGISTRATION_ID))
                .thenReturn(Optional.of(activityRegistration));
        when(activityRegistration.getActivityId()).thenReturn(ACTIVITY_ID);
        when(activityRegistration.getEventRegistrationId()).thenReturn(EVENT_REGISTRATION_ID);
        when(activities.findById(ACTIVITY_ID)).thenReturn(Optional.of(activity));
        when(eventRegistrations.findById(EVENT_REGISTRATION_ID))
                .thenReturn(Optional.of(eventRegistration));
        when(eventRegistration.getUserId()).thenReturn(USER_ID);
        when(eventRegistration.getEventId()).thenReturn(EVENT_ID);
        when(users.findById(USER_ID)).thenReturn(Optional.of(user));
        when(user.getId()).thenReturn(USER_ID);
        when(user.getFullName()).thenReturn("Nguyễn An");
        when(activity.getTitle()).thenReturn("Giao lưu tác giả");
    }

    @Test
    void issueCreatesOneCertificateAndCertificateOnlyNotification() {
        completedCertificateActivityWith(AttendanceStatus.VALID);
        when(ratings.findByAttendanceIdForUpdate(ATTENDANCE_ID)).thenReturn(Optional.empty());
        when(certificates.findByAttendanceIdForUpdate(ATTENDANCE_ID))
                .thenReturn(Optional.empty());
        when(codeGenerator.generate()).thenReturn("BKS-TAKEN", "BKS-NEW");
        when(certificates.existsByCertificateCode("BKS-TAKEN")).thenReturn(true);
        when(certificates.existsByCertificateCode("BKS-NEW")).thenReturn(false);
        when(certificates.saveAndFlush(any(Certificate.class))).thenAnswer(invocation -> {
            Certificate saved = invocation.getArgument(0);
            ReflectionTestUtils.setField(saved, "certificateId", 72L);
            return saved;
        });
        when(notification.getNotificationId()).thenReturn(82L);
        when(notifications.write(any())).thenReturn(notification);

        ParticipationDownstreamResult result = service.issueOrRestore(command("complete-42"));

        assertThat(result.certificateEnabled()).isTrue();
        assertThat(result.certificateId()).isEqualTo(72L);
        assertThat(result.certificateStatus()).isEqualTo(CertificateStatus.ISSUED);
        assertThat(result.certificateChanged()).isTrue();
        assertThat(result.ratingChanged()).isFalse();
        assertThat(result.notificationId()).isEqualTo(82L);

        ArgumentCaptor<ParticipantNotificationCommand> captured =
                ArgumentCaptor.forClass(ParticipantNotificationCommand.class);
        verify(notifications).write(captured.capture());
        ParticipantNotificationCommand sent = captured.getValue();
        assertThat(sent.recipientUserId()).isEqualTo(USER_ID);
        assertThat(sent.type()).isEqualTo(ParticipantNotificationType.CERTIFICATE_ISSUED);
        assertThat(sent.eventId()).isNull();
        assertThat(sent.activityId()).isNull();
        assertThat(sent.certificateId()).isEqualTo(72L);
        assertThat(sent.deduplicationKey())
                .isEqualTo("certificate:72:issued:complete-42");
    }

    @Test
    void exactIssueReplayIsANoOpAndDoesNotNotifyAgain() {
        completedCertificateActivityWith(AttendanceStatus.VALID);
        Certificate certificate = Certificate.issue(ATTENDANCE_ID, "BKS-SAME", "Nguyễn An",
                NOW.minusSeconds(60));
        ReflectionTestUtils.setField(certificate, "certificateId", 72L);
        when(ratings.findByAttendanceIdForUpdate(ATTENDANCE_ID)).thenReturn(Optional.empty());
        when(certificates.findByAttendanceIdForUpdate(ATTENDANCE_ID))
                .thenReturn(Optional.of(certificate));

        ParticipationDownstreamResult result = service.issueOrRestore(command("complete-42"));

        assertThat(result.noOp()).isTrue();
        assertThat(result.certificateId()).isEqualTo(72L);
        verify(notifications, never()).write(any());
        verify(codeGenerator, never()).generate();
    }

    @Test
    void restoreReusesCertificateIdentityAndReactivatesExistingRating() {
        completedCertificateActivityWith(AttendanceStatus.VALID);
        Instant issuedAt = NOW.minusSeconds(180);
        Certificate certificate = Certificate.issue(ATTENDANCE_ID, "BKS-SAME", "Nguyễn An",
                issuedAt);
        ReflectionTestUtils.setField(certificate, "certificateId", 72L);
        certificate.revoke(NOW.minusSeconds(120));
        ActivityRating rating = invalidatedRating();
        when(ratings.findByAttendanceIdForUpdate(ATTENDANCE_ID))
                .thenReturn(Optional.of(rating));
        when(certificates.findByAttendanceIdForUpdate(ATTENDANCE_ID))
                .thenReturn(Optional.of(certificate));
        when(notification.getNotificationId()).thenReturn(82L);
        when(notifications.write(any())).thenReturn(notification);

        ParticipationDownstreamResult result = service.issueOrRestore(command("adjustment-abc"));

        assertThat(result.certificateChanged()).isTrue();
        assertThat(result.ratingChanged()).isTrue();
        assertThat(result.certificateId()).isEqualTo(72L);
        assertThat(certificate.getCertificateCode()).isEqualTo("BKS-SAME");
        assertThat(certificate.getIssuedAt()).isEqualTo(issuedAt);
        assertThat(certificate.getRevokedAt()).isNull();
        assertThat(rating.getStatus()).isEqualTo(ActivityRatingStatus.ACTIVE);
        assertThat(rating.getInvalidatedAt()).isNull();
    }

    @Test
    void revokeInvalidatesRatingAndWritesOneRevocationNotification() {
        completedCertificateActivityWith(AttendanceStatus.VOIDED);
        Certificate certificate = Certificate.issue(ATTENDANCE_ID, "BKS-SAME", "Nguyễn An",
                NOW.minusSeconds(180));
        ReflectionTestUtils.setField(certificate, "certificateId", 72L);
        ActivityRating rating = activeRating();
        when(ratings.findByAttendanceIdForUpdate(ATTENDANCE_ID))
                .thenReturn(Optional.of(rating));
        when(certificates.findByAttendanceIdForUpdate(ATTENDANCE_ID))
                .thenReturn(Optional.of(certificate));
        when(notification.getNotificationId()).thenReturn(82L);
        when(notifications.write(any())).thenReturn(notification);

        ParticipationDownstreamResult result = service.revokeAndInvalidate(
                command("adjustment-def"));

        assertThat(result.certificateChanged()).isTrue();
        assertThat(result.ratingChanged()).isTrue();
        assertThat(certificate.getStatus()).isEqualTo(CertificateStatus.REVOKED);
        assertThat(rating.getStatus()).isEqualTo(ActivityRatingStatus.INVALIDATED);

        ArgumentCaptor<ParticipantNotificationCommand> captured =
                ArgumentCaptor.forClass(ParticipantNotificationCommand.class);
        verify(notifications).write(captured.capture());
        assertThat(captured.getValue().type())
                .isEqualTo(ParticipantNotificationType.CERTIFICATE_REVOKED);
        assertThat(captured.getValue().deduplicationKey())
                .isEqualTo("certificate:72:revoked:adjustment-def");
    }

    @Test
    void repeatedRevokeAndMissingDownstreamRowsAreSafeNoOps() {
        completedCertificateActivityWith(AttendanceStatus.VOIDED);
        when(ratings.findByAttendanceIdForUpdate(ATTENDANCE_ID)).thenReturn(Optional.empty());
        when(certificates.findByAttendanceIdForUpdate(ATTENDANCE_ID))
                .thenReturn(Optional.empty());

        ParticipationDownstreamResult result = service.revokeAndInvalidate(
                command("adjustment-def"));

        assertThat(result.noOp()).isTrue();
        assertThat(result.certificateId()).isNull();
        verify(notifications, never()).write(any());
    }

    @Test
    void disabledCertificateIsExpectedSkipWithoutCreatingDownstreamState() {
        when(activity.getStatus()).thenReturn(ActivityStatus.COMPLETED);
        when(attendance.getStatus()).thenReturn(AttendanceStatus.VALID);
        when(activity.isCertificateEnabled()).thenReturn(false);
        when(ratings.findByAttendanceIdForUpdate(ATTENDANCE_ID)).thenReturn(Optional.empty());

        ParticipationDownstreamResult result = service.issueOrRestore(command("complete-42"));

        assertThat(result.certificateEnabled()).isFalse();
        assertThat(result.noOp()).isTrue();
        verify(certificates, never()).findByAttendanceIdForUpdate(ATTENDANCE_ID);
        verify(codeGenerator, never()).generate();
        verify(notifications, never()).write(any());
    }

    @Test
    void disabledCertificateStillRestoresAnInvalidatedRating() {
        when(activity.getStatus()).thenReturn(ActivityStatus.COMPLETED);
        when(attendance.getStatus()).thenReturn(AttendanceStatus.VALID);
        when(activity.isCertificateEnabled()).thenReturn(false);
        ActivityRating rating = invalidatedRating();
        when(ratings.findByAttendanceIdForUpdate(ATTENDANCE_ID))
                .thenReturn(Optional.of(rating));

        ParticipationDownstreamResult result = service.issueOrRestore(command("adjustment-ghi"));

        assertThat(result.certificateEnabled()).isFalse();
        assertThat(result.certificateChanged()).isFalse();
        assertThat(result.ratingChanged()).isTrue();
        assertThat(result.ratingStatus()).isEqualTo(ActivityRatingStatus.ACTIVE);
        verify(certificates, never()).findByAttendanceIdForUpdate(ATTENDANCE_ID);
        verify(notifications, never()).write(any());
    }

    @Test
    void revokeWithoutCertificateStillInvalidatesAnExistingRating() {
        completedCertificateActivityWith(AttendanceStatus.VOIDED);
        ActivityRating rating = activeRating();
        when(ratings.findByAttendanceIdForUpdate(ATTENDANCE_ID))
                .thenReturn(Optional.of(rating));
        when(certificates.findByAttendanceIdForUpdate(ATTENDANCE_ID))
                .thenReturn(Optional.empty());

        ParticipationDownstreamResult result = service.revokeAndInvalidate(
                command("adjustment-jkl"));

        assertThat(result.certificateChanged()).isFalse();
        assertThat(result.ratingChanged()).isTrue();
        assertThat(result.ratingStatus()).isEqualTo(ActivityRatingStatus.INVALIDATED);
        verify(notifications, never()).write(any());
    }

    @Test
    void retriesGeneratedCodeAndFailsClosedAfterBoundedCollisions() {
        completedCertificateActivityWith(AttendanceStatus.VALID);
        when(ratings.findByAttendanceIdForUpdate(ATTENDANCE_ID)).thenReturn(Optional.empty());
        when(certificates.findByAttendanceIdForUpdate(ATTENDANCE_ID))
                .thenReturn(Optional.empty());
        when(codeGenerator.generate()).thenReturn("BKS-DUPLICATE");
        when(certificates.existsByCertificateCode("BKS-DUPLICATE")).thenReturn(true);

        assertThatIllegalStateException()
                .isThrownBy(() -> service.issueOrRestore(command("complete-42")))
                .withMessageContaining("5 attempts");
        verify(certificates, never()).saveAndFlush(any());
        verify(notifications, never()).write(any());
    }

    @Test
    void rejectsIssueBeforeCompletionOrWithoutValidAttendance() {
        when(activity.getStatus()).thenReturn(ActivityStatus.PUBLISHED);

        assertThatIllegalStateException()
                .isThrownBy(() -> service.issueOrRestore(command("complete-42")))
                .withMessageContaining("Completed");

        when(activity.getStatus()).thenReturn(ActivityStatus.COMPLETED);
        when(attendance.getStatus()).thenReturn(AttendanceStatus.VOIDED);
        assertThatIllegalStateException()
                .isThrownBy(() -> service.issueOrRestore(command("complete-42")))
                .withMessageContaining("Valid");
    }

    @Test
    void rejectsRevokeWhileAttendanceIsStillValid() {
        when(attendance.getStatus()).thenReturn(AttendanceStatus.VALID);

        assertThatIllegalStateException()
                .isThrownBy(() -> service.revokeAndInvalidate(command("adjustment-def")))
                .withMessageContaining("Voided");
        verify(certificates, never()).findByAttendanceIdForUpdate(ATTENDANCE_ID);
    }

    @Test
    void propagatesNotificationFailureSoTransactionCanRollback() {
        completedCertificateActivityWith(AttendanceStatus.VOIDED);
        Certificate certificate = Certificate.issue(ATTENDANCE_ID, "BKS-SAME", "Nguyễn An",
                NOW.minusSeconds(180));
        ReflectionTestUtils.setField(certificate, "certificateId", 72L);
        when(ratings.findByAttendanceIdForUpdate(ATTENDANCE_ID)).thenReturn(Optional.empty());
        when(certificates.findByAttendanceIdForUpdate(ATTENDANCE_ID))
                .thenReturn(Optional.of(certificate));
        when(notifications.write(any())).thenThrow(new IllegalStateException("notification down"));

        assertThatIllegalStateException()
                .isThrownBy(() -> service.revokeAndInvalidate(command("adjustment-def")))
                .withMessage("notification down");
    }

    private void completedCertificateActivityWith(AttendanceStatus attendanceStatus) {
        when(activity.getStatus()).thenReturn(ActivityStatus.COMPLETED);
        when(activity.isCertificateEnabled()).thenReturn(true);
        when(attendance.getStatus()).thenReturn(attendanceStatus);
    }

    private ParticipationDownstreamCommand command(String transitionKey) {
        return new ParticipationDownstreamCommand(ATTENDANCE_ID, transitionKey, NOW);
    }

    private ActivityRating activeRating() {
        ActivityRating rating = BeanUtils.instantiateClass(ActivityRating.class);
        ReflectionTestUtils.setField(rating, "activityRatingId", 92L);
        ReflectionTestUtils.setField(rating, "attendanceId", ATTENDANCE_ID);
        ReflectionTestUtils.setField(rating, "status", ActivityRatingStatus.ACTIVE);
        ReflectionTestUtils.setField(rating, "createdAt", NOW.minusSeconds(300));
        ReflectionTestUtils.setField(rating, "updatedAt", NOW.minusSeconds(300));
        return rating;
    }

    private ActivityRating invalidatedRating() {
        ActivityRating rating = activeRating();
        rating.invalidate(NOW.minusSeconds(120));
        return rating;
    }
}
