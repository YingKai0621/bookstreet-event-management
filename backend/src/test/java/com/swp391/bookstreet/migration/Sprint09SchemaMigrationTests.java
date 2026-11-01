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
class Sprint09SchemaMigrationTests {
    private static final MigrationVersion SPRINT_09_VERSION = MigrationVersion.fromVersion("15");
    private static final Instant CREATED_AT = Instant.parse("2026-11-01T07:00:00Z");
    private static final Instant PUBLISHED_AT = Instant.parse("2026-11-01T08:00:00Z");
    private static final Instant UPDATED_AT = Instant.parse("2026-11-01T09:00:00Z");
    private String schema;

    @BeforeEach
    void createSchemaName() {
        schema = "s9_migration_" + UUID.randomUUID().toString().replace("-", "");
    }

    @AfterEach
    void dropSchema() throws SQLException {
        if (schema == null) return;
        try (Connection connection = DriverManager.getConnection(
                databaseUrl(), databaseUser(), databasePassword());
                Statement statement = connection.createStatement()) {
            statement.execute("DROP SCHEMA IF EXISTS " + quotedSchema() + " CASCADE");
        }
    }

    @Test
    void cleanDatabaseMigratesThroughV15WithExactHeritageShape() throws SQLException {
        Flyway flyway = flyway(SPRINT_09_VERSION);
        flyway.migrate();

        assertThat(flyway.info().current().getVersion().getVersion()).isEqualTo("15");
        try (Connection connection = connect()) {
            assertThat(tableExists(connection, "heritage_contents")).isTrue();
            assertThat(columnCount(connection, "heritage_contents")).isEqualTo(11);
            assertThat(foreignKeyCount(connection, "heritage_contents")).isZero();

            for (String constraint : List.of(
                    "pk_heritage_contents",
                    "uq_heritage_contents_public_code",
                    "ck_heritage_contents_public_code",
                    "ck_heritage_contents_title",
                    "ck_heritage_contents_summary",
                    "ck_heritage_contents_content",
                    "ck_heritage_contents_image_url",
                    "ck_heritage_contents_location_text",
                    "ck_heritage_contents_status",
                    "ck_heritage_contents_publication_state",
                    "ck_heritage_contents_timestamps")) {
                assertThat(constraintExists(connection, constraint)).as(constraint).isTrue();
            }

            assertThat(indexExists(connection, "idx_heritage_contents_public_published")).isTrue();
            assertThat(indexExists(connection, "idx_heritage_contents_status_updated")).isTrue();
        }
    }

    @Test
    void v14DatabaseUpgradesWithoutChangingExistingFeedbackData() throws SQLException {
        Flyway baseline = flyway(MigrationVersion.fromVersion("14"));
        baseline.migrate();

        try (Connection connection = connect()) {
            execute(connection, """
                    INSERT INTO general_feedbacks(
                        target_type, message, submitted_at, updated_at
                    ) VALUES ('BOOK_STREET', 'Góp ý tồn tại trước Sprint 9.', ?, ?)
                    """, CREATED_AT, CREATED_AT);
        }

        Flyway upgraded = flyway(SPRINT_09_VERSION);
        upgraded.migrate();

        assertThat(upgraded.info().current().getVersion().getVersion()).isEqualTo("15");
        try (Connection connection = connect(); Statement statement = connection.createStatement();
                ResultSet result = statement.executeQuery("SELECT COUNT(*) FROM general_feedbacks")) {
            assertThat(result.next()).isTrue();
            assertThat(result.getLong(1)).isOne();
            assertThat(tableExists(connection, "heritage_contents")).isTrue();
            assertThat(columnExists(connection, "general_feedbacks", "heritage_content_id")).isFalse();
        }
    }

    @Test
    void validDraftPublishedAndArchivedRowsAreAccepted() throws SQLException {
        flyway(SPRINT_09_VERSION).migrate();

        try (Connection connection = connect()) {
            execute(connection, """
                    INSERT INTO heritage_contents(public_code, title, content)
                    VALUES ('DS-01', 'Di sản', 'Nội dung di sản hợp lệ và đủ dài.')
                    """);
            execute(connection, """
                    INSERT INTO heritage_contents(
                        public_code, title, summary, content, image_url, location_text,
                        status, published_at, created_at, updated_at
                    ) VALUES (
                        'DS-02', 'Di sản công khai', 'Tóm tắt hợp lệ',
                        'Nội dung di sản công khai hợp lệ.',
                        'https://example.com/heritage.webp', 'Công xã Paris',
                        'PUBLISHED', ?, ?, ?
                    )
                    """, PUBLISHED_AT, CREATED_AT, PUBLISHED_AT);
            execute(connection, """
                    INSERT INTO heritage_contents(
                        public_code, title, content, image_url, status,
                        published_at, created_at, updated_at
                    ) VALUES (
                        'DS-03', 'Di sản lưu trữ', 'Nội dung di sản lưu trữ hợp lệ.',
                        '/assets/heritage/ds-03.webp', 'ARCHIVED', ?, ?, ?
                    )
                    """, PUBLISHED_AT, CREATED_AT, UPDATED_AT);

            try (Statement statement = connection.createStatement();
                    ResultSet result = statement.executeQuery("SELECT COUNT(*) FROM heritage_contents")) {
                assertThat(result.next()).isTrue();
                assertThat(result.getLong(1)).isEqualTo(3);
            }
        }
    }

