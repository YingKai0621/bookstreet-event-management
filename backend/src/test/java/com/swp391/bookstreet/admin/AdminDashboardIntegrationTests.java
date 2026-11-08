package com.swp391.bookstreet.admin;

import static org.assertj.core.api.Assertions.assertThat;

import com.swp391.bookstreet.admin.service.AdminDashboardService;
import com.swp391.bookstreet.auth.entity.AccountStatus;
import com.swp391.bookstreet.auth.entity.RoleCode;
import com.swp391.bookstreet.event.entity.EventStatus;
import java.math.BigDecimal;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.sql.Statement;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.UUID;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

@SpringBootTest
@EnabledIfEnvironmentVariable(named = "EVENT_TEST_DATABASE_URL", matches = ".+")
class AdminDashboardIntegrationTests {
    private static final String SCHEMA = "s11dash_" + UUID.randomUUID().toString().replace("-", "");

    @Autowired JdbcTemplate jdbc;
    @Autowired AdminDashboardService dashboard;

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", () -> databaseUrl() + (databaseUrl().contains("?") ? "&" : "?") + "currentSchema=" + SCHEMA);
        registry.add("spring.datasource.username", () -> System.getenv("EVENT_TEST_DATABASE_USER"));
        registry.add("spring.datasource.password", () -> System.getenv("EVENT_TEST_DATABASE_PASSWORD"));
        registry.add("spring.flyway.default-schema", () -> SCHEMA);
        registry.add("spring.flyway.schemas", () -> SCHEMA);
        registry.add("spring.flyway.create-schemas", () -> true);
        registry.add("spring.flyway.locations", () -> "classpath:db/migration");
        registry.add("spring.jpa.properties.hibernate.default_schema", () -> SCHEMA);
        registry.add("spring.session.redis.namespace", () -> "bookstreet:test:" + SCHEMA);
    }

    private static String databaseUrl() {
        String url = System.getenv("EVENT_TEST_DATABASE_URL");
        if (!url.matches("jdbc:postgresql://[^/]+/[A-Za-z0-9_]+_event_test(?:\\?.*)?")) {
            throw new IllegalStateException("Dashboard tests require a dedicated *_event_test database.");
        }
        return url;
    }

    @AfterAll
    static void dropSchema() throws SQLException {
        try (Connection connection = DriverManager.getConnection(databaseUrl(),
                System.getenv("EVENT_TEST_DATABASE_USER"), System.getenv("EVENT_TEST_DATABASE_PASSWORD"));
                Statement statement = connection.createStatement()) {
            statement.execute("DROP SCHEMA IF EXISTS \"" + SCHEMA + "\" CASCADE");
        }
    }

    @BeforeEach
    void setup() {
        assertThat(jdbc.queryForObject("select current_schema()", String.class)).isEqualTo(SCHEMA);
        jdbc.execute("truncate users, locations restart identity cascade");
    }

    @Test
    void dashboardUsesDurableAggregatesAndVietnameseSevenDayAuditWindow() {
        long partner = user("dashpartner", "ACTIVE", "PARTICIPANT", "PARTNER");
        long admin = user("dashadmin", "DISABLED", "PARTICIPANT", "ADMIN");
        long draft = event(admin, "DRAFT", "Dashboard draft");
        long published = event(admin, "PUBLISHED", "Dashboard published");
        long organization = jdbc.queryForObject("""
                insert into partner_organizations(representative_user_id, name, category_code, status, created_at, updated_at)
                values (?, 'Dashboard Partner', 'PUBLISHER', 'ACTIVE', current_timestamp, current_timestamp)
                returning partner_organization_id
                """, Long.class, partner);
        long application = jdbc.queryForObject("""
                insert into partner_event_applications(partner_organization_id, event_id, status, submitted_at, reviewed_at)
                values (?, ?, 'APPROVED', current_timestamp, current_timestamp) returning application_id
                """, Long.class, organization, published);
        long booth = jdbc.queryForObject("""
                insert into locations(code, name, location_type, max_capacity, is_active, created_at, updated_at)
                values ('DASH01', 'Dashboard Booth', 'BOOTH', 10, true, current_timestamp, current_timestamp)
                returning location_id
                """, Long.class);
        jdbc.update("insert into booths(booth_id, category_code) values (?, 'PUBLISHER')", booth);
        long config = jdbc.queryForObject("""
                insert into event_booth_configs(event_id, booth_id, rental_price, is_enabled)
                values (?, ?, 1500000, true) returning event_booth_config_id
                """, Long.class, published, booth);
        long request = jdbc.queryForObject("""
                insert into booth_requests(application_id, booth_id, status, submitted_at, reviewed_at, selected_at, completed_at)
                values (?, ?, 'COMPLETED', current_timestamp, current_timestamp, current_timestamp, current_timestamp)
                returning booth_request_id
                """, Long.class, application, booth);
        long hold = jdbc.queryForObject("""
                insert into booth_holds(event_booth_config_id, booth_request_id, locked_rental_price, status,
                    created_at, expires_at, consumed_at)
                values (?, ?, 1500000, 'CONSUMED', current_timestamp, current_timestamp + interval '1 day', current_timestamp)
                returning booth_hold_id
                """, Long.class, config, request);
        jdbc.update("insert into booth_assignments(booth_hold_id, qr_token, status, assigned_at) values (?, ?, 'ACTIVE', current_timestamp)",
                hold, UUID.randomUUID());
        jdbc.update("""
                insert into booth_payments(booth_hold_id, transaction_type, purpose, amount, status,
                    idempotency_key, gateway_provider, created_at, updated_at, completed_at)
                values (?, 'PAYMENT', 'INITIAL_BOOTH_RENTAL', 1500000, 'SUCCESS', ?, 'VNPAY',
                    current_timestamp, current_timestamp, current_timestamp)
                """, hold, UUID.randomUUID());
        jdbc.update("""
                insert into admin_audit_logs(actor_user_id, action, target_type, target_id, target_label, details, created_at)
                values (?, 'USER_CREATED', 'USER', ?, 'dashpartner', '{}'::jsonb, current_timestamp)
                """, admin, partner);

        var stats = dashboard.getStats();
        assertThat(stats.accounts().total()).isEqualTo(jdbc.queryForObject("select count(*) from users", Long.class));
        for (RoleCode role : RoleCode.values()) {
            assertThat(stats.accounts().byRole().get(role)).isEqualTo(jdbc.queryForObject("""
                    select count(distinct ur.user_id) from user_roles ur join roles r on r.role_id = ur.role_id
                    where r.code = ?
                    """, Long.class, role.name()));
        }
        for (AccountStatus status : AccountStatus.values()) {
            assertThat(stats.accounts().byStatus().get(status)).isEqualTo(
                    jdbc.queryForObject("select count(*) from users where status = ?", Long.class, status.name()));
        }
        for (EventStatus status : EventStatus.values()) {
            assertThat(stats.events().byStatus().get(status)).isEqualTo(
                    jdbc.queryForObject("select count(*) from events where status = ?", Long.class, status.name()));
        }
        assertThat(stats.activeBoothAssignments()).isOne();
        assertThat(stats.boothRevenue()).isEqualByComparingTo(new BigDecimal("1500000.00"));
        assertThat(stats.auditByDay()).hasSize(7);
        assertThat(stats.auditByDay()).isSortedAccordingTo(java.util.Comparator.comparing(day -> day.date()));
        assertThat(stats.auditByDay().getLast().date()).isEqualTo(LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh")));
        assertThat(stats.auditByDay().getLast().count()).isOne();
        assertThat(draft).isPositive();
    }

    private long user(String username, String status, String... roles) {
        long id = jdbc.queryForObject("""
                insert into users(username, password_hash, full_name, status)
                values (?, 'unused-test-hash', ?, ?) returning user_id
                """, Long.class, username, username, status);
        for (String role : roles) {
            jdbc.update("insert into user_roles(user_id, role_id) select ?, role_id from roles where code = ?", id, role);
        }
        return id;
    }

    private long event(long organizer, String status, String name) {
        return jdbc.queryForObject("""
                insert into events(organizer_user_id, name, start_at, end_at, booth_payment_window_minutes,
                    max_booths_per_partner, max_activities_per_partner, status, created_at, updated_at)
                values (?, ?, current_timestamp + interval '2 days', current_timestamp + interval '3 days',
                    60, 2, 2, ?, current_timestamp, current_timestamp) returning event_id
                """, Long.class, organizer, name, status);
    }
}
