package com.swp391.bookstreet.notification;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.swp391.bookstreet.security.authentication.AuthenticatedPrincipal;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
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
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@SpringBootTest(properties = {
        "spring.datasource.url=${EVENT_TEST_DATABASE_URL}",
        "logging.level.org.springframework.security=ERROR"
})
@EnabledIfEnvironmentVariable(named = "EVENT_TEST_DATABASE_URL", matches = ".+")
@ContextConfiguration(initializers = RoleScopedNotificationIntegrationTests.TestDatabaseGuard.class)
class RoleScopedNotificationIntegrationTests {

    private static final Instant BASE = Instant.parse("2026-01-02T00:00:00Z");
    private static final Map<String, String> ROLE_TYPES = Map.of(
            "participant", "EVENT_CANCELLED",
            "partner", "PARTNER_APPLICATION_STATUS_CHANGED",
            "organizer", "ORGANIZER_NEW_PARTNER_APPLICATION");

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
    Long userId;
    Long eventId;
    Long organizationId;
    Long applicationId;
    Map<String, List<Long>> notificationIds;

    @BeforeEach
    void setup() {
        assertThat(jdbc.queryForObject("select current_database()", String.class)).endsWith("_event_test");
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();

        userId = insertMultiRoleUser();
        eventId = insertEvent();
        organizationId = insertOrganization();
        applicationId = insertApplication();
        notificationIds = Map.of(
                "participant", List.of(
                        insertNotification("PARTICIPANT", ROLE_TYPES.get("participant"), "event_id", eventId, "p-1"),
                        insertNotification("PARTICIPANT", ROLE_TYPES.get("participant"), "event_id", eventId, "p-2")),
                "partner", List.of(
                        insertNotification("PARTNER", ROLE_TYPES.get("partner"),
                                "partner_event_application_id", applicationId, "partner-1"),
                        insertNotification("PARTNER", ROLE_TYPES.get("partner"),
                                "partner_event_application_id", applicationId, "partner-2")),
                "organizer", List.of(
                        insertNotification("ORGANIZER", ROLE_TYPES.get("organizer"),
                                "partner_event_application_id", applicationId, "org-1"),
                        insertNotification("ORGANIZER", ROLE_TYPES.get("organizer"),
                                "partner_event_application_id", applicationId, "org-2")));
    }

    @AfterEach
    void cleanup() {
        jdbc.update("delete from notifications where recipient_user_id = ?", userId);
        jdbc.update("delete from partner_event_applications where application_id = ?", applicationId);
        jdbc.update("delete from partner_organizations where partner_organization_id = ?", organizationId);
        jdbc.update("delete from events where event_id = ?", eventId);
        jdbc.update("delete from user_roles where user_id = ?", userId);
        jdbc.update("delete from users where user_id = ?", userId);
    }

