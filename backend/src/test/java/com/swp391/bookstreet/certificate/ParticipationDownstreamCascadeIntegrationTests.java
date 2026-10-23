package com.swp391.bookstreet.certificate;

import com.swp391.bookstreet.certificate.service.ParticipationDownstreamCascade;
import com.swp391.bookstreet.certificate.service.ParticipationDownstreamCommand;
import com.swp391.bookstreet.certificate.service.ParticipationDownstreamResult;
import com.swp391.bookstreet.event.service.EventCancellationMailService;
import com.swp391.bookstreet.notification.service.ParticipantNotificationWriter;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContextInitializer;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;

@SpringBootTest(properties = {
        "spring.datasource.url=${EVENT_TEST_DATABASE_URL}",
        "logging.level.org.springframework.security=ERROR"
})
@EnabledIfEnvironmentVariable(named = "EVENT_TEST_DATABASE_URL", matches = ".+")
@ContextConfiguration(initializers = ParticipationDownstreamCascadeIntegrationTests.TestDatabaseGuard.class)
class ParticipationDownstreamCascadeIntegrationTests {
    private static final Instant BASE = Instant.parse("2026-10-23T08:00:00Z");

    static class TestDatabaseGuard
            implements ApplicationContextInitializer<ConfigurableApplicationContext> {
        @Override
        public void initialize(ConfigurableApplicationContext applicationContext) {
            String url = applicationContext.getEnvironment()
                    .getRequiredProperty("spring.datasource.url");
            if (!url.matches("jdbc:postgresql://[^/]+/[A-Za-z0-9_]+_event_test(?:\\?.*)?")) {
                throw new IllegalStateException(
                        "Certificate cascade tests require a dedicated *_event_test database.");
            }
        }
    }

    @Autowired JdbcTemplate jdbc;
    @Autowired ParticipationDownstreamCascade cascade;
    @MockitoBean EventCancellationMailService cancellationMailService;
    @MockitoSpyBean ParticipantNotificationWriter notificationWriter;

    Long organizerId;
    Long participantId;
    Long eventId;
    Long locationId;
    Long activityId;
    Long eventRegistrationId;
    Long activityRegistrationId;
    Long attendanceId;

    @BeforeEach
    void setup() {
        assertThat(jdbc.queryForObject("select current_database()", String.class))
                .endsWith("_event_test");
        organizerId = insertUser("organizer");
        participantId = insertUser("participant");
        eventId = insertEvent();
        locationId = insertLocation();
        activityId = insertCompletedActivity();
        eventRegistrationId = insertEventRegistration();
        activityRegistrationId = insertActivityRegistration();
        attendanceId = insertAttendance();
    }

    @AfterEach
    void cleanup() {
        if (participantId == null) return;
        jdbc.update("delete from notifications where recipient_user_id = ?", participantId);
        if (attendanceId != null) {
            jdbc.update("delete from activity_ratings where attendance_id = ?", attendanceId);
            jdbc.update("delete from certificates where attendance_id = ?", attendanceId);
            jdbc.update("delete from attendances where attendance_id = ?", attendanceId);
        }
        if (activityRegistrationId != null) {
            jdbc.update("delete from activity_registrations where activity_registration_id = ?",
                    activityRegistrationId);
        }
        if (eventRegistrationId != null) {
            jdbc.update("delete from event_registrations where event_registration_id = ?",
                    eventRegistrationId);
        }
        if (activityId != null) {
            jdbc.update("delete from activities where activity_id = ?", activityId);
        }
        if (locationId != null) {
            jdbc.update("delete from locations where location_id = ?", locationId);
        }
        if (eventId != null) jdbc.update("delete from events where event_id = ?", eventId);
        jdbc.update("delete from users where user_id in (?, ?)", organizerId, participantId);
    }

