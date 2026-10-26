package com.swp391.bookstreet.attendance;

import com.swp391.bookstreet.event.service.EventCancellationMailService;
import com.swp391.bookstreet.security.authentication.AuthenticatedPrincipal;
import com.swp391.bookstreet.activity.service.ActivityLifecycleTransactionService;
import com.swp391.bookstreet.notification.service.ParticipantNotificationWriter;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.doCallRealMethod;
import static org.mockito.ArgumentMatchers.any;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.ApplicationContextInitializer;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
        "spring.datasource.url=${EVENT_TEST_DATABASE_URL}",
        "logging.level.org.springframework.security=ERROR"
})
@EnabledIfEnvironmentVariable(named = "EVENT_TEST_DATABASE_URL", matches = ".+")
@ContextConfiguration(initializers = AttendanceFlowIntegrationTests.TestDatabaseGuard.class)
@Import(AttendanceFlowIntegrationTests.FixedClockConfiguration.class)
class AttendanceFlowIntegrationTests {
    private static final Instant BASE = Instant.parse("2026-10-19T08:00:00Z");
    private static final String PARTICIPANT = "/api/v1/participant";

    static class TestDatabaseGuard implements ApplicationContextInitializer<ConfigurableApplicationContext> {
        @Override
        public void initialize(ConfigurableApplicationContext applicationContext) {
            String url = applicationContext.getEnvironment()
                    .getRequiredProperty("spring.datasource.url");
            if (!url.matches("jdbc:postgresql://[^/]+/[A-Za-z0-9_]+_event_test(?:\\?.*)?")) {
                throw new IllegalStateException(
                        "Attendance tests require a dedicated *_event_test database.");
            }
        }
    }

    @TestConfiguration
    static class FixedClockConfiguration {
        @Bean
        @Primary
        MutableClock registrationTestClock() {
            return new MutableClock(BASE);
        }
    }

    static final class MutableClock extends Clock {
        private final AtomicReference<Instant> instant;

        MutableClock(Instant initial) {
            instant = new AtomicReference<>(initial);
        }

        void set(Instant value) {
            instant.set(value);
        }

        @Override public ZoneId getZone() { return ZoneOffset.UTC; }
        @Override public Clock withZone(ZoneId zone) { return this; }
        @Override public Instant instant() { return instant.get(); }
    }

    @Autowired WebApplicationContext context;
    @Autowired JdbcTemplate jdbc;
    @Autowired ObjectMapper mapper;
    @Autowired MutableClock clock;
    @Autowired ActivityLifecycleTransactionService lifecycle;
    @MockitoSpyBean ParticipantNotificationWriter notifications;
    @MockitoBean EventCancellationMailService cancellationMailService;
    MockMvc mvc;
    Long organizerId;
    Long participantId;
    Long otherParticipantId;

    @BeforeEach
    void setup() {
        assertThat(jdbc.queryForObject("select current_database()", String.class))
                .endsWith("_event_test");
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        clock.set(BASE);
        organizerId = insertUser("organizer");
        participantId = insertUser("participant");
        otherParticipantId = insertUser("other");
    }

    @AfterEach
    void cleanup() {
        jdbc.update("delete from attendance_adjustments where actor_user_id = ?", organizerId);
        jdbc.update("delete from activity_revisions where actor_user_id = ?", organizerId);
        jdbc.update("delete from notifications where recipient_user_id in (?, ?)",
                participantId, otherParticipantId);
        jdbc.update("""
                delete from activity_ratings where attendance_id in (
                    select attendance_id from attendances where activity_registration_id in (
                        select activity_registration_id from activity_registrations
                        where event_registration_id in (
                            select event_registration_id from event_registrations
                            where user_id in (?, ?)
                        )
                    )
                )
                """, participantId, otherParticipantId);
        jdbc.update("""
                delete from certificates where attendance_id in (
                    select attendance_id from attendances where activity_registration_id in (
                        select activity_registration_id from activity_registrations
                        where event_registration_id in (
                            select event_registration_id from event_registrations
                            where user_id in (?, ?)
                        )
                    )
                )
                """, participantId, otherParticipantId);
        jdbc.update("""
                delete from attendances where activity_registration_id in (
                    select activity_registration_id from activity_registrations
                    where event_registration_id in (
                        select event_registration_id from event_registrations
                        where user_id in (?, ?)
                    )
                )
                """, participantId, otherParticipantId);
        jdbc.update("""
                delete from activity_registrations
                where event_registration_id in (
                    select event_registration_id from event_registrations
                    where user_id in (?, ?)
                )
                """, participantId, otherParticipantId);
        jdbc.update("delete from event_registrations where user_id in (?, ?)",
                participantId, otherParticipantId);
        jdbc.update("delete from activities where event_id in (select event_id from events where organizer_user_id = ?)",
                organizerId);
        jdbc.update("delete from locations where code like ?", "ATT6-%");
        jdbc.update("delete from events where organizer_user_id = ?", organizerId);
        jdbc.update("delete from users where user_id in (?, ?, ?)", organizerId,
                participantId, otherParticipantId);
    }


    private static final Instant START = BASE.plusSeconds(7200);
    private static final Instant END = BASE.plusSeconds(10800);
    private static final String SCAN = "/api/v1/participant/attendance-scans";

    record Fixture(long eventId, long activityId, long registrationId, String token) {}

