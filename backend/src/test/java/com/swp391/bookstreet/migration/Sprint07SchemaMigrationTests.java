package com.swp391.bookstreet.migration;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.MigrationVersion;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@EnabledIfEnvironmentVariable(named = "EVENT_TEST_DATABASE_URL", matches = ".+")
class Sprint07SchemaMigrationTests {
    private static final MigrationVersion SPRINT_07_VERSION = MigrationVersion.fromVersion("13");
    private static final Instant NOW = Instant.parse("2026-10-28T08:20:00Z");
    private String schema;

    @BeforeEach
    void createIsolatedSchemaName() {
        schema = "s7_migration_" + UUID.randomUUID().toString().replace("-", "");
    }

    @AfterEach
    void dropIsolatedSchema() throws SQLException {
        if (schema == null) return;
        try (Connection connection = DriverManager.getConnection(databaseUrl(), databaseUser(),
                databasePassword()); Statement statement = connection.createStatement()) {
            statement.execute("DROP SCHEMA IF EXISTS " + quotedSchema() + " CASCADE");
        }
    }

    @Test
    void cleanDatabaseMigratesThroughSprint07SchemaWithRewardSchema() throws SQLException {
        Flyway flyway = flyway(SPRINT_07_VERSION);

        flyway.migrate();

        assertThat(flyway.info().current().getVersion().getVersion()).isEqualTo("13");
        try (Connection connection = connectToSchema()) {
            for (String table : List.of(
                    "booth_visits", "point_transactions", "badges", "user_badges")) {
                assertThat(tableExists(connection, table)).as(table).isTrue();
            }
            assertThat(columnExists(connection, "notifications", "badge_id")).isTrue();
            assertThat(indexExists(connection, "uk_badges_name_case_insensitive")).isTrue();
            assertThat(indexExists(connection, "idx_notifications_badge")).isTrue();
            assertThat(columnExists(connection, "booths", "image_url")).isTrue();
        }
    }

    @Test
    void existingV11DatabaseUpgradesWithoutLosingExistingRows() throws SQLException {
        Flyway baseline = flyway(MigrationVersion.fromVersion("11"));
        baseline.migrate();
        long userCount;
        try (Connection connection = connectToSchema(); Statement statement =
                connection.createStatement(); ResultSet result = statement.executeQuery(
                        "SELECT COUNT(*) FROM users")) {
            assertThat(result.next()).isTrue();
            userCount = result.getLong(1);
        }

        Flyway upgraded = flyway(SPRINT_07_VERSION);
        upgraded.migrate();

        assertThat(upgraded.info().current().getVersion().getVersion()).isEqualTo("13");
        try (Connection connection = connectToSchema(); Statement statement =
                connection.createStatement(); ResultSet result = statement.executeQuery(
                        "SELECT COUNT(*) FROM users")) {
            assertThat(result.next()).isTrue();
            assertThat(result.getLong(1)).isEqualTo(userCount);
            assertThat(tableExists(connection, "badges")).isTrue();
            assertThat(columnExists(connection, "notifications", "badge_id")).isTrue();
        }
    }