    @Test
    void issueRevokeRestoreReuseDurableRowsAndRemainIdempotent() {
        insertActiveRating();

        ParticipationDownstreamResult issued = cascade.issueOrRestore(
                command("activity-completed-" + activityId, BASE.plusSeconds(60)));
        Long certificateId = issued.certificateId();
        List<Object> original = certificateIdentity(certificateId);

        ParticipationDownstreamResult issueReplay = cascade.issueOrRestore(
                command("activity-completed-" + activityId, BASE.plusSeconds(60)));
        assertThat(issueReplay.noOp()).isTrue();
        assertThat(count("certificates", "attendance_id", attendanceId)).isEqualTo(1);
        assertThat(count("notifications", "recipient_user_id", participantId)).isEqualTo(1);

        Instant voidedAt = BASE.plusSeconds(120);
        jdbc.update("""
                update attendances
                set status = 'VOIDED', voided_at = ?, updated_at = ?
                where attendance_id = ?
                """, Timestamp.from(voidedAt), Timestamp.from(voidedAt), attendanceId);
        ParticipationDownstreamCommand revokeCommand = command(
                "attendance-adjustment-void", voidedAt);
        ParticipationDownstreamResult revoked = cascade.revokeAndInvalidate(revokeCommand);
        ParticipationDownstreamResult revokeReplay = cascade.revokeAndInvalidate(revokeCommand);

        assertThat(revoked.certificateChanged()).isTrue();
        assertThat(revoked.ratingChanged()).isTrue();
        assertThat(revokeReplay.noOp()).isTrue();
        assertThat(jdbc.queryForObject(
                "select status from certificates where certificate_id = ?",
                String.class, certificateId)).isEqualTo("REVOKED");
        assertThat(jdbc.queryForObject(
                "select status from activity_ratings where attendance_id = ?",
                String.class, attendanceId)).isEqualTo("INVALIDATED");
        assertThat(count("notifications", "recipient_user_id", participantId)).isEqualTo(2);

        Instant restoredAt = BASE.plusSeconds(180);
        jdbc.update("""
                update attendances
                set status = 'VALID', voided_at = null, updated_at = ?
                where attendance_id = ?
                """, Timestamp.from(restoredAt), attendanceId);
        ParticipationDownstreamResult restored = cascade.issueOrRestore(
                command("attendance-adjustment-restore", restoredAt));

        assertThat(restored.certificateId()).isEqualTo(certificateId);
        assertThat(restored.certificateChanged()).isTrue();
        assertThat(restored.ratingChanged()).isTrue();
        assertThat(certificateIdentity(certificateId)).isEqualTo(original);
        assertThat(jdbc.queryForObject(
                "select status from activity_ratings where attendance_id = ?",
                String.class, attendanceId)).isEqualTo("ACTIVE");
        assertThat(count("notifications", "recipient_user_id", participantId)).isEqualTo(3);
    }

