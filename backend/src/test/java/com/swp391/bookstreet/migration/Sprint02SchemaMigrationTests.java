package com.swp391.bookstreet.migration;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
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
class Sprint02SchemaMigrationTests {

    private static final List<String> SPRINT_2_TABLES = List.of(
            "locations",
            "booths",
            "event_booth_configs",
            "booth_requests",
            "booth_holds"
    );

    private String schema;

    @BeforeEach
    void createIsolatedSchemaName() {
        schema = "s2_migration_" + UUID.randomUUID().toString().replace("-", "");
    }

    @AfterEach
    void dropIsolatedSchema() throws SQLException {
        if (schema == null) {
            return;
        }
        try (Connection connection = DriverManager.getConnection(databaseUrl(), databaseUser(), databasePassword());
             Statement statement = connection.createStatement()) {
            statement.execute("DROP SCHEMA IF EXISTS " + quotedSchema() + " CASCADE");
        }
    }

    @Test
    void cleanDatabaseMigratesThroughV6() throws SQLException {
        Flyway flyway = flyway(MigrationVersion.fromVersion("6"));

        flyway.migrate();

        assertThat(flyway.info().current().getVersion().getVersion()).isEqualTo("6");
        try (Connection connection = connectToSchema()) {
            assertThat(existingSprint2Tables(connection)).containsExactlyInAnyOrderElementsOf(SPRINT_2_TABLES);
            assertThat(indexDefinition(connection, "uk_booth_requests_open_application_booth"))
                    .contains("application_id", "booth_id", "PENDING", "SELECTED");
            assertThat(indexDefinition(connection, "uk_booth_holds_active_event_booth_config"))
                    .contains("event_booth_config_id", "ACTIVE");
        }
    }

    @Test
    void existingV1ThroughV5DatabaseUpgradesWithoutManualIntervention() throws SQLException {
        flyway(MigrationVersion.fromVersion("5")).migrate();
        try (Connection connection = connectToSchema()) {
            insertLegacyEvent(connection, "Legacy short window", 0);
            insertLegacyEvent(connection, "Legacy long window", 20000);
            assertThat(existingSprint2Tables(connection)).isEmpty();
        }

        flyway(null).migrate();

        try (Connection connection = connectToSchema()) {
            assertThat(eventPaymentWindow(connection, "Legacy short window")).isEqualTo(60);
            assertThat(eventPaymentWindow(connection, "Legacy long window")).isEqualTo(10080);
            assertThat(eventPaymentWindowConstraint(connection))
                    .contains("booth_payment_window_minutes >= 60")
                    .contains("booth_payment_window_minutes <= 10080");
            assertThat(columnDefault(connection, "events", "booth_payment_window_minutes"))
                    .isEqualTo("1440");
            assertOpenRequestUniqueness(connection);
        }
    }

    private Flyway flyway(MigrationVersion target) {
        var configuration = Flyway.configure()
                .dataSource(databaseUrl(), databaseUser(), databasePassword())
                .locations("classpath:db/migration")
                .defaultSchema(schema)
                .schemas(schema)
                .createSchemas(true);
        if (target != null) {
            configuration.target(target);
        }
        return configuration.load();
    }

    private Connection connectToSchema() throws SQLException {
        Connection connection = DriverManager.getConnection(databaseUrl(), databaseUser(), databasePassword());
        try (Statement statement = connection.createStatement()) {
            statement.execute("SET search_path TO " + quotedSchema());
        }
        return connection;
    }

