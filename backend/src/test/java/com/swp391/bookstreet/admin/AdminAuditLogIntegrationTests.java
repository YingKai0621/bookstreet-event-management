package com.swp391.bookstreet.admin;

import com.swp391.bookstreet.admin.entity.AdminAuditAction;
import com.swp391.bookstreet.admin.service.AdminAuditWriter;
import com.swp391.bookstreet.security.authentication.AuthenticatedPrincipal;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContextInitializer;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.test.context.TestSecurityContextHolder;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.IllegalTransactionStateException;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.context.WebApplicationContext;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
        "spring.datasource.url=${EVENT_TEST_DATABASE_URL}",
        "logging.level.root=ERROR"
})
@EnabledIfEnvironmentVariable(named = "EVENT_TEST_DATABASE_URL", matches = ".+")
@ContextConfiguration(initializers = AdminAuditLogIntegrationTests.TestDatabaseGuard.class)
class AdminAuditLogIntegrationTests {
    static class TestDatabaseGuard
            implements ApplicationContextInitializer<ConfigurableApplicationContext> {
        @Override
        public void initialize(ConfigurableApplicationContext context) {
            String url = context.getEnvironment().getRequiredProperty("spring.datasource.url");
            if (!url.matches("jdbc:postgresql://[^/]+/[A-Za-z0-9_]+_event_test(?:\\?.*)?")) {
                throw new IllegalStateException("Audit tests require a *_event_test database.");
            }
        }
    }

    private static final String AUDIT_LOGS = "/api/v1/admin/audit-logs";

    @Autowired WebApplicationContext context;
    @Autowired JdbcTemplate jdbc;
    @Autowired AdminAuditWriter writer;
    @Autowired TransactionTemplate transactions;

    private MockMvc mvc;
    private long adminId;
    private long otherAdminId;

    @BeforeEach
    void setup() {
        assertThat(jdbc.queryForObject("select current_database()", String.class)).endsWith("_event_test");
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        adminId = insertUser("auditadmin");
        otherAdminId = insertUser("auditother");
    }

    @AfterEach
    void cleanup() {
        SecurityContextHolder.clearContext();
        TestSecurityContextHolder.clearContext();
        jdbc.update("delete from admin_audit_logs where actor_user_id in (?, ?)", adminId, otherAdminId);
        jdbc.update("delete from users where user_id in (?, ?)", adminId, otherAdminId);
    }

    @Test
    void writerRecordsTheSessionActorInsideTheChangeTransaction() {
        signIn(adminId);
        write(AdminAuditAction.USER_LOCKED, 42, "mocmien01", "Tài khoản có dấu hiệu lạm dụng.",
                Map.of("from", "ACTIVE", "to", "DISABLED"));

        var row = jdbc.queryForMap("select * from admin_audit_logs where actor_user_id = ?", adminId);
        assertThat(row.get("action")).isEqualTo("USER_LOCKED");
        assertThat(row.get("target_type")).isEqualTo("USER");
        assertThat(row.get("target_id")).isEqualTo(42L);
        assertThat(row.get("target_label")).isEqualTo("mocmien01");
        assertThat(row.get("reason")).isEqualTo("Tài khoản có dấu hiệu lạm dụng.");
        assertThat(row.get("created_at")).isNotNull();
        assertThat(row.get("details").toString()).contains("DISABLED");
    }

    @Test
    void writerCannotRunOutsideATransaction() {
        signIn(adminId);
        assertThatThrownBy(() -> writer.write(AdminAuditAction.USER_UPDATED, 1L, "x", null, Map.of()))
                .isInstanceOf(IllegalTransactionStateException.class);
        assertThat(auditRows()).isZero();
    }

    @Test
    void aRolledBackChangeLeavesNoAuditRow() {
        signIn(adminId);
        transactions.executeWithoutResult(status -> {
            writer.write(AdminAuditAction.USER_UPDATED, 1L, "x", null, Map.of());
            status.setRollbackOnly();
        });
        assertThat(auditRows()).isZero();
    }

    @Test
    void aFailedAuditWriteRollsBackTheChange() {
        signIn(adminId);
        assertThatThrownBy(() -> transactions.executeWithoutResult(status -> {
            jdbc.update("update users set phone_number = '0900000000' where user_id = ?", otherAdminId);
            writer.write(AdminAuditAction.USER_LOCKED, 1L, "   ", "A valid reason text", Map.of());
        })).isNotNull();

        assertThat(jdbc.queryForObject("select phone_number from users where user_id = ?",
                String.class, otherAdminId)).isNull();
        assertThat(auditRows()).isZero();
    }

