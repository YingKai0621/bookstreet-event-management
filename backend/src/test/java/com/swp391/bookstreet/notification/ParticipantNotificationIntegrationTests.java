package com.swp391.bookstreet.notification;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
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
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
        "spring.datasource.url=${EVENT_TEST_DATABASE_URL}",
        "logging.level.org.springframework.security=ERROR"
})
@EnabledIfEnvironmentVariable(named = "EVENT_TEST_DATABASE_URL", matches = ".+")
@ContextConfiguration(initializers = ParticipantNotificationIntegrationTests.TestDatabaseGuard.class)
class ParticipantNotificationIntegrationTests {

    private static final Instant BASE = Instant.parse("2026-01-01T00:00:00Z");
    private static final String BASE_URL = "/api/v1/participant/notifications";

    static class TestDatabaseGuard implements ApplicationContextInitializer<ConfigurableApplicationContext> {
        @Override
        public void initialize(ConfigurableApplicationContext applicationContext) {
            String url = applicationContext.getEnvironment().getRequiredProperty("spring.datasource.url");
            if (!url.matches("jdbc:postgresql://[^/]+/[A-Za-z0-9_]+_event_test(?:\\?.*)?")) {
                throw new IllegalStateException("Notification integration tests require a dedicated *_event_test database.");
            }
        }
    }

    @Autowired WebApplicationContext context;
    @Autowired JdbcTemplate jdbc;
    @Autowired ObjectMapper mapper;

    MockMvc mvc;
    Long organizerId;
    Long participant1Id;
    Long participant2Id;
    Long eventId;
    Long p1Notif1Id;
    Long p1Notif2Id;
    Long p2NotifId;

    @BeforeEach
    void setup() {
        assertThat(jdbc.queryForObject("select current_database()", String.class)).endsWith("_event_test");
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();

        organizerId = insertUser("notif_org");
        participant1Id = insertUser("notif_p1");
        participant2Id = insertUser("notif_p2");

        eventId = insertEvent("Festival BookStreet 2027");

        p1Notif1Id = insertNotification(participant1Id, "EVENT_CANCELLED", eventId, null, null,
                "dedup-p1-1-" + UUID.randomUUID(), "Sự kiện hủy 1", "Nội dung 1", BASE);
        p1Notif2Id = insertNotification(participant1Id, "EVENT_CANCELLED", eventId, null, null,
                "dedup-p1-2-" + UUID.randomUUID(), "Sự kiện hủy 2", "Nội dung 2", BASE.plusSeconds(60));

        p2NotifId = insertNotification(participant2Id, "EVENT_CANCELLED", eventId, null, null,
                "dedup-p2-" + UUID.randomUUID(), "Sự kiện hủy P2", "Nội dung P2", BASE);
    }

    @AfterEach
    void cleanup() {
        jdbc.update("delete from notifications where recipient_user_id in (?, ?)", participant1Id, participant2Id);
        jdbc.update("delete from events where event_id = ?", eventId);
        jdbc.update("delete from user_roles where user_id in (?, ?, ?)", organizerId, participant1Id, participant2Id);
        jdbc.update("delete from users where user_id in (?, ?, ?)", organizerId, participant1Id, participant2Id);
    }