    @Test
    void badgeUserBadgeAndNotificationGuardsAreEnforced() throws SQLException {
        flyway(SPRINT_07_VERSION).migrate();

        try (Connection connection = connectToSchema()) {
            long userId = userId(connection, "participantdemo");
            long badgeId = insertBadge(connection, "Người khám phá", 10);

            assertThatThrownBy(() -> insertBadge(connection, "người khám phá", 20))
                    .isInstanceOf(SQLException.class)
                    .hasMessageContaining("uk_badges_name_case_insensitive");
            assertThatThrownBy(() -> execute(connection, """
                    INSERT INTO badges (
                        name, required_points, is_active, created_at, updated_at
                    ) VALUES ('  Không chuẩn', 10, TRUE, ?, ?)
                    """, NOW, NOW))
                    .isInstanceOf(SQLException.class)
                    .hasMessageContaining("ck_badges_name");
            assertThatThrownBy(() -> execute(connection, """
                    INSERT INTO badges (
                        name, required_points, is_active, created_at, updated_at
                    ) VALUES ('Không hợp lệ', 0, TRUE, ?, ?)
                    """, NOW, NOW))
                    .isInstanceOf(SQLException.class)
                    .hasMessageContaining("ck_badges_required_points");

            long userBadgeId = insertUserBadge(connection, userId, badgeId);
            assertThatThrownBy(() -> insertUserBadge(connection, userId, badgeId))
                    .isInstanceOf(SQLException.class)
                    .hasMessageContaining("uk_user_badges_user_badge");

            execute(connection, """
                    INSERT INTO notifications (
                        recipient_user_id, notification_type, badge_id,
                        deduplication_key, title, message, created_at
                    ) VALUES (?, 'BADGE_UNLOCKED', ?, ?,
                        'Bạn vừa mở khóa huy hiệu', 'Bạn đã mở khóa huy hiệu.', ?)
                    """, userId, badgeId, "badge-unlocked:user-badge:" + userBadgeId, NOW);
            assertThatThrownBy(() -> execute(connection, """
                    INSERT INTO notifications (
                        recipient_user_id, notification_type,
                        deduplication_key, title, message, created_at
                    ) VALUES (?, 'BADGE_UNLOCKED', 'badge-unlocked:missing-reference',
                        'Thiếu tham chiếu', 'Thiếu Badge.', ?)
                    """, userId, NOW))
                    .isInstanceOf(SQLException.class)
                    .hasMessageContaining("ck_notifications_reference");
        }
    }

    @Test
    void boothVisitAndPointLedgerGuardsAreEnforced() throws SQLException {
        flyway(SPRINT_07_VERSION).migrate();

        try (Connection connection = connectToSchema()) {
            RewardFixture fixture = insertRewardFixture(connection);
            long boothVisitId = insertBoothVisit(
                    connection, fixture.eventRegistrationId(), fixture.boothAssignmentId());

            assertThatThrownBy(() -> insertBoothVisit(
                    connection, fixture.eventRegistrationId(), fixture.boothAssignmentId()))
                    .isInstanceOf(SQLException.class)
                    .hasMessageContaining("uk_booth_visits_registration_assignment");
            assertThatThrownBy(() -> execute(connection, """
                    INSERT INTO booth_visits (
                        event_registration_id, booth_assignment_id, visited_at
                    ) VALUES (999999999, ?, ?)
                    """, fixture.boothAssignmentId(), NOW))
                    .isInstanceOf(SQLException.class)
                    .hasMessageContaining("fk_booth_visits_event_registration");

            insertPointTransaction(connection, boothVisitId, 10);
            assertThatThrownBy(() -> insertPointTransaction(connection, boothVisitId, 10))
                    .isInstanceOf(SQLException.class)
                    .hasMessageContaining("uk_point_transactions_booth_visit");
            execute(connection,
                    "DELETE FROM point_transactions WHERE booth_visit_id = ?", boothVisitId);
            assertThatThrownBy(() -> execute(connection, """
                    INSERT INTO point_transactions (booth_visit_id, points, created_at)
                    VALUES (?, 0, ?)
                    """, boothVisitId, NOW))
                    .isInstanceOf(SQLException.class)
                    .hasMessageContaining("ck_point_transactions_points");
            assertThatThrownBy(() -> execute(connection, """
                    INSERT INTO point_transactions (booth_visit_id, points, created_at)
                    VALUES (999999999, 10, ?)
                    """, NOW))
                    .isInstanceOf(SQLException.class)
                    .hasMessageContaining("fk_point_transactions_booth_visit");
        }
    }

