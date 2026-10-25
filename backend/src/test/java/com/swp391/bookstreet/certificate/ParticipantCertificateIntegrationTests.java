package com.swp391.bookstreet.certificate;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import com.swp391.bookstreet.certificate.service.CertificatePdfRenderer;
import com.swp391.bookstreet.event.service.EventCancellationMailService;
import com.swp391.bookstreet.security.authentication.AuthenticatedPrincipal;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContextInitializer;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
        "spring.datasource.url=${EVENT_TEST_DATABASE_URL}",
        "logging.level.org.springframework.security=ERROR"
})
@EnabledIfEnvironmentVariable(named = "EVENT_TEST_DATABASE_URL", matches = ".+")
@ContextConfiguration(initializers = ParticipantCertificateIntegrationTests.TestDatabaseGuard.class)
class ParticipantCertificateIntegrationTests {

    private static final Instant BASE = Instant.parse("2026-01-01T00:00:00Z");
    private static final String CERTIFICATES_URL = "/api/v1/participant/certificates";

    static class TestDatabaseGuard implements ApplicationContextInitializer<ConfigurableApplicationContext> {
        @Override
        public void initialize(ConfigurableApplicationContext applicationContext) {
            String url = applicationContext.getEnvironment().getRequiredProperty("spring.datasource.url");
            if (!url.matches("jdbc:postgresql://[^/]+/[A-Za-z0-9_]+_event_test(?:\\?.*)?")) {
                throw new IllegalStateException("Certificate integration tests require a dedicated *_event_test database.");
            }
        }
    }

    @Autowired WebApplicationContext context;
    @Autowired JdbcTemplate jdbc;
    @Autowired ObjectMapper mapper;
    @Autowired CertificatePdfRenderer pdfRenderer;
    @MockitoBean EventCancellationMailService cancellationMailService;

    MockMvc mvc;
    Long organizerId;
    Long participantId;
    Long otherParticipantId;
    Long eventId;
    Long activityId;
    Long issuedCertId;
    Long revokedCertId;

    @BeforeEach
    void setup() {
        assertThat(jdbc.queryForObject("select current_database()", String.class)).endsWith("_event_test");
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        pdfRenderer.setSimulateFailure(false);

        organizerId = insertUser("organizer_cert");
        participantId = insertUser("participant_cert");
        otherParticipantId = insertUser("other_participant_cert");

        eventId = insertEvent("Festival Doc 2027");
        long locationId = insertLocation();
        activityId = insertActivity(eventId, locationId, "Book Talk");

        // Create registration, attendance and certificate for participant
        long eventRegId = insertEventRegistration(eventId, participantId);
        long actRegId = insertActivityRegistration(activityId, eventRegId);
        long attendanceId = insertAttendance(actRegId, "VALID");
        issuedCertId = insertCertificate(attendanceId, "BKS-2027-TEST001", "Participant Cert One", "ISSUED", null);

        // Create a revoked certificate for participant in another activity with a distinct location
        long locationId2 = insertLocation();
        long activityId2 = insertActivity(eventId, locationId2, "Poetry Reading");
        long actRegId2 = insertActivityRegistration(activityId2, eventRegId);
        long attendanceId2 = insertAttendance(actRegId2, "VOIDED");
        revokedCertId = insertCertificate(attendanceId2, "BKS-2027-TEST002", "Participant Cert One", "REVOKED", BASE.plusSeconds(3600));
    }

