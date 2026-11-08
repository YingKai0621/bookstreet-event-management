package com.swp391.bookstreet.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.swp391.bookstreet.admin.dto.AdminPartnerOrganizationStatusRequest;
import com.swp391.bookstreet.admin.service.AdminPartnerOrganizationService;
import com.swp391.bookstreet.security.authentication.AuthenticatedPrincipal;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest
@EnabledIfEnvironmentVariable(named = "EVENT_TEST_DATABASE_URL", matches = ".+")
class AdminPartnerOrganizationIntegrationTests {
    private static final String SCHEMA = "s11org_" + UUID.randomUUID().toString().replace("-", "");
    private static final String BASE = "/api/v1/admin/partner-organizations";
    private static final String REASON = "Đơn vị vi phạm quy định trưng bày.";

    @Autowired WebApplicationContext context;
    @Autowired JdbcTemplate jdbc;
    @Autowired AdminPartnerOrganizationService service;

    private MockMvc mvc;
    private long actorId;
    private long representativeId;
    private long organizationId;

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
            throw new IllegalStateException("Organization tests require a dedicated *_event_test database.");
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
        jdbc.execute("truncate users restart identity cascade");
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        actorId = user("admin", "Quản trị viên", "ADMIN");
        representativeId = user("partner", "Nguyễn Văn A", "PARTNER");
        organizationId = jdbc.queryForObject("""
                insert into partner_organizations(
                    representative_user_id, name, description, category_code, contact_email,
                    status, created_at, updated_at)
                values (?, 'Nhà sách Mộc Miên', 'Đơn vị phát hành', 'PUBLISHER',
                    'mocmien@example.test', 'ACTIVE', current_timestamp, current_timestamp)
                returning partner_organization_id
                """, Long.class, representativeId);
    }

    @AfterEach
    void clearAuthentication() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void listDetailAndStatusCommandUseTheContractAndWriteOneAuditRow() throws Exception {
        mvc.perform(get(BASE).param("search", "partner").param("status", "ACTIVE")
                        .with(authentication(auth(actorId))))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].name").value("Nhà sách Mộc Miên"))
                .andExpect(jsonPath("$.content[0].representative.username").value("partner"))
                .andExpect(jsonPath("$.content[0].representative.hasPartnerRole").value(true));

        mvc.perform(get(BASE + "/" + organizationId).with(authentication(auth(actorId))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.description").value("Đơn vị phát hành"));

        mvc.perform(patch(BASE + "/" + organizationId + "/status")
                        .with(authentication(auth(actorId))).with(csrf())
                        .contentType("application/json")
                        .content("{\"status\":\"INACTIVE\",\"reason\":\"%s\"}".formatted(REASON)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("INACTIVE"));

        assertThat(jdbc.queryForObject("""
                select count(*) from admin_audit_logs
                where action = 'ORGANIZATION_LOCKED' and target_id = ? and reason = ?
                """, Long.class, organizationId, REASON)).isOne();

        // Repeating the state is idempotent and creates no second audit row.
        mvc.perform(patch(BASE + "/" + organizationId + "/status")
                        .with(authentication(auth(actorId))).with(csrf())
                        .contentType("application/json")
                        .content("{\"status\":\"INACTIVE\",\"reason\":\"%s\"}".formatted(REASON)))
                .andExpect(status().isOk());
        assertThat(jdbc.queryForObject("select count(*) from admin_audit_logs where target_id = ?", Long.class,
                organizationId)).isOne();
    }

    @Test
    void invalidFiltersReasonsAndUnlockWithoutPartnerRoleAreRejected() throws Exception {
        mvc.perform(get(BASE).param("status", "LOCKED").with(authentication(auth(actorId))))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_FILTER"));
        mvc.perform(patch(BASE + "/" + organizationId + "/status")
                        .with(authentication(auth(actorId))).with(csrf())
                        .contentType("application/json").content("{\"status\":\"INACTIVE\",\"reason\":\"ngắn\"}"))
                .andExpect(status().isUnprocessableContent()).andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));

        authenticate(actorId);
        service.changeStatus(String.valueOf(organizationId), new AdminPartnerOrganizationStatusRequest("INACTIVE", REASON));
        jdbc.update("delete from user_roles where user_id = ? and role_id = (select role_id from roles where code = 'PARTNER')",
                representativeId);
        mvc.perform(patch(BASE + "/" + organizationId + "/status")
                        .with(authentication(auth(actorId))).with(csrf())
                        .contentType("application/json")
                        .content("{\"status\":\"ACTIVE\",\"reason\":\"Khôi phục sau khi đã hoàn tất xử lý.\"}"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("PARTNER_ROLE_REQUIRED"));
        assertThat(jdbc.queryForObject("select status from partner_organizations where partner_organization_id = ?",
                String.class, organizationId)).isEqualTo("INACTIVE");
    }

    @Test
    void auditFailureRollsBackOrganizationStatus() {
        authenticate(Long.MAX_VALUE);

        assertThatThrownBy(() -> service.changeStatus(String.valueOf(organizationId),
                new AdminPartnerOrganizationStatusRequest("INACTIVE", REASON)))
                .isInstanceOf(DataIntegrityViolationException.class);
        assertThat(jdbc.queryForObject("select status from partner_organizations where partner_organization_id = ?",
                String.class, organizationId)).isEqualTo("ACTIVE");
    }

    private long user(String username, String fullName, String role) {
        long id = jdbc.queryForObject("""
                insert into users(username, password_hash, full_name, email, email_verified_at, status)
                values (?, 'unused-test-hash', ?, ? || '@example.test', current_timestamp, 'ACTIVE')
                returning user_id
                """, Long.class, username, fullName, username);
        jdbc.update("insert into user_roles(user_id, role_id) select ?, role_id from roles where code = ?", id, role);
        return id;
    }

    private static UsernamePasswordAuthenticationToken auth(long userId) {
        return UsernamePasswordAuthenticationToken.authenticated(new Principal(userId), null,
                List.of(new SimpleGrantedAuthority("ROLE_ADMIN")));
    }

    private static void authenticate(long userId) {
        SecurityContextHolder.getContext().setAuthentication(auth(userId));
    }

    private record Principal(Long userId) implements AuthenticatedPrincipal {
        @Override public boolean emailVerified() { return true; }
    }
}