    private List<String> existingSprint2Tables(Connection connection) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement("""
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = ?
                  AND table_name IN ('locations', 'booths', 'event_booth_configs', 'booth_requests', 'booth_holds')
                ORDER BY table_name
                """)) {
            statement.setString(1, schema);
            try (ResultSet result = statement.executeQuery()) {
                var tables = new java.util.ArrayList<String>();
                while (result.next()) {
                    tables.add(result.getString(1));
                }
                return tables;
            }
        }
    }

    private String indexDefinition(Connection connection, String indexName) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement("""
                SELECT indexdef
                FROM pg_indexes
                WHERE schemaname = ? AND indexname = ?
                """)) {
            statement.setString(1, schema);
            statement.setString(2, indexName);
            try (ResultSet result = statement.executeQuery()) {
                assertThat(result.next()).isTrue();
                return result.getString(1);
            }
        }
    }

    private void insertLegacyEvent(Connection connection, String name, int paymentWindowMinutes) throws SQLException {
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
                    ?,
                    CURRENT_TIMESTAMP + INTERVAL '30 days',
                    CURRENT_TIMESTAMP + INTERVAL '31 days',
                    ?,
                    1,
                    1,
                    'DRAFT',
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP
                FROM users
                WHERE username = 'organizerdemo'
                """)) {
            statement.setString(1, name);
            statement.setInt(2, paymentWindowMinutes);
            assertThat(statement.executeUpdate()).isEqualTo(1);
        }
    }

    private int eventPaymentWindow(Connection connection, String eventName) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement("""
                SELECT booth_payment_window_minutes
                FROM events
                WHERE name = ?
                """)) {
            statement.setString(1, eventName);
            try (ResultSet result = statement.executeQuery()) {
                assertThat(result.next()).isTrue();
                return result.getInt(1);
            }
        }
    }

    private String eventPaymentWindowConstraint(Connection connection) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement("""
                SELECT pg_get_constraintdef(oid)
                FROM pg_constraint
                WHERE connamespace = ?::regnamespace
                  AND conname = 'ck_events_booth_payment_window_range'
                """)) {
            statement.setString(1, schema);
            try (ResultSet result = statement.executeQuery()) {
                assertThat(result.next()).isTrue();
                return result.getString(1);
            }
        }
    }

    private String columnDefault(Connection connection, String table, String column) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement("""
                SELECT column_default
                FROM information_schema.columns
                WHERE table_schema = ? AND table_name = ? AND column_name = ?
                """)) {
            statement.setString(1, schema);
            statement.setString(2, table);
            statement.setString(3, column);
            try (ResultSet result = statement.executeQuery()) {
                assertThat(result.next()).isTrue();
                return result.getString(1);
            }
        }
    }

    private void assertOpenRequestUniqueness(Connection connection) throws SQLException {
        long eventId = insertEventUsingDefaultWindow(connection);
        long organizationId = insertPartnerOrganization(connection);
        long applicationId = insertApprovedApplication(connection, organizationId, eventId);
        long boothId = insertBooth(connection);

        insertBoothRequest(connection, applicationId, boothId, "PENDING");

        assertThatThrownBy(() -> insertBoothRequest(connection, applicationId, boothId, "SELECTED"))
                .isInstanceOf(SQLException.class)
                .hasMessageContaining("uk_booth_requests_open_application_booth");

        try (PreparedStatement statement = connection.prepareStatement("""
                UPDATE booth_requests
                SET status = 'WITHDRAWN', withdrawn_at = CURRENT_TIMESTAMP
                WHERE application_id = ? AND booth_id = ?
                """)) {
            statement.setLong(1, applicationId);
            statement.setLong(2, boothId);
            assertThat(statement.executeUpdate()).isEqualTo(1);
        }

        insertBoothRequest(connection, applicationId, boothId, "PENDING");
    }

    private long insertEventUsingDefaultWindow(Connection connection) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement("""
                INSERT INTO events (
                    organizer_user_id,
                    name,
                    start_at,
                    end_at,
                    max_booths_per_partner,
                    max_activities_per_partner,
                    status,
                    created_at,
                    updated_at
                )
                SELECT
                    user_id,
                    'Sprint 2 migration fixture',
                    CURRENT_TIMESTAMP + INTERVAL '40 days',
                    CURRENT_TIMESTAMP + INTERVAL '41 days',
                    2,
                    2,
                    'DRAFT',
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP
                FROM users
                WHERE username = 'organizerdemo'
                RETURNING event_id, booth_payment_window_minutes
                """)) {
            try (ResultSet result = statement.executeQuery()) {
                assertThat(result.next()).isTrue();
                assertThat(result.getInt("booth_payment_window_minutes")).isEqualTo(1440);
                return result.getLong("event_id");
            }
        }
    }

    private long insertPartnerOrganization(Connection connection) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement("""
                INSERT INTO partner_organizations (
                    representative_user_id,
                    name,
                    category_code,
                    status,
                    created_at,
                    updated_at
                )
                SELECT
                    user_id,
                    'Sprint 2 migration partner',
                    'PUBLISHER',
                    'ACTIVE',
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP
                FROM users
                WHERE username = 'partnerdemo'
                RETURNING partner_organization_id
                """)) {
            try (ResultSet result = statement.executeQuery()) {
                assertThat(result.next()).isTrue();
                return result.getLong(1);
            }
        }
    }

    private long insertApprovedApplication(Connection connection, long organizationId, long eventId)
            throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement("""
                INSERT INTO partner_event_applications (
                    partner_organization_id,
                    event_id,
                    status,
                    submitted_at,
                    reviewed_at
                )
                VALUES (?, ?, 'APPROVED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                RETURNING application_id
                """)) {
            statement.setLong(1, organizationId);
            statement.setLong(2, eventId);
            try (ResultSet result = statement.executeQuery()) {
                assertThat(result.next()).isTrue();
                return result.getLong(1);
            }
        }
    }

    private long insertBooth(Connection connection) throws SQLException {
        long locationId;
        try (PreparedStatement statement = connection.prepareStatement("""
                INSERT INTO locations (code, name, location_type, max_capacity)
                VALUES ('MIGRATION-A01', 'Migration Booth A01', 'BOOTH', 4)
                RETURNING location_id
                """)) {
            try (ResultSet result = statement.executeQuery()) {
                assertThat(result.next()).isTrue();
                locationId = result.getLong(1);
            }
        }
        try (PreparedStatement statement = connection.prepareStatement("""
                INSERT INTO booths (booth_id, category_code)
                VALUES (?, 'PUBLISHER')
                """)) {
            statement.setLong(1, locationId);
            assertThat(statement.executeUpdate()).isEqualTo(1);
        }
        return locationId;
    }

    private void insertBoothRequest(Connection connection, long applicationId, long boothId, String status)
            throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement("""
                INSERT INTO booth_requests (application_id, booth_id, status)
                VALUES (?, ?, ?)
                """)) {
            statement.setLong(1, applicationId);
            statement.setLong(2, boothId);
            statement.setString(3, status);
            assertThat(statement.executeUpdate()).isEqualTo(1);
        }
    }

    private String quotedSchema() {
        if (!schema.matches("[a-z0-9_]+")) {
            throw new IllegalStateException("Unsafe test schema name");
        }
        return '"' + schema + '"';
    }

    private String databaseUrl() {
        return requiredEnvironment("EVENT_TEST_DATABASE_URL");
    }

    private String databaseUser() {
        return requiredEnvironment("POSTGRES_USER");
    }

    private String databasePassword() {
        return requiredEnvironment("POSTGRES_PASSWORD");
    }

    private String requiredEnvironment(String name) {
        String value = System.getenv(name);
        if (value == null || value.isBlank()) {
            throw new IllegalStateException(name + " is required for migration tests");
        }
        return value;
    }
}