    @Test
    void writerRejectsAMissingOrUnexpectedReason() {
        signIn(adminId);
        assertThatThrownBy(() -> transactions.executeWithoutResult(status ->
                writer.write(AdminAuditAction.USER_LOCKED, 1L, "x", null, Map.of())))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> transactions.executeWithoutResult(status ->
                writer.write(AdminAuditAction.USER_UPDATED, 1L, "x", "A valid reason text", Map.of())))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void writerRequiresAnAuthenticatedActor() {
        assertThatThrownBy(() -> transactions.executeWithoutResult(status ->
                writer.write(AdminAuditAction.USER_UPDATED, 1L, "x", null, Map.of())))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void listIsNewestFirstAndFiltersByEveryField() throws Exception {
        long older = insertRow(adminId, "USER_UPDATED", "USER", 7, "2026-11-01T02:00:00Z");
        long newer = insertRow(adminId, "BADGE_CREATED", "BADGE", 8, "2026-11-03T02:00:00Z");
        long other = insertRow(otherAdminId, "USER_CREATED", "USER", 9, "2026-11-02T02:00:00Z");

        mvc.perform(get(AUDIT_LOGS).param("size", "100").with(admin()))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", containsString("no-store")))
                .andExpect(jsonPath("$.content[0].auditLogId").value(newer))
                .andExpect(jsonPath("$.content[0].actor.userId").value(adminId))
                .andExpect(jsonPath("$.content[1].auditLogId").value(other))
                .andExpect(jsonPath("$.content[2].auditLogId").value(older));

        expectOnly(newer, "actorUserId", String.valueOf(adminId), "action", "BADGE_CREATED");
        expectOnly(older, "actorUserId", String.valueOf(adminId), "targetType", "USER");
        expectOnly(other, "targetType", "USER", "targetId", "9");
        expectOnly(older, "actorUserId", String.valueOf(adminId), "to", "2026-11-01");
        expectOnly(newer, "actorUserId", String.valueOf(adminId), "from", "2026-11-02");
    }

    @Test
    void dateFiltersUseTheBusinessTimeZone() throws Exception {
        long lateEvening = insertRow(adminId, "USER_UPDATED", "USER", 1, "2026-11-01T16:59:59Z");
        long nextDay = insertRow(adminId, "USER_UPDATED", "USER", 2, "2026-11-01T17:00:00Z");

        expectOnly(lateEvening, "actorUserId", String.valueOf(adminId), "from", "2026-11-01", "to", "2026-11-01");
        expectOnly(nextDay, "actorUserId", String.valueOf(adminId), "from", "2026-11-02", "to", "2026-11-02");
    }

    @Test
    void unsupportedQueryValuesAreRejected() throws Exception {
        for (String[] query : List.of(
                new String[] {"page", "-1"},
                new String[] {"page", "abc"},
                new String[] {"size", "0"},
                new String[] {"size", "101"},
                new String[] {"action", "SOMETHING"},
                new String[] {"targetType", "EVENT"},
                new String[] {"actorUserId", "0"},
                new String[] {"targetId", "9"},
                new String[] {"from", "01/11/2026"})) {
            mvc.perform(get(AUDIT_LOGS).param(query[0], query[1]).with(admin()))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("INVALID_FILTER"));
        }
        mvc.perform(get(AUDIT_LOGS).param("from", "2026-11-02").param("to", "2026-11-01").with(admin()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_FILTER"));
    }

    @Test
    void onlyAdminCanReadAndNothingCanDelete() throws Exception {
        mvc.perform(get(AUDIT_LOGS)).andExpect(status().isUnauthorized());
        mvc.perform(get(AUDIT_LOGS).with(identity("ORGANIZER"))).andExpect(status().isForbidden());
        mvc.perform(delete(AUDIT_LOGS + "/1").with(admin()).with(csrf()))
                .andExpect(result -> assertThat(result.getResponse().getStatus()).isIn(404, 405));
    }

    private void expectOnly(long id, String... query) throws Exception {
        var request = get(AUDIT_LOGS).param("size", "100").with(admin());
        for (int i = 0; i < query.length; i += 2) {
            request = request.param(query[i], query[i + 1]);
        }
        mvc.perform(request)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].auditLogId").value(id));
    }

    private void write(AdminAuditAction action, long target, String label, String reason, Map<String, Object> details) {
        transactions.executeWithoutResult(status -> writer.write(action, target, label, reason, details));
    }

    private int auditRows() {
        return jdbc.queryForObject("select count(*) from admin_audit_logs where actor_user_id in (?, ?)",
                Integer.class, adminId, otherAdminId);
    }

    private long insertRow(long actor, String action, String targetType, long targetId, String createdAt) {
        return jdbc.queryForObject("""
                insert into admin_audit_logs(actor_user_id, action, target_type, target_id, target_label, created_at)
                values (?, ?, ?, ?, 'label', ?) returning audit_log_id
                """, Long.class, actor, action, targetType, targetId, Timestamp.from(Instant.parse(createdAt)));
    }

    private long insertUser(String prefix) {
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 10);
        return jdbc.queryForObject("""
                insert into users(username, password_hash, full_name, email, email_verified_at, status)
                values (?, '{noop}unused', 'Audit Test User', ?, current_timestamp, 'ACTIVE')
                returning user_id
                """, Long.class, prefix + suffix, prefix + suffix + "@example.test");
    }

    private void signIn(long userId) {
        SecurityContextHolder.getContext().setAuthentication(token(userId, "ADMIN"));
    }

    private RequestPostProcessor admin() {
        return authentication(token(adminId, "ADMIN"));
    }

    private RequestPostProcessor identity(String role) {
        return authentication(token(adminId, role));
    }

    private static UsernamePasswordAuthenticationToken token(long userId, String role) {
        return UsernamePasswordAuthenticationToken.authenticated(new Identity(userId, true), null,
                List.of(new SimpleGrantedAuthority("ROLE_" + role)));
    }

    record Identity(Long userId, boolean emailVerified) implements AuthenticatedPrincipal {
    }
}