    @Test
    void identityTextLifecycleAndTimestampConstraintsRejectInvalidRows() throws SQLException {
        flyway(SPRINT_09_VERSION).migrate();

        try (Connection connection = connect()) {
            assertConstraint(connection, "ck_heritage_contents_public_code", """
                    INSERT INTO heritage_contents(public_code, title, content)
                    VALUES ('ds-01', 'Di sản', 'Nội dung di sản hợp lệ và đủ dài.')
                    """);
            execute(connection, """
                    INSERT INTO heritage_contents(public_code, title, content)
                    VALUES ('DS-01', 'Di sản', 'Nội dung di sản hợp lệ và đủ dài.')
                    """);
            assertConstraint(connection, "uq_heritage_contents_public_code", """
                    INSERT INTO heritage_contents(public_code, title, content)
                    VALUES ('DS-01', 'Di sản khác', 'Nội dung di sản khác hợp lệ.')
                    """);
            assertConstraint(connection, "ck_heritage_contents_title", """
                    INSERT INTO heritage_contents(public_code, title, content)
                    VALUES ('DS-02', ' Dư khoảng trắng ', 'Nội dung di sản hợp lệ và đủ dài.')
                    """);
            assertConstraint(connection, "ck_heritage_contents_summary", """
                    INSERT INTO heritage_contents(public_code, title, summary, content)
                    VALUES ('DS-02', 'Di sản', ' ', 'Nội dung di sản hợp lệ và đủ dài.')
                    """);
            assertConstraint(connection, "ck_heritage_contents_content", """
                    INSERT INTO heritage_contents(public_code, title, content)
                    VALUES ('DS-02', 'Di sản', ' Nội dung bị bao quanh bởi khoảng trắng. ')
                    """);
            assertConstraint(connection, "ck_heritage_contents_image_url", """
                    INSERT INTO heritage_contents(public_code, title, content, image_url)
                    VALUES ('DS-02', 'Di sản', 'Nội dung di sản hợp lệ và đủ dài.', 'data:image/png;base64,abc')
                    """);
            assertConstraint(connection, "ck_heritage_contents_location_text", """
                    INSERT INTO heritage_contents(public_code, title, content, location_text)
                    VALUES ('DS-02', 'Di sản', 'Nội dung di sản hợp lệ và đủ dài.', ' ')
                    """);
            assertRejected(connection, """
                    INSERT INTO heritage_contents(public_code, title, content, status)
                    VALUES ('DS-02', 'Di sản', 'Nội dung di sản hợp lệ và đủ dài.', 'HIDDEN')
                    """);
            assertConstraint(connection, "ck_heritage_contents_publication_state", """
                    INSERT INTO heritage_contents(public_code, title, content, status)
                    VALUES ('DS-02', 'Di sản', 'Nội dung di sản hợp lệ và đủ dài.', 'PUBLISHED')
                    """);
            assertConstraint(connection, "ck_heritage_contents_timestamps", """
                    INSERT INTO heritage_contents(
                        public_code, title, content, created_at, updated_at
                    ) VALUES ('DS-02', 'Di sản', 'Nội dung di sản hợp lệ và đủ dài.', ?, ?)
                    """, UPDATED_AT, CREATED_AT);
        }
    }

    private void assertConstraint(
            Connection connection,
            String constraint,
            String sql,
            Object... values
    ) {
        assertThatThrownBy(() -> execute(connection, sql, values))
                .isInstanceOf(SQLException.class)
                .hasMessageContaining(constraint);
    }

    private void assertRejected(Connection connection, String sql, Object... values) {
        assertThatThrownBy(() -> execute(connection, sql, values))
                .isInstanceOf(SQLException.class);
    }

    private void execute(Connection connection, String sql, Object... values) throws SQLException {
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

    private Flyway flyway(MigrationVersion target) {
        return Flyway.configure()
                .dataSource(databaseUrl(), databaseUser(), databasePassword())
                .locations("classpath:db/migration")
                .defaultSchema(schema)
                .schemas(schema)
                .createSchemas(true)
                .target(target)
                .load();
    }

    private Connection connect() throws SQLException {
        Connection connection = DriverManager.getConnection(
                databaseUrl(), databaseUser(), databasePassword());
        try (Statement statement = connection.createStatement()) {
            statement.execute("SET search_path TO " + quotedSchema());
        }
        return connection;
    }

    private boolean tableExists(Connection connection, String table) throws SQLException {
        return metadataExists(connection, "information_schema.tables", "table_name", table);
    }

    private boolean columnExists(Connection connection, String table, String column) throws SQLException {
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

    private int columnCount(Connection connection, String table) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement("""
                SELECT COUNT(*) FROM information_schema.columns
                WHERE table_schema = ? AND table_name = ?
                """)) {
            statement.setString(1, schema);
            statement.setString(2, table);
            try (ResultSet result = statement.executeQuery()) {
                assertThat(result.next()).isTrue();
                return result.getInt(1);
            }
        }
    }

    private int foreignKeyCount(Connection connection, String table) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement("""
                SELECT COUNT(*)
                FROM pg_constraint constraint_row
                JOIN pg_class table_row ON table_row.oid = constraint_row.conrelid
                JOIN pg_namespace schema_row ON schema_row.oid = table_row.relnamespace
                WHERE schema_row.nspname = ? AND table_row.relname = ?
                  AND constraint_row.contype = 'f'
                """)) {
            statement.setString(1, schema);
            statement.setString(2, table);
            try (ResultSet result = statement.executeQuery()) {
                assertThat(result.next()).isTrue();
                return result.getInt(1);
            }
        }
    }

    private boolean metadataExists(
            Connection connection,
            String metadataTable,
            String column,
            String value
    ) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT EXISTS (SELECT 1 FROM " + metadataTable
                        + " WHERE table_schema = ? AND " + column + " = ?)")) {
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
}
