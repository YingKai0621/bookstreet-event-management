package com.swp391.bookstreet.migration;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.time.Instant;
import java.time.ZoneOffset;
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
class Sprint04SchemaMigrationTests {
    private static final String LEGACY_CANCELLATION_REASON =
            "Sự kiện đã được hủy trước khi hệ thống lưu lý do.";

    private String schema;

    @BeforeEach
    void createIsolatedSchemaName() {
        schema = "s4_migration_" + UUID.randomUUID().toString().replace("-", "");
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
    void cleanDatabaseMigratesThroughV8WithCancellationSchema() throws SQLException {
        Flyway flyway = flyway(MigrationVersion.fromVersion("8"));

        flyway.migrate();

        assertThat(flyway.info().current().getVersion().getVersion()).isEqualTo("8");
        try (Connection connection = connectToSchema()) {
            assertThat(columnExists(connection, "events", "cancelled_at")).isTrue();
            assertThat(columnExists(connection, "events", "cancellation_reason")).isTrue();
            assertThat(columnExists(connection, "booth_requests", "cancelled_at")).isTrue();
            assertThat(constraintDefinition(connection, "ck_events_cancellation_consistency"))
                    .contains("CANCELLED", "cancelled_at", "cancellation_reason");
            assertThat(constraintDefinition(connection, "ck_events_cancellation_reason_length"))
                    .contains("char_length", "10", "500");
            assertThat(constraintDefinition(connection, "ck_booth_requests_status"))
                    .contains("CANCELLED");
            assertThat(constraintDefinition(connection,
                    "ck_booth_requests_cancellation_consistency"))
                    .contains("CANCELLED", "cancelled_at");
        }
    }

    @Test
    void existingV7DatabaseBackfillsLegacyCancelledEventBeforeAddingConstraints()
            throws SQLException {
        flyway(MigrationVersion.fromVersion("7")).migrate();
        Instant legacyUpdatedAt;
        long eventId;
        try (Connection connection = connectToSchema()) {
            legacyUpdatedAt = Instant.parse("2026-10-08T05:00:00Z");
            eventId = insertLegacyCancelledEvent(connection, legacyUpdatedAt);
        }

        Flyway upgraded = flyway(MigrationVersion.fromVersion("8"));
        upgraded.migrate();

        assertThat(upgraded.info().current().getVersion().getVersion()).isEqualTo("8");
        try (Connection connection = connectToSchema()) {
            try (PreparedStatement statement = connection.prepareStatement("""
                    SELECT cancelled_at, cancellation_reason
                    FROM events
                    WHERE event_id = ?
                    """)) {
                statement.setLong(1, eventId);
                try (ResultSet result = statement.executeQuery()) {
                    assertThat(result.next()).isTrue();
                    assertThat(result.getObject("cancelled_at", java.time.OffsetDateTime.class)
                            .toInstant()).isEqualTo(legacyUpdatedAt);
                    assertThat(result.getString("cancellation_reason"))
                            .isEqualTo(LEGACY_CANCELLATION_REASON);
                }
            }

            assertThatThrownBy(() -> setEventStatusWithoutCancellationMetadata(connection, eventId,
                    "PUBLISHED"))
                    .isInstanceOf(SQLException.class);
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
        Connection connection = DriverManager.getConnection(databaseUrl(), databaseUser(),
                databasePassword());
        try (Statement statement = connection.createStatement()) {
            statement.execute("SET search_path TO " + quotedSchema());
        }
        return connection;
    }

    private long insertLegacyCancelledEvent(Connection connection, Instant updatedAt)
            throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement("""
                INSERT INTO events (
                    organizer_user_id,
                    name,
                    start_at,
                    end_at,
                    booth_payment_window_minutes,
                    max_booths_per_partner,
                    max_activities_per_partner,
                    status,
                    created_at,
                    updated_at
                )
                SELECT
                    user_id,
                    'Legacy cancelled Event',
                    ?::timestamptz + INTERVAL '30 days',
                    ?::timestamptz + INTERVAL '31 days',
                    1440,
                    1,
                    1,
                    'CANCELLED',
                    ?::timestamptz - INTERVAL '1 day',
                    ?::timestamptz
                FROM users
                WHERE username = 'organizerdemo'
                RETURNING event_id
                """)) {
            for (int index = 1; index <= 4; index++) {
                statement.setObject(index, updatedAt.atOffset(ZoneOffset.UTC));
            }
            try (ResultSet result = statement.executeQuery()) {
                assertThat(result.next()).isTrue();
                return result.getLong(1);
            }
        }
    }

    private void setEventStatusWithoutCancellationMetadata(Connection connection, long eventId,
            String status) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement("""
                UPDATE events
                SET status = ?
                WHERE event_id = ?
                """)) {
            statement.setString(1, status);
            statement.setLong(2, eventId);
            statement.executeUpdate();
        }
    }

    private boolean columnExists(Connection connection, String table, String column)
            throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement("""
                SELECT EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_schema = ? AND table_name = ? AND column_name = ?
                )
                """)) {
            statement.setString(1, schema);
            statement.setString(2, table);
            statement.setString(3, column);
            try (ResultSet result = statement.executeQuery()) {
                result.next();
                return result.getBoolean(1);
            }
        }
    }

    private String constraintDefinition(Connection connection, String constraint)
            throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement("""
                SELECT pg_get_constraintdef(oid)
                FROM pg_constraint
                WHERE connamespace = ?::regnamespace AND conname = ?
                """)) {
            statement.setString(1, schema);
            statement.setString(2, constraint);
            try (ResultSet result = statement.executeQuery()) {
                assertThat(result.next()).isTrue();
                return result.getString(1);
            }
        }
    }

    private String quotedSchema() {
        if (!schema.matches("[a-z0-9_]+")) throw new IllegalStateException("Unsafe schema");
        return '"' + schema + '"';
    }

    private static String databaseUrl() {
        return requiredEnvironment("EVENT_TEST_DATABASE_URL");
    }

    private static String databaseUser() {
        return requiredEnvironment("POSTGRES_USER");
    }

    private static String databasePassword() {
        return requiredEnvironment("POSTGRES_PASSWORD");
    }

    private static String requiredEnvironment(String name) {
        String value = System.getenv(name);
        if (value == null || value.isBlank()) {
            throw new IllegalStateException(name + " is required.");
        }
        return value;
    }
}
