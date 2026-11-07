package com.swp391.bookstreet.migration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

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

@EnabledIfEnvironmentVariable(named = "EVENT_TEST_DATABASE_URL", matches = ".+")
class Sprint08SchemaMigrationTests {
    private static final MigrationVersion SPRINT_08_VERSION = MigrationVersion.fromVersion("14");
    private static final Instant NOW = Instant.parse("2026-10-31T08:20:00Z");
    private String schema;

    @BeforeEach
    void createSchemaName() {
        schema = "s8_migration_" + UUID.randomUUID().toString().replace("-", "");
    }

    @AfterEach
    void dropSchema() throws SQLException {
        if (schema == null) return;
        try (Connection connection = DriverManager.getConnection(databaseUrl(), databaseUser(), databasePassword());
                Statement statement = connection.createStatement()) {
            statement.execute("DROP SCHEMA IF EXISTS " + quotedSchema() + " CASCADE");
        }
    }

    @Test
    void cleanDatabaseMigratesThroughV14WithFeedbackTableAndIndexes() throws SQLException {
        Flyway flyway = flyway(SPRINT_08_VERSION);
        flyway.migrate();

        assertThat(flyway.info().current().getVersion().getVersion()).isEqualTo("14");
        try (Connection connection = connect()) {
            assertThat(exists(connection, "information_schema.tables", "table_name", "general_feedbacks")).isTrue();
            assertThat(indexExists(connection, "idx_general_feedbacks_queue")).isTrue();
            assertThat(indexExists(connection, "idx_general_feedbacks_status_queue")).isTrue();
            assertThat(indexExists(connection, "idx_general_feedbacks_event_queue")).isTrue();
            assertThat(constraintExists(connection, "ck_general_feedbacks_target_type")).isTrue();
            assertThat(constraintExists(connection, "ck_general_feedbacks_status")).isTrue();
        }
    }

    @Test
    void v13DatabaseUpgradesWithoutLosingExistingRows() throws SQLException {
        Flyway baseline = flyway(MigrationVersion.fromVersion("13"));
        baseline.migrate();
        long before;
        try (Connection connection = connect(); Statement statement = connection.createStatement();
                ResultSet result = statement.executeQuery("SELECT COUNT(*) FROM users")) {
            assertThat(result.next()).isTrue();
            before = result.getLong(1);
        }

        Flyway upgraded = flyway(SPRINT_08_VERSION);
        upgraded.migrate();

        try (Connection connection = connect(); Statement statement = connection.createStatement();
                ResultSet result = statement.executeQuery("SELECT COUNT(*) FROM users")) {
            assertThat(result.next()).isTrue();
            assertThat(result.getLong(1)).isEqualTo(before);
        }
    }

