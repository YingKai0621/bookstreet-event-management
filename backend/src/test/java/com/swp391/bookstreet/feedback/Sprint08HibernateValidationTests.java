package com.swp391.bookstreet.feedback;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.swp391.bookstreet.security.authentication.AuthenticatedPrincipal;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.sql.Statement;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

@SpringBootTest
@AutoConfigureMockMvc
@EnabledIfEnvironmentVariable(named = "EVENT_TEST_DATABASE_URL", matches = ".+")
class Sprint08HibernateValidationTests {
    private static final String SCHEMA =
            "s8_hibernate_" + UUID.randomUUID().toString().replace("-", "");
    private static final String PATH = "/api/v1/public/feedbacks";
    private static final Instant NOW = Instant.parse("2026-10-31T08:20:00Z");

    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;

    @DynamicPropertySource
    static void databaseProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", Sprint08HibernateValidationTests::databaseUrl);
        registry.add("spring.datasource.username", Sprint08HibernateValidationTests::databaseUser);
        registry.add("spring.datasource.password", Sprint08HibernateValidationTests::databasePassword);
        registry.add("spring.flyway.default-schema", () -> SCHEMA);
        registry.add("spring.flyway.schemas", () -> SCHEMA);
        registry.add("spring.flyway.create-schemas", () -> true);
        registry.add("spring.jpa.properties.hibernate.default_schema", () -> SCHEMA);
        registry.add("bookstreet.feedback.throttle-hmac-secret", () -> "test-only-secret");
    }

    @AfterAll
    static void dropSchema() throws SQLException {
        try (Connection connection = DriverManager.getConnection(databaseUrl(), databaseUser(), databasePassword());
                Statement statement = connection.createStatement()) {
            statement.execute("DROP SCHEMA IF EXISTS " + quotedSchema() + " CASCADE");
        }
    }

    @Test
    void contextLoadsWithHibernateValidateAgainstV14() {
    }

    @Test
    void anonymousBookStreetSubmissionRequiresCsrfAndPersistsNormalizedData() throws Exception {
        String request = """
                {
                  "targetType":"BOOK_STREET",
                  "guestName":"  Minh   An  ",
                  "contactEmail":" MINHAN@EXAMPLE.COM ",
                  "message":"  Không gian Đường Sách rất thân thiện.  "
                }
                """;

        mvc.perform(post(PATH).contentType(MediaType.APPLICATION_JSON).content(request))
                .andExpect(status().isForbidden())
                .andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.code").value("CSRF_INVALID"));

        long feedbackId = ((Number) com.jayway.jsonpath.JsonPath.read(
                mvc.perform(post(PATH).with(csrf()).with(remoteAddress("192.0.2.11"))
                                .contentType(MediaType.APPLICATION_JSON).content(request))
                        .andExpect(status().isCreated())
                        .andExpect(header().string("Cache-Control", "no-store"))
                        .andReturn().getResponse().getContentAsString(),
                "$.feedbackId")).longValue();

        var row = jdbc.queryForMap("""
                select target_type, event_id, guest_name, contact_email, message, status,
                       submitted_by_user_id, internal_note, last_handled_by_user_id,
                       handling_started_at, resolved_at
                from %s where general_feedback_id = ?
                """.formatted(table("general_feedbacks")), feedbackId);
        assertThat(row.get("target_type")).isEqualTo("BOOK_STREET");
        assertThat(row.get("event_id")).isNull();
        assertThat(row.get("guest_name")).isEqualTo("Minh An");
        assertThat(row.get("contact_email")).isEqualTo("minhan@example.com");
        assertThat(row.get("message")).isEqualTo("Không gian Đường Sách rất thân thiện.");
        assertThat(row.get("status")).isEqualTo("NEW");
        assertThat(row.get("submitted_by_user_id")).isNull();
        assertThat(row.get("internal_note")).isNull();
        assertThat(row.get("last_handled_by_user_id")).isNull();
        assertThat(row.get("handling_started_at")).isNull();
        assertThat(row.get("resolved_at")).isNull();
    }

    @Test
    void sessionIdentityIsAssociatedWithoutAcceptingClientIdentity() throws Exception {
        long userId = insertUser("feedbackparticipant");

        mvc.perform(post(PATH)
                        .with(authentication(new UsernamePasswordAuthenticationToken(
                                new Identity(userId), null,
                                List.of(new SimpleGrantedAuthority("ROLE_PARTICIPANT")))))
                        .with(csrf())
                        .with(remoteAddress("192.0.2.12"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"targetType":"BOOK_STREET","message":"Nội dung góp ý hợp lệ."}
                                """))
                .andExpect(status().isCreated());

        Long storedUserId = jdbc.queryForObject("""
                select submitted_by_user_id from %s
                where submitted_by_user_id = ? order by general_feedback_id desc limit 1
                """.formatted(table("general_feedbacks")), Long.class, userId);
        assertThat(storedUserId).isEqualTo(userId);
    }

    @Test
    void eventFeedbackAcceptsFourPublicDetailStatusesAndHidesDraftOrMissing() throws Exception {
        long organizerId = jdbc.queryForObject(
                "select user_id from " + table("users") + " where username = 'organizerdemo'", Long.class);
        int addressSuffix = 20;
        for (String eventStatus : List.of("PUBLISHED", "ONGOING", "COMPLETED", "CANCELLED")) {
            long eventId = insertEvent(organizerId, eventStatus);
            mvc.perform(post(PATH).with(csrf()).with(remoteAddress("192.0.2." + addressSuffix++))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(eventPayload(eventId)))
                    .andExpect(status().isCreated());
        }

        long draftEventId = insertEvent(organizerId, "DRAFT");
        mvc.perform(post(PATH).with(csrf()).with(remoteAddress("192.0.2.30"))
                        .contentType(MediaType.APPLICATION_JSON).content(eventPayload(draftEventId)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("EVENT_NOT_FOUND"));
        mvc.perform(post(PATH).with(csrf()).with(remoteAddress("192.0.2.31"))
                        .contentType(MediaType.APPLICATION_JSON).content(eventPayload(999999999L)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("EVENT_NOT_FOUND"));
    }

    @Test
    void legacyFieldIsRejectedWithoutWritingFeedback() throws Exception {
        Integer before = jdbc.queryForObject(
                "select count(*) from " + table("general_feedbacks"), Integer.class);
        mvc.perform(post(PATH).with(csrf()).with(remoteAddress("192.0.2.40"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "targetType":"BOOK_STREET",
                                  "message":"Nội dung góp ý hợp lệ.",
                                  "rating":5
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("UNKNOWN_FIELD"));
        assertThat(jdbc.queryForObject(
                "select count(*) from " + table("general_feedbacks"), Integer.class)).isEqualTo(before);
    }

    private long insertUser(String prefix) {
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 10);
        return jdbc.queryForObject("""
                insert into %s(username, password_hash, full_name, status)
                values (?, 'unused', 'Feedback Participant', 'ACTIVE') returning user_id
                """.formatted(table("users")), Long.class, prefix + suffix);
    }

    private long insertEvent(long organizerId, String status) {
        if ("CANCELLED".equals(status)) {
            return jdbc.queryForObject("""
                    insert into %s(
                        organizer_user_id, name, start_at, end_at,
                        booth_payment_window_minutes, max_booths_per_partner,
                        max_activities_per_partner, status, cancelled_at, cancellation_reason,
                        created_at, updated_at
                    ) values (?, ?, ?, ?, 60, 2, 3, ?, ?, 'Sự kiện hủy để kiểm tra góp ý.', ?, ?)
                    returning event_id
                    """.formatted(table("events")), Long.class, organizerId, "Feedback " + status,
                    Timestamp.from(NOW), Timestamp.from(NOW.plusSeconds(3600)), status,
                    Timestamp.from(NOW), Timestamp.from(NOW), Timestamp.from(NOW));
        }
        return jdbc.queryForObject("""
                insert into %s(
                    organizer_user_id, name, start_at, end_at,
                    booth_payment_window_minutes, max_booths_per_partner,
                    max_activities_per_partner, status, created_at, updated_at
                ) values (?, ?, ?, ?, 60, 2, 3, ?, ?, ?) returning event_id
                """.formatted(table("events")), Long.class, organizerId, "Feedback " + status,
                Timestamp.from(NOW), Timestamp.from(NOW.plusSeconds(3600)), status,
                Timestamp.from(NOW), Timestamp.from(NOW));
    }

    private String eventPayload(long eventId) {
        return "{\"targetType\":\"EVENT\",\"eventId\":" + eventId
                + ",\"message\":\"Nội dung góp ý sự kiện hợp lệ.\"}";
    }

    private static RequestPostProcessor remoteAddress(String address) {
        return request -> {
            request.setRemoteAddr(address);
            return request;
        };
    }

    private static String table(String name) {
        return quotedSchema() + ".\"" + name.replace("\"", "\"\"") + "\"";
    }

    private record Identity(Long userId) implements AuthenticatedPrincipal {
        @Override public boolean emailVerified() { return false; }
    }

    private static String quotedSchema() {
        return '"' + SCHEMA.replace("\"", "\"\"") + '"';
    }

    private static String databaseUrl() { return System.getenv("EVENT_TEST_DATABASE_URL"); }
    private static String databaseUser() { return System.getenv().getOrDefault("EVENT_TEST_DATABASE_USER", "postgres"); }
    private static String databasePassword() { return System.getenv().getOrDefault("EVENT_TEST_DATABASE_PASSWORD", "postgres"); }
}
