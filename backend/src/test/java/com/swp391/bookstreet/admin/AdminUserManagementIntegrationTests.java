package com.swp391.bookstreet.admin;

import com.swp391.bookstreet.admin.dto.AdminStatusUpdateRequest;
import com.swp391.bookstreet.admin.service.AdminUserService;
import com.swp391.bookstreet.common.exception.ApiException;
import com.swp391.bookstreet.security.authentication.AuthenticatedPrincipal;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContextInitializer;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.test.context.TestSecurityContextHolder;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.clearInvocations;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Sprint 11 UC-A01 and UC-A02: AC-A01-S11-01 to 06 and AC-A02-S11-01, 02, 04, 05 on a real database. */
@SpringBootTest(properties = {
        "spring.datasource.url=${EVENT_TEST_DATABASE_URL}",
        "logging.level.root=ERROR"
})
@EnabledIfEnvironmentVariable(named = "EVENT_TEST_DATABASE_URL", matches = ".+")
@ContextConfiguration(initializers = AdminUserManagementIntegrationTests.TestDatabaseGuard.class)
class AdminUserManagementIntegrationTests {
    static class TestDatabaseGuard
            implements ApplicationContextInitializer<ConfigurableApplicationContext> {
        @Override
        public void initialize(ConfigurableApplicationContext context) {
            String url = context.getEnvironment().getRequiredProperty("spring.datasource.url");
            if (!url.matches("jdbc:postgresql://[^/]+/[A-Za-z0-9_]+_event_test(?:\\?.*)?")) {
                throw new IllegalStateException("Admin user tests require a *_event_test database.");
            }
        }
    }

    private static final String USERS = "/api/v1/admin/users";
    private static final String REASON = "Tài khoản có dấu hiệu bị lạm dụng.";

    @Autowired WebApplicationContext context;
    @Autowired JdbcTemplate jdbc;
    @Autowired AdminUserService service;
    @MockitoBean JavaMailSender mailSender;

    private MockMvc mvc;
    private String prefix;
    private long actorId;
    private final List<Long> created = new ArrayList<>();
    private List<Long> parkedAdmins = List.of();

    @BeforeEach
    void setup() {
        assertThat(jdbc.queryForObject("select current_database()", String.class)).endsWith("_event_test");
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        prefix = "u" + UUID.randomUUID().toString().replace("-", "").substring(0, 8);
        actorId = insertUser("actor", true, "ACTIVE", "ADMIN");
    }

    @AfterEach
    void cleanup() {
        SecurityContextHolder.clearContext();
        TestSecurityContextHolder.clearContext();
        created.addAll(jdbc.queryForList("select user_id from users where username ilike ?", Long.class, prefix + "%"));
        for (Long id : created) {
            jdbc.update("delete from admin_audit_logs where actor_user_id = ? or (target_type = 'USER' and target_id = ?)",
                    id, id);
            jdbc.update("delete from user_tokens where user_id = ?", id);
            jdbc.update("delete from events where organizer_user_id = ?", id);
            jdbc.update("delete from partner_organizations where representative_user_id = ?", id);
            jdbc.update("delete from user_roles where user_id = ?", id);
            jdbc.update("delete from users where user_id = ?", id);
        }
        parkedAdmins.forEach(id -> jdbc.update("update users set status = 'ACTIVE' where user_id = ?", id));
    }

    // ---- AC-A01-S11-02, 03 -------------------------------------------------------------------------------