    private Fixture fixture() throws Exception {
        long eventId = insertEvent("Attendance Event", BASE.plusSeconds(3600));
        long activityId = insertActivity(eventId, insertLocation(), "PUBLISHED");
        long registrationId = register(activityId, participantId);
        String token = jdbc.queryForObject("select attendance_qr_token::text from activities where activity_id=?", String.class, activityId);
        return new Fixture(eventId, activityId, registrationId, token);
    }

    private org.springframework.test.web.servlet.ResultActions scan(Fixture f, long userId) throws Exception {
        return mvc.perform(post(SCAN).with(participant(userId)).with(csrf())
                .contentType("application/json").content(mapper.writeValueAsString(java.util.Map.of("token", f.token()))));
    }

    private org.springframework.test.web.servlet.ResultActions correct(Fixture f, String key, String target,
            Instant effective, String reason) throws Exception {
        var request = new java.util.LinkedHashMap<String, Object>();
        request.put("targetAttendanceStatus", target);
        request.put("effectiveAttendedAt", effective == null ? null : effective.toString());
        request.put("reason", reason);
        return mvc.perform(post("/api/v1/organizer/activity-registrations/" + f.registrationId() + "/attendance-adjustments")
                .with(organizer(organizerId)).with(csrf()).header("Idempotency-Key", key)
                .contentType("application/json").content(mapper.writeValueAsString(request)));
    }

    private long count(String table) {
        // Tests run only against the guarded disposable *_event_test database.
        return jdbc.queryForObject("select count(*) from " + table, Long.class);
    }

    @ParameterizedTest
    @CsvSource({"6299,409,ATTENDANCE_WINDOW_NOT_OPEN", "6300,200,ok", "6301,200,ok",
            "7199,200,ok", "7200,200,ok", "7201,200,ok", "10799,200,ok",
            "10800,409,ATTENDANCE_WINDOW_CLOSED", "10801,409,ATTENDANCE_WINDOW_CLOSED"})
    void exactScanWindow(long seconds, int expected, String code) throws Exception {
        Fixture f = fixture();
        clock.set(BASE.plusSeconds(seconds));
        var result = scan(f, participantId).andExpect(status().is(expected));
        if (expected == 200) {
            result.andExpect(jsonPath("$.attendance.status").value("VALID"))
                    .andExpect(jsonPath("$.attendance.recordedSource").value("SELF_SCAN"))
                    .andExpect(jsonPath("$.alreadyRecorded").value(false));
            assertThat(count("certificates")).isZero();
        } else result.andExpect(jsonPath("$.code").value(code));
    }

