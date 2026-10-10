package com.swp391.bookstreet.migration;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.MigrationVersion;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;

import static org.assertj.core.api.Assertions.assertThat;

@EnabledIfEnvironmentVariable(named = "EVENT_TEST_DATABASE_URL", matches = ".+")
class Sprint03SchemaMigrationTests {
    private String schema;

    @BeforeEach
    void createIsolatedSchemaName() {
        schema = "s3_migration_" + UUID.randomUUID().toString().replace("-", "");
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
    void cleanDatabaseMigratesThroughV7WithPaymentAndAssignmentConstraints()
            throws SQLException {
        Flyway flyway = Flyway.configure()
                .dataSource(databaseUrl(), databaseUser(), databasePassword())
                .locations("classpath:db/migration")
                .defaultSchema(schema)
                .schemas(schema)
                .createSchemas(true)
                .target(MigrationVersion.fromVersion("7"))
                .load();

        flyway.migrate();

        assertThat(flyway.info().current().getVersion().getVersion()).isEqualTo("7");
        try (Connection connection = connectToSchema()) {
            assertThat(tableExists(connection, "booth_payments")).isTrue();
            assertThat(tableExists(connection, "booth_assignments")).isTrue();
            assertThat(indexExists(connection,
                    "uk_booth_payments_pending_initial_rental_hold")).isTrue();
            assertThat(indexExists(connection,
                    "uk_booth_payments_success_initial_rental_hold")).isTrue();
            assertThat(constraintDefinition(connection,
                    "ck_event_booth_configs_rental_price_supported"))
                    .contains("rental_price")
                    .contains("= (0)::numeric")
                    .contains(">= (5000)::numeric");
        }
    }

    private Connection connectToSchema() throws SQLException {
        Connection connection = DriverManager.getConnection(databaseUrl(), databaseUser(),
                databasePassword());
        try (Statement statement = connection.createStatement()) {
            statement.execute("SET search_path TO " + quotedSchema());
        }
        return connection;
    }

    private boolean tableExists(Connection connection, String table) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement("""
                select exists (
                    select 1 from information_schema.tables
                    where table_schema = ? and table_name = ?
                )
                """)) {
            statement.setString(1, schema);
            statement.setString(2, table);
            try (ResultSet result = statement.executeQuery()) {
                result.next();
                return result.getBoolean(1);
            }
        }
    }

    private boolean indexExists(Connection connection, String index) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement("""
                select exists (
                    select 1 from pg_indexes where schemaname = ? and indexname = ?
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
                select pg_get_constraintdef(oid)
                from pg_constraint
                where connamespace = ?::regnamespace and conname = ?
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
