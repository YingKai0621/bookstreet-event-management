package com.swp391.bookstreet.feedback;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
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
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
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

    @Test
    void organizerQueueIsSharedPrivateAndUsesServerSideFilters() throws Exception {
        long organizerA = insertUser("feedbackorga");
        long organizerB = insertUser("feedbackorgb");
        long eventA = insertEvent(organizerA, "PUBLISHED");
        long eventB = insertEvent(organizerB, "PUBLISHED");
        String marker = "shared" + UUID.randomUUID().toString().replace("-", "").substring(0, 8);
        long feedbackA = insertEventFeedback(eventA, marker + " Alpha", "alpha@example.test");
        long feedbackB = insertEventFeedback(eventB, marker + " Beta", "beta@example.test");

        for (long organizerId : List.of(organizerA, organizerB)) {
            mvc.perform(get("/api/v1/organizer/feedbacks")
                            .queryParam("search", marker)
                            .queryParam("sort", "submittedAt,asc")
                            .with(role(organizerId, "ROLE_ORGANIZER")))
                    .andExpect(status().isOk())
                    .andExpect(header().string("Cache-Control", "no-store"))
                    .andExpect(jsonPath("$.totalElements").value(2))
                    .andExpect(jsonPath("$.content[0].feedbackId").value(feedbackA))
                    .andExpect(jsonPath("$.content[1].feedbackId").value(feedbackB))
                    .andExpect(jsonPath("$.content[0].contactEmail").doesNotExist())
                    .andExpect(jsonPath("$.content[0].internalNote").doesNotExist());
        }

        mvc.perform(get("/api/v1/organizer/feedbacks")
                        .queryParam("search", marker)
                        .queryParam("senderSearch", "beta@example.test")
                        .queryParam("eventNameSearch", "Feedback PUBLISHED")
                        .queryParam("targetType", "EVENT")
                        .queryParam("status", "NEW")
                        .with(role(organizerA, "ROLE_ORGANIZER")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].feedbackId").value(feedbackB));
        mvc.perform(get("/api/v1/organizer/feedbacks")
                        .queryParam("eventId", String.valueOf(eventA))
                        .queryParam("status", "NEW")
                        .with(role(organizerB, "ROLE_ORGANIZER")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content.length()").value(1));

        Timestamp updatedBeforeRead = jdbc.queryForObject(
                "select updated_at from " + table("general_feedbacks")
                        + " where general_feedback_id = ?", Timestamp.class, feedbackA);
        mvc.perform(get("/api/v1/organizer/feedbacks/" + feedbackA)
                        .with(role(organizerB, "ROLE_ORGANIZER")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.contactEmail").value("alpha@example.test"))
                .andExpect(jsonPath("$.message").value(marker + " Alpha"));
        assertThat(jdbc.queryForObject(
                "select updated_at from " + table("general_feedbacks")
                        + " where general_feedback_id = ?", Timestamp.class, feedbackA))
                .isEqualTo(updatedBeforeRead);

        mvc.perform(get("/api/v1/organizer/feedbacks?targetType=BOOK_STREET&eventId=" + eventA)
                        .with(role(organizerA, "ROLE_ORGANIZER")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_FILTER"));
        mvc.perform(get("/api/v1/organizer/feedbacks")
                        .queryParam("targetType", "BOOK_STREET")
                        .queryParam("eventNameSearch", "Feedback")
                        .with(role(organizerA, "ROLE_ORGANIZER")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_FILTER"));
        mvc.perform(get("/api/v1/organizer/feedbacks?eventId=999999999")
                        .with(role(organizerA, "ROLE_ORGANIZER")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(0));

        mvc.perform(get("/api/v1/organizer/feedbacks"))
                .andExpect(status().isUnauthorized())
                .andExpect(header().string("Cache-Control", "no-store"));
        mvc.perform(get("/api/v1/organizer/feedbacks")
                        .with(role(organizerA, "ROLE_PARTICIPANT")))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/organizer/feedbacks")
                        .with(role(organizerA, "ROLE_ADMIN")))
                .andExpect(status().isForbidden());
    }

    @Test
    void organizerTransitionsAreCsrfProtectedAtomicAndSharedAcrossOrganizers() throws Exception {
        long organizerA = insertUser("transitionorga");
        long organizerB = insertUser("transitionorgb");
        long feedbackId = insertBookStreetFeedback("Transition " + UUID.randomUUID());
        String base = "/api/v1/organizer/feedbacks/" + feedbackId;

        mvc.perform(post(base + "/start-handling").with(role(organizerA, "ROLE_ORGANIZER")))
                .andExpect(status().isForbidden())
                .andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.code").value("CSRF_INVALID"));

        mvc.perform(post(base + "/start-handling")
                        .with(role(organizerA, "ROLE_ORGANIZER")).with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("IN_PROGRESS"))
                .andExpect(jsonPath("$.lastHandledBy.userId").value(organizerA));

        mvc.perform(post(base + "/resolve")
                        .with(role(organizerB, "ROLE_ORGANIZER")).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"internalNote\":\"  Đã   xử lý liên phòng ban.  \"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("RESOLVED"))
                .andExpect(jsonPath("$.internalNote").value("Đã xử lý liên phòng ban."))
                .andExpect(jsonPath("$.lastHandledBy.userId").value(organizerB));

        mvc.perform(post(base + "/resolve")
                        .with(role(organizerA, "ROLE_ORGANIZER")).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"internalNote\":\"Không được ghi đè.\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("FEEDBACK_TRANSITION_CONFLICT"));

        mvc.perform(post(base + "/reopen")
                        .with(role(organizerA, "ROLE_ORGANIZER")).with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("IN_PROGRESS"))
                .andExpect(jsonPath("$.internalNote").value("Đã xử lý liên phòng ban."))
                .andExpect(jsonPath("$.resolvedAt").doesNotExist());

        var row = jdbc.queryForMap("""
                select status, internal_note, last_handled_by_user_id,
                       handling_started_at, resolved_at
                from %s where general_feedback_id = ?
                """.formatted(table("general_feedbacks")), feedbackId);
        assertThat(row.get("status")).isEqualTo("IN_PROGRESS");
        assertThat(row.get("internal_note")).isEqualTo("Đã xử lý liên phòng ban.");
        assertThat(((Number) row.get("last_handled_by_user_id")).longValue()).isEqualTo(organizerA);
        assertThat(row.get("handling_started_at")).isNotNull();
        assertThat(row.get("resolved_at")).isNull();
    }

    @Test
    void concurrentOrganizersProduceOneTransitionWinner() throws Exception {
        long organizerA = insertUser("raceorganiza");
        long organizerB = insertUser("raceorganizb");
        long feedbackId = insertBookStreetFeedback("Race " + UUID.randomUUID());
        String path = "/api/v1/organizer/feedbacks/" + feedbackId + "/start-handling";
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);

        try (var executor = Executors.newFixedThreadPool(2)) {
            var first = executor.submit(() -> transitionStatus(path, organizerA, ready, start));
            var second = executor.submit(() -> transitionStatus(path, organizerB, ready, start));
            ready.await();
            start.countDown();
            assertThat(List.of(first.get(), second.get())).containsExactlyInAnyOrder(200, 409);
        }

        assertThat(jdbc.queryForObject(
                "select status from " + table("general_feedbacks")
                        + " where general_feedback_id = ?", String.class, feedbackId))
                .isEqualTo("IN_PROGRESS");
    }

    private int transitionStatus(
            String path,
            long organizerId,
            CountDownLatch ready,
            CountDownLatch start
    ) throws Exception {
        ready.countDown();
        start.await();
        return mvc.perform(post(path).with(role(organizerId, "ROLE_ORGANIZER")).with(csrf()))
                .andReturn().getResponse().getStatus();
    }

    private long insertEventFeedback(long eventId, String message, String email) {
        return jdbc.queryForObject("""
                insert into %s(
                    target_type, event_id, contact_email, message, status, submitted_at, updated_at
                ) values ('EVENT', ?, ?, ?, 'NEW', ?, ?) returning general_feedback_id
                """.formatted(table("general_feedbacks")), Long.class,
                eventId, email, message, Timestamp.from(NOW), Timestamp.from(NOW));
    }

    private long insertBookStreetFeedback(String message) {
        return jdbc.queryForObject("""
                insert into %s(target_type, message, status, submitted_at, updated_at)
                values ('BOOK_STREET', ?, 'NEW', ?, ?) returning general_feedback_id
                """.formatted(table("general_feedbacks")), Long.class,
                message, Timestamp.from(NOW), Timestamp.from(NOW));
    }

    private static RequestPostProcessor role(long userId, String authority) {
        return authentication(new UsernamePasswordAuthenticationToken(
                new OrganizerIdentity(userId),
                null,
                List.of(new SimpleGrantedAuthority(authority))
        ));
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

    private record OrganizerIdentity(Long userId) implements AuthenticatedPrincipal {
        @Override public boolean emailVerified() { return true; }
    }

    private static String quotedSchema() {
        return '"' + SCHEMA.replace("\"", "\"\"") + '"';
    }

    private static String databaseUrl() { return System.getenv("EVENT_TEST_DATABASE_URL"); }
    private static String databaseUser() { return System.getenv().getOrDefault("EVENT_TEST_DATABASE_USER", "postgres"); }
    private static String databasePassword() { return System.getenv().getOrDefault("EVENT_TEST_DATABASE_PASSWORD", "postgres"); }
}