    @Test
    void listReturnsOnlyCurrentParticipantNotifications() throws Exception {
        MvcResult resultP1 = mvc.perform(get(BASE_URL)
                        .with(participant(participant1Id)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(2))
                .andReturn();

        JsonNode jsonP1 = mapper.readTree(resultP1.getResponse().getContentAsString());
        assertThat(jsonP1.get("content").get(0).get("notificationId").asLong()).isIn(p1Notif1Id, p1Notif2Id);
        assertThat(jsonP1.get("content").get(1).get("notificationId").asLong()).isIn(p1Notif1Id, p1Notif2Id);

        MvcResult resultP2 = mvc.perform(get(BASE_URL)
                        .with(participant(participant2Id)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andReturn();

        JsonNode jsonP2 = mapper.readTree(resultP2.getResponse().getContentAsString());
        assertThat(jsonP2.get("content").get(0).get("notificationId").asLong()).isEqualTo(p2NotifId);
    }

    @Test
    void unreadCountReturnsOnlyCurrentParticipantCount() throws Exception {
        mvc.perform(get(BASE_URL + "/unread-count")
                        .with(participant(participant1Id)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.unreadCount").value(2));

        mvc.perform(get(BASE_URL + "/unread-count")
                        .with(participant(participant2Id)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.unreadCount").value(1));
    }

    @Test
    void markAsReadForeignNotificationReturns404AndConcealsForeignData() throws Exception {
        // Participant 1 attempts to mark Participant 2's notification as read
        mvc.perform(post(BASE_URL + "/" + p2NotifId + "/read")
                        .with(participant(participant1Id))
                        .with(csrf()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOTIFICATION_NOT_FOUND"));

        // Verify Participant 2's notification is still unread in database
        Timestamp readAt = jdbc.queryForObject(
                "select read_at from notifications where notification_id = ?",
                Timestamp.class, p2NotifId);
        assertThat(readAt).isNull();
    }

    @Test
    void markAsReadOwnedNotificationUpdatesReadAtAndIsIdempotent() throws Exception {
        // First read call updates read_at
        MvcResult firstResult = mvc.perform(post(BASE_URL + "/" + p1Notif1Id + "/read")
                        .with(participant(participant1Id))
                        .with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.notificationId").value(p1Notif1Id))
                .andExpect(jsonPath("$.read").value(true))
                .andExpect(jsonPath("$.readAt").isNotEmpty())
                .andReturn();

        Instant firstReadAt = Instant.parse(mapper.readTree(firstResult.getResponse().getContentAsString()).get("readAt").asText());

        // Second read call (retry) preserves the first read_at
        MvcResult secondResult = mvc.perform(post(BASE_URL + "/" + p1Notif1Id + "/read")
                        .with(participant(participant1Id))
                        .with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.notificationId").value(p1Notif1Id))
                .andExpect(jsonPath("$.read").value(true))
                .andReturn();

        Instant secondReadAt = Instant.parse(mapper.readTree(secondResult.getResponse().getContentAsString()).get("readAt").asText());
        assertThat(java.time.temporal.ChronoUnit.MICROS.between(firstReadAt, secondReadAt)).isZero();

        // Unread count for P1 is now 1
        mvc.perform(get(BASE_URL + "/unread-count")
                        .with(participant(participant1Id)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.unreadCount").value(1));

        // P2 unread count remains 1
        mvc.perform(get(BASE_URL + "/unread-count")
                        .with(participant(participant2Id)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.unreadCount").value(1));
    }

    @Test
    void markAllAsReadUpdatesAllUnreadForCurrentParticipantOnly() throws Exception {
        // Participant 1 marks all as read
        mvc.perform(post(BASE_URL + "/read-all")
                        .with(participant(participant1Id))
                        .with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.updatedCount").value(2));

        // Participant 1 unread count is now 0
        mvc.perform(get(BASE_URL + "/unread-count")
                        .with(participant(participant1Id)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.unreadCount").value(0));

        // Participant 2's notification is untouched and unread count is still 1
        mvc.perform(get(BASE_URL + "/unread-count")
                        .with(participant(participant2Id)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.unreadCount").value(1));

        Timestamp p2ReadAt = jdbc.queryForObject(
                "select read_at from notifications where notification_id = ?",
                Timestamp.class, p2NotifId);
        assertThat(p2ReadAt).isNull();
    }

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

    private long insertNotification(long recipientUserId, String type, Long eventId, Long activityId, Long certificateId,
                                   String dedupKey, String title, String message, Instant createdAt) {
        return jdbc.queryForObject("""
                insert into notifications(recipient_user_id, recipient_role, notification_type,
                                          event_id, activity_id, certificate_id,
                                          deduplication_key, title, message, created_at, read_at)
                values (?, 'PARTICIPANT', ?, ?, ?, ?, ?, ?, ?, ?, null)
                returning notification_id
                """, Long.class, recipientUserId, type, eventId, activityId, certificateId, dedupKey, title, message, Timestamp.from(createdAt));
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