    @AfterEach
    void cleanup() {
        pdfRenderer.setSimulateFailure(false);
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
                delete from activity_registrations where event_registration_id in (
                    select event_registration_id from event_registrations
                    where user_id in (?, ?)
                )
                """, participantId, otherParticipantId);

        jdbc.update("delete from event_registrations where user_id in (?, ?)", participantId, otherParticipantId);
        jdbc.update("delete from activities where event_id = ?", eventId);
        jdbc.update("delete from locations where code like 'CERT-%'");
        jdbc.update("delete from events where event_id = ?", eventId);
        jdbc.update("delete from user_roles where user_id in (?, ?, ?)", organizerId, participantId, otherParticipantId);
        jdbc.update("delete from users where user_id in (?, ?, ?)", organizerId, participantId, otherParticipantId);
    }

    @Test
    void participantCanListOwnedCertificatesAndFilterByStatus() throws Exception {
        // List all certificates
        mvc.perform(get(CERTIFICATES_URL)
                        .with(participant(participantId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.content[0].certificateId").exists());

        // Filter by status ISSUED
        mvc.perform(get(CERTIFICATES_URL)
                        .param("status", "ISSUED")
                        .with(participant(participantId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].certificateId").value(issuedCertId))
                .andExpect(jsonPath("$.content[0].status").value("ISSUED"))
                .andExpect(jsonPath("$.content[0].downloadAvailable").value(true));

        // Filter by status REVOKED
        mvc.perform(get(CERTIFICATES_URL)
                        .param("status", "REVOKED")
                        .with(participant(participantId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].certificateId").value(revokedCertId))
                .andExpect(jsonPath("$.content[0].status").value("REVOKED"))
                .andExpect(jsonPath("$.content[0].downloadAvailable").value(false));
    }

    @Test
    void listRejectsUnsupportedSortField() throws Exception {
        mvc.perform(get(CERTIFICATES_URL)
                        .param("sort", "unsupportedField,asc")
                        .with(participant(participantId)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_SORT"));
    }

    @Test
    void participantCanListCertificatesSortedByActivityTitle() throws Exception {
        // Book Talk (B) comes before Poetry Reading (P) in ASC
        mvc.perform(get(CERTIFICATES_URL)
                        .param("sort", "activityTitle,asc")
                        .with(participant(participantId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.content[0].certificateId").value(issuedCertId))
                .andExpect(jsonPath("$.content[1].certificateId").value(revokedCertId));

        // Poetry Reading (P) comes before Book Talk (B) in DESC
        mvc.perform(get(CERTIFICATES_URL)
                        .param("sort", "activityTitle,desc")
                        .with(participant(participantId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.content[0].certificateId").value(revokedCertId))
                .andExpect(jsonPath("$.content[1].certificateId").value(issuedCertId));
    }

    @Test
    void participantCanViewDetailOfOwnedCertificate() throws Exception {
        mvc.perform(get(CERTIFICATES_URL + "/" + issuedCertId)
                        .with(participant(participantId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.certificate.certificateId").value(issuedCertId))
                .andExpect(jsonPath("$.certificate.certificateCode").value("BKS-2027-TEST001"))
                .andExpect(jsonPath("$.certificate.status").value("ISSUED"))
                .andExpect(jsonPath("$.certificate.downloadAvailable").value(true))
                .andExpect(jsonPath("$.activity.activityId").value(activityId))
                .andExpect(jsonPath("$.activity.title").value("Book Talk"))
                .andExpect(jsonPath("$.event.eventId").value(eventId))
                .andExpect(jsonPath("$.event.name").value("Festival Doc 2027"));
    }

    @Test
    void otherParticipantCannotAccessForeignCertificateDetailOrDownload() throws Exception {
        // Other participant gets 404 when querying detail
        mvc.perform(get(CERTIFICATES_URL + "/" + issuedCertId)
                        .with(participant(otherParticipantId)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("CERTIFICATE_NOT_FOUND"));

        // Other participant gets 404 when downloading
        mvc.perform(get(CERTIFICATES_URL + "/" + issuedCertId + "/download")
                        .with(participant(otherParticipantId)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("CERTIFICATE_NOT_FOUND"));
    }

    @Test
    void participantCanDownloadIssuedCertificateAsPdf() throws Exception {
        MvcResult result = mvc.perform(get(CERTIFICATES_URL + "/" + issuedCertId + "/download")
                        .with(participant(participantId)))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.APPLICATION_PDF))
                .andExpect(header().string("Content-Disposition", "attachment; filename=\"certificate-BKS-2027-TEST001.pdf\""))
                .andReturn();

        byte[] content = result.getResponse().getContentAsByteArray();
        assertThat(content).isNotEmpty();
        assertThat(new String(content)).startsWith("%PDF-1.4");
    }

    @Test
    void downloadRevokedCertificateReturnsConflict() throws Exception {
        mvc.perform(get(CERTIFICATES_URL + "/" + revokedCertId + "/download")
                        .with(participant(participantId)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CERTIFICATE_REVOKED"));
    }

    @Test
    void renderFailureReturns503AndPreservesDurableIssuedStatus() throws Exception {
        pdfRenderer.setSimulateFailure(true);

        mvc.perform(get(CERTIFICATES_URL + "/" + issuedCertId + "/download")
                        .with(participant(participantId)))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("CERTIFICATE_RENDER_UNAVAILABLE"));

        // Verify database status is still ISSUED
        String dbStatus = jdbc.queryForObject(
                "select status from certificates where certificate_id = ?",
                String.class, issuedCertId);
        assertThat(dbStatus).isEqualTo("ISSUED");
    }

    // Helper insert methods
    private long insertUser(String prefix) {
        String username = prefix + UUID.randomUUID().toString().replace("-", "").substring(0, 8);
        long roleId = jdbc.queryForObject("select role_id from roles where code = 'PARTICIPANT'", Long.class);
        long id = jdbc.queryForObject("""
                insert into users(username, full_name, password_hash, email, email_verified_at, status, created_at, updated_at)
                values (?, ?, 'hash', ?, ?, 'ACTIVE', ?, ?)
                returning user_id
                """, Long.class, username, "User " + prefix, username + "@example.com", Timestamp.from(BASE), Timestamp.from(BASE), Timestamp.from(BASE));
        jdbc.update("insert into user_roles(user_id, role_id) values (?, ?)", id, roleId);
        return id;
    }

    private long insertEvent(String name) {
        return jdbc.queryForObject("""
                insert into events(organizer_user_id, name, description, start_at, end_at,
                    booth_payment_window_minutes, max_booths_per_partner, max_activities_per_partner,
                    status, created_at, updated_at)
                values (?, ?, 'Event Description', ?, ?, 60, 2, 3, 'PUBLISHED', ?, ?)
                returning event_id
                """, Long.class, organizerId, name,
                Timestamp.from(BASE.plus(Duration.ofDays(1))),
                Timestamp.from(BASE.plus(Duration.ofDays(2))),
                Timestamp.from(BASE), Timestamp.from(BASE));
    }

    private long insertLocation() {
        String code = "CERT-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        return jdbc.queryForObject("""
                insert into locations(code, name, location_type, max_capacity, is_active, created_at, updated_at)
                values (?, 'Stage Area', 'STAGE', 100, true, ?, ?)
                returning location_id
                """, Long.class, code, Timestamp.from(BASE), Timestamp.from(BASE));
    }

    private long insertActivity(long evId, long locId, String title) {
        return jdbc.queryForObject("""
                insert into activities(
                    event_id, location_id, title, activity_type, start_at, end_at,
                    registration_required, registration_deadline_at, capacity,
                    attendance_qr_token, is_certificate_enabled, status,
                    created_at, updated_at, published_at, completed_at)
                values (?, ?, ?, 'TALKSHOW', ?, ?, true, ?, 50,
                    ?, true, 'COMPLETED', ?, ?, ?, ?)
                returning activity_id
                """, Long.class, evId, locId, title,
                Timestamp.from(BASE.minus(Duration.ofHours(2))),
                Timestamp.from(BASE.minus(Duration.ofHours(1))),
                Timestamp.from(BASE.minus(Duration.ofHours(3))), UUID.randomUUID(),
                Timestamp.from(BASE.minus(Duration.ofDays(1))), Timestamp.from(BASE),
                Timestamp.from(BASE.minus(Duration.ofDays(1))), Timestamp.from(BASE));
    }

    private long insertEventRegistration(long evId, long uId) {
        return jdbc.queryForObject("""
                insert into event_registrations(event_id, user_id, status, registered_at, activated_at, updated_at)
                values (?, ?, 'ACTIVE', ?, ?, ?)
                returning event_registration_id
                """, Long.class, evId, uId, Timestamp.from(BASE), Timestamp.from(BASE), Timestamp.from(BASE));
    }

    private long insertActivityRegistration(long actId, long evRegId) {
        return jdbc.queryForObject("""
                insert into activity_registrations(activity_id, event_registration_id, status, registered_at, activated_at, updated_at)
                values (?, ?, 'ACTIVE', ?, ?, ?)
                returning activity_registration_id
                """, Long.class, actId, evRegId, Timestamp.from(BASE), Timestamp.from(BASE), Timestamp.from(BASE));
    }

    private long insertAttendance(long actRegId, String status) {
        Timestamp voidedAt = "VOIDED".equals(status) ? Timestamp.from(BASE.plusSeconds(3600)) : null;
        Timestamp updatedAt = "VOIDED".equals(status) ? Timestamp.from(BASE.plusSeconds(3600)) : Timestamp.from(BASE);
        return jdbc.queryForObject("""
                insert into attendances(activity_registration_id, status, recorded_source, attended_at, voided_at, created_at, updated_at)
                values (?, ?, 'SELF_SCAN', ?, ?, ?, ?)
                returning attendance_id
                """, Long.class, actRegId, status, Timestamp.from(BASE), voidedAt, Timestamp.from(BASE), updatedAt);
    }

    private long insertCertificate(long attId, String code, String nameSnapshot, String status, Instant revokedAt) {
        Timestamp revoked = revokedAt == null ? null : Timestamp.from(revokedAt);
        Timestamp updatedAt = revokedAt == null ? Timestamp.from(BASE) : Timestamp.from(revokedAt);
        return jdbc.queryForObject("""
                insert into certificates(attendance_id, certificate_code, recipient_name_snapshot, status, issued_at, revoked_at, created_at, updated_at)
                values (?, ?, ?, ?, ?, ?, ?, ?)
                returning certificate_id
                """, Long.class, attId, code, nameSnapshot, status, Timestamp.from(BASE), revoked, Timestamp.from(BASE), updatedAt);
    }

    private static org.springframework.test.web.servlet.request.RequestPostProcessor participant(long userId) {
        var principal = new Identity(userId);
        return authentication(new UsernamePasswordAuthenticationToken(principal, null,
                java.util.List.of(new SimpleGrantedAuthority("ROLE_PARTICIPANT"))));
    }

    private record Identity(Long userId) implements AuthenticatedPrincipal {
        @Override public boolean emailVerified() { return false; }
    }
}
