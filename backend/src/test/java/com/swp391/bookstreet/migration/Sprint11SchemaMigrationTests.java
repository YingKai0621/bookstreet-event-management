package com.swp391.bookstreet.migration;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.MigrationVersion;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@EnabledIfEnvironmentVariable(named = "EVENT_TEST_DATABASE_URL", matches = ".+")
class Sprint11SchemaMigrationTests {
    private static final MigrationVersion SPRINT_11_VERSION = MigrationVersion.fromVersion("18");
    private static final String INSERT_WITH_REASON = """
            INSERT INTO admin_audit_logs(actor_user_id, action, target_type, target_id, target_label,
                reason, created_at)
            VALUES (?, ?, ?, 1, 'target', ?, CURRENT_TIMESTAMP)
            """;

    private String schema;

    @BeforeEach
    void createSchemaName() {
        schema = "s11_migration_" + UUID.randomUUID().toString().replace("-", "");
    }

    @AfterEach
    void dropSchema() throws SQLException {
        try (Connection connection = DriverManager.getConnection(
                databaseUrl(), databaseUser(), databasePassword());
                Statement statement = connection.createStatement()) {
            statement.execute("DROP SCHEMA IF EXISTS \"" + schema + "\" CASCADE");
        }
    }

    @Test
    void cleanDatabaseMigratesThroughV18WithExactShape() throws SQLException {
        Flyway flyway = flyway(SPRINT_11_VERSION);
        flyway.migrate();

        assertThat(flyway.info().current().getVersion().getVersion()).isEqualTo("18");
        try (Connection connection = connect()) {
            assertThat(columns(connection, "admin_audit_logs")).containsExactly(
                    "audit_log_id", "actor_user_id", "action", "target_type", "target_id",
                    "target_label", "reason", "details", "created_at");
            assertThat(columns(connection, "users")).contains("sessions_valid_from");
            for (String constraint : List.of(
                    "pk_admin_audit_logs",
                    "fk_admin_audit_logs_actor",
                    "ck_admin_audit_logs_target_positive",
                    "ck_admin_audit_logs_target_label",
                    "ck_admin_audit_logs_details_object",
                    "ck_admin_audit_logs_action_target",
                    "ck_admin_audit_logs_reason")) {
                assertThat(count(connection,
                        "SELECT count(*) FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace "
                                + "WHERE n.nspname = current_schema() AND c.conname = ?", constraint))
                        .as(constraint).isOne();
            }
            for (String index : List.of(
                    "idx_admin_audit_logs_created",
                    "idx_admin_audit_logs_actor_created",
                    "idx_admin_audit_logs_target_created",
                    "idx_admin_audit_logs_action_created")) {
                assertThat(count(connection,
                        "SELECT count(*) FROM pg_indexes WHERE schemaname = current_schema() AND indexname = ?",
                        index)).as(index).isOne();
            }
        }
    }

    @Test
    void v17UpgradeKeepsExistingUsersAndEndsNoSession() throws SQLException {
        flyway(MigrationVersion.fromVersion("17")).migrate();
        long userId;
        try (Connection connection = connect()) {
            userId = insertUser(connection);
        }

        flyway(SPRINT_11_VERSION).migrate();

        try (Connection connection = connect(); PreparedStatement statement = connection.prepareStatement(
                "SELECT status, sessions_valid_from FROM users WHERE user_id = ?")) {
            statement.setLong(1, userId);
            try (ResultSet row = statement.executeQuery()) {
                assertThat(row.next()).isTrue();
                assertThat(row.getString("status")).isEqualTo("ACTIVE");
                assertThat(row.getObject("sessions_valid_from")).isNull();
            }
            assertThat(count(connection, "SELECT count(*) FROM admin_audit_logs")).isZero();
        }
    }

    @Test
    void everyApprovedActionIsAcceptedOnItsOwnTargetOnly() throws SQLException {
        flyway(SPRINT_11_VERSION).migrate();
        Map<String, String> actions = Map.ofEntries(
                Map.entry("USER_CREATED", "USER"),
                Map.entry("USER_UPDATED", "USER"),
                Map.entry("USER_LOCKED", "USER"),
                Map.entry("USER_UNLOCKED", "USER"),
                Map.entry("ROLE_ASSIGNED", "USER"),
                Map.entry("ROLE_REMOVED", "USER"),
                Map.entry("ORGANIZATION_LOCKED", "PARTNER_ORGANIZATION"),
                Map.entry("ORGANIZATION_UNLOCKED", "PARTNER_ORGANIZATION"),
                Map.entry("BADGE_CREATED", "BADGE"),
                Map.entry("BADGE_UPDATED", "BADGE"),
                Map.entry("BADGE_AWARDS_SYNCHRONIZED", "BADGE"));
        List<String> needsReason = List.of(
                "USER_LOCKED", "USER_UNLOCKED", "ORGANIZATION_LOCKED", "ORGANIZATION_UNLOCKED");

        try (Connection connection = connect()) {
            long actor = insertUser(connection);
            for (Map.Entry<String, String> action : actions.entrySet()) {
                String reason = needsReason.contains(action.getKey()) ? "A valid reason text" : null;
                assertThatCode(() -> insertAudit(connection, actor, action.getKey(), action.getValue(), reason))
                        .as(action.getKey()).doesNotThrowAnyException();
                String wrongTarget = action.getValue().equals("USER") ? "BADGE" : "USER";
                assertRejected(connection, "ck_admin_audit_logs_action_target",
                        () -> insertAudit(connection, actor, action.getKey(), wrongTarget, reason));
            }
        }
    }

