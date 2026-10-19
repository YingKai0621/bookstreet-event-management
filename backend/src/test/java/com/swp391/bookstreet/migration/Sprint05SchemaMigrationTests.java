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
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.FlywayException;
import org.flywaydb.core.api.MigrationVersion;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@EnabledIfEnvironmentVariable(named = "EVENT_TEST_DATABASE_URL", matches = ".+")
class Sprint05SchemaMigrationTests {
    private String schema;

    @BeforeEach
    void createIsolatedSchemaName() {
        schema = "s5_migration_" + UUID.randomUUID().toString().replace("-", "");
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
    void cleanDatabaseMigratesThroughV9WithActivitySchema() throws SQLException {
        Flyway flyway = flyway(MigrationVersion.fromVersion("9"));

        flyway.migrate();

        assertThat(flyway.info().current().getVersion().getVersion()).isEqualTo("9");
        try (Connection connection = connectToSchema()) {
            assertThat(tableExists(connection, "activity_proposals")).isTrue();
            assertThat(tableExists(connection, "activities")).isTrue();
            assertThat(tableExists(connection, "activity_requests")).isTrue();
            assertThat(tableExists(connection, "activity_revisions")).isTrue();
            assertThat(indexExists(connection, "uk_locations_code_normalized")).isTrue();
            assertThat(indexExists(connection, "uk_activity_requests_one_pending")).isTrue();
            assertThat(constraintDefinition(connection, "ex_activities_location_time"))
                    .contains("EXCLUDE USING gist")
                    .contains("tstzrange(start_at, end_at, '[)'::text)")
                    .contains("status")
                    .contains("CANCELLED");
        }
    }

    @Test
    void existingV8DatabaseNormalizesLegacyLocationCodes() throws SQLException {
        flyway(MigrationVersion.fromVersion("8")).migrate();
        try (Connection connection = connectToSchema(); Statement statement = connection.createStatement()) {
            statement.executeUpdate("""
                    INSERT INTO locations (
                        code, name, location_type, max_capacity, is_active
                    ) VALUES (
                        ' booth-mixed ', 'Legacy Booth', 'BOOTH', 10, TRUE
                    )
                    """);
            statement.executeUpdate("""
                    INSERT INTO locations (
                        code, name, location_type, max_capacity, is_active
                    ) VALUES (
                        'Gian hàng cũ', 'Invalid-code legacy Booth', 'BOOTH', 10, TRUE
                    )
                    """);
        }

        Flyway upgraded = flyway(MigrationVersion.fromVersion("9"));
        upgraded.migrate();

        assertThat(upgraded.info().current().getVersion().getVersion()).isEqualTo("9");
        try (Connection connection = connectToSchema();
                Statement statement = connection.createStatement();
                ResultSet result = statement.executeQuery("""
                        SELECT code
                        FROM locations
                        WHERE name = 'Legacy Booth'
                        """)) {
            assertThat(result.next()).isTrue();
            assertThat(result.getString("code")).isEqualTo("BOOTH-MIXED");
        }
        try (Connection connection = connectToSchema();
                Statement statement = connection.createStatement();
                ResultSet result = statement.executeQuery("""
                        SELECT code
                        FROM locations
                        WHERE name = 'Invalid-code legacy Booth'
                        """)) {
            assertThat(result.next()).isTrue();
            assertThat(result.getString("code")).matches("LEGACY-[0-9]+");
        }
    }

    @Test
    void existingV8DatabaseRejectsCaseInsensitiveLocationCodeCollision() throws SQLException {
        flyway(MigrationVersion.fromVersion("8")).migrate();
        try (Connection connection = connectToSchema(); Statement statement = connection.createStatement()) {
            statement.executeUpdate("""
                    INSERT INTO locations (
                        code, name, location_type, max_capacity, is_active
                    ) VALUES
                        ('STAGE-A', 'First legacy Location', 'BOOTH', 10, TRUE),
                        ('stage-a', 'Second legacy Location', 'BOOTH', 10, TRUE)
                    """);
        }

        assertThatThrownBy(() -> flyway(MigrationVersion.fromVersion("9")).migrate())
                .isInstanceOf(FlywayException.class)
                .hasMessageContaining("projected codes are not unique");
    }

    @Test
    void exclusionConstraintAllowsAdjacencyAndRejectsCrossEventOverlap() throws SQLException {
        flyway(MigrationVersion.fromVersion("9")).migrate();

        try (Connection connection = connectToSchema()) {
            long firstEventId = insertEvent(connection, "First Event");
            long secondEventId = insertEvent(connection, "Second Event");
            long locationId = insertLocation(connection, "STAGE-CONFLICT");
            Instant start = Instant.parse("2027-01-11T02:00:00Z");
            Instant end = Instant.parse("2027-01-11T03:00:00Z");

            insertActivity(connection, firstEventId, locationId, start, end);

            assertThatCode(() -> insertActivity(connection, secondEventId, locationId, end,
                    end.plusSeconds(3600))).doesNotThrowAnyException();
            assertThatThrownBy(() -> insertActivity(connection, secondEventId, locationId,
                    start.plusSeconds(1800), end.plusSeconds(1800)))
                    .isInstanceOf(SQLException.class)
                    .hasMessageContaining("ex_activities_location_time");
        }
    }

    @Test
    void onePendingRequestGuardWorksAcrossRequestTypes() throws SQLException {
        flyway(MigrationVersion.fromVersion("9")).migrate();

        try (Connection connection = connectToSchema()) {
            long eventId = insertEvent(connection, "Request Guard Event");
            long locationId = insertLocation(connection, "REQUEST-STAGE");
            long activityId = insertActivity(connection, eventId, locationId,
                    Instant.parse("2027-01-11T02:00:00Z"),
                    Instant.parse("2027-01-11T03:00:00Z"));

            insertCancellationRequest(connection, activityId);

            assertThatThrownBy(() -> insertChangeRequest(connection, activityId))
                    .isInstanceOf(SQLException.class)
                    .hasMessageContaining("uk_activity_requests_one_pending");
        }
    }

    @Test
    void onePendingRequestGuardSurvivesConcurrentCrossTypeInserts() throws Exception {
        flyway(MigrationVersion.fromVersion("9")).migrate();

        long activityId;
        try (Connection connection = connectToSchema()) {
            long eventId = insertEvent(connection, "Concurrent Request Guard Event");
            long locationId = insertLocation(connection, "CONCURRENT-STAGE");
            activityId = insertActivity(connection, eventId, locationId,
                    Instant.parse("2027-01-11T02:00:00Z"),
                    Instant.parse("2027-01-11T03:00:00Z"));
        }

        CountDownLatch start = new CountDownLatch(1);
        try (ExecutorService pool = Executors.newFixedThreadPool(2)) {
            Future<Boolean> cancellation = pool.submit(() -> insertPendingRequestConcurrently(
                    activityId, "CANCELLATION", start));
            Future<Boolean> change = pool.submit(() -> insertPendingRequestConcurrently(
                    activityId, "CHANGE", start));
            start.countDown();

            List<Boolean> outcomes = List.of(
                    cancellation.get(10, TimeUnit.SECONDS),
                    change.get(10, TimeUnit.SECONDS));
            assertThat(outcomes).containsExactlyInAnyOrder(true, false);
        }

        try (Connection connection = connectToSchema(); PreparedStatement statement =
                connection.prepareStatement("""
                        SELECT COUNT(*)
                        FROM activity_requests
                        WHERE activity_id = ? AND status = 'PENDING'
                        """)) {
            statement.setLong(1, activityId);
            try (ResultSet result = statement.executeQuery()) {
                assertThat(result.next()).isTrue();
                assertThat(result.getInt(1)).isOne();
            }
        }
    }

    @Test
    void sourceProposalCanCreateAtMostOneActivity() throws SQLException {
        flyway(MigrationVersion.fromVersion("9")).migrate();

        try (Connection connection = connectToSchema()) {
            long eventId = insertEvent(connection, "Unique Proposal Event");
            long locationId = insertLocation(connection, "PROPOSAL-STAGE");
            long applicationId = insertApprovedApplication(connection, eventId);
            long proposalId = insertApprovedProposal(connection, applicationId, locationId);
            Instant start = Instant.parse("2027-01-11T02:00:00Z");

            insertActivityWithSourceProposal(connection, eventId, locationId, proposalId,
                    start, start.plusSeconds(3600));

            assertThatThrownBy(() -> insertActivityWithSourceProposal(connection, eventId,
                    locationId, proposalId, start.plusSeconds(3600), start.plusSeconds(7200)))
                    .isInstanceOf(SQLException.class)
                    .hasMessageContaining("uk_activities_source_proposal");
        }
    }

    @Test
    void invalidCancellationAndRequestStateAreRejectedByDatabase() throws SQLException {
        flyway(MigrationVersion.fromVersion("9")).migrate();

        try (Connection connection = connectToSchema()) {
            long eventId = insertEvent(connection, "State Constraint Event");
            long locationId = insertLocation(connection, "STATE-STAGE");

            assertThatThrownBy(() -> insertCancelledActivityWithoutMetadata(
                    connection, eventId, locationId))
                    .isInstanceOf(SQLException.class)
                    .hasMessageContaining("ck_activities_cancellation_consistency");

            long activityId = insertActivity(connection, eventId, locationId,
                    Instant.parse("2027-01-11T02:00:00Z"),
                    Instant.parse("2027-01-11T03:00:00Z"));
            assertThatThrownBy(() -> insertCancellationRequestWithChangePayload(
                    connection, activityId))
                    .isInstanceOf(SQLException.class)
                    .hasMessageContaining("ck_activity_requests_payload_by_type");
        }
    }

    @Test
    void revisionSnapshotsPersistAsObjectsAndRejectNonObjects() throws SQLException {
        flyway(MigrationVersion.fromVersion("9")).migrate();

        try (Connection connection = connectToSchema()) {
            long eventId = insertEvent(connection, "Revision Event");
            long locationId = insertLocation(connection, "REVISION-STAGE");
            long activityId = insertActivity(connection, eventId, locationId,
                    Instant.parse("2027-01-11T02:00:00Z"),
                    Instant.parse("2027-01-11T03:00:00Z"));

            insertRevision(connection, activityId, "{\"title\":\"Before\"}",
                    "{\"title\":\"After\"}");
            try (PreparedStatement statement = connection.prepareStatement("""
                    SELECT old_snapshot ->> 'title', new_snapshot ->> 'title'
                    FROM activity_revisions
                    WHERE activity_id = ?
                    """)) {
                statement.setLong(1, activityId);
                try (ResultSet result = statement.executeQuery()) {
                    assertThat(result.next()).isTrue();
                    assertThat(result.getString(1)).isEqualTo("Before");
                    assertThat(result.getString(2)).isEqualTo("After");
                }
            }

            assertThatThrownBy(() -> insertRevision(connection, activityId, "[]", "{}"))
                    .isInstanceOf(SQLException.class)
                    .hasMessageContaining("ck_activity_revisions_old_snapshot_object");
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

    private long insertEvent(Connection connection, String name) throws SQLException {
        Instant start = Instant.parse("2027-01-11T00:00:00Z");
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
                    ?,
                    ?,
                    1440,
                    1,
                    3,
                    'PUBLISHED',
                    ?,
                    ?
                FROM users
                WHERE username = 'organizerdemo'
                RETURNING event_id
                """)) {
            statement.setString(1, name);
            statement.setObject(2, start.atOffset(ZoneOffset.UTC));
            statement.setObject(3, start.plusSeconds(86400).atOffset(ZoneOffset.UTC));
            statement.setObject(4, Instant.parse("2026-10-16T00:00:00Z").atOffset(ZoneOffset.UTC));
            statement.setObject(5, Instant.parse("2026-10-16T00:00:00Z").atOffset(ZoneOffset.UTC));
            try (ResultSet result = statement.executeQuery()) {
                assertThat(result.next()).isTrue();
                return result.getLong(1);
            }
        }
    }

    private long insertLocation(Connection connection, String code) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement("""
                INSERT INTO locations (
                    code, name, location_type, max_capacity, is_active
                ) VALUES (?, ?, 'STAGE', 100, TRUE)
                RETURNING location_id
                """)) {
            statement.setString(1, code);
            statement.setString(2, code + " name");
            try (ResultSet result = statement.executeQuery()) {
                assertThat(result.next()).isTrue();
                return result.getLong(1);
            }
        }
    }

    private long insertActivity(Connection connection, long eventId, long locationId,
            Instant start, Instant end) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement("""
                INSERT INTO activities (
                    event_id,
                    location_id,
                    title,
                    activity_type,
                    start_at,
                    end_at,
                    capacity,
                    status,
                    created_at,
                    updated_at
                ) VALUES (?, ?, 'Schema test Activity', 'TALKSHOW', ?, ?, 50, 'DRAFT', ?, ?)
                RETURNING activity_id
                """)) {
            statement.setLong(1, eventId);
            statement.setLong(2, locationId);
            statement.setObject(3, start.atOffset(ZoneOffset.UTC));
            statement.setObject(4, end.atOffset(ZoneOffset.UTC));
            Instant createdAt = Instant.parse("2026-10-16T00:00:00Z");
            statement.setObject(5, createdAt.atOffset(ZoneOffset.UTC));
            statement.setObject(6, createdAt.atOffset(ZoneOffset.UTC));
            try (ResultSet result = statement.executeQuery()) {
                assertThat(result.next()).isTrue();
                return result.getLong(1);
            }
        }
    }

    private long insertApprovedApplication(Connection connection, long eventId)
            throws SQLException {
        long organizationId;
        try (PreparedStatement statement = connection.prepareStatement("""
                INSERT INTO partner_organizations (
                    representative_user_id, name, category_code, status, created_at, updated_at
                )
                SELECT user_id, 'Sprint 5 migration Partner', 'PUBLISHER', 'ACTIVE',
                    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                FROM users
                WHERE username = 'partnerdemo'
                RETURNING partner_organization_id
                """)) {
            try (ResultSet result = statement.executeQuery()) {
                assertThat(result.next()).isTrue();
                organizationId = result.getLong(1);
            }
        }
        try (PreparedStatement statement = connection.prepareStatement("""
                INSERT INTO partner_event_applications (
                    partner_organization_id, event_id, status, submitted_at, reviewed_at
                ) VALUES (?, ?, 'APPROVED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
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

    private long insertApprovedProposal(Connection connection, long applicationId,
            long locationId) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement("""
                INSERT INTO activity_proposals (
                    application_id, location_id, title, activity_type,
                    proposed_start_at, proposed_end_at, capacity, status,
                    submitted_at, updated_at, reviewed_at
                ) VALUES (
                    ?, ?, 'Approved Proposal', 'TALKSHOW',
                    '2027-01-11T02:00:00Z', '2027-01-11T03:00:00Z', 50, 'APPROVED',
                    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                )
                RETURNING activity_proposal_id
                """)) {
            statement.setLong(1, applicationId);
            statement.setLong(2, locationId);
            try (ResultSet result = statement.executeQuery()) {
                assertThat(result.next()).isTrue();
                return result.getLong(1);
            }
        }
    }

    private long insertActivityWithSourceProposal(Connection connection, long eventId,
            long locationId, long proposalId, Instant start, Instant end) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement("""
                INSERT INTO activities (
                    event_id, location_id, source_proposal_id, title, activity_type,
                    start_at, end_at, capacity, status, created_at, updated_at
                ) VALUES (?, ?, ?, 'Proposal Activity', 'TALKSHOW', ?, ?, 50, 'DRAFT',
                    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                RETURNING activity_id
                """)) {
            statement.setLong(1, eventId);
            statement.setLong(2, locationId);
            statement.setLong(3, proposalId);
            statement.setObject(4, start.atOffset(ZoneOffset.UTC));
            statement.setObject(5, end.atOffset(ZoneOffset.UTC));
            try (ResultSet result = statement.executeQuery()) {
                assertThat(result.next()).isTrue();
                return result.getLong(1);
            }
        }
    }

    private void insertCancelledActivityWithoutMetadata(Connection connection, long eventId,
            long locationId) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement("""
                INSERT INTO activities (
                    event_id, location_id, title, activity_type, start_at, end_at,
                    capacity, status, created_at, updated_at
                ) VALUES (
                    ?, ?, 'Invalid cancellation', 'TALKSHOW',
                    '2027-01-11T04:00:00Z', '2027-01-11T05:00:00Z',
                    50, 'CANCELLED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                )
                """)) {
            statement.setLong(1, eventId);
            statement.setLong(2, locationId);
            statement.executeUpdate();
        }
    }

    private void insertCancellationRequestWithChangePayload(Connection connection,
            long activityId) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement("""
                INSERT INTO activity_requests (
                    activity_id, request_type, requested_title, reason, status, submitted_at
                ) VALUES (
                    ?, 'CANCELLATION', 'Unexpected title', 'Cancellation test reason',
                    'PENDING', CURRENT_TIMESTAMP
                )
                """)) {
            statement.setLong(1, activityId);
            statement.executeUpdate();
        }
    }

    private void insertRevision(Connection connection, long activityId, String oldSnapshot,
            String newSnapshot) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement("""
                INSERT INTO activity_revisions (
                    activity_id, revision_source, old_snapshot, new_snapshot, changed_at
                ) VALUES (?, 'SYSTEM', ?::jsonb, ?::jsonb, CURRENT_TIMESTAMP)
                """)) {
            statement.setLong(1, activityId);
            statement.setString(2, oldSnapshot);
            statement.setString(3, newSnapshot);
            statement.executeUpdate();
        }
    }

    private boolean insertPendingRequestConcurrently(long activityId, String requestType,
            CountDownLatch start) throws Exception {
        assertThat(start.await(5, TimeUnit.SECONDS)).isTrue();
        try (Connection connection = connectToSchema(); PreparedStatement statement =
                connection.prepareStatement("""
                        INSERT INTO activity_requests (
                            activity_id, request_type, requested_title, reason,
                            status, submitted_at
                        ) VALUES (
                            ?, ?, CASE WHEN ? = 'CHANGE' THEN 'Changed title' ELSE NULL END,
                            'Concurrent request reason', 'PENDING', CURRENT_TIMESTAMP
                        )
                        """)) {
            statement.setLong(1, activityId);
            statement.setString(2, requestType);
            statement.setString(3, requestType);
            statement.executeUpdate();
            return true;
        } catch (SQLException exception) {
            if ("23505".equals(exception.getSQLState())
                    && exception.getMessage().contains("uk_activity_requests_one_pending")) {
                return false;
            }
            throw exception;
        }
    }

    private void insertCancellationRequest(Connection connection, long activityId)
            throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement("""
                INSERT INTO activity_requests (
                    activity_id, request_type, reason, status, submitted_at
                ) VALUES (?, 'CANCELLATION', 'Cancellation test reason', 'PENDING', CURRENT_TIMESTAMP)
                """)) {
            statement.setLong(1, activityId);
            statement.executeUpdate();
        }
    }

    private void insertChangeRequest(Connection connection, long activityId) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement("""
                INSERT INTO activity_requests (
                    activity_id,
                    request_type,
                    requested_title,
                    reason,
                    status,
                    submitted_at
                ) VALUES (?, 'CHANGE', 'Changed title', 'Change test reason', 'PENDING', CURRENT_TIMESTAMP)
                """)) {
            statement.setLong(1, activityId);
            statement.executeUpdate();
        }
    }

    private boolean tableExists(Connection connection, String table) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement("""
                SELECT EXISTS (
                    SELECT 1
                    FROM information_schema.tables
                    WHERE table_schema = ? AND table_name = ?
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
                SELECT EXISTS (
                    SELECT 1
                    FROM pg_indexes
                    WHERE schemaname = ? AND indexname = ?
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