    @Test
    void organizerCanSetEarlyQrWindowAndValidAttendanceFreezesIt() throws Exception {
        Fixture f = fixture();
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch(
                        "/api/v1/organizer/activities/" + f.activityId())
                .with(organizer(organizerId)).with(csrf())
                .contentType("application/json")
                .content("{\"attendanceEarlyScanMinutes\":30,\"changeReason\":\"Adjust QR check-in opening time\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.attendanceEarlyScanMinutes").value(30));
        assertThat(jdbc.queryForObject("select attendance_early_scan_minutes from activities where activity_id=?",
                Integer.class, f.activityId())).isEqualTo(30);
        clock.set(START.minusSeconds(1801));
        scan(f, participantId).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("ATTENDANCE_WINDOW_NOT_OPEN"));
        clock.set(START.minusSeconds(1800));
        scan(f, participantId).andExpect(status().isOk());
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch(
                        "/api/v1/organizer/activities/" + f.activityId())
                .with(organizer(organizerId)).with(csrf())
                .contentType("application/json")
                .content("{\"attendanceEarlyScanMinutes\":45,\"changeReason\":\"Adjust QR check-in opening time\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("ACTIVITY_ATTENDANCE_WINDOW_FROZEN"));
    }

    @Test
    void invalidEarlyQrWindowIsRejected() throws Exception {
        Fixture f = fixture();
        for (int value : new int[]{-1, 1441}) {
            mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch(
                            "/api/v1/organizer/activities/" + f.activityId())
                    .with(organizer(organizerId)).with(csrf())
                    .contentType("application/json")
                    .content("{\"attendanceEarlyScanMinutes\":" + value + "}"))
                    .andExpect(status().isUnprocessableContent())
                    .andExpect(jsonPath("$.code").value("ACTIVITY_ATTENDANCE_WINDOW_INVALID"));
        }
    }

    @Test
    void organizerCreateDefaultsToFifteenMinutesAndAcceptsCustomMinutes() throws Exception {
        long eventId = insertEvent("QR configuration Event", BASE.plusSeconds(3600));
        for (Integer configured : new Integer[]{null, 45}) {
            long locationId = insertLocation();
            var request = new java.util.LinkedHashMap<String, Object>();
            request.put("eventId", eventId);
            request.put("locationId", locationId);
            request.put("title", "QR configuration Activity");
            request.put("activityType", "Workshop");
            request.put("startAt", START.toString());
            request.put("endAt", END.toString());
            request.put("capacity", 10);
            request.put("registrationRequired", true);
            request.put("registrationDeadlineAt", BASE.plusSeconds(3600).toString());
            request.put("certificateEnabled", false);
            if (configured != null) request.put("attendanceEarlyScanMinutes", configured);
            var response = body(mvc.perform(post("/api/v1/organizer/activities")
                    .with(organizer(organizerId)).with(csrf())
                    .contentType("application/json").content(mapper.writeValueAsString(request)))
                    .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString());
            int expected = configured == null ? 15 : configured;
            assertThat(response.get("attendanceEarlyScanMinutes").asInt()).isEqualTo(expected);
            assertThat(jdbc.queryForObject("select attendance_early_scan_minutes from activities where activity_id=?",
                    Integer.class, response.get("activityId").asLong())).isEqualTo(expected);
        }
    }

    @Test
    void repeatedAndConcurrentScansKeepOneIdentityAndTimestamps() throws Exception {
        Fixture f = fixture(); clock.set(START.minusSeconds(900));
        try (var pool = Executors.newFixedThreadPool(2)) {
            var ready = new CountDownLatch(2); var start = new CountDownLatch(1);
            java.util.concurrent.Callable<JsonNode> task = () -> {
                ready.countDown(); start.await(5, TimeUnit.SECONDS);
                return body(scan(f, participantId).andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
            };
            var first = pool.submit(task); var second = pool.submit(task);
            assertThat(ready.await(5, TimeUnit.SECONDS)).isTrue(); start.countDown();
            var a = first.get(15, TimeUnit.SECONDS); var b = second.get(15, TimeUnit.SECONDS);
            assertThat(a.get("attendance")).isEqualTo(b.get("attendance"));
            assertThat(a.get("alreadyRecorded").asBoolean()).isNotEqualTo(b.get("alreadyRecorded").asBoolean());
            clock.set(START);
            var replay = body(scan(f, participantId).andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
            assertThat(replay.get("attendance")).isEqualTo(a.get("attendance"));
            assertThat(count("attendances")).isEqualTo(1);
        }
    }

    @Test
    void tokenIsPrivateAndOnlyOwnerDetailReturnsItWithoutCaching() throws Exception {
        Fixture f = fixture();
        mvc.perform(get("/api/v1/organizer/activities/" + f.activityId()).with(organizer(organizerId)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.attendanceQrToken").value(f.token()))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.header().string("Cache-Control", "no-store"));
        for (String path : List.of("/api/v1/activities", "/api/v1/activities/" + f.activityId(),
                "/api/v1/organizer/activities", "/api/v1/participant/activity-registrations")) {
            String response = mvc.perform(get(path).with(path.contains("organizer") ? organizer(organizerId) : participant(participantId)))
                    .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
            assertThat(response).doesNotContain(f.token());
        }
    }

    @Test
    void malformedUnknownTokensAndClientIdentityAreRejectedWithoutEcho() throws Exception {
        fixture(); clock.set(START);
        for (String token : List.of("bad-token-secret", UUID.randomUUID().toString())) {
            var response = mvc.perform(post(SCAN).with(participant(participantId)).with(csrf())
                    .contentType("application/json").content(mapper.writeValueAsString(java.util.Map.of("token", token))))
                    .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("ATTENDANCE_QR_NOT_FOUND"))
                    .andReturn().getResponse().getContentAsString();
            assertThat(response).doesNotContain(token);
        }
        mvc.perform(post(SCAN).with(participant(participantId)).with(csrf()).contentType("application/json")
                .content("{\"token\":\"test\",\"userId\":1}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("UNKNOWN_FIELD"));
    }

    @Test
    void scanRequiresSessionParticipantCsrfAndActiveOwnedRegistration() throws Exception {
        Fixture f = fixture(); clock.set(START);
        mvc.perform(post(SCAN).with(csrf()).contentType("application/json").content("{}"))
                .andExpect(status().isUnauthorized());
        mvc.perform(post(SCAN).with(organizer(organizerId)).with(csrf()).contentType("application/json").content("{}"))
                .andExpect(status().isForbidden());
        mvc.perform(post(SCAN).with(participant(participantId)).contentType("application/json").content("{}"))
                .andExpect(status().isForbidden());
        scan(f, otherParticipantId).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("ATTENDANCE_REGISTRATION_INELIGIBLE"));
        assertThat(count("attendances")).isZero();
    }

    @ParameterizedTest
    @ValueSource(strings = {"CANCELLED", "NO_SHOW"})
    void inactiveRegistrationCannotScan(String state) throws Exception {
        Fixture f = fixture();
        if (state.equals("CANCELLED")) {
            mvc.perform(post(PARTICIPANT + "/activities/" + f.activityId() + "/cancel-registration")
                    .with(participant(participantId)).with(csrf())).andExpect(status().isOk());
        } else jdbc.update("update activity_registrations set status='NO_SHOW', no_show_at=?, updated_at=? where activity_registration_id=?",
                Timestamp.from(BASE), Timestamp.from(BASE), f.registrationId());
        clock.set(START);
        scan(f, participantId).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("ATTENDANCE_REGISTRATION_INELIGIBLE"));
    }

    @Test
    void completionClassifiesNoShowAndIssuesCertificatesExactlyOnce() throws Exception {
        Fixture f = fixture(); long absent = register(f.activityId(), otherParticipantId);
        clock.set(START); scan(f, participantId).andExpect(status().isOk());
        clock.set(END.minusNanos(1000)); lifecycle.advance(f.activityId());
        assertThat(count("certificates")).isZero();
        clock.set(END); lifecycle.advance(f.activityId());
        var certificate = jdbc.queryForMap("select * from certificates");
        var noShow = jdbc.queryForMap("select * from activity_registrations where activity_registration_id=?", absent);
        assertThat(noShow.get("status")).isEqualTo("NO_SHOW");
        assertThat(count("notifications")).isEqualTo(1);
        clock.set(END.plusSeconds(60)); lifecycle.advance(f.activityId());
        assertThat(jdbc.queryForMap("select * from certificates")).isEqualTo(certificate);
        assertThat(jdbc.queryForMap("select * from activity_registrations where activity_registration_id=?", absent)).isEqualTo(noShow);
        assertThat(count("notifications")).isEqualTo(1);
    }

    @Test
    void completionSkipsCancelledRowsAndVoidedEvidenceBecomesNoShow() throws Exception {
        Fixture f = fixture(); long cancelled = register(f.activityId(), otherParticipantId);
        mvc.perform(post(PARTICIPANT + "/activities/" + f.activityId() + "/cancel-registration")
                .with(participant(otherParticipantId)).with(csrf())).andExpect(status().isOk());
        clock.set(START); scan(f, participantId).andExpect(status().isOk());
        correct(f, UUID.randomUUID().toString(), "VOIDED", null, "Incorrect initial Attendance record")
                .andExpect(status().isOk()).andExpect(jsonPath("$.participation.registrationStatus").value("ACTIVE"));
        clock.set(END); lifecycle.advance(f.activityId());
        assertThat(jdbc.queryForObject("select status from activity_registrations where activity_registration_id=?", String.class, f.registrationId())).isEqualTo("NO_SHOW");
        assertThat(jdbc.queryForObject("select status from activity_registrations where activity_registration_id=?", String.class, cancelled)).isEqualTo("CANCELLED");
        assertThat(count("certificates")).isZero();
    }

    @Test
    void lateCorrectionVoidRestoreAuditsAndCascadesCertificateRating() throws Exception {
        Fixture f = fixture(); clock.set(END); lifecycle.advance(f.activityId());
        String key = UUID.randomUUID().toString(); String reason = "Verified attendance after scanner outage";
        var first = correct(f, key, "VALID", START, "  Verified   attendance after scanner outage  ")
                .andExpect(status().isOk()).andExpect(jsonPath("$.attendance.recordedSource").value("ORGANIZER_CORRECTION"))
                .andExpect(jsonPath("$.attendance.attendedAt").value(START.toString()))
                .andExpect(jsonPath("$.attendance.createdAt").value(END.toString()))
                .andExpect(jsonPath("$.certificate.status").value("ISSUED"))
                .andExpect(jsonPath("$.adjustment.reason").value(reason));
        long attendanceId = body(first.andReturn().getResponse().getContentAsString()).get("attendance").get("attendanceId").asLong();
        mvc.perform(put(PARTICIPANT + "/activities/" + f.activityId() + "/rating").with(participant(participantId)).with(csrf())
                .contentType("application/json").content("{\"score\":5,\"comment\":\"Great\"}"))
                .andExpect(status().isOk());
        var identity = jdbc.queryForMap("select certificate_id, certificate_code, issued_at from certificates");
        correct(f, key, "VALID", START, reason).andExpect(status().isOk()).andExpect(jsonPath("$.idempotentReplay").value(true));
        assertThat(count("attendance_adjustments")).isEqualTo(1);
        correct(f, UUID.randomUUID().toString(), "VALID", START, reason)
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("ATTENDANCE_CORRECTION_HAS_NO_EFFECT"));
        correct(f, key, "VOIDED", null, reason).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("IDEMPOTENCY_KEY_REUSED"));
        clock.set(END.plusSeconds(30));
        correct(f, UUID.randomUUID().toString(), "VOIDED", null, "Evidence was attached to the wrong person")
                .andExpect(status().isOk()).andExpect(jsonPath("$.participation.outcome").value("NO_SHOW"))
                .andExpect(jsonPath("$.certificate.status").value("REVOKED"))
                .andExpect(jsonPath("$.ratingStatus").value("INVALIDATED"));
        mvc.perform(get("/api/v1/activities/" + f.activityId())).andExpect(status().isOk())
                .andExpect(jsonPath("$.ratingSummary.ratingCount").value(0));
        clock.set(END.plusSeconds(60));
        correct(f, UUID.randomUUID().toString(), "VALID", START, reason).andExpect(status().isOk())
                .andExpect(jsonPath("$.attendance.attendanceId").value(attendanceId))
                .andExpect(jsonPath("$.certificate.status").value("ISSUED"))
                .andExpect(jsonPath("$.ratingStatus").value("ACTIVE"));
        assertThat(jdbc.queryForMap("select certificate_id, certificate_code, issued_at from certificates")).isEqualTo(identity);
        assertThat(count("attendance_adjustments")).isEqualTo(3);
        assertThat(count("notifications")).isEqualTo(3);
        mvc.perform(get("/api/v1/organizer/activity-registrations/" + f.registrationId() + "/attendance-adjustments")
                        .with(organizer(organizerId))).andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(3))
                .andExpect(jsonPath("$.content[0].previousState.attendanceStatus").value("VOIDED"))
                .andExpect(jsonPath("$.content[0].newState.attendanceStatus").value("VALID"));
    }

    @ParameterizedTest
    @CsvSource({"6299,422", "6300,200", "10799,200", "10800,422", "10801,422"})
    void correctionEffectiveWindow(long seconds, int expected) throws Exception {
        Fixture f = fixture(); clock.set(END);
        var result = correct(f, UUID.randomUUID().toString(), "VALID", BASE.plusSeconds(seconds), "Manual attendance verified by Organizer")
                .andExpect(status().is(expected));
        if (expected == 422) result.andExpect(jsonPath("$.code").value("ATTENDANCE_EFFECTIVE_TIME_OUTSIDE_WINDOW"));
    }

    @ParameterizedTest
    @ValueSource(ints = {0, 9, 10, 500, 501})
    void normalizedReasonLength(int length) throws Exception {
        Fixture f = fixture(); clock.set(END);
        boolean valid = length >= 10 && length <= 500;
        var result = correct(f, UUID.randomUUID().toString(), "VALID", START, "  " + "x".repeat(length) + "  ")
                .andExpect(status().is(valid ? 200 : 422));
        if (!valid) result.andExpect(jsonPath("$.code").value("ATTENDANCE_CORRECTION_REASON_INVALID"));
    }

    @Test
    void correctionRequiresKeyAndRejectsUnknownFieldsAndEnums() throws Exception {
        Fixture f = fixture();
        for (String key : List.of("bad", "")) correct(f, key, "VALID", START, "Reason with enough characters")
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_IDEMPOTENCY_KEY"));
        correct(f, UUID.randomUUID().toString(), "NO_SHOW", null, "Cannot assign NO_SHOW manually")
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_ENUM_VALUE"));
        correct(f, UUID.randomUUID().toString(), "VOIDED", START, "Wrong effective time on void command")
                .andExpect(status().isUnprocessableEntity());
    }

    @Test
    void monitoringSupportsOwnershipFiltersStablePagesAndCounts() throws Exception {
        Fixture f = fixture(); register(f.activityId(), otherParticipantId);
        clock.set(START); scan(f, participantId).andExpect(status().isOk());
        String path = "/api/v1/organizer/activities/" + f.activityId() + "/registrations";
        mvc.perform(get(path).with(organizer(organizerId)).param("outcome", "ATTENDED").param("size", "1"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].participant.userId").value(participantId));
        mvc.perform(get(path).with(organizer(organizerId)).param("outcome", "ACTIVE"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1));
        for (String sort : List.of("registeredAt", "activatedAt", "updatedAt", "participantDisplayName", "attendedAt")) {
            mvc.perform(get(path).with(organizer(organizerId)).param("sort", sort + ",desc")).andExpect(status().isOk());
        }
        mvc.perform(get(path).with(organizer(organizerId)).param("outcome", "FAKE"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_FILTER"));
        mvc.perform(get(path).with(organizer(organizerId)).param("sort", "passwordHash,asc"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_SORT"));
        mvc.perform(get(path).with(organizer(organizerId)).param("page", "-1"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_PAGE"));
        mvc.perform(get(path).with(organizer(organizerId)).param("size", "101"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_SIZE"));
        mvc.perform(get("/api/v1/organizer/events/" + f.eventId() + "/event-registrations").with(organizer(organizerId)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(2));
        for (String url : List.of(path, "/api/v1/organizer/activity-registrations/" + f.registrationId(),
                "/api/v1/organizer/activity-registrations/" + f.registrationId() + "/attendance-adjustments",
                "/api/v1/organizer/events/" + f.eventId() + "/event-registrations")) {
            mvc.perform(get(url).with(organizer(otherParticipantId))).andExpect(status().isNotFound());
        }
        mvc.perform(post("/api/v1/organizer/activity-registrations/" + f.registrationId() + "/attendance-adjustments")
                .with(organizer(otherParticipantId)).with(csrf()).header("Idempotency-Key", UUID.randomUUID().toString())
                .contentType("application/json").content("{\"targetAttendanceStatus\":\"VALID\",\"effectiveAttendedAt\":\"" + START + "\",\"reason\":\"Verified attendance manually\"}"))
                .andExpect(status().isNotFound());
    }

    private org.springframework.test.web.servlet.ResultActions reschedule(Fixture f, Instant start, Instant end) throws Exception {
        return mvc.perform(patch("/api/v1/organizer/activities/" + f.activityId()).with(organizer(organizerId)).with(csrf())
                .contentType("application/json").content(mapper.writeValueAsString(java.util.Map.of(
                        "startAt", start.toString(), "endAt", end.toString(), "changeReason", "Updated speaker availability and schedule"))));
    }

    private org.springframework.test.web.servlet.ResultActions cancel(Fixture f, boolean event) throws Exception {
        return mvc.perform(post("/api/v1/organizer/" + (event ? "events/" + f.eventId() : "activities/" + f.activityId()) + "/cancel")
                .with(organizer(organizerId)).with(csrf()).contentType("application/json")
                .content("{\"reason\":\"Cancelled due to venue disruption\"}"));
    }

    @Test
    void reschedulePreservesRowsAndTokenAndNotifiesOnlyActualChanges() throws Exception {
        Fixture f = fixture(); long cancelled = register(f.activityId(), otherParticipantId);
        mvc.perform(post(PARTICIPANT + "/activities/" + f.activityId() + "/cancel-registration")
                .with(participant(otherParticipantId)).with(csrf())).andExpect(status().isOk());
        reschedule(f, START.plusSeconds(3600), END.plusSeconds(3600)).andExpect(status().isOk());
        assertThat(count("notifications")).isEqualTo(1);
        reschedule(f, START.plusSeconds(3600), END.plusSeconds(3600)).andExpect(status().isOk());
        assertThat(count("notifications")).isEqualTo(1);
        assertThat(jdbc.queryForObject("select status from activity_registrations where activity_registration_id=?", String.class, f.registrationId())).isEqualTo("ACTIVE");
        assertThat(jdbc.queryForObject("select status from activity_registrations where activity_registration_id=?", String.class, cancelled)).isEqualTo("CANCELLED");
        assertThat(jdbc.queryForObject("select attendance_qr_token::text from activities where activity_id=?", String.class, f.activityId())).isEqualTo(f.token());
        clock.set(START); scan(f, participantId).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("ATTENDANCE_WINDOW_NOT_OPEN"));
        clock.set(START.plusSeconds(2700)); scan(f, participantId).andExpect(status().isOk());
    }

    @Test
    void earlyAttendanceFreezesScheduleAndLocationButCapacityFloorStillApplies() throws Exception {
        Fixture f = fixture(); register(f.activityId(), otherParticipantId);
        clock.set(START.minusSeconds(900)); scan(f, participantId).andExpect(status().isOk());
        reschedule(f, START.plusSeconds(3600), END.plusSeconds(3600)).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("ACTIVITY_ATTENDANCE_FREEZES_SCHEDULE_OR_LOCATION"));
        long newLocation = insertLocation();
        mvc.perform(patch("/api/v1/organizer/activities/" + f.activityId()).with(organizer(organizerId)).with(csrf())
                .contentType("application/json").content("{\"locationId\":" + newLocation + ",\"changeReason\":\"Move to the replacement stage\"}"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("ACTIVITY_ATTENDANCE_FREEZES_SCHEDULE_OR_LOCATION"));
        mvc.perform(patch("/api/v1/organizer/activities/" + f.activityId()).with(organizer(organizerId)).with(csrf())
                .contentType("application/json").content("{\"capacity\":1,\"changeReason\":\"Venue capacity reduced for safety\"}"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("ACTIVITY_CAPACITY_BELOW_ACTIVE_REGISTRATIONS"));
    }

    @Test
    void scheduleCannotMoveBeforeItsRegistrationDeadline() throws Exception {
        Fixture f = fixture();
        reschedule(f, BASE.plusSeconds(1800), BASE.plusSeconds(5400)).andExpect(status().isUnprocessableEntity());
        assertThat(count("notifications")).isZero();
    }

    @Test
    void publishedRegistrationRequirementCannotBeTurnedOffAfterSeatsExist() throws Exception {
        Fixture f = fixture();
        mvc.perform(patch("/api/v1/organizer/activities/" + f.activityId()).with(organizer(organizerId)).with(csrf())
                .contentType("application/json").content("{\"registrationRequired\":false,\"registrationDeadlineAt\":null,\"certificateEnabled\":false}"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("ACTIVITY_NOT_CHANGEABLE"));
        assertThat(jdbc.queryForObject("select attendance_qr_token::text from activities where activity_id=?", String.class, f.activityId())).isEqualTo(f.token());
    }

    @Test
    void lateScanAloneFinalizesNoShowBeforeReturningClosedWindow() throws Exception {
        Fixture f = fixture(); clock.set(END);
        scan(f, participantId).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("ATTENDANCE_WINDOW_CLOSED"));
        assertThat(jdbc.queryForObject("select status from activities where activity_id=?", String.class, f.activityId())).isEqualTo("COMPLETED");
        assertThat(jdbc.queryForObject("select status from activity_registrations where activity_registration_id=?", String.class, f.registrationId())).isEqualTo("NO_SHOW");
    }

    @Test
    void myActivitiesReadUsesCompletedOutcomeAndFinalizesBeforeReturningIt() throws Exception {
        Fixture f = fixture(); clock.set(END);
        mvc.perform(get(PARTICIPANT + "/activity-registrations/" + f.registrationId())
                        .with(participant(participantId)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("NO_SHOW"))
                .andExpect(jsonPath("$.outcome").value("NO_SHOW"));
        assertThat(jdbc.queryForObject("select status from activities where activity_id=?", String.class, f.activityId()))
                .isEqualTo("COMPLETED");
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void cancellationPreservesAttendanceAndOnlyAllowsAuditedHistoricalRestore(boolean eventCancellation) throws Exception {
        Fixture f = fixture(); long absent = register(f.activityId(), otherParticipantId);
        // Event cancellation must occur while Event is PUBLISHED, including Activity's early window.
        jdbc.update("update events set start_at=? where event_id=?", Timestamp.from(START), f.eventId());
        clock.set(START.minusSeconds(900)); scan(f, participantId).andExpect(status().isOk());
        cancel(f, eventCancellation).andExpect(status().isOk());
        cancel(f, eventCancellation).andExpect(status().isOk());
        assertThat(count("notifications")).isEqualTo(2);
        String source = eventCancellation ? "EVENT" : "ACTIVITY";
        mvc.perform(get(PARTICIPANT + "/activity-registrations/" + f.registrationId()).with(participant(participantId)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.outcome").value("CANCELLED"))
                .andExpect(jsonPath("$.attendance.status").value("VALID"));
        scan(f, participantId).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("ATTENDANCE_ACTIVITY_INELIGIBLE"));
        correct(f, UUID.randomUUID().toString(), "VOIDED", null, "Historical attendance record corrected")
                .andExpect(status().isOk()).andExpect(jsonPath("$.participation.cancellationSource").value(source));
        correct(f, UUID.randomUUID().toString(), "VALID", START.minusSeconds(900), "Historical attendance record restored")
                .andExpect(status().isOk()).andExpect(jsonPath("$.participation.outcome").value("CANCELLED"))
                .andExpect(jsonPath("$.attendance.recordedSource").value("SELF_SCAN"));
        correct(new Fixture(f.eventId(), f.activityId(), absent, f.token()), UUID.randomUUID().toString(), "VALID",
                START, "Cannot fabricate attendance after cancellation").andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("ATTENDANCE_HISTORY_REQUIRED"));
    }

    @Test
    void completionNotificationFailureRollsBackEntireFinalization() throws Exception {
        Fixture f = fixture(); long absent = register(f.activityId(), otherParticipantId);
        clock.set(START); scan(f, participantId).andExpect(status().isOk());
        clock.set(END);
        doThrow(new IllegalStateException("simulated notification storage outage")).when(notifications).write(any());
        try {
            org.assertj.core.api.Assertions.assertThatThrownBy(() -> lifecycle.advance(f.activityId())).isInstanceOf(IllegalStateException.class);
            assertThat(jdbc.queryForObject("select status from activities where activity_id=?", String.class, f.activityId())).isEqualTo("ONGOING");
            assertThat(jdbc.queryForObject("select status from activity_registrations where activity_registration_id=?", String.class, absent)).isEqualTo("ACTIVE");
            assertThat(count("certificates")).isZero();
        } finally { doCallRealMethod().when(notifications).write(any()); }
        lifecycle.advance(f.activityId());
        assertThat(count("certificates")).isEqualTo(1);
    }

    @Test
    void failedCorrectionRollsBackAttendanceAuditCertificateAndRating() throws Exception {
        Fixture f = fixture(); clock.set(END); lifecycle.advance(f.activityId());
        correct(f, UUID.randomUUID().toString(), "VALID", START, "Manual Attendance after scanner failure").andExpect(status().isOk());
        doThrow(new IllegalStateException("simulated notification storage outage")).when(notifications).write(any());
        try {
            org.assertj.core.api.Assertions.assertThatThrownBy(() -> correct(f, UUID.randomUUID().toString(), "VOIDED", null,
                    "Correction must roll back atomically")).hasRootCauseInstanceOf(IllegalStateException.class);
            assertThat(jdbc.queryForObject("select status from attendances", String.class)).isEqualTo("VALID");
            assertThat(jdbc.queryForObject("select status from certificates", String.class)).isEqualTo("ISSUED");
            assertThat(count("attendance_adjustments")).isEqualTo(1);
        } finally { doCallRealMethod().when(notifications).write(any()); }
    }

    @Test
    void concurrentCorrectionsReplayOneAuditAndRejectReusedKeyAcrossRegistrations() throws Exception {
        Fixture f = fixture(); long other = register(f.activityId(), otherParticipantId); clock.set(END);
        String key = UUID.randomUUID().toString();
        try (var pool = Executors.newFixedThreadPool(2)) {
            java.util.concurrent.Callable<JsonNode> command = () -> body(correct(f, key, "VALID", START,
                    "Verified attendance by concurrent retry").andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
            var a = pool.submit(command); var b = pool.submit(command);
            assertThat(a.get(15, TimeUnit.SECONDS).get("adjustment").get("attendanceAdjustmentId"))
                    .isEqualTo(b.get(15, TimeUnit.SECONDS).get("adjustment").get("attendanceAdjustmentId"));
        }
        assertThat(count("attendance_adjustments")).isEqualTo(1);
        correct(new Fixture(f.eventId(), f.activityId(), other, f.token()), key, "VALID", START,
                "Verified attendance by concurrent retry").andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("IDEMPOTENCY_KEY_REUSED"));
    }

    @Test
    void scanRacingRescheduleUsesCommittedScheduleOrFreezesChange() throws Exception {
        Fixture f = fixture(); clock.set(START.minusSeconds(900));
        try (var pool = Executors.newFixedThreadPool(2)) {
            var a = pool.submit(() -> scan(f, participantId).andReturn().getResponse().getStatus());
            var b = pool.submit(() -> reschedule(f, START.plusSeconds(3600), END.plusSeconds(3600)).andReturn().getResponse().getStatus());
            int scanStatus = a.get(15, TimeUnit.SECONDS); int changeStatus = b.get(15, TimeUnit.SECONDS);
            assertThat(List.of(scanStatus, changeStatus)).containsExactlyInAnyOrder(200, 409);
        }
    }

    @Test
    void finalScanRacingCompletionNeverCreatesAttendanceAtExclusiveEnd() throws Exception {
        Fixture f = fixture(); clock.set(END);
        try (var pool = Executors.newFixedThreadPool(2)) {
            var a = pool.submit(() -> scan(f, participantId).andReturn().getResponse().getStatus());
            var b = pool.submit(() -> lifecycle.advance(f.activityId()));
            assertThat(a.get(15, TimeUnit.SECONDS)).isEqualTo(409); b.get(15, TimeUnit.SECONDS);
        }
        assertThat(count("attendances")).isZero();
        assertThat(jdbc.queryForObject("select status from activity_registrations where activity_registration_id=?", String.class, f.registrationId())).isEqualTo("NO_SHOW");
    }

    @Test
    void scanRacingCancellationLeavesOnlyCancelledParticipation() throws Exception {
        Fixture f = fixture(); clock.set(START.minusSeconds(900));
        try (var pool = Executors.newFixedThreadPool(2)) {
            var a = pool.submit(() -> scan(f, participantId).andReturn().getResponse().getStatus());
            var b = pool.submit(() -> cancel(f, false).andReturn().getResponse().getStatus());
            assertThat(a.get(15, TimeUnit.SECONDS)).isIn(200, 409);
            assertThat(b.get(15, TimeUnit.SECONDS)).isEqualTo(200);
        }
        assertThat(jdbc.queryForObject("select status from activity_registrations where activity_registration_id=?", String.class, f.registrationId())).isEqualTo("CANCELLED");
    }

    @Test
    void capacityReductionRacingRegistrationNeverOverbooks() throws Exception {
        Fixture f = fixture();
        try (var pool = Executors.newFixedThreadPool(2)) {
            var a = pool.submit(() -> mvc.perform(post(PARTICIPANT + "/activities/" + f.activityId() + "/register")
                    .with(participant(otherParticipantId)).with(csrf())).andReturn().getResponse().getStatus());
            var b = pool.submit(() -> mvc.perform(patch("/api/v1/organizer/activities/" + f.activityId()).with(organizer(organizerId)).with(csrf())
                    .contentType("application/json").content("{\"capacity\":1,\"changeReason\":\"Reduce available venue capacity\"}"))
                    .andReturn().getResponse().getStatus());
            assertThat(List.of(a.get(15, TimeUnit.SECONDS), b.get(15, TimeUnit.SECONDS))).containsExactlyInAnyOrder(200, 409);
        }
        long capacity = jdbc.queryForObject("select capacity from activities where activity_id=?", Long.class, f.activityId());
        assertThat(count("activity_registrations")).isLessThanOrEqualTo(capacity);
    }

    private long join(long eventId, long userId) throws Exception {
        return body(mvc.perform(post(PARTICIPANT + "/events/" + eventId + "/join")
                        .with(participant(userId)).with(csrf()))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString())
                .get("eventRegistrationId").asLong();
    }

    private long register(long activityId, long userId) throws Exception {
        return body(mvc.perform(post(PARTICIPANT + "/activities/" + activityId + "/register")
                        .with(participant(userId)).with(csrf()))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString())
                .get("activityRegistrationId").asLong();
    }

    private JsonNode body(String value) {
        return mapper.readTree(value);
    }

    private long insertUser(String kind) {
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        return jdbc.queryForObject("""
                insert into users(username, password_hash, full_name, email, status)
                values (?, '{noop}unused', ?, ?, 'ACTIVE') returning user_id
                """, Long.class, kind + suffix, "Registration " + kind,
                kind + suffix + "@example.test");
    }

    private long insertEvent(String name, Instant deadline) {
        return jdbc.queryForObject("""
                insert into events(
                    organizer_user_id, name, start_at, end_at,
                    participant_registration_deadline_at,
                    booth_payment_window_minutes, max_booths_per_partner,
                    max_activities_per_partner, status, created_at, updated_at)
                values (?, ?, ?, ?, ?, 60, 2, 3, 'PUBLISHED', ?, ?)
                returning event_id
                """, Long.class, organizerId, name,
                Timestamp.from(BASE.plus(Duration.ofHours(1))),
                Timestamp.from(BASE.plus(Duration.ofDays(2))), Timestamp.from(deadline),
                Timestamp.from(BASE), Timestamp.from(BASE));
    }

    private long insertLocation() {
        String code = "ATT6-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        return jdbc.queryForObject("""
                insert into locations(code, name, location_type, max_capacity, is_active,
                    created_at, updated_at)
                values (?, 'Registration Stage', 'STAGE', 100, true, ?, ?)
                returning location_id
                """, Long.class, code, Timestamp.from(BASE), Timestamp.from(BASE));
    }

    private long insertActivity(long eventId, long locationId, String status) {
        return insertActivity(eventId, locationId, "Registration Activity",
                BASE.plus(Duration.ofHours(2)), BASE.plus(Duration.ofHours(3)),
                BASE.plus(Duration.ofHours(1)), 100, true, status);
    }

    private long insertActivity(long eventId, long locationId, String title,
            Instant startAt, Instant endAt, Instant deadline, int capacity,
            boolean registrationRequired, String status) {
        UUID attendanceToken = !"DRAFT".equals(status) && registrationRequired
                ? UUID.randomUUID() : null;
        Timestamp publishedAt = "DRAFT".equals(status) ? null : Timestamp.from(BASE);
        Timestamp registrationDeadline = registrationRequired ? Timestamp.from(deadline) : null;
        return jdbc.queryForObject("""
                insert into activities(
                    event_id, location_id, title, activity_type, start_at, end_at,
                    registration_required, registration_deadline_at, capacity,
                    attendance_qr_token, is_certificate_enabled, status,
                    created_at, updated_at, published_at)
                values (?, ?, ?, 'TALKSHOW', ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?)
                returning activity_id
                """, Long.class, eventId, locationId, title, Timestamp.from(startAt),
                Timestamp.from(endAt), registrationRequired, registrationDeadline, capacity,
                attendanceToken, registrationRequired, status,
                Timestamp.from(BASE), Timestamp.from(BASE), publishedAt);
    }

    private static org.springframework.test.web.servlet.request.RequestPostProcessor participant(
            long userId) {
        return role(userId, "PARTICIPANT");
    }

    private static org.springframework.test.web.servlet.request.RequestPostProcessor organizer(
            long userId) {
        var principal = new VerifiedIdentity(userId);
        return authentication(new UsernamePasswordAuthenticationToken(principal, null,
                java.util.List.of(new SimpleGrantedAuthority("ROLE_ORGANIZER"))));
    }

    private static org.springframework.test.web.servlet.request.RequestPostProcessor role(
            long userId, String role) {
        var principal = new Identity(userId);
        return authentication(new UsernamePasswordAuthenticationToken(principal, null,
                java.util.List.of(new SimpleGrantedAuthority("ROLE_" + role))));
    }

    private record Identity(Long userId) implements AuthenticatedPrincipal {
        @Override public boolean emailVerified() { return false; }
    }

    private record VerifiedIdentity(Long userId) implements AuthenticatedPrincipal {
        @Override public boolean emailVerified() { return true; }
    }
}