    @Test
    void targetTextWorkflowTimestampAndForeignKeyGuardsRejectInvalidRows() throws SQLException {
        flyway(SPRINT_08_VERSION).migrate();
        try (Connection connection = connect()) {
            long organizerId = userId(connection, "organizerdemo");
            long eventId = insertEvent(connection, organizerId);

            execute(connection, """
                    INSERT INTO general_feedbacks(target_type, message, submitted_at, updated_at)
                    VALUES ('BOOK_STREET', 'Nội dung góp ý hợp lệ.', ?, ?)
                    """, NOW, NOW);
            execute(connection, """
                    INSERT INTO general_feedbacks(target_type, event_id, message, submitted_at, updated_at)
                    VALUES ('EVENT', ?, 'Nội dung góp ý sự kiện.', ?, ?)
                    """, eventId, NOW, NOW);
            execute(connection, """
                    INSERT INTO general_feedbacks(
                        target_type, message, status, last_handled_by_user_id,
                        handling_started_at, submitted_at, updated_at
                    ) VALUES ('BOOK_STREET', 'Đang xử lý góp ý hợp lệ.', 'IN_PROGRESS', ?, ?, ?, ?)
                    """, organizerId, NOW.plusSeconds(10), NOW, NOW.plusSeconds(10));
            execute(connection, """
                    INSERT INTO general_feedbacks(
                        target_type, message, status, internal_note, last_handled_by_user_id,
                        handling_started_at, submitted_at, updated_at, resolved_at
                    ) VALUES (
                        'BOOK_STREET', 'Góp ý đã xử lý hợp lệ.', 'RESOLVED',
                        'Đã xử lý.', ?, ?, ?, ?, ?
                    )
                    """, organizerId, NOW.plusSeconds(10), NOW, NOW.plusSeconds(20), NOW.plusSeconds(20));

            assertOneOfConstraints(connection, List.of(
                    "ck_general_feedbacks_target_type",
                    "ck_general_feedbacks_target_reference"
            ), """
                    INSERT INTO general_feedbacks(target_type, message, submitted_at, updated_at)
                    VALUES ('HERITAGE', 'Nội dung góp ý hợp lệ.', ?, ?)
                    """, NOW, NOW);
            assertConstraint(connection, "ck_general_feedbacks_target_reference", """
                    INSERT INTO general_feedbacks(target_type, event_id, message, submitted_at, updated_at)
                    VALUES ('BOOK_STREET', ?, 'Nội dung góp ý hợp lệ.', ?, ?)
                    """, eventId, NOW, NOW);
            assertConstraint(connection, "ck_general_feedbacks_target_reference", """
                    INSERT INTO general_feedbacks(target_type, message, submitted_at, updated_at)
                    VALUES ('EVENT', 'Nội dung góp ý hợp lệ.', ?, ?)
                    """, NOW, NOW);
            assertOneOfConstraints(connection, List.of(
                    "ck_general_feedbacks_status",
                    "ck_general_feedbacks_workflow_state"
            ), """
                    INSERT INTO general_feedbacks(target_type, message, status, submitted_at, updated_at)
                    VALUES ('BOOK_STREET', 'Nội dung góp ý hợp lệ.', 'CLOSED', ?, ?)
                    """, NOW, NOW);
            assertConstraint(connection, "ck_general_feedbacks_guest_name", """
                    INSERT INTO general_feedbacks(target_type, guest_name, message, submitted_at, updated_at)
                    VALUES ('BOOK_STREET', 'Tên  chưa chuẩn', 'Nội dung góp ý hợp lệ.', ?, ?)
                    """, NOW, NOW);
            assertConstraint(connection, "ck_general_feedbacks_contact_email", """
                    INSERT INTO general_feedbacks(target_type, contact_email, message, submitted_at, updated_at)
                    VALUES ('BOOK_STREET', 'UPPER@EXAMPLE.COM', 'Nội dung góp ý hợp lệ.', ?, ?)
                    """, NOW, NOW);
            assertConstraint(connection, "ck_general_feedbacks_message", """
                    INSERT INTO general_feedbacks(target_type, message, submitted_at, updated_at)
                    VALUES ('BOOK_STREET', ' quá ngắn ', ?, ?)
                    """, NOW, NOW);
            assertConstraint(connection, "ck_general_feedbacks_internal_note", """
                    INSERT INTO general_feedbacks(
                        target_type, message, status, internal_note, last_handled_by_user_id,
                        handling_started_at, submitted_at, updated_at
                    ) VALUES (
                        'BOOK_STREET', 'Nội dung góp ý hợp lệ.', 'IN_PROGRESS',
                        ' Ghi chú chưa chuẩn ', ?, ?, ?, ?
                    )
                    """, organizerId, NOW.plusSeconds(10), NOW, NOW.plusSeconds(10));
            assertConstraint(connection, "ck_general_feedbacks_workflow_state", """
                    INSERT INTO general_feedbacks(target_type, message, status, submitted_at, updated_at)
                    VALUES ('BOOK_STREET', 'Nội dung góp ý hợp lệ.', 'RESOLVED', ?, ?)
                    """, NOW, NOW);
            assertConstraint(connection, "ck_general_feedbacks_workflow_state", """
                    INSERT INTO general_feedbacks(
                        target_type, message, status, handling_started_at, submitted_at, updated_at
                    ) VALUES ('BOOK_STREET', 'Nội dung góp ý hợp lệ.', 'IN_PROGRESS', ?, ?, ?)
                    """, NOW.plusSeconds(10), NOW, NOW.plusSeconds(10));
            assertConstraint(connection, "ck_general_feedbacks_workflow_state", """
                    INSERT INTO general_feedbacks(
                        target_type, message, status, last_handled_by_user_id,
                        handling_started_at, submitted_at, updated_at, resolved_at
                    ) VALUES (
                        'BOOK_STREET', 'Nội dung góp ý hợp lệ.', 'RESOLVED',
                        ?, ?, ?, ?, ?
                    )
                    """, organizerId, NOW.plusSeconds(10), NOW, NOW.plusSeconds(20), NOW.plusSeconds(20));
            assertConstraint(connection, "ck_general_feedbacks_timestamps", """
                    INSERT INTO general_feedbacks(target_type, message, submitted_at, updated_at)
                    VALUES ('BOOK_STREET', 'Nội dung góp ý hợp lệ.', ?, ?)
                    """, NOW, NOW.minusSeconds(1));
            assertConstraint(connection, "ck_general_feedbacks_timestamps", """
                    INSERT INTO general_feedbacks(
                        target_type, message, status, last_handled_by_user_id,
                        handling_started_at, submitted_at, updated_at
                    ) VALUES ('BOOK_STREET', 'Nội dung góp ý hợp lệ.', 'IN_PROGRESS', ?, ?, ?, ?)
                    """, organizerId, NOW.minusSeconds(1), NOW, NOW);
            assertConstraint(connection, "ck_general_feedbacks_timestamps", """
                    INSERT INTO general_feedbacks(
                        target_type, message, status, last_handled_by_user_id,
                        handling_started_at, submitted_at, updated_at
                    ) VALUES ('BOOK_STREET', 'Nội dung góp ý hợp lệ.', 'IN_PROGRESS', ?, ?, ?, ?)
                    """, organizerId, NOW.plusSeconds(20), NOW, NOW.plusSeconds(10));
            assertConstraint(connection, "ck_general_feedbacks_timestamps", """
                    INSERT INTO general_feedbacks(
                        target_type, message, status, internal_note, last_handled_by_user_id,
                        handling_started_at, submitted_at, updated_at, resolved_at
                    ) VALUES (
                        'BOOK_STREET', 'Nội dung góp ý hợp lệ.', 'RESOLVED',
                        'Đã xử lý.', ?, ?, ?, ?, ?
                    )
                    """, organizerId, NOW.plusSeconds(10), NOW, NOW.plusSeconds(20), NOW.plusSeconds(5));
            assertConstraint(connection, "ck_general_feedbacks_timestamps", """
                    INSERT INTO general_feedbacks(
                        target_type, message, status, internal_note, last_handled_by_user_id,
                        handling_started_at, submitted_at, updated_at, resolved_at
                    ) VALUES (
                        'BOOK_STREET', 'Nội dung góp ý hợp lệ.', 'RESOLVED',
                        'Đã xử lý.', ?, ?, ?, ?, ?
                    )
                    """, organizerId, NOW.plusSeconds(10), NOW, NOW.plusSeconds(20), NOW.plusSeconds(30));
            assertConstraint(connection, "fk_general_feedbacks_submitted_by_user", """
                    INSERT INTO general_feedbacks(
                        submitted_by_user_id, target_type, message, submitted_at, updated_at
                    ) VALUES (999999999, 'BOOK_STREET', 'Nội dung góp ý hợp lệ.', ?, ?)
                    """, NOW, NOW);
            assertConstraint(connection, "fk_general_feedbacks_event", """
                    INSERT INTO general_feedbacks(target_type, event_id, message, submitted_at, updated_at)
                    VALUES ('EVENT', 999999999, 'Nội dung góp ý hợp lệ.', ?, ?)
                    """, NOW, NOW);
            assertConstraint(connection, "fk_general_feedbacks_last_handled_by_user", """
                    INSERT INTO general_feedbacks(
                        target_type, message, status, last_handled_by_user_id,
                        handling_started_at, submitted_at, updated_at
                    ) VALUES (
                        'BOOK_STREET', 'Nội dung góp ý hợp lệ.', 'IN_PROGRESS',
                        999999999, ?, ?, ?
                    )
                    """, NOW.plusSeconds(10), NOW, NOW.plusSeconds(10));
        }
    }