    @Test
    void allSixteenOperationsUseTheAuthenticatedRoleAudience() throws Exception {
        for (String role : List.of("participant", "partner", "organizer")) {
            String baseUrl = baseUrl(role);
            RequestPostProcessor identity = identity(role);

            mvc.perform(get(baseUrl).with(identity))
                    .andExpect(status().isOk())
                    .andExpect(header().string("Cache-Control", containsString("no-store")))
                    .andExpect(jsonPath("$.totalElements").value(2))
                    .andExpect(jsonPath("$.content[0].contextEventId").value(eventId))
                    .andExpect(jsonPath("$.content[1].contextEventId").value(eventId));

            mvc.perform(get(baseUrl + "/unread-count").with(identity(role)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.unreadCount").value(2));

            mvc.perform(post(baseUrl + "/" + notificationIds.get(role).getFirst() + "/read")
                            .with(identity(role)).with(csrf()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.read").value(true));

            mvc.perform(post(baseUrl + "/read-all").with(identity(role)).with(csrf()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.updatedCount").value(1));
        }

        String adminUrl = baseUrl("admin");
        mvc.perform(get(adminUrl).with(identity("admin")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isEmpty())
                .andExpect(jsonPath("$.totalElements").value(0));
        mvc.perform(get(adminUrl + "/unread-count").with(identity("admin")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.unreadCount").value(0));
        mvc.perform(post(adminUrl + "/" + notificationIds.get("participant").getFirst() + "/read")
                        .with(identity("admin")).with(csrf()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOTIFICATION_NOT_FOUND"));
        mvc.perform(post(adminUrl + "/read-all").with(identity("admin")).with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.updatedCount").value(0));
    }

    @Test
    void exactRoleOwnershipCsrfValidationAndNoStoreAreEnforced() throws Exception {
        long partnerNotificationId = notificationIds.get("partner").getFirst();

        mvc.perform(get(baseUrl("partner")).with(identity("participant")))
                .andExpect(status().isForbidden())
                .andExpect(header().string("Cache-Control", containsString("no-store")));
        mvc.perform(get(baseUrl("partner")))
                .andExpect(status().isUnauthorized())
                .andExpect(header().string("Cache-Control", containsString("no-store")));
        mvc.perform(post(baseUrl("partner") + "/read-all").with(identity("partner")))
                .andExpect(status().isForbidden())
                .andExpect(header().string("Cache-Control", containsString("no-store")));

        mvc.perform(post(baseUrl("participant") + "/" + partnerNotificationId + "/read")
                        .with(identity("participant")).with(csrf()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOTIFICATION_NOT_FOUND"));
        assertThat(readAt(partnerNotificationId)).isNull();

        mvc.perform(get(baseUrl("admin") + "?type=EVENT_CANCELLED").with(identity("admin")))
                .andExpect(status().isBadRequest())
                .andExpect(header().string("Cache-Control", containsString("no-store")))
                .andExpect(jsonPath("$.code").value("INVALID_ENUM_VALUE"));
        mvc.perform(get(baseUrl("admin")).param("type", "  ").with(identity("admin")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(0));
        mvc.perform(post(baseUrl("partner") + "/0/read").with(identity("partner")).with(csrf()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_IDENTIFIER"));
        mvc.perform(post(baseUrl("partner") + "/abc/read").with(identity("partner")).with(csrf()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_IDENTIFIER"));
        mvc.perform(post(baseUrl("partner") + "/9223372036854775808/read")
                        .with(identity("partner")).with(csrf()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_IDENTIFIER"));
    }

    @Test
    void filtersPagingTieBreakerAndReadAtNullsLastUseDurableDatabaseState() throws Exception {
        String url = baseUrl("participant");
        long firstId = notificationIds.get("participant").getFirst();
        long secondId = notificationIds.get("participant").get(1);

        mvc.perform(post(url + "/" + firstId + "/read")
                        .with(identity("participant")).with(csrf()))
                .andExpect(status().isOk());

        mvc.perform(get(url).param("read", "true").with(identity("participant")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].notificationId").value(firstId));
        mvc.perform(get(url).param("read", "false").param("type", ROLE_TYPES.get("participant"))
                        .with(identity("participant")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].notificationId").value(secondId));

        for (String direction : List.of("asc", "desc")) {
            mvc.perform(get(url).param("sort", "readAt," + direction)
                            .with(identity("participant")))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.content[0].notificationId").value(firstId))
                    .andExpect(jsonPath("$.content[1].notificationId").value(secondId));
        }

        mvc.perform(get(url).param("page", "0").param("size", "1")
                        .with(identity("participant")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.totalPages").value(2))
                .andExpect(jsonPath("$.content[0].notificationId").value(firstId));
        mvc.perform(get(url).param("page", "1").param("size", "1")
                        .with(identity("participant")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].notificationId").value(secondId));
    }

    @Test
    void concurrentMarkOneAndMarkAllKeepTheFirstCommittedTimestamp() throws Exception {
        long targetId = notificationIds.get("participant").getFirst();
        CountDownLatch start = new CountDownLatch(1);

        try (ExecutorService executor = Executors.newFixedThreadPool(2)) {
            CompletableFuture<Instant> first = readConcurrently(executor, start, targetId);
            CompletableFuture<Integer> second = readAllConcurrently(executor, start);
            start.countDown();

            Instant firstReadAt = first.get(10, TimeUnit.SECONDS);
            assertThat(second.get(10, TimeUnit.SECONDS)).isBetween(1, 2);
            assertThat(readAt(targetId).toInstant()).isEqualTo(firstReadAt);

            MvcResult retry = mvc.perform(post(baseUrl("participant") + "/" + targetId + "/read")
                            .with(identity("participant")).with(csrf()))
                    .andExpect(status().isOk())
                    .andReturn();
            Instant retryReadAt = Instant.parse(
                    mapper.readTree(retry.getResponse().getContentAsString()).get("readAt").asText());
            assertThat(retryReadAt).isEqualTo(firstReadAt);

            mvc.perform(post(baseUrl("participant") + "/read-all")
                            .with(identity("participant")).with(csrf()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.updatedCount").value(0));
        }
    }

    private CompletableFuture<Instant> readConcurrently(
            ExecutorService executor, CountDownLatch start, long notificationId) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                assertThat(start.await(5, TimeUnit.SECONDS)).isTrue();
                MvcResult result = mvc.perform(post(baseUrl("participant") + "/" + notificationId + "/read")
                                .with(identity("participant")).with(csrf()))
                        .andExpect(status().isOk())
                        .andReturn();
                JsonNode json = mapper.readTree(result.getResponse().getContentAsString());
                return Instant.parse(json.get("readAt").asText());
            } catch (Exception exception) {
                throw new IllegalStateException(exception);
            }
        }, executor);
    }

    private CompletableFuture<Integer> readAllConcurrently(
            ExecutorService executor, CountDownLatch start) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                assertThat(start.await(5, TimeUnit.SECONDS)).isTrue();
                MvcResult result = mvc.perform(post(baseUrl("participant") + "/read-all")
                                .with(identity("participant")).with(csrf()))
                        .andExpect(status().isOk())
                        .andReturn();
                return mapper.readTree(result.getResponse().getContentAsString())
                        .get("updatedCount").asInt();
            } catch (Exception exception) {
                throw new IllegalStateException(exception);
            }
        }, executor);
    }

    private Long insertMultiRoleUser() {
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 8);
        String username = "notifall" + suffix;
        Long id = jdbc.queryForObject("""
                insert into users(username, full_name, password_hash, email, email_verified_at,
                                  status, created_at, updated_at)
                values (?, 'Notification Multi Role', 'hash', ?, ?, 'ACTIVE', ?, ?)
                returning user_id
                """, Long.class, username, username + "@example.com",
                Timestamp.from(BASE), Timestamp.from(BASE), Timestamp.from(BASE));
        for (String role : List.of("PARTICIPANT", "PARTNER", "ORGANIZER", "ADMIN")) {
            Long roleId = jdbc.queryForObject("select role_id from roles where code = ?", Long.class, role);
            jdbc.update("insert into user_roles(user_id, role_id) values (?, ?)", id, roleId);
        }
        return id;
    }

    private Long insertEvent() {
        return jdbc.queryForObject("""
                insert into events(organizer_user_id, name, description, start_at, end_at,
                    booth_payment_window_minutes, max_booths_per_partner, max_activities_per_partner,
                    status, created_at, updated_at)
                values (?, ?, 'Role scoped notification test', ?, ?, 60, 2, 3,
                        'PUBLISHED', ?, ?)
                returning event_id
                """, Long.class, userId, "Role Event " + UUID.randomUUID(),
                Timestamp.from(BASE.plus(Duration.ofDays(3))),
                Timestamp.from(BASE.plus(Duration.ofDays(4))),
                Timestamp.from(BASE), Timestamp.from(BASE));
    }

    private Long insertOrganization() {
        return jdbc.queryForObject("""
                insert into partner_organizations(
                    representative_user_id, name, category_code, status, created_at, updated_at)
                values (?, ?, 'PUBLISHER', 'ACTIVE', ?, ?)
                returning partner_organization_id
                """, Long.class, userId, "Role Partner " + UUID.randomUUID(),
                Timestamp.from(BASE), Timestamp.from(BASE));
    }

    private Long insertApplication() {
        return jdbc.queryForObject("""
                insert into partner_event_applications(
                    partner_organization_id, event_id, status, submitted_at)
                values (?, ?, 'PENDING', ?)
                returning application_id
                """, Long.class, organizationId, eventId, Timestamp.from(BASE));
    }

    private Long insertNotification(
            String role, String type, String referenceColumn, Long referenceId, String key) {
        String sql = """
                insert into notifications(
                    recipient_user_id, recipient_role, notification_type, %s,
                    deduplication_key, title, message, created_at)
                values (?, ?, ?, ?, ?, 'Notification title', 'Notification message', ?)
                returning notification_id
                """.formatted(referenceColumn);
        return jdbc.queryForObject(sql, Long.class, userId, role, type, referenceId,
                key + "-" + UUID.randomUUID(), Timestamp.from(BASE));
    }

    private Timestamp readAt(long notificationId) {
        return jdbc.queryForObject(
                "select read_at from notifications where notification_id = ?",
                Timestamp.class, notificationId);
    }

    private static String baseUrl(String role) {
        return "/api/v1/" + role + "/notifications";
    }

    private RequestPostProcessor identity(String role) {
        var principal = new Identity(userId);
        var authority = new SimpleGrantedAuthority("ROLE_" + role.toUpperCase());
        return authentication(new UsernamePasswordAuthenticationToken(
                principal, null, List.of(authority)));
    }

    private record Identity(Long userId) implements AuthenticatedPrincipal {
        @Override public boolean emailVerified() { return true; }
    }
}
