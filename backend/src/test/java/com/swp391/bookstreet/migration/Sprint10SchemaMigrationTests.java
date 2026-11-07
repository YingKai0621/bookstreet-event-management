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
class Sprint10SchemaMigrationTests {
    private static final MigrationVersion SPRINT_10_VERSION = MigrationVersion.fromVersion("16");
    private static final Instant BASE = Instant.parse("2026-11-04T00:00:00Z");
    private String schema;

    @BeforeEach
    void createSchemaName() {
        schema = "s10_migration_" + UUID.randomUUID().toString().replace("-", "");
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
    void cleanDatabaseMigratesThroughV16WithExactRoleScopedShape() throws SQLException {
        Flyway flyway = flyway(SPRINT_10_VERSION);
        flyway.migrate();

        assertThat(flyway.info().current().getVersion().getVersion()).isEqualTo("16");
        try (Connection connection = connect()) {
            for (String column : List.of(
                    "recipient_role",
                    "partner_event_application_id",
                    "booth_request_id",
                    "activity_proposal_id",
                    "activity_request_id")) {
                assertThat(columnExists(connection, "notifications", column)).as(column).isTrue();
            }
            for (String constraint : List.of(
                    "ck_notifications_recipient_role",
                    "ck_notifications_type_role_reference",
                    "uk_notifications_recipient_role_deduplication",
                    "fk_notifications_partner_event_application",
                    "fk_notifications_booth_request",
                    "fk_notifications_activity_proposal",
                    "fk_notifications_activity_request")) {
                assertThat(constraintExists(connection, constraint)).as(constraint).isTrue();
            }
            for (String index : List.of(
                    "idx_notifications_recipient_role_created",
                    "idx_notifications_recipient_role_unread",
                    "idx_notifications_recipient_role_read",
                    "idx_notifications_partner_event_application",
                    "idx_notifications_booth_request",
                    "idx_notifications_activity_proposal",
                    "idx_notifications_activity_request")) {
                assertThat(indexExists(connection, index)).as(index).isTrue();
            }
            assertThat(constraintExists(connection, "uk_notifications_recipient_deduplication"))
                    .isFalse();
            assertThat(indexExists(connection, "idx_notifications_recipient_created")).isFalse();
            assertThat(indexExists(connection, "idx_notifications_recipient_unread")).isFalse();
        }
    }

    @Test
    void v15UpgradeBackfillsParticipantAndPreservesReadStateExactly() throws SQLException {
        flyway(MigrationVersion.fromVersion("15")).migrate();
        long unreadId;
        long readId;
        Instant firstReadAt = BASE.plusSeconds(120);
        try (Connection connection = connect()) {
            long userId = insertUser(connection, "upgrade_user");
            long eventId = insertEvent(connection, userId);
            unreadId = insertLegacyNotification(
                    connection, userId, eventId, "upgrade-unread", BASE, null);
            readId = insertLegacyNotification(
                    connection, userId, eventId, "upgrade-read", BASE, firstReadAt);
        }

        Flyway upgraded = flyway(SPRINT_10_VERSION);
        upgraded.migrate();

        try (Connection connection = connect(); PreparedStatement statement = connection.prepareStatement("""
                SELECT notification_id, recipient_role, deduplication_key, created_at, read_at
                FROM notifications
                WHERE notification_id IN (?, ?)
                ORDER BY notification_id
                """)) {
            statement.setLong(1, unreadId);
            statement.setLong(2, readId);
            try (ResultSet rows = statement.executeQuery()) {
                assertThat(rows.next()).isTrue();
                assertThat(rows.getLong("notification_id")).isEqualTo(unreadId);
                assertThat(rows.getString("recipient_role")).isEqualTo("PARTICIPANT");
                assertThat(rows.getString("deduplication_key")).isEqualTo("upgrade-unread");
                assertThat(rows.getObject("read_at")).isNull();
                assertThat(rows.next()).isTrue();
                assertThat(rows.getLong("notification_id")).isEqualTo(readId);
                assertThat(rows.getString("recipient_role")).isEqualTo("PARTICIPANT");
                assertThat(rows.getString("deduplication_key")).isEqualTo("upgrade-read");
                assertThat(rows.getObject("read_at", java.time.OffsetDateTime.class).toInstant())
                        .isEqualTo(firstReadAt);
            }
        }
    }

    @Test
    void closedRoleTypeReferenceMatrixAndRoleAwareIdentityAreEnforced() throws SQLException {
        flyway(SPRINT_10_VERSION).migrate();
        try (Connection connection = connect()) {
            Fixture fixture = createFixture(connection);

            insertAllValidTypes(connection, fixture);
            insertNotification(connection, fixture.recipientUserId(), "PARTICIPANT",
                    "EVENT_CANCELLED", fixture.eventId(), null, null, null,
                    null, null, null, null, "same-transition");
            insertNotification(connection, fixture.recipientUserId(), "PARTNER",
                    "PARTNER_EVENT_CANCELLED", fixture.eventId(), null, null, null,
                    null, null, null, null, "same-transition");

            assertConstraint(connection, "ck_notifications_type_role_reference", () ->
                    insertNotification(connection, fixture.recipientUserId(), "ADMIN",
                            "EVENT_CANCELLED", fixture.eventId(), null, null, null,
                            null, null, null, null, "invalid-admin"));
            assertConstraint(connection, "ck_notifications_type_role_reference", () ->
                    insertNotification(connection, fixture.recipientUserId(), "PARTNER",
                            "EVENT_CANCELLED", fixture.eventId(), null, null, null,
                            null, null, null, null, "wrong-role"));
            assertConstraint(connection, "ck_notifications_type_role_reference", () ->
                    insertNotification(connection, fixture.recipientUserId(), "PARTICIPANT",
                            "EVENT_CANCELLED", fixture.eventId(), fixture.activityId(), null, null,
                            null, null, null, null, "two-references"));
            assertConstraint(connection, "uk_notifications_recipient_role_deduplication", () ->
                    insertNotification(connection, fixture.recipientUserId(), "PARTICIPANT",
                            "EVENT_CANCELLED", fixture.eventId(), null, null, null,
                            null, null, null, null, "same-transition"));
        }
    }

    private void insertAllValidTypes(Connection connection, Fixture fixture) throws SQLException {
        for (String type : List.of(
                "ACTIVITY_SCHEDULE_OR_LOCATION_CHANGED", "ACTIVITY_CANCELLED")) {
            insertNotification(connection, fixture.recipientUserId(), "PARTICIPANT", type,
                    null, fixture.activityId(), null, null,
                    null, null, null, null, "valid-" + type);
        }
        insertNotification(connection, fixture.recipientUserId(), "PARTICIPANT", "EVENT_CANCELLED",
                fixture.eventId(), null, null, null,
                null, null, null, null, "valid-EVENT_CANCELLED");
        for (String type : List.of("CERTIFICATE_ISSUED", "CERTIFICATE_REVOKED")) {
            insertNotification(connection, fixture.recipientUserId(), "PARTICIPANT", type,
                    null, null, fixture.certificateId(), null,
                    null, null, null, null, "valid-" + type);
        }
        insertNotification(connection, fixture.recipientUserId(), "PARTICIPANT", "BADGE_UNLOCKED",
                null, null, null, fixture.badgeId(),
                null, null, null, null, "valid-BADGE_UNLOCKED");

        insertNotification(connection, fixture.recipientUserId(), "PARTNER",
                "PARTNER_APPLICATION_STATUS_CHANGED",
                null, null, null, null, fixture.applicationId(), null, null, null,
                "valid-PARTNER_APPLICATION_STATUS_CHANGED");
        insertNotification(connection, fixture.recipientUserId(), "PARTNER",
                "PARTNER_BOOTH_REQUEST_STATUS_CHANGED",
                null, null, null, null, null, fixture.boothRequestId(), null, null,
                "valid-PARTNER_BOOTH_REQUEST_STATUS_CHANGED");
        insertNotification(connection, fixture.recipientUserId(), "PARTNER",
                "PARTNER_ACTIVITY_PROPOSAL_STATUS_CHANGED",
                null, null, null, null, null, null, fixture.proposalId(), null,
                "valid-PARTNER_ACTIVITY_PROPOSAL_STATUS_CHANGED");
        for (String type : List.of(
                "PARTNER_ACTIVITY_CHANGE_REQUEST_STATUS_CHANGED",
                "PARTNER_ACTIVITY_CANCELLATION_REQUEST_STATUS_CHANGED")) {
            insertNotification(connection, fixture.recipientUserId(), "PARTNER", type,
                    null, null, null, null, null, null, null, fixture.activityRequestId(),
                    "valid-" + type);
        }
        insertNotification(connection, fixture.recipientUserId(), "PARTNER", "PARTNER_EVENT_CANCELLED",
                fixture.eventId(), null, null, null,
                null, null, null, null, "valid-PARTNER_EVENT_CANCELLED");
        insertNotification(connection, fixture.recipientUserId(), "PARTNER", "PARTNER_ACTIVITY_CANCELLED",
                null, fixture.activityId(), null, null,
                null, null, null, null, "valid-PARTNER_ACTIVITY_CANCELLED");

        insertNotification(connection, fixture.recipientUserId(), "ORGANIZER",
                "ORGANIZER_NEW_PARTNER_APPLICATION",
                null, null, null, null, fixture.applicationId(), null, null, null,
                "valid-ORGANIZER_NEW_PARTNER_APPLICATION");
        for (String type : List.of("ORGANIZER_NEW_BOOTH_REQUEST", "ORGANIZER_BOOTH_RESELECTION_REQUIRED")) {
            insertNotification(connection, fixture.recipientUserId(), "ORGANIZER", type,
                    null, null, null, null, null, fixture.boothRequestId(), null, null,
                    "valid-" + type);
        }
        insertNotification(connection, fixture.recipientUserId(), "ORGANIZER",
                "ORGANIZER_ACTIVITY_PROPOSAL_SUBMITTED",
                null, null, null, null, null, null, fixture.proposalId(), null,
                "valid-ORGANIZER_ACTIVITY_PROPOSAL_SUBMITTED");
        for (String type : List.of(
                "ORGANIZER_NEW_ACTIVITY_CHANGE_REQUEST",
                "ORGANIZER_NEW_ACTIVITY_CANCELLATION_REQUEST")) {
            insertNotification(connection, fixture.recipientUserId(), "ORGANIZER", type,
                    null, null, null, null, null, null, null, fixture.activityRequestId(),
                    "valid-" + type);
        }
    }

    private Fixture createFixture(Connection connection) throws SQLException {
        long organizerId = insertUser(connection, "fixture_org");
        long recipientId = insertUser(connection, "fixture_recipient");
        long eventId = insertEvent(connection, organizerId);
        long locationId = queryId(connection, """
                INSERT INTO locations(code, name, location_type, max_capacity)
                VALUES (?, 'Khu vực kiểm thử', 'BOOTH', 100)
                RETURNING location_id
                """, "S10-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase());
        execute(connection, "INSERT INTO booths(booth_id) VALUES (?)", locationId);
        long organizationId = queryId(connection, """
                INSERT INTO partner_organizations(
                    representative_user_id, name, category_code, status, created_at, updated_at
                ) VALUES (?, 'Đối tác kiểm thử', 'BOOK', 'ACTIVE', ?, ?)
                RETURNING partner_organization_id
                """, recipientId, BASE, BASE);
        long applicationId = queryId(connection, """
                INSERT INTO partner_event_applications(
                    partner_organization_id, event_id, status, submitted_at
                ) VALUES (?, ?, 'APPROVED', ?)
                RETURNING application_id
                """, organizationId, eventId, BASE);
        long boothRequestId = queryId(connection, """
                INSERT INTO booth_requests(application_id, booth_id, status, submitted_at)
                VALUES (?, ?, 'PENDING', ?)
                RETURNING booth_request_id
                """, applicationId, locationId, BASE);
        long proposalId = queryId(connection, """
                INSERT INTO activity_proposals(
                    application_id, location_id, title, activity_type,
                    proposed_start_at, proposed_end_at, capacity, status, submitted_at, updated_at
                ) VALUES (?, ?, 'Đề xuất kiểm thử', 'TALK', ?, ?, 20, 'PENDING', ?, ?)
                RETURNING activity_proposal_id
                """, applicationId, locationId, BASE.plusSeconds(7200), BASE.plusSeconds(10800), BASE, BASE);
        long activityId = queryId(connection, """
                INSERT INTO activities(
                    event_id, location_id, title, activity_type, start_at, end_at,
                    registration_required, registration_deadline_at, capacity,
                    attendance_qr_token, is_certificate_enabled, status,
                    created_at, updated_at, published_at
                ) VALUES (?, ?, 'Hoạt động kiểm thử', 'TALK', ?, ?, TRUE, ?, 20, ?,
                          TRUE, 'PUBLISHED', ?, ?, ?)
                RETURNING activity_id
                """, eventId, locationId, BASE.plusSeconds(7200), BASE.plusSeconds(10800),
                BASE.plusSeconds(3600), UUID.randomUUID(), BASE, BASE, BASE);
        long activityRequestId = queryId(connection, """
                INSERT INTO activity_requests(
                    activity_id, request_type, requested_title, reason, status, submitted_at
                ) VALUES (?, 'CHANGE', 'Hoạt động sau điều chỉnh', 'Lý do thay đổi hợp lệ', 'PENDING', ?)
                RETURNING activity_request_id
                """, activityId, BASE);
        long eventRegistrationId = queryId(connection, """
                INSERT INTO event_registrations(
                    user_id, event_id, status, registered_at, activated_at, updated_at
                ) VALUES (?, ?, 'ACTIVE', ?, ?, ?)
                RETURNING event_registration_id
                """, recipientId, eventId, BASE, BASE, BASE);
        long activityRegistrationId = queryId(connection, """
                INSERT INTO activity_registrations(
                    event_registration_id, activity_id, status,
                    registered_at, activated_at, updated_at
                ) VALUES (?, ?, 'ACTIVE', ?, ?, ?)
                RETURNING activity_registration_id
                """, eventRegistrationId, activityId, BASE, BASE, BASE);
        long attendanceId = queryId(connection, """
                INSERT INTO attendances(
                    activity_registration_id, status, recorded_source,
                    attended_at, created_at, updated_at
                ) VALUES (?, 'VALID', 'SELF_SCAN', ?, ?, ?)
                RETURNING attendance_id
                """, activityRegistrationId, BASE.plusSeconds(7200), BASE, BASE.plusSeconds(7200));
        long certificateId = queryId(connection, """
                INSERT INTO certificates(
                    attendance_id, certificate_code, recipient_name_snapshot,
                    status, issued_at, created_at, updated_at
                ) VALUES (?, ?, 'Người nhận kiểm thử', 'ISSUED', ?, ?, ?)
                RETURNING certificate_id
                """, attendanceId, "S10-CERT-" + UUID.randomUUID(),
                BASE.plusSeconds(7200), BASE, BASE.plusSeconds(7200));
        long badgeId = queryId(connection, """
                INSERT INTO badges(name, required_points, is_active, created_at, updated_at)
                VALUES (?, 10, TRUE, ?, ?)
                RETURNING badge_id
                """, "Huy hiệu " + UUID.randomUUID(), BASE, BASE);

        return new Fixture(recipientId, eventId, activityId, certificateId, badgeId,
                applicationId, boothRequestId, proposalId, activityRequestId);
    }

    private long insertUser(Connection connection, String prefix) throws SQLException {
        return queryId(connection, """
                INSERT INTO users(username, full_name, password_hash, email_verified_at, status, created_at, updated_at)
                VALUES (?, 'Người dùng kiểm thử', 'hash', ?, 'ACTIVE', ?, ?)
                RETURNING user_id
                """, prefix + UUID.randomUUID().toString().replace("-", "").substring(0, 8), BASE, BASE, BASE);
    }

    private long insertEvent(Connection connection, long organizerId) throws SQLException {
        return queryId(connection, """
                INSERT INTO events(
                    organizer_user_id, name, start_at, end_at,
                    booth_payment_window_minutes, max_booths_per_partner,
                    max_activities_per_partner, status, created_at, updated_at
                ) VALUES (?, 'Sự kiện kiểm thử', ?, ?, 1440, 2, 2, 'PUBLISHED', ?, ?)
                RETURNING event_id
                """, organizerId, BASE.plusSeconds(3600), BASE.plusSeconds(172800), BASE, BASE);
    }

    private long insertLegacyNotification(
            Connection connection,
            long userId,
            long eventId,
            String key,
            Instant createdAt,
            Instant readAt) throws SQLException {
        return queryId(connection, """
                INSERT INTO notifications(
                    recipient_user_id, notification_type, event_id,
                    deduplication_key, title, message, created_at, read_at
                ) VALUES (?, 'EVENT_CANCELLED', ?, ?, 'Sự kiện đã hủy', 'Nội dung', ?, ?)
                RETURNING notification_id
                """, userId, eventId, key, createdAt, readAt);
    }

    private void insertNotification(
            Connection connection,
            long recipientUserId,
            String role,
            String type,
            Long eventId,
            Long activityId,
            Long certificateId,
            Long badgeId,
            Long applicationId,
            Long boothRequestId,
            Long proposalId,
            Long activityRequestId,
            String key) throws SQLException {
        execute(connection, """
                INSERT INTO notifications(
                    recipient_user_id, recipient_role, notification_type,
                    event_id, activity_id, certificate_id, badge_id,
                    partner_event_application_id, booth_request_id,
                    activity_proposal_id, activity_request_id,
                    deduplication_key, title, message, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Tiêu đề', 'Nội dung', ?)
                """, recipientUserId, role, type, eventId, activityId, certificateId, badgeId,
                applicationId, boothRequestId, proposalId, activityRequestId, key, BASE);
    }

    private void assertConstraint(Connection connection, String constraint, SqlOperation operation) {
        assertThatThrownBy(operation::run)
                .isInstanceOf(SQLException.class)
                .hasMessageContaining(constraint);
    }

    private long queryId(Connection connection, String sql, Object... values) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            bind(statement, values);
            try (ResultSet result = statement.executeQuery()) {
                assertThat(result.next()).isTrue();
                return result.getLong(1);
            }
        }
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

    private String quotedSchema() {
        return '"' + schema.replace("\"", "\"\"") + '"';
    }

    private static String databaseUrl() { return System.getenv("EVENT_TEST_DATABASE_URL"); }
    private static String databaseUser() {
        return System.getenv().getOrDefault("EVENT_TEST_DATABASE_USER", "postgres");
    }
    private static String databasePassword() {
        return System.getenv().getOrDefault("EVENT_TEST_DATABASE_PASSWORD", "postgres");
    }

    @FunctionalInterface
    private interface SqlOperation {
        void run() throws SQLException;
    }

    private record Fixture(
            long recipientUserId,
            long eventId,
            long activityId,
            long certificateId,
            long badgeId,
            long applicationId,
            long boothRequestId,
            long proposalId,
            long activityRequestId) {
    }
}