    @Test
    void concurrentIssueCallsSerializeOnAttendanceAndCreateOneCertificate() throws Exception {
        ParticipationDownstreamCommand command = command(
                "activity-completed-" + activityId, BASE.plusSeconds(60));
        ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            Future<ParticipationDownstreamResult> first =
                    executor.submit(() -> cascade.issueOrRestore(command));
            Future<ParticipationDownstreamResult> second =
                    executor.submit(() -> cascade.issueOrRestore(command));
            List<ParticipationDownstreamResult> results = List.of(
                    first.get(10, TimeUnit.SECONDS), second.get(10, TimeUnit.SECONDS));

            assertThat(results).filteredOn(ParticipationDownstreamResult::certificateChanged)
                    .hasSize(1);
            assertThat(results).extracting(ParticipationDownstreamResult::certificateId)
                    .doesNotContainNull()
                    .containsOnly(results.getFirst().certificateId());
            assertThat(count("certificates", "attendance_id", attendanceId)).isEqualTo(1);
            assertThat(count("notifications", "recipient_user_id", participantId)).isEqualTo(1);
        } finally {
            executor.shutdownNow();
        }
    }

    @Test
    void notificationFailureRollsBackCertificateAndRatingChangesTogether() {
        insertActiveRating();
        ParticipationDownstreamResult issued = cascade.issueOrRestore(
                command("activity-completed-" + activityId, BASE.plusSeconds(60)));
        Instant voidedAt = BASE.plusSeconds(120);
        jdbc.update("""
                update attendances
                set status = 'VOIDED', voided_at = ?, updated_at = ?
                where attendance_id = ?
                """, Timestamp.from(voidedAt), Timestamp.from(voidedAt), attendanceId);
        doThrow(new IllegalStateException("notification failure"))
                .when(notificationWriter).write(any());

        assertThatThrownBy(() -> cascade.revokeAndInvalidate(
                command("attendance-adjustment-rollback", voidedAt)))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("notification failure");

        assertThat(jdbc.queryForObject(
                "select status from certificates where certificate_id = ?",
                String.class, issued.certificateId())).isEqualTo("ISSUED");
        assertThat(jdbc.queryForObject(
                "select status from activity_ratings where attendance_id = ?",
                String.class, attendanceId)).isEqualTo("ACTIVE");
        assertThat(count("notifications", "recipient_user_id", participantId)).isEqualTo(1);
    }

    private ParticipationDownstreamCommand command(String key, Instant occurredAt) {
        return new ParticipationDownstreamCommand(attendanceId, key, occurredAt);
    }

    private int count(String table, String column, Long value) {
        return jdbc.queryForObject(
                "select count(*) from " + table + " where " + column + " = ?",
                Integer.class, value);
    }

    private List<Object> certificateIdentity(Long certificateId) {
        return jdbc.queryForObject("""
                select certificate_id, certificate_code, recipient_name_snapshot, issued_at
                from certificates where certificate_id = ?
                """, (rs, row) -> List.of(
                rs.getLong("certificate_id"),
                rs.getString("certificate_code"),
                rs.getString("recipient_name_snapshot"),
                rs.getTimestamp("issued_at").toInstant()), certificateId);
    }

    private long insertUser(String kind) {
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        return jdbc.queryForObject("""
                insert into users(username, password_hash, full_name, email, status)
                values (?, '{noop}unused', ?, ?, 'ACTIVE') returning user_id
                """, Long.class, "cascade" + kind + suffix, "Cascade " + kind,
                "cascade" + kind + suffix + "@example.test");
    }

    private long insertEvent() {
        return jdbc.queryForObject("""
                insert into events(
                    organizer_user_id, name, start_at, end_at,
                    participant_registration_deadline_at,
                    booth_payment_window_minutes, max_booths_per_partner,
                    max_activities_per_partner, status, created_at, updated_at)
                values (?, ?, ?, ?, ?, 60, 2, 3, 'PUBLISHED', ?, ?)
                returning event_id
                """, Long.class, organizerId, "Certificate Cascade Test",
                Timestamp.from(BASE.minus(Duration.ofHours(4))),
                Timestamp.from(BASE.plus(Duration.ofHours(4))),
                Timestamp.from(BASE.minus(Duration.ofHours(5))),
                Timestamp.from(BASE.minus(Duration.ofDays(1))),
                Timestamp.from(BASE.minus(Duration.ofDays(1))));
    }

    private long insertLocation() {
        String code = "CERT6-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        return jdbc.queryForObject("""
                insert into locations(code, name, location_type, max_capacity, is_active,
                    created_at, updated_at)
                values (?, 'Certificate Stage', 'STAGE', 100, true, ?, ?)
                returning location_id
                """, Long.class, code, Timestamp.from(BASE.minus(Duration.ofDays(1))),
                Timestamp.from(BASE.minus(Duration.ofDays(1))));
    }

    private long insertCompletedActivity() {
        return jdbc.queryForObject("""
                insert into activities(
                    event_id, location_id, title, activity_type, start_at, end_at,
                    registration_required, registration_deadline_at, capacity,
                    attendance_qr_token, is_certificate_enabled, status,
                    created_at, updated_at, published_at, completed_at)
                values (?, ?, 'Certificate Activity', 'TALKSHOW', ?, ?, true, ?, 100,
                    ?, true, 'COMPLETED', ?, ?, ?, ?)
                returning activity_id
                """, Long.class, eventId, locationId,
                Timestamp.from(BASE.minus(Duration.ofHours(2))),
                Timestamp.from(BASE.minus(Duration.ofHours(1))),
                Timestamp.from(BASE.minus(Duration.ofHours(3))), UUID.randomUUID(),
                Timestamp.from(BASE.minus(Duration.ofDays(1))), Timestamp.from(BASE),
                Timestamp.from(BASE.minus(Duration.ofDays(1))), Timestamp.from(BASE));
    }

    private long insertEventRegistration() {
        return jdbc.queryForObject("""
                insert into event_registrations(
                    user_id, event_id, status, registered_at, activated_at, updated_at)
                values (?, ?, 'ACTIVE', ?, ?, ?) returning event_registration_id
                """, Long.class, participantId, eventId,
                Timestamp.from(BASE.minus(Duration.ofDays(1))),
                Timestamp.from(BASE.minus(Duration.ofDays(1))),
                Timestamp.from(BASE.minus(Duration.ofDays(1))));
    }

    private long insertActivityRegistration() {
        return jdbc.queryForObject("""
                insert into activity_registrations(
                    event_registration_id, activity_id, status,
                    registered_at, activated_at, updated_at)
                values (?, ?, 'ACTIVE', ?, ?, ?) returning activity_registration_id
                """, Long.class, eventRegistrationId, activityId,
                Timestamp.from(BASE.minus(Duration.ofHours(3))),
                Timestamp.from(BASE.minus(Duration.ofHours(3))),
                Timestamp.from(BASE.minus(Duration.ofHours(3))));
    }

    private long insertAttendance() {
        return jdbc.queryForObject("""
                insert into attendances(
                    activity_registration_id, status, recorded_source,
                    attended_at, created_at, updated_at)
                values (?, 'VALID', 'SELF_SCAN', ?, ?, ?) returning attendance_id
                """, Long.class, activityRegistrationId,
                Timestamp.from(BASE.minus(Duration.ofHours(2))), Timestamp.from(BASE),
                Timestamp.from(BASE));
    }

    private void insertActiveRating() {
        jdbc.update("""
                insert into activity_ratings(
                    attendance_id, rating_score, comment, status, created_at, updated_at)
                values (?, 5, 'Great session', 'ACTIVE', ?, ?)
                """, attendanceId, Timestamp.from(BASE), Timestamp.from(BASE));
    }
}