    private long insertEvent(Connection connection, long organizerId) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement("""
                INSERT INTO events(
                    organizer_user_id, name, start_at, end_at, booth_payment_window_minutes,
                    max_booths_per_partner, max_activities_per_partner, status, created_at, updated_at
                ) VALUES (?, 'Sprint 8 Event', ?, ?, 60, 2, 3, 'PUBLISHED', ?, ?)
                RETURNING event_id
                """)) {
            bind(statement, organizerId, NOW, NOW.plusSeconds(3600), NOW, NOW);
            try (ResultSet result = statement.executeQuery()) {
                assertThat(result.next()).isTrue();
                return result.getLong(1);
            }
        }
    }

    private long userId(Connection connection, String username) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement("SELECT user_id FROM users WHERE username = ?")) {
            statement.setString(1, username);
            try (ResultSet result = statement.executeQuery()) {
                assertThat(result.next()).isTrue();
                return result.getLong(1);
            }
        }
    }

    private void assertConstraint(Connection connection, String constraint, String sql, Object... values) {
        assertThatThrownBy(() -> execute(connection, sql, values))
                .isInstanceOf(SQLException.class)
                .hasMessageContaining(constraint);
    }

    private void assertOneOfConstraints(
            Connection connection,
            List<String> constraints,
            String sql,
            Object... values
    ) {
        assertThatThrownBy(() -> execute(connection, sql, values))
                .isInstanceOfSatisfying(SQLException.class, exception ->
                        assertThat(constraints).anySatisfy(constraint ->
                                assertThat(exception.getMessage()).contains(constraint)));
    }

    private void execute(Connection connection, String sql, Object... values) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            bind(statement, values);
            statement.executeUpdate();
        }
    }

    private void bind(PreparedStatement statement, Object... values) throws SQLException {
        for (int index = 0; index < values.length; index++) {
            Object value = values[index];
            if (value instanceof Instant instant) {
                statement.setObject(index + 1, instant.atOffset(ZoneOffset.UTC));
            } else {
                statement.setObject(index + 1, value);
            }
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

    private Connection connect() throws SQLException {
        Connection connection = DriverManager.getConnection(databaseUrl(), databaseUser(), databasePassword());
        try (Statement statement = connection.createStatement()) {
            statement.execute("SET search_path TO " + quotedSchema());
        }
        return connection;
    }

    private boolean exists(Connection connection, String table, String column, String value) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT EXISTS (SELECT 1 FROM " + table + " WHERE table_schema = ? AND " + column + " = ?)")) {
            statement.setString(1, schema);
            statement.setString(2, value);
            try (ResultSet result = statement.executeQuery()) {
                return result.next() && result.getBoolean(1);
            }
        }
    }

    private boolean indexExists(Connection connection, String index) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = ? AND indexname = ?)")) {
            statement.setString(1, schema);
            statement.setString(2, index);
            try (ResultSet result = statement.executeQuery()) {
                return result.next() && result.getBoolean(1);
            }
        }
    }

    private boolean constraintExists(Connection connection, String constraint) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement("""
                SELECT EXISTS (
                    SELECT 1
                    FROM pg_constraint constraint_row
                    JOIN pg_class table_row ON table_row.oid = constraint_row.conrelid
                    JOIN pg_namespace schema_row ON schema_row.oid = table_row.relnamespace
                    WHERE schema_row.nspname = ? AND constraint_row.conname = ?
                )
                """)) {
            statement.setString(1, schema);
            statement.setString(2, constraint);
            try (ResultSet result = statement.executeQuery()) {
                return result.next() && result.getBoolean(1);
            }
        }
    }

    private String quotedSchema() { return '"' + schema.replace("\"", "\"\"") + '"'; }
    private static String databaseUrl() { return System.getenv("EVENT_TEST_DATABASE_URL"); }
    private static String databaseUser() { return System.getenv().getOrDefault("EVENT_TEST_DATABASE_USER", "postgres"); }
    private static String databasePassword() { return System.getenv().getOrDefault("EVENT_TEST_DATABASE_PASSWORD", "postgres"); }
}
