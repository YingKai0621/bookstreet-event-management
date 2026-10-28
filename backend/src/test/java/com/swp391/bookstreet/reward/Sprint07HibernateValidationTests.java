package com.swp391.bookstreet.reward;

import static org.assertj.core.api.Assertions.assertThat;

import com.swp391.bookstreet.reward.service.ParticipantBoothVisitService;
import com.swp391.bookstreet.security.authentication.AuthenticatedPrincipal;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.sql.Statement;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@EnabledIfEnvironmentVariable(named = "EVENT_TEST_DATABASE_URL", matches = ".+")
class Sprint07HibernateValidationTests {
    private static final String SCHEMA =
            "s7_hibernate_" + UUID.randomUUID().toString().replace("-", "");

    @Autowired JdbcTemplate jdbc;
    @Autowired ParticipantBoothVisitService boothVisitService;

    @DynamicPropertySource
    static void databaseProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", Sprint07HibernateValidationTests::databaseUrl);
        registry.add("spring.datasource.username", Sprint07HibernateValidationTests::databaseUser);
        registry.add("spring.datasource.password", Sprint07HibernateValidationTests::databasePassword);
        registry.add("spring.flyway.default-schema", () -> SCHEMA);
        registry.add("spring.flyway.schemas", () -> SCHEMA);
        registry.add("spring.flyway.create-schemas", () -> true);
        registry.add("spring.jpa.properties.hibernate.default_schema", () -> SCHEMA);
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
    void contextLoadsWithHibernateValidateAgainstV12() {
    }

    @Test
    @Transactional
    void scanQueriesPersistAndReuseOneDurableReward() {
        Instant now = Instant.now();
        long organizerId = insertUser("organizer");
        long partnerId = insertUser("partner");
        long participantId = insertUser("participant");
        long eventId = jdbc.queryForObject("""
                insert into %s(
                    organizer_user_id, name, start_at, end_at,
                    booth_payment_window_minutes, max_booths_per_partner,
                    max_activities_per_partner, status, created_at, updated_at)
                values (?, 'S7 scan event', ?, ?, 60, 2, 3, 'ONGOING', ?, ?)
                returning event_id
                """.formatted(table("events")), Long.class, organizerId,
                Timestamp.from(now.minusSeconds(60)), Timestamp.from(now.plusSeconds(60)),
                Timestamp.from(now.minusSeconds(120)), Timestamp.from(now.minusSeconds(120)));
        long organizationId = jdbc.queryForObject("""
                insert into %s(
                    representative_user_id, name, category_code, status,
                    created_at, updated_at)
                values (?, 'S7 Partner', 'PUBLISHER', 'ACTIVE', ?, ?)
                returning partner_organization_id
                """.formatted(table("partner_organizations")), Long.class, partnerId,
                Timestamp.from(now), Timestamp.from(now));
        long applicationId = jdbc.queryForObject("""
                insert into %s(
                    partner_organization_id, event_id, status, submitted_at, reviewed_at)
                values (?, ?, 'APPROVED', ?, ?)
                returning application_id
                """.formatted(table("partner_event_applications")), Long.class,
                organizationId, eventId, Timestamp.from(now), Timestamp.from(now));
        long boothId = jdbc.queryForObject("""
                insert into %s(
                    code, name, location_type, max_capacity, is_active,
                    created_at, updated_at)
                values ('S7-A01', 'S7 Booth', 'BOOTH', 10, true, ?, ?)
                returning location_id
                """.formatted(table("locations")), Long.class,
                Timestamp.from(now), Timestamp.from(now));
        jdbc.update("insert into " + table("booths")
                + "(booth_id, category_code) values (?, 'PUBLISHER')", boothId);
        long configId = jdbc.queryForObject("""
                insert into %s(event_id, booth_id, rental_price, is_enabled)
                values (?, ?, 10000, true)
                returning event_booth_config_id
                """.formatted(table("event_booth_configs")), Long.class, eventId, boothId);
        long requestId = jdbc.queryForObject("""
                insert into %s(
                    application_id, booth_id, status, submitted_at, reviewed_at,
                    selected_at, completed_at)
                values (?, ?, 'COMPLETED', ?, ?, ?, ?)
                returning booth_request_id
                """.formatted(table("booth_requests")), Long.class, applicationId, boothId,
                Timestamp.from(now), Timestamp.from(now), Timestamp.from(now),
                Timestamp.from(now));
        long holdId = jdbc.queryForObject("""
                insert into %s(
                    event_booth_config_id, booth_request_id, locked_rental_price,
                    status, created_at, expires_at, consumed_at)
                values (?, ?, 10000, 'CONSUMED', ?, ?, ?)
                returning booth_hold_id
                """.formatted(table("booth_holds")), Long.class, configId, requestId,
                Timestamp.from(now.minusSeconds(120)), Timestamp.from(now.plusSeconds(120)),
                Timestamp.from(now.minusSeconds(60)));
        UUID token = UUID.randomUUID();
        long assignmentId = jdbc.queryForObject("""
                insert into %s(booth_hold_id, qr_token, status, assigned_at)
                values (?, ?, 'ACTIVE', ?)
                returning booth_assignment_id
                """.formatted(table("booth_assignments")), Long.class, holdId, token,
                Timestamp.from(now.minusSeconds(60)));

        var authentication = UsernamePasswordAuthenticationToken.authenticated(
                new TestPrincipal(participantId), null,
                java.util.List.of(new SimpleGrantedAuthority("ROLE_PARTICIPANT")));
        SecurityContextHolder.getContext().setAuthentication(authentication);
        try {
            var first = boothVisitService.scan(token.toString());
            var duplicate = boothVisitService.scan(token.toString());

            assertThat(first.alreadyVisited()).isFalse();
            assertThat(first.newlyAwardedPoints()).isEqualTo(10);
            assertThat(first.totalPoints()).isEqualTo(10);
            assertThat(first.boothVisit().boothAssignmentId()).isEqualTo(assignmentId);
            assertThat(duplicate.alreadyVisited()).isTrue();
            assertThat(duplicate.boothVisit().boothVisitId())
                    .isEqualTo(first.boothVisit().boothVisitId());
            assertThat(duplicate.newlyAwardedPoints()).isZero();
            assertThat(jdbc.queryForObject("select count(*) from " + table("booth_visits"),
                    Long.class)).isOne();
            assertThat(jdbc.queryForObject(
                    "select coalesce(sum(points), 0) from " + table("point_transactions"),
                    Long.class)).isEqualTo(10L);
        } finally {
            SecurityContextHolder.clearContext();
        }
    }

    private long insertUser(String label) {
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 10);
        return jdbc.queryForObject("""
                insert into %s(username, email, password_hash, full_name, status)
                values (?, ?, '{noop}unused', ?, 'ACTIVE')
                returning user_id
                """.formatted(table("users")), Long.class,
                label + suffix, label + suffix + "@example.test", "S7 " + label);
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
        @Override public boolean emailVerified() { return true; }
    }
}
