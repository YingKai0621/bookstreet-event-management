package com.swp391.bookstreet.notification;

import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest(properties = {
        "debug=false",
        "logging.level.root=ERROR"
})
@EnabledIfEnvironmentVariable(named = "EVENT_TEST_DATABASE_URL", matches = ".+")
class BadgeUnlockedNotificationIntegrationTests {
    private static final String SCHEMA =
            "s7_badge_notification_" + UUID.randomUUID().toString().replace("-", "");
    private static final String BASE_URL = "/api/v1/participant/notifications";
    private static final Instant BASE = Instant.parse("2026-10-28T08:00:00Z");

    @Autowired WebApplicationContext context;
    @Autowired JdbcTemplate jdbc;

    private MockMvc mvc;

    @DynamicPropertySource
    static void databaseProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", BadgeUnlockedNotificationIntegrationTests::databaseUrl);
        registry.add("spring.datasource.username", BadgeUnlockedNotificationIntegrationTests::databaseUser);
        registry.add("spring.datasource.password", BadgeUnlockedNotificationIntegrationTests::databasePassword);
        registry.add("spring.flyway.default-schema", () -> SCHEMA);
        registry.add("spring.flyway.schemas", () -> SCHEMA);
        registry.add("spring.flyway.create-schemas", () -> true);
        registry.add("spring.jpa.properties.hibernate.default_schema", () -> SCHEMA);
    }

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        jdbc.execute("TRUNCATE TABLE " + table("users") + ", " + table("badges")
                + " RESTART IDENTITY CASCADE");
    }

    @AfterAll
    static void dropSchema() throws SQLException {
        try (Connection connection = DriverManager.getConnection(
                databaseUrl(), databaseUser(), databasePassword());
                Statement statement = connection.createStatement()) {
            statement.execute("DROP SCHEMA IF EXISTS " + quotedSchema() + " CASCADE");
        }
    }

    @Test
    void listAcceptsBadgeUnlockedAndReturnsOwnedBadgeReferences() throws Exception {
        Fixture fixture = seedFixture();

        mvc.perform(get(BASE_URL)
                        .param("type", "BADGE_UNLOCKED")
                        .with(participant(fixture.participantOneId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.content[*].notificationId", containsInAnyOrder(
                        fixture.participantOneFirstNotificationId().intValue(),
                        fixture.participantOneSecondNotificationId().intValue())))
                .andExpect(jsonPath("$.content[*].notificationId",
                        not(hasItem(fixture.participantTwoNotificationId().intValue()))))
                .andExpect(jsonPath("$.content[*].type",
                        containsInAnyOrder("BADGE_UNLOCKED", "BADGE_UNLOCKED")))
                .andExpect(jsonPath("$.content[*].referenceType",
                        containsInAnyOrder("BADGE", "BADGE")))
                .andExpect(jsonPath("$.content[*].referenceId", containsInAnyOrder(
                        fixture.firstBadgeId().intValue(), fixture.secondBadgeId().intValue())))
                .andExpect(jsonPath("$.content[*].read", containsInAnyOrder(false, false)));

        mvc.perform(get(BASE_URL)
                        .param("type", "BADGE_UNLOCKED")
                        .with(participant(fixture.participantTwoId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].notificationId")
                        .value(fixture.participantTwoNotificationId()))
                .andExpect(jsonPath("$.content[0].referenceType").value("BADGE"))
                .andExpect(jsonPath("$.content[0].referenceId")
                        .value(fixture.thirdBadgeId()));
    }

    @Test
    void markOneReadSupportsBadgeUnlockedAndConcealsForeignNotification() throws Exception {
        Fixture fixture = seedFixture();

        mvc.perform(post(BASE_URL + "/" + fixture.participantOneFirstNotificationId() + "/read")
                        .with(participant(fixture.participantOneId()))
                        .with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.notificationId")
                        .value(fixture.participantOneFirstNotificationId()))
                .andExpect(jsonPath("$.type").value("BADGE_UNLOCKED"))
                .andExpect(jsonPath("$.referenceType").value("BADGE"))
                .andExpect(jsonPath("$.referenceId").value(fixture.firstBadgeId()))
                .andExpect(jsonPath("$.read").value(true))
                .andExpect(jsonPath("$.readAt").isNotEmpty());

        mvc.perform(get(BASE_URL + "/unread-count")
                        .with(participant(fixture.participantOneId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.unreadCount").value(1));

        mvc.perform(post(BASE_URL + "/" + fixture.participantTwoNotificationId() + "/read")
                        .with(participant(fixture.participantOneId()))
                        .with(csrf()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOTIFICATION_NOT_FOUND"));

        mvc.perform(get(BASE_URL + "/unread-count")
                        .with(participant(fixture.participantTwoId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.unreadCount").value(1));
    }

    @Test
    void markAllReadIncludesOwnedBadgeUnlocksWithoutChangingAnotherOwner() throws Exception {
        Fixture fixture = seedFixture();

        mvc.perform(get(BASE_URL + "/unread-count")
                        .with(participant(fixture.participantOneId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.unreadCount").value(2));

        mvc.perform(post(BASE_URL + "/read-all")
                        .with(participant(fixture.participantOneId()))
                        .with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.updatedCount").value(2));

        mvc.perform(get(BASE_URL + "/unread-count")
                        .with(participant(fixture.participantOneId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.unreadCount").value(0));

        mvc.perform(get(BASE_URL)
                        .param("type", "BADGE_UNLOCKED")
                        .param("read", "true")
                        .with(participant(fixture.participantOneId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.content[*].read", containsInAnyOrder(true, true)));

        mvc.perform(get(BASE_URL + "/unread-count")
                        .with(participant(fixture.participantTwoId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.unreadCount").value(1));

        Integer foreignReadCount = jdbc.queryForObject("""
                select count(*)
                from %s
                where notification_id = ? and read_at is not null
                """.formatted(table("notifications")), Integer.class,
                fixture.participantTwoNotificationId());
        org.assertj.core.api.Assertions.assertThat(foreignReadCount).isZero();
    }

    private Fixture seedFixture() {
        long participantOneId = insertUser("badge-notification-one");
        long participantTwoId = insertUser("badge-notification-two");
        long firstBadgeId = insertBadge("S7 Notification Badge One", 10);
        long secondBadgeId = insertBadge("S7 Notification Badge Two", 20);
        long thirdBadgeId = insertBadge("S7 Notification Badge Three", 30);

        long firstUserBadgeId = insertUserBadge(
                participantOneId, firstBadgeId, BASE.plusSeconds(10));
        long secondUserBadgeId = insertUserBadge(
                participantOneId, secondBadgeId, BASE.plusSeconds(20));
        long thirdUserBadgeId = insertUserBadge(
                participantTwoId, thirdBadgeId, BASE.plusSeconds(30));

        long participantOneFirstNotificationId = insertBadgeNotification(
                participantOneId, firstBadgeId, firstUserBadgeId,
                "Bạn vừa mở khóa huy hiệu một", BASE.plusSeconds(10));
        long participantOneSecondNotificationId = insertBadgeNotification(
                participantOneId, secondBadgeId, secondUserBadgeId,
                "Bạn vừa mở khóa huy hiệu hai", BASE.plusSeconds(20));
        long participantTwoNotificationId = insertBadgeNotification(
                participantTwoId, thirdBadgeId, thirdUserBadgeId,
                "Bạn vừa mở khóa huy hiệu ba", BASE.plusSeconds(30));

        return new Fixture(
                participantOneId, participantTwoId,
                firstBadgeId, secondBadgeId, thirdBadgeId,
                participantOneFirstNotificationId,
                participantOneSecondNotificationId,
                participantTwoNotificationId);
    }

    private long insertUser(String label) {
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 8);
        String usernamePrefix = label.replace("-", "");
        if (usernamePrefix.length() > 18) {
            usernamePrefix = usernamePrefix.substring(0, 18);
        }
        return jdbc.queryForObject("""
                insert into %s(username, email, password_hash, full_name, status)
                values (?, ?, '{noop}unused', ?, 'ACTIVE')
                returning user_id
                """.formatted(table("users")), Long.class,
                usernamePrefix + suffix, usernamePrefix + suffix + "@example.test",
                "S7 " + label);
    }

    private long insertBadge(String name, int requiredPoints) {
        return jdbc.queryForObject("""
                insert into %s(
                    name, description, required_points, is_active, created_at, updated_at)
                values (?, ?, ?, true, ?, ?)
                returning badge_id
                """.formatted(table("badges")), Long.class, name, name + " description",
                requiredPoints, Timestamp.from(BASE), Timestamp.from(BASE));
    }

    private long insertUserBadge(long participantId, long badgeId, Instant earnedAt) {
        return jdbc.queryForObject("""
                insert into %s(user_id, badge_id, earned_at)
                values (?, ?, ?)
                returning user_badge_id
                """.formatted(table("user_badges")), Long.class,
                participantId, badgeId, Timestamp.from(earnedAt));
    }

    private long insertBadgeNotification(
            long participantId, long badgeId, long userBadgeId,
            String message, Instant createdAt) {
        return jdbc.queryForObject("""
                insert into %s(
                    recipient_user_id, recipient_role, notification_type, badge_id,
                    deduplication_key, title, message, created_at, read_at)
                values (?, 'PARTICIPANT', 'BADGE_UNLOCKED', ?, ?, 'Bạn vừa mở khóa huy hiệu', ?, ?, null)
                returning notification_id
                """.formatted(table("notifications")), Long.class,
                participantId, badgeId, "badge-unlocked:user-badge:" + userBadgeId,
                message, Timestamp.from(createdAt));
    }

    private static RequestPostProcessor participant(long userId) {
        var token = UsernamePasswordAuthenticationToken.authenticated(
                new TestPrincipal(userId), null,
                List.of(new SimpleGrantedAuthority("ROLE_PARTICIPANT")));
        return authentication(token);
    }

    private static String table(String name) {
        return quotedSchema() + ".\"" + name.replace("\"", "\"\"") + "\"";
    }

    private static String quotedSchema() {
        return '"' + SCHEMA.replace("\"", "\"\"") + '"';
    }

    private static String databaseUrl() {
        return System.getenv("EVENT_TEST_DATABASE_URL");
    }

    private static String databaseUser() {
        return System.getenv().getOrDefault("EVENT_TEST_DATABASE_USER", "postgres");
    }

    private static String databasePassword() {
        return System.getenv().getOrDefault("EVENT_TEST_DATABASE_PASSWORD", "postgres");
    }

    private record TestPrincipal(Long userId) implements AuthenticatedPrincipal {
        @Override
        public boolean emailVerified() {
            return true;
        }
    }

    private record Fixture(
            Long participantOneId,
            Long participantTwoId,
            Long firstBadgeId,
            Long secondBadgeId,
            Long thirdBadgeId,
            Long participantOneFirstNotificationId,
            Long participantOneSecondNotificationId,
            Long participantTwoNotificationId) {
    }
}