    @Test
    void createMakesAnActiveParticipantWithAnUnverifiedEmailAndIgnoresRoleAndStatus() throws Exception {
        String username = prefix + "new";
        perform(post(USERS), """
                {"username":"%s","fullName":"  Nguyễn   Văn A ","password":"Secret123!","confirmPassword":"Secret123!",
                 "email":"%s@example.test","phone":"0900000000","role":"ADMIN","status":"DISABLED"}
                """.formatted(username, username))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.username").value(username))
                .andExpect(jsonPath("$.fullName").value("Nguyễn Văn A"))
                .andExpect(jsonPath("$.emailVerified").value(false))
                .andExpect(jsonPath("$.phone").value("0900000000"))
                .andExpect(jsonPath("$.roles.length()").value(1))
                .andExpect(jsonPath("$.roles[0]").value("PARTICIPANT"))
                .andExpect(jsonPath("$.status").value("ACTIVE"))
                .andExpect(jsonPath("$.passwordHash").doesNotExist());

        var row = jdbc.queryForMap("select * from users where username = ?", username);
        assertThat(row.get("email_verified_at")).isNull();
        assertThat(row.get("password_hash").toString()).startsWith("$2").doesNotContain("Secret123!");
        long userId = (Long) row.get("user_id");
        assertThat(audit(userId, "USER_CREATED")).isOne();
        assertThat(jdbc.queryForObject("select details::text from admin_audit_logs where target_id = ?",
                String.class, userId)).contains("PARTICIPANT");
        assertThat(jdbc.queryForObject(
                "select count(*) from user_tokens where user_id = ? and token_type = 'EMAIL_VERIFICATION'",
                Integer.class, userId)).isOne();
        verify(mailSender).send(any(SimpleMailMessage.class));
    }

    @Test
    void createRejectsInvalidInputAndDuplicates() throws Exception {
        String existing = prefix + "dup";
        insertNamed(existing, true, "ACTIVE");

        perform(post(USERS), """
                {"username":"%sx","fullName":"Nguyễn Văn A"}
                """.formatted(prefix))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
        perform(post(USERS), body(prefix + "x", "Secret123!", "Other1234!", null))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.code").value("PASSWORD_CONFIRMATION_MISMATCH"));
        perform(post(USERS), body("1" + prefix, "Secret123!", "Secret123!", null))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
        perform(post(USERS), body(existing.toUpperCase(), "Secret123!", "Secret123!", null))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("USERNAME_ALREADY_EXISTS"));
        perform(post(USERS), body(prefix + "y", "Secret123!", "Secret123!", existing.toUpperCase() + "@EXAMPLE.TEST"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("EMAIL_ALREADY_EXISTS"));
        perform(post(USERS), "{not json")
                .andExpect(status().isUnprocessableContent());

        // Only the acting Admin and the existing duplicate: no rejected command created an account.
        assertThat(jdbc.queryForObject("select count(*) from users where username ilike ?", Integer.class,
                prefix + "%")).isEqualTo(2);
        verify(mailSender, never()).send(any(SimpleMailMessage.class));
    }

    // ---- AC-A01-S11-01 -----------------------------------------------------------------------------------