    private long insertBadge(Connection connection, String name, int requiredPoints)
            throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement("""
                INSERT INTO badges (
                    name, description, required_points, icon_url,
                    is_active, created_at, updated_at
                ) VALUES (?, 'Huy hiệu kiểm thử', ?, 'https://example.com/badge.png',
                    TRUE, ?, ?)
                RETURNING badge_id
                """)) {
            statement.setString(1, name);
            statement.setInt(2, requiredPoints);
            statement.setObject(3, NOW.atOffset(ZoneOffset.UTC));
            statement.setObject(4, NOW.atOffset(ZoneOffset.UTC));
            return returnedId(statement);
        }
    }

    private long insertUserBadge(Connection connection, long userId, long badgeId)
            throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement("""
                INSERT INTO user_badges (user_id, badge_id, earned_at)
                VALUES (?, ?, ?)
                RETURNING user_badge_id
                """)) {
            statement.setLong(1, userId);
            statement.setLong(2, badgeId);
            statement.setObject(3, NOW.atOffset(ZoneOffset.UTC));
            return returnedId(statement);
        }
    }

    private RewardFixture insertRewardFixture(Connection connection) throws SQLException {
        long organizerId = userId(connection, "organizerdemo");
        long partnerId = userId(connection, "partnerdemo");
        long participantId = userId(connection, "participantdemo");

        long eventId = returnedId(connection, """
                INSERT INTO events (
                    organizer_user_id, name, start_at, end_at,
                    booth_payment_window_minutes, max_booths_per_partner,
                    max_activities_per_partner, status, created_at, updated_at
                ) VALUES (?, 'Sprint 7 migration Event', ?, ?, 1440, 1, 3,
                    'PUBLISHED', ?, ?)
                RETURNING event_id
                """, organizerId, NOW, NOW.plusSeconds(86400), NOW, NOW);
        long organizationId = returnedId(connection, """
                INSERT INTO partner_organizations (
                    representative_user_id, name, category_code, status, created_at, updated_at
                ) VALUES (?, 'Sprint 7 Partner', 'PUBLISHER', 'ACTIVE', ?, ?)
                RETURNING partner_organization_id
                """, partnerId, NOW, NOW);
        long applicationId = returnedId(connection, """
                INSERT INTO partner_event_applications (
                    partner_organization_id, event_id, status, submitted_at, reviewed_at
                ) VALUES (?, ?, 'APPROVED', ?, ?)
                RETURNING application_id
                """, organizationId, eventId, NOW, NOW);
        long locationId = returnedId(connection, """
                INSERT INTO locations (
                    code, name, location_type, max_capacity, is_active, created_at, updated_at
                ) VALUES ('S7-MIGRATION-BOOTH', 'Sprint 7 Booth', 'BOOTH', 20, TRUE, ?, ?)
                RETURNING location_id
                """, NOW, NOW);
        execute(connection, "INSERT INTO booths (booth_id) VALUES (?)", locationId);
        long configId = returnedId(connection, """
                INSERT INTO event_booth_configs (
                    event_id, booth_id, rental_price, is_enabled, created_at, updated_at
                ) VALUES (?, ?, 5000, TRUE, ?, ?)
                RETURNING event_booth_config_id
                """, eventId, locationId, NOW, NOW);
        long requestId = returnedId(connection, """
                INSERT INTO booth_requests (
                    application_id, booth_id, status, submitted_at, reviewed_at,
                    selected_at, completed_at
                ) VALUES (?, ?, 'COMPLETED', ?, ?, ?, ?)
                RETURNING booth_request_id
                """, applicationId, locationId, NOW, NOW, NOW, NOW);
        long holdId = returnedId(connection, """
                INSERT INTO booth_holds (
                    event_booth_config_id, booth_request_id, locked_rental_price,
                    status, created_at, expires_at, consumed_at
                ) VALUES (?, ?, 5000, 'CONSUMED', ?, ?, ?)
                RETURNING booth_hold_id
                """, configId, requestId, NOW, NOW.plusSeconds(3600), NOW);
        long assignmentId = returnedId(connection, """
                INSERT INTO booth_assignments (
                    booth_hold_id, qr_token, status, assigned_at
                ) VALUES (?, ?, 'ACTIVE', ?)
                RETURNING booth_assignment_id
                """, holdId, UUID.randomUUID(), NOW);
        long eventRegistrationId = returnedId(connection, """
                INSERT INTO event_registrations (
                    user_id, event_id, status, registered_at, activated_at, updated_at
                ) VALUES (?, ?, 'ACTIVE', ?, ?, ?)
                RETURNING event_registration_id
                """, participantId, eventId, NOW, NOW, NOW);
        return new RewardFixture(eventRegistrationId, assignmentId);
    }

    private long insertBoothVisit(
            Connection connection, long eventRegistrationId, long boothAssignmentId)
            throws SQLException {
        return returnedId(connection, """
                INSERT INTO booth_visits (
                    event_registration_id, booth_assignment_id, visited_at
                ) VALUES (?, ?, ?)
                RETURNING booth_visit_id
                """, eventRegistrationId, boothAssignmentId, NOW);
    }

    private long insertPointTransaction(Connection connection, long boothVisitId, int points)
            throws SQLException {
        return returnedId(connection, """
                INSERT INTO point_transactions (booth_visit_id, points, created_at)
                VALUES (?, ?, ?)
                RETURNING point_transaction_id
                """, boothVisitId, points, NOW);
    }

    private long returnedId(Connection connection, String sql, Object... values)
            throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            for (int index = 0; index < values.length; index++) {
                Object value = values[index];
                if (value instanceof Instant instant) {
                    statement.setObject(index + 1, instant.atOffset(ZoneOffset.UTC));
                } else {
                    statement.setObject(index + 1, value);
                }
            }
            return returnedId(statement);
        }
    }

    private long userId(Connection connection, String username) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT user_id FROM users WHERE username = ?")) {
            statement.setString(1, username);
            try (ResultSet result = statement.executeQuery()) {
                assertThat(result.next()).isTrue();
                return result.getLong(1);
            }
        }
    }

    private void execute(Connection connection, String sql, Object... values)
            throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            for (int index = 0; index < values.length; index++) {
                Object value = values[index];
                if (value instanceof Instant instant) {
                    statement.setObject(index + 1, instant.atOffset(ZoneOffset.UTC));
                } else {
                    statement.setObject(index + 1, value);
                }
            }
            statement.executeUpdate();
        }
    }

    private long returnedId(PreparedStatement statement) throws SQLException {
        try (ResultSet result = statement.executeQuery()) {
            assertThat(result.next()).isTrue();
            return result.getLong(1);
        }
    }

    private Flyway flyway(MigrationVersion target) {
        var configuration = Flyway.configure()
                .dataSource(databaseUrl(), databaseUser(), databasePassword())
                .locations("classpath:db/migration")
                .defaultSchema(schema)
                .schemas(schema)
                .createSchemas(true);
        if (target != null) configuration.target(target);
        return configuration.load();
    }

    private Connection connectToSchema() throws SQLException {
        Connection connection = DriverManager.getConnection(
                databaseUrl(), databaseUser(), databasePassword());
        try (Statement statement = connection.createStatement()) {
            statement.execute("SET search_path TO " + quotedSchema());
        }
        return connection;
    }

    private boolean tableExists(Connection connection, String table) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement("""
                SELECT EXISTS (
                    SELECT 1 FROM information_schema.tables
                    WHERE table_schema = ? AND table_name = ?
                )
                """)) {
            statement.setString(1, schema);
            statement.setString(2, table);
            try (ResultSet result = statement.executeQuery()) {
                return result.next() && result.getBoolean(1);
            }
        }
    }

    private boolean columnExists(Connection connection, String table, String column)
            throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement("""
                SELECT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_schema = ? AND table_name = ? AND column_name = ?
                )
                """)) {
            statement.setString(1, schema);
            statement.setString(2, table);
            statement.setString(3, column);
            try (ResultSet result = statement.executeQuery()) {
                return result.next() && result.getBoolean(1);
            }
        }
    }

    private boolean indexExists(Connection connection, String index) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement("""
                SELECT EXISTS (
                    SELECT 1 FROM pg_indexes
                    WHERE schemaname = ? AND indexname = ?
                )
                """)) {
            statement.setString(1, schema);
            statement.setString(2, index);
            try (ResultSet result = statement.executeQuery()) {
                return result.next() && result.getBoolean(1);
            }
        }
    }

    private String quotedSchema() {
        return '"' + schema.replace("\"", "\"\"") + '"';
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

    private record RewardFixture(Long eventRegistrationId, Long boothAssignmentId) {
    }
}