    @Test
    void databaseRejectsInvalidAuditRows() throws SQLException {
        flyway(SPRINT_11_VERSION).migrate();
        try (Connection connection = connect()) {
            long actor = insertUser(connection);

            assertRejected(connection, "ck_admin_audit_logs_action_target",
                    () -> insertAudit(connection, actor, "SOMETHING_ELSE", "USER", null));
            assertRejected(connection, "ck_admin_audit_logs_reason",
                    () -> insertAudit(connection, actor, "USER_LOCKED", "USER", null));
            assertRejected(connection, "ck_admin_audit_logs_reason",
                    () -> insertAudit(connection, actor, "USER_LOCKED", "USER", "too short"));
            assertRejected(connection, "ck_admin_audit_logs_reason",
                    () -> insertAudit(connection, actor, "ORGANIZATION_LOCKED", "PARTNER_ORGANIZATION",
                            "                    "));
            assertRejected(connection, "ck_admin_audit_logs_reason",
                    () -> insertAudit(connection, actor, "USER_UPDATED", "USER", "A valid reason text"));
            assertRejected(connection, "ck_admin_audit_logs_details_object", () -> execute(connection, """
                    INSERT INTO admin_audit_logs(actor_user_id, action, target_type, target_id, target_label,
                        details, created_at)
                    VALUES (%d, 'USER_UPDATED', 'USER', 1, 'target', '[]', CURRENT_TIMESTAMP)
                    """.formatted(actor)));
            assertRejected(connection, "ck_admin_audit_logs_target_positive", () -> execute(connection, """
                    INSERT INTO admin_audit_logs(actor_user_id, action, target_type, target_id, target_label,
                        created_at)
                    VALUES (%d, 'USER_UPDATED', 'USER', 0, 'target', CURRENT_TIMESTAMP)
                    """.formatted(actor)));
            assertRejected(connection, "ck_admin_audit_logs_target_label", () -> execute(connection, """
                    INSERT INTO admin_audit_logs(actor_user_id, action, target_type, target_id, target_label,
                        created_at)
                    VALUES (%d, 'USER_UPDATED', 'USER', 1, '   ', CURRENT_TIMESTAMP)
                    """.formatted(actor)));
            assertRejected(connection, "fk_admin_audit_logs_actor",
                    () -> insertAudit(connection, -1, "USER_UPDATED", "USER", null));
        }
    }

    @Test
    void userWhoAppearsAsActorCannotBeDeleted() throws SQLException {
        flyway(SPRINT_11_VERSION).migrate();
        try (Connection connection = connect()) {
            long actor = insertUser(connection);
            insertAudit(connection, actor, "USER_UPDATED", "USER", null);

            assertRejected(connection, "fk_admin_audit_logs_actor",
                    () -> execute(connection, "DELETE FROM users WHERE user_id = " + actor));
        }
    }

    private void insertAudit(Connection connection, long actor, String action, String target, String reason)
            throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(INSERT_WITH_REASON)) {
            statement.setLong(1, actor);
            statement.setString(2, action);
            statement.setString(3, target);
            statement.setString(4, reason);
            statement.executeUpdate();
        }
    }

    private long insertUser(Connection connection) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement("""
                INSERT INTO users(username, full_name, password_hash)
                VALUES (?, 'Người dùng kiểm thử', 'hash')
                RETURNING user_id
                """)) {
            statement.setString(1, "s11" + UUID.randomUUID().toString().replace("-", "").substring(0, 8));
            try (ResultSet row = statement.executeQuery()) {
                row.next();
                return row.getLong(1);
            }
        }
    }

    private void assertRejected(Connection connection, String constraint, SqlOperation operation) {
        assertThatThrownBy(operation)
                .as(constraint)
                .isInstanceOf(SQLException.class)
                .hasMessageContaining(constraint);
    }

    private void execute(Connection connection, String sql) throws SQLException {
        try (Statement statement = connection.createStatement()) {
            statement.execute(sql);
        }
    }

    private List<String> columns(Connection connection, String table) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement("""
                SELECT column_name FROM information_schema.columns
                WHERE table_schema = current_schema() AND table_name = ?
                ORDER BY ordinal_position
                """)) {
            statement.setString(1, table);
            try (ResultSet rows = statement.executeQuery()) {
                List<String> names = new java.util.ArrayList<>();
                while (rows.next()) {
                    names.add(rows.getString(1));
                }
                return names;
            }
        }
    }

    private long count(Connection connection, String sql, String... values) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            for (int i = 0; i < values.length; i++) {
                statement.setString(i + 1, values[i]);
            }
            try (ResultSet row = statement.executeQuery()) {
                row.next();
                return row.getLong(1);
            }
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
            statement.execute("SET search_path TO \"" + schema + "\"");
        }
        return connection;
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

    @FunctionalInterface
    private interface SqlOperation extends org.assertj.core.api.ThrowableAssert.ThrowingCallable {
    }
}