    @Test
    void listIsPagedAndFiltersBySearchRoleAndStatus() throws Exception {
        long organizer = insertUser("org", true, "ACTIVE", "ORGANIZER");
        long locked = insertUser("lock", true, "DISABLED");

        mvc.perform(get(USERS).param("search", prefix.toUpperCase()).param("sort", "username,asc").with(admin()))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", containsString("no-store")))
                .andExpect(jsonPath("$.totalElements").value(3))
                .andExpect(jsonPath("$.page").value(0))
                .andExpect(jsonPath("$.size").value(20))
                .andExpect(jsonPath("$.content[0].username").value(prefix + "actor"))
                .andExpect(jsonPath("$.content[0].roles[0]").value("PARTICIPANT"))
                .andExpect(jsonPath("$.content[0].roles[1]").value("ADMIN"));

        mvc.perform(get(USERS).param("search", prefix).param("role", "ORGANIZER").with(admin()))
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].userId").value(organizer));
        mvc.perform(get(USERS).param("search", prefix).param("status", "DISABLED").with(admin()))
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].userId").value(locked))
                .andExpect(jsonPath("$.content[0].status").value("DISABLED"));
        mvc.perform(get(USERS).param("search", prefix).param("size", "1").param("page", "2").with(admin()))
                .andExpect(jsonPath("$.content.length()").value(1))
                .andExpect(jsonPath("$.totalPages").value(3));
        mvc.perform(get(USERS).param("search", prefix + "%").with(admin()))
                .andExpect(jsonPath("$.totalElements").value(0));

        mvc.perform(get(USERS).param("sort", "fullName,asc").with(admin()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_SORT"));
        for (String[] query : List.of(new String[] {"role", "participant"}, new String[] {"status", "locked"},
                new String[] {"size", "101"}, new String[] {"search", "x".repeat(101)})) {
            mvc.perform(get(USERS).param(query[0], query[1]).with(admin()))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("INVALID_FILTER"));
        }
        mvc.perform(get(USERS + "/" + organizer).with(admin()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.roles[1]").value("ORGANIZER"));
        mvc.perform(get(USERS + "/abc").with(admin()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("ADMIN_USER_NOT_FOUND"));
    }

    @Test
    void onlyAdminCanUseTheseOperations() throws Exception {
        mvc.perform(get(USERS)).andExpect(status().isUnauthorized());
        mvc.perform(get(USERS).with(identity("ORGANIZER"))).andExpect(status().isForbidden());
        mvc.perform(put(USERS + "/" + actorId + "/roles/PARTNER").with(admin()))
                .andExpect(status().isForbidden());
    }

    // ---- AC-A01-S11-04 -----------------------------------------------------------------------------------

    @Test
    void updateChangesOnlyAllowedFieldsAndAuditsFieldNames() throws Exception {
        long target = insertUser("edit", false, "ACTIVE");
        jdbc.update("update users set phone_number = '0900000000' where user_id = ?", target);

        perform(patch(USERS + "/" + target), """
                {"fullName":"Trần  Thị B","phone":"  ","role":"ADMIN","status":"DISABLED"}
                """)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.fullName").value("Trần Thị B"))
                .andExpect(jsonPath("$.phone").doesNotExist())
                .andExpect(jsonPath("$.status").value("ACTIVE"))
                .andExpect(jsonPath("$.roles.length()").value(1));
        assertThat(jdbc.queryForObject(
                "select details::text from admin_audit_logs where target_id = ? and action = 'USER_UPDATED'",
                String.class, target)).contains("fullName", "phone").doesNotContain("Trần");

        perform(patch(USERS + "/" + target), "{\"fullName\":\"Trần Thị B\"}").andExpect(status().isOk());
        assertThat(audit(target, "USER_UPDATED")).isOne();
    }

    @Test
    void changingAnUnverifiedEmailReplacesItsVerificationToken() throws Exception {
        long target = insertUser("mail", false, "ACTIVE");
        jdbc.update("""
                insert into user_tokens(user_id, token_type, token_hash, created_at, expires_at)
                values (?, 'EMAIL_VERIFICATION', ?, current_timestamp - interval '2 minutes',
                        current_timestamp + interval '1 hour')
                """, target, "hash-" + prefix);

        perform(patch(USERS + "/" + target), "{\"email\":\"" + prefix + "next@example.test\"}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value(prefix + "next@example.test"))
                .andExpect(jsonPath("$.emailVerified").value(false));

        assertThat(jdbc.queryForObject(
                "select revoked_at from user_tokens where token_hash = ?", Timestamp.class, "hash-" + prefix))
                .isNotNull();
        assertThat(jdbc.queryForObject("""
                select count(*) from user_tokens
                where user_id = ? and token_type = 'EMAIL_VERIFICATION' and revoked_at is null and used_at is null
                """, Integer.class, target)).isOne();
        verify(mailSender).send(any(SimpleMailMessage.class));
    }

    @Test
    void updateRejectsSelfVerifiedEmailDuplicatesAndUnknownAccounts() throws Exception {
        long verified = insertUser("ver", true, "ACTIVE");
        long other = insertUser("oth", false, "ACTIVE");

        perform(patch(USERS + "/" + actorId), "{\"fullName\":\"Tự Sửa\"}")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("ADMIN_SELF_UPDATE_NOT_ALLOWED"));
        perform(patch(USERS + "/" + verified), "{\"email\":\"" + prefix + "z@example.test\"}")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("VERIFIED_EMAIL_LOCKED"));
        perform(patch(USERS + "/" + other), "{\"email\":\"" + prefix + "VER@example.test\"}")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("EMAIL_ALREADY_EXISTS"));
        perform(patch(USERS + "/" + other), "{\"fullName\":\"A\"}")
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
        perform(patch(USERS + "/999999999"), "{\"fullName\":\"Không Có\"}")
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("ADMIN_USER_NOT_FOUND"));
        perform(patch(USERS + "/-1"), "{\"fullName\":\"Không Có\"}")
                .andExpect(status().isNotFound());

        assertThat(jdbc.queryForObject("select count(*) from admin_audit_logs where actor_user_id = ?",
                Integer.class, actorId)).isZero();
    }

    // ---- AC-A01-S11-05, 06 -------------------------------------------------------------------------------

    @Test
    void lockAndUnlockNeedAnExactStatusAndAReason() throws Exception {
        long target = insertUser("lk", true, "ACTIVE");

        changeStatus(target, "locked", REASON).andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
        changeStatus(target, "disabled", REASON).andExpect(status().isUnprocessableContent());
        changeStatus(target, "DISABLED", "   ngắn    ").andExpect(status().isUnprocessableContent());
        changeStatus(target, "DISABLED", null).andExpect(status().isUnprocessableContent());
        assertThat(audit(target, "USER_LOCKED")).isZero();

        Instant before = Instant.now().truncatedTo(ChronoUnit.MILLIS);
        changeStatus(target, "DISABLED", "  " + REASON + "  ").andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("DISABLED"));
        var row = jdbc.queryForMap("select status, sessions_valid_from from users where user_id = ?", target);
        assertThat(row.get("status")).isEqualTo("DISABLED");
        assertThat(((Timestamp) row.get("sessions_valid_from")).toInstant()).isAfterOrEqualTo(before.minusSeconds(1));
        assertThat(jdbc.queryForObject("select reason from admin_audit_logs where target_id = ? and action = 'USER_LOCKED'",
                String.class, target)).isEqualTo(REASON);

        changeStatus(target, "DISABLED", REASON).andExpect(status().isOk());
        assertThat(audit(target, "USER_LOCKED")).isOne();

        changeStatus(target, "ACTIVE", "Đã xác minh lại chủ tài khoản.").andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ACTIVE"));
        assertThat(audit(target, "USER_UNLOCKED")).isOne();
    }

    @Test
    void adminCannotLockThemselvesOrTheLastActiveAdmin() throws Exception {
        changeStatus(actorId, "DISABLED", REASON).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("ADMIN_SELF_LOCK_NOT_ALLOWED"));

        parkOtherAdminsThan(-1L);
        long lastAdmin = insertUser("last", true, "ACTIVE", "ADMIN");
        changeStatus(lastAdmin, "DISABLED", REASON).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("LAST_ACTIVE_ADMIN_REQUIRED"));
        assertThat(jdbc.queryForObject("select status from users where user_id = ?", String.class, lastAdmin))
                .isEqualTo("ACTIVE");
    }

    @Test
    void concurrentLocksCannotLeaveTheSystemWithoutAnActiveAdmin() throws Exception {
        parkOtherAdminsThan(-1L);
        long first = insertUser("cfa", true, "ACTIVE", "ADMIN");
        long second = insertUser("cfb", true, "ACTIVE", "ADMIN");
        long firstActor = insertUser("cfx", true, "ACTIVE");
        long secondActor = insertUser("cfy", true, "ACTIVE");
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);

        try (ExecutorService executor = Executors.newFixedThreadPool(2)) {
            Future<Boolean> lockFirst = executor.submit(() -> lockAs(firstActor, first, ready, start));
            Future<Boolean> lockSecond = executor.submit(() -> lockAs(secondActor, second, ready, start));
            ready.await();
            start.countDown();
            assertThat(List.of(lockFirst.get(), lockSecond.get())).containsExactlyInAnyOrder(true, false);
        }
        assertThat(jdbc.queryForObject("select count(*) from users where user_id in (?, ?) and status = 'ACTIVE'",
                Integer.class, first, second)).isOne();
    }

    // ---- AC-A02-S11-01, 02 -------------------------------------------------------------------------------

    @Test
    void assignAddsOnlyManageableRolesToActiveVerifiedAccounts() throws Exception {
        long target = insertUser("asg", true, "ACTIVE");
        long unverified = insertUser("unv", false, "ACTIVE");
        long locked = insertUser("dis", true, "DISABLED");

        role(put(USERS + "/" + target + "/roles/PARTICIPANT")).andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.code").value("ROLE_NOT_MANAGEABLE"));
        role(put(USERS + "/" + target + "/roles/organizer")).andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.code").value("ROLE_NOT_MANAGEABLE"));
        role(put(USERS + "/" + unverified + "/roles/PARTNER")).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("VERIFIED_EMAIL_REQUIRED"));
        role(put(USERS + "/" + locked + "/roles/PARTNER")).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("TARGET_ACCOUNT_NOT_ACTIVE"));
        role(put(USERS + "/999999999/roles/PARTNER")).andExpect(status().isNotFound());

        role(put(USERS + "/" + target + "/roles/ORGANIZER")).andExpect(status().isOk())
                .andExpect(jsonPath("$.roles[1]").value("ORGANIZER"));
        role(put(USERS + "/" + target + "/roles/ORGANIZER")).andExpect(status().isOk());
        assertThat(audit(target, "ROLE_ASSIGNED")).isOne();
        assertThat(jdbc.queryForObject("select details::text from admin_audit_logs where target_id = ?",
                String.class, target)).contains("ORGANIZER");
    }

    // ---- AC-A02-S11-01, 04, 05 ---------------------------------------------------------------------------

    @Test
    void removeDeletesTheRoleAndAuditsIt() throws Exception {
        long target = insertUser("rmv", true, "ACTIVE", "PARTNER");

        role(delete(USERS + "/" + target + "/roles/PARTNER")).andExpect(status().isOk())
                .andExpect(jsonPath("$.roles.length()").value(1));
        role(delete(USERS + "/" + target + "/roles/PARTNER")).andExpect(status().isOk());
        assertThat(audit(target, "ROLE_REMOVED")).isOne();
        assertThat(jdbc.queryForObject("""
                select count(*) from user_roles ur join roles r on r.role_id = ur.role_id
                where ur.user_id = ? and r.code = 'PARTNER'
                """, Integer.class, target)).isZero();
    }

    @Test
    void removeIsBlockedByOpenEventsAnActiveOrganizationAndTheAdminGuards() throws Exception {
        long organizer = insertUser("own", true, "ACTIVE", "ORGANIZER");
        long eventId = insertEvent(organizer, "DRAFT");
        role(delete(USERS + "/" + organizer + "/roles/ORGANIZER")).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("ORGANIZER_OWNS_OPEN_EVENTS"));
        jdbc.update("update events set status = 'COMPLETED' where event_id = ?", eventId);
        role(delete(USERS + "/" + organizer + "/roles/ORGANIZER")).andExpect(status().isOk());
        assertThat(jdbc.queryForObject("select organizer_user_id from events where event_id = ?", Long.class, eventId))
                .isEqualTo(organizer);

        long partner = insertUser("rep", true, "ACTIVE", "PARTNER");
        long organizationId = insertOrganization(partner, "ACTIVE");
        role(delete(USERS + "/" + partner + "/roles/PARTNER")).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PARTNER_ORGANIZATION_ACTIVE"));
        jdbc.update("update partner_organizations set status = 'INACTIVE' where partner_organization_id = ?",
                organizationId);
        role(delete(USERS + "/" + partner + "/roles/PARTNER")).andExpect(status().isOk());

        role(delete(USERS + "/" + actorId + "/roles/ADMIN")).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("ADMIN_SELF_ROLE_REMOVAL_NOT_ALLOWED"));
        parkOtherAdminsThan(-1L);
        long lastAdmin = insertUser("only", true, "ACTIVE", "ADMIN");
        role(delete(USERS + "/" + lastAdmin + "/roles/ADMIN")).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("LAST_ACTIVE_ADMIN_REQUIRED"));
        role(delete(USERS + "/" + lastAdmin + "/roles/PARTICIPANT")).andExpect(status().isUnprocessableContent());

        assertThat(audit(lastAdmin, "ROLE_REMOVED")).isZero();
    }

    // ---- helpers -----------------------------------------------------------------------------------------

    private boolean lockAs(long actor, long target, CountDownLatch ready, CountDownLatch start)
            throws InterruptedException {
        ready.countDown();
        start.await();
        SecurityContextHolder.getContext().setAuthentication(token(actor, "ADMIN"));
        try {
            service.updateStatus(actor, String.valueOf(target), new AdminStatusUpdateRequest("DISABLED", REASON));
            return true;
        } catch (ApiException rejected) {
            return false;
        } finally {
            SecurityContextHolder.clearContext();
        }
    }

    private ResultActions perform(MockHttpServletRequestBuilder request, String json) throws Exception {
        return mvc.perform(request.with(admin()).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(json));
    }

    private ResultActions changeStatus(long target, String status, String reason) throws Exception {
        String reasonJson = reason == null ? "null" : "\"" + reason + "\"";
        return perform(patch(USERS + "/" + target + "/status"),
                "{\"status\":\"" + status + "\",\"reason\":" + reasonJson + "}");
    }

    private ResultActions role(MockHttpServletRequestBuilder request) throws Exception {
        return mvc.perform(request.with(admin()).with(csrf()));
    }

    private static String body(String username, String password, String confirm, String email) {
        return """
                {"username":"%s","fullName":"Nguyễn Văn A","password":"%s","confirmPassword":"%s"%s}
                """.formatted(username, password, confirm, email == null ? "" : ",\"email\":\"" + email + "\"");
    }

    private int audit(long target, String action) {
        return jdbc.queryForObject(
                "select count(*) from admin_audit_logs where target_type = 'USER' and target_id = ? and action = ?",
                Integer.class, target, action);
    }

    private void parkOtherAdminsThan(long keep) {
        parkedAdmins = jdbc.queryForList("""
                select u.user_id from users u
                join user_roles ur on ur.user_id = u.user_id
                join roles r on r.role_id = ur.role_id
                where r.code = 'ADMIN' and u.status = 'ACTIVE' and u.email_verified_at is not null and u.user_id <> ?
                """, Long.class, keep);
        parkedAdmins.forEach(id -> jdbc.update("update users set status = 'DISABLED' where user_id = ?", id));
    }

    private long insertUser(String suffix, boolean verified, String accountStatus, String... roles) {
        long id = insertNamed(prefix + suffix, verified, accountStatus);
        jdbc.update("insert into user_roles(user_id, role_id) select ?, role_id from roles where code = 'PARTICIPANT'", id);
        for (String role : roles) {
            jdbc.update("insert into user_roles(user_id, role_id) select ?, role_id from roles where code = ?", id, role);
        }
        return id;
    }

    private long insertNamed(String username, boolean verified, String accountStatus) {
        long id = jdbc.queryForObject("""
                insert into users(username, password_hash, full_name, email, email_verified_at, status)
                values (?, '{noop}unused', 'Admin Test User', ?, case when ? then current_timestamp end, ?)
                returning user_id
                """, Long.class, username, username + "@example.test", verified, accountStatus);
        created.add(id);
        return id;
    }

    private long insertEvent(long organizerId, String eventStatus) {
        Instant start = Instant.now().plus(30, ChronoUnit.DAYS);
        return jdbc.queryForObject("""
                insert into events(
                    organizer_user_id, name, start_at, end_at,
                    booth_payment_window_minutes, max_booths_per_partner,
                    max_activities_per_partner, status, created_at, updated_at)
                values (?, ?, ?, ?, 60, 2, 3, ?, current_timestamp, current_timestamp)
                returning event_id
                """, Long.class, organizerId, prefix + " Event", Timestamp.from(start),
                Timestamp.from(start.plus(1, ChronoUnit.DAYS)), eventStatus);
    }

    private long insertOrganization(long representativeId, String organizationStatus) {
        return jdbc.queryForObject("""
                insert into partner_organizations(
                    representative_user_id, name, category_code, status, created_at, updated_at)
                values (?, ?, 'PUBLISHER', ?, current_timestamp, current_timestamp)
                returning partner_organization_id
                """, Long.class, representativeId, prefix + " Partner", organizationStatus);
    }

    private RequestPostProcessor admin() {
        return authentication(token(actorId, "ADMIN"));
    }

    private RequestPostProcessor identity(String role) {
        return authentication(token(actorId, role));
    }

    private static UsernamePasswordAuthenticationToken token(long userId, String role) {
        return UsernamePasswordAuthenticationToken.authenticated(new Identity(userId, true), null,
                List.of(new SimpleGrantedAuthority("ROLE_" + role)));
    }

    record Identity(Long userId, boolean emailVerified) implements AuthenticatedPrincipal {
    }
}
