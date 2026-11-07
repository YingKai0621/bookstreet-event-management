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
class Sprint06SchemaMigrationTests {
    private static final Instant CREATED_AT = Instant.parse("2026-10-19T00:00:00Z");
    private static final MigrationVersion SPRINT_06_SCHEMA_VERSION =
            MigrationVersion.fromVersion("11");
    private String schema;

    @BeforeEach
    void createIsolatedSchemaName() {
        schema = "s6_migration_" + UUID.randomUUID().toString().replace("-", "");
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
    void cleanDatabaseMigratesThroughV10WithParticipationSchema() throws SQLException {
        Flyway flyway = flyway(SPRINT_06_SCHEMA_VERSION);

        flyway.migrate();

        assertThat(flyway.info().current().getVersion().getVersion()).isEqualTo("11");
        try (Connection connection = connectToSchema()) {
            assertThat(List.of(
                    "event_registrations",
                    "activity_registrations",
                    "attendances",
                    "attendance_adjustments",
                    "certificates",
                    "activity_ratings",
                    "notifications"))
                    .allMatch(table -> tableExists(connection, table));
            assertThat(indexExists(connection, "idx_activity_registrations_active_capacity"))
                    .isTrue();
            assertThat(indexExists(connection, "idx_notifications_recipient_unread")).isTrue();
            assertThat(constraintDefinition(connection,
                    "uk_event_registrations_user_event")).contains("UNIQUE (user_id, event_id)");
            assertThat(constraintDefinition(connection,
                    "uk_attendance_adjustments_idempotency_key"))
                    .contains("UNIQUE (idempotency_key)");
        }
    }

    @Test
    void existingV9DatabaseUpgradesWithoutChangingExistingActivity() throws SQLException {
        flyway(MigrationVersion.fromVersion("9")).migrate();
        long activityId;
        try (Connection connection = connectToSchema()) {
            long eventId = insertEvent(connection, "Sprint 6 upgrade Event");
            long locationId = insertLocation(connection, "S6-UPGRADE");
            activityId = insertActivity(connection, eventId, locationId);
        }

        Flyway upgraded = flyway(SPRINT_06_SCHEMA_VERSION);
        upgraded.migrate();

        assertThat(upgraded.info().current().getVersion().getVersion()).isEqualTo("11");
        try (Connection connection = connectToSchema(); PreparedStatement statement =
                connection.prepareStatement("SELECT title FROM activities WHERE activity_id = ?")) {
            statement.setLong(1, activityId);
            try (ResultSet result = statement.executeQuery()) {
                assertThat(result.next()).isTrue();
                assertThat(result.getString(1)).isEqualTo("Sprint 6 schema test Activity");
            }
            assertThat(tableExists(connection, "event_registrations")).isTrue();
            assertThat(tableExists(connection, "notifications")).isTrue();
        }
    }

    @Test
    void registrationAndAttendanceStateConstraintsRejectInvalidRows() throws SQLException {
        flyway(SPRINT_06_SCHEMA_VERSION).migrate();

        try (Connection connection = connectToSchema()) {
            long participantId = userId(connection, "participantdemo");
            long eventId = insertEvent(connection, "Sprint 6 state Event");
            long locationId = insertLocation(connection, "S6-STATE");
            long activityId = insertActivity(connection, eventId, locationId);
            long eventRegistrationId = insertEventRegistration(connection, participantId, eventId);
            long activityRegistrationId = insertActivityRegistration(
                    connection, eventRegistrationId, activityId);

            assertThatThrownBy(() -> execute(connection, """
                    INSERT INTO event_registrations (
                        user_id, event_id, status, registered_at, activated_at, left_at, updated_at
                    ) VALUES (?, ?, 'ACTIVE', ?, ?, ?, ?)
                    """, participantId, insertEvent(connection, "Invalid Event"), CREATED_AT,
                    CREATED_AT, CREATED_AT, CREATED_AT))
                    .isInstanceOf(SQLException.class)
                    .hasMessageContaining("ck_event_registrations_state");

            assertThatThrownBy(() -> execute(connection, """
                    INSERT INTO activity_registrations (
                        event_registration_id, activity_id, status, cancellation_source,
                        registered_at, activated_at, updated_at
                    ) VALUES (?, ?, 'ACTIVE', 'PARTICIPANT', ?, ?, ?)
                    """, eventRegistrationId,
                    insertActivity(connection, eventId,
                            insertLocation(connection, "S6-INVALID-ACTIVITY")),
                    CREATED_AT, CREATED_AT, CREATED_AT))
                    .isInstanceOf(SQLException.class)
                    .hasMessageContaining("ck_activity_registrations_state");

            insertAttendance(connection, activityRegistrationId);
            assertThatThrownBy(() -> execute(connection, """
                    INSERT INTO attendances (
                        activity_registration_id, status, recorded_source, attended_at,
                        created_at, updated_at, voided_at
                    ) VALUES (?, 'VALID', 'SELF_SCAN', ?, ?, ?, ?)
                    """, activityRegistrationId, CREATED_AT, CREATED_AT, CREATED_AT, CREATED_AT))
                    .isInstanceOf(SQLException.class);
        }
    }

    @Test
    void auditCertificateRatingAndNotificationGuardsAreEnforced() throws SQLException {
        flyway(SPRINT_06_SCHEMA_VERSION).migrate();

        try (Connection connection = connectToSchema()) {
            long participantId = userId(connection, "participantdemo");
            long organizerId = userId(connection, "organizerdemo");
            long eventId = insertEvent(connection, "Sprint 6 downstream Event");
            long locationId = insertLocation(connection, "S6-DOWNSTREAM");
            long activityId = insertActivity(connection, eventId, locationId);
            long eventRegistrationId = insertEventRegistration(connection, participantId, eventId);
            long activityRegistrationId = insertActivityRegistration(
                    connection, eventRegistrationId, activityId);
            long attendanceId = insertAttendance(connection, activityRegistrationId);
            long certificateId = insertCertificate(connection, attendanceId);

            String previousState = """
                    {
                      "registration_status":"ACTIVE",
                      "cancellation_source":null,
                      "attendance_status":null,
                      "attended_at":null,
                      "derived_display_outcome":"ACTIVE"
                    }
                    """;
            String newState = """
                    {
                      "registration_status":"ACTIVE",
                      "cancellation_source":null,
                      "attendance_status":"VALID",
                      "attended_at":"2026-10-19T00:00:00Z",
                      "derived_display_outcome":"ATTENDED"
                    }
                    """;
            execute(connection, """
                    INSERT INTO attendance_adjustments (
                        activity_registration_id, actor_user_id, idempotency_key,
                        previous_state, new_state, effective_attended_at, reason, adjusted_at
                    ) VALUES (?, ?, ?, ?::jsonb, ?::jsonb, ?, 'A valid correction reason', ?)
                    """, activityRegistrationId, organizerId, UUID.randomUUID(), previousState,
                    newState, CREATED_AT, CREATED_AT);

            assertThatThrownBy(() -> execute(connection, """
                    INSERT INTO attendance_adjustments (
                        activity_registration_id, actor_user_id, idempotency_key,
                        previous_state, new_state, effective_attended_at, reason, adjusted_at
                    ) VALUES (?, ?, ?, '{}'::jsonb, ?::jsonb, ?,
                        'A valid reason', ?)
                    """, activityRegistrationId, organizerId, UUID.randomUUID(), newState,
                    CREATED_AT, CREATED_AT))
                    .isInstanceOf(SQLException.class)
                    .hasMessageContaining("ck_attendance_adjustments_previous_state_shape");

            assertThatThrownBy(() -> execute(connection, """
                    INSERT INTO activity_ratings (
                        attendance_id, rating_score, status, created_at, updated_at
                    ) VALUES (?, 6, 'ACTIVE', ?, ?)
                    """, attendanceId, CREATED_AT, CREATED_AT))
                    .isInstanceOf(SQLException.class)
                    .hasMessageContaining("ck_activity_ratings_score");

            execute(connection, """
                    INSERT INTO notifications (
                        recipient_user_id, notification_type, activity_id,
                        deduplication_key, title, message, created_at
                    ) VALUES (?, 'ACTIVITY_CANCELLED', ?, 'activity-cancelled:1',
                        'Activity cancelled', 'The activity was cancelled.', ?)
                    """, participantId, activityId, CREATED_AT);
            assertThatThrownBy(() -> execute(connection, """
                    INSERT INTO notifications (
                        recipient_user_id, notification_type, certificate_id,
                        deduplication_key, title, message, created_at
                    ) VALUES (?, 'ACTIVITY_CANCELLED', ?, 'invalid-reference',
                        'Invalid reference', 'Invalid reference type.', ?)
                    """, participantId, certificateId, CREATED_AT))
                    .isInstanceOf(SQLException.class)
                    .hasMessageContaining("ck_notifications_reference");
            assertThatThrownBy(() -> execute(connection, """
                    INSERT INTO notifications (
                        recipient_user_id, notification_type, activity_id,
                        deduplication_key, title, message, created_at
                    ) VALUES (?, 'ACTIVITY_CANCELLED', ?, 'activity-cancelled:1',
                        'Duplicate', 'Duplicate notification.', ?)
                    """, participantId, activityId, CREATED_AT))
                    .isInstanceOf(SQLException.class)
                    .hasMessageContaining("uk_notifications_recipient_deduplication");
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

    private long insertEvent(Connection connection, String name) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement("""
                INSERT INTO events (
                    organizer_user_id, name, start_at, end_at,
                    booth_payment_window_minutes, max_booths_per_partner,
                    max_activities_per_partner, status, created_at, updated_at
                )
                SELECT user_id, ?, ?, ?, 1440, 1, 3, 'PUBLISHED', ?, ?
                FROM users WHERE username = 'organizerdemo'
                RETURNING event_id
                """)) {
            statement.setString(1, name);
            statement.setObject(2, Instant.parse("2027-01-11T00:00:00Z").atOffset(ZoneOffset.UTC));
            statement.setObject(3, Instant.parse("2027-01-12T00:00:00Z").atOffset(ZoneOffset.UTC));
            statement.setObject(4, CREATED_AT.atOffset(ZoneOffset.UTC));
            statement.setObject(5, CREATED_AT.atOffset(ZoneOffset.UTC));
            return returnedId(statement);
        }
    }

    private long insertLocation(Connection connection, String code) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement("""
                INSERT INTO locations (code, name, location_type, max_capacity, is_active)
                VALUES (?, ?, 'STAGE', 100, TRUE)
                RETURNING location_id
                """)) {
            statement.setString(1, code);
            statement.setString(2, code + " name");
            return returnedId(statement);
        }
    }

    private long insertActivity(Connection connection, long eventId, long locationId)
            throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement("""
                INSERT INTO activities (
                    event_id, location_id, title, activity_type, start_at, end_at,
                    capacity, status, created_at, updated_at
                ) VALUES (?, ?, 'Sprint 6 schema test Activity', 'TALKSHOW', ?, ?,
                    50, 'DRAFT', ?, ?)
                RETURNING activity_id
                """)) {
            statement.setLong(1, eventId);
            statement.setLong(2, locationId);
            statement.setObject(3, Instant.parse("2027-01-11T02:00:00Z").atOffset(ZoneOffset.UTC));
            statement.setObject(4, Instant.parse("2027-01-11T03:00:00Z").atOffset(ZoneOffset.UTC));
            statement.setObject(5, CREATED_AT.atOffset(ZoneOffset.UTC));
            statement.setObject(6, CREATED_AT.atOffset(ZoneOffset.UTC));
            return returnedId(statement);
        }
    }

    private long insertEventRegistration(Connection connection, long userId, long eventId)
            throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement("""
                INSERT INTO event_registrations (
                    user_id, event_id, status, registered_at, activated_at, updated_at
                ) VALUES (?, ?, 'ACTIVE', ?, ?, ?)
                RETURNING event_registration_id
                """)) {
            statement.setLong(1, userId);
            statement.setLong(2, eventId);
            setInstant(statement, 3, CREATED_AT);
            setInstant(statement, 4, CREATED_AT);
            setInstant(statement, 5, CREATED_AT);
            return returnedId(statement);
        }
    }

    private long insertActivityRegistration(Connection connection, long eventRegistrationId,
            long activityId) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement("""
                INSERT INTO activity_registrations (
                    event_registration_id, activity_id, status,
                    registered_at, activated_at, updated_at
                ) VALUES (?, ?, 'ACTIVE', ?, ?, ?)
                RETURNING activity_registration_id
                """)) {
            statement.setLong(1, eventRegistrationId);
            statement.setLong(2, activityId);
            setInstant(statement, 3, CREATED_AT);
            setInstant(statement, 4, CREATED_AT);
            setInstant(statement, 5, CREATED_AT);
            return returnedId(statement);
        }
    }

    private long insertAttendance(Connection connection, long activityRegistrationId)
            throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement("""
                INSERT INTO attendances (
                    activity_registration_id, status, recorded_source, attended_at,
                    created_at, updated_at
                ) VALUES (?, 'VALID', 'SELF_SCAN', ?, ?, ?)
                RETURNING attendance_id
                """)) {
            statement.setLong(1, activityRegistrationId);
            setInstant(statement, 2, CREATED_AT);
            setInstant(statement, 3, CREATED_AT);
            setInstant(statement, 4, CREATED_AT);
            return returnedId(statement);
        }
    }

    private long insertCertificate(Connection connection, long attendanceId) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement("""
                INSERT INTO certificates (
                    attendance_id, certificate_code, recipient_name_snapshot,
                    status, issued_at, created_at, updated_at
                ) VALUES (?, ?, 'Demo Participant', 'ISSUED', ?, ?, ?)
                RETURNING certificate_id
                """)) {
            statement.setLong(1, attendanceId);
            statement.setString(2, "CERT-" + UUID.randomUUID());
            setInstant(statement, 3, CREATED_AT);
            setInstant(statement, 4, CREATED_AT);
            setInstant(statement, 5, CREATED_AT);
            return returnedId(statement);
        }
    }

    private void execute(Connection connection, String sql, Object... values)
            throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            for (int index = 0; index < values.length; index++) {
                Object value = values[index];
                if (value instanceof Instant instant) {
                    setInstant(statement, index + 1, instant);
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

    private void setInstant(PreparedStatement statement, int index, Instant instant)
            throws SQLException {
        statement.setObject(index, instant.atOffset(ZoneOffset.UTC));
    }

    private boolean tableExists(Connection connection, String table) {
        try (PreparedStatement statement = connection.prepareStatement("""
                SELECT EXISTS (
                    SELECT 1 FROM information_schema.tables
                    WHERE table_schema = ? AND table_name = ?
                )
                """)) {
            statement.setString(1, schema);
            statement.setString(2, table);
            try (ResultSet result = statement.executeQuery()) {
                result.next();
                return result.getBoolean(1);
            }
        } catch (SQLException exception) {
            throw new IllegalStateException(exception);
        }
    }

    private boolean indexExists(Connection connection, String index) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement("""
                SELECT EXISTS (
                    SELECT 1 FROM pg_indexes WHERE schemaname = ? AND indexname = ?
                )
                """)) {
            statement.setString(1, schema);
            statement.setString(2, index);
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
