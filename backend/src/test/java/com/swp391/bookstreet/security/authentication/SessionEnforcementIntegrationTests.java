package com.swp391.bookstreet.security.authentication;

import jakarta.servlet.http.Cookie;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.ApplicationContextInitializer;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Uses real sign-in, so the Session principal and security filter chain behave as in production. */
@SpringBootTest(properties = {
        "spring.datasource.url=${EVENT_TEST_DATABASE_URL}",
        "logging.level.root=ERROR"
})
@AutoConfigureMockMvc
@EnabledIfEnvironmentVariable(named = "EVENT_TEST_DATABASE_URL", matches = ".+")
@ContextConfiguration(initializers = SessionEnforcementIntegrationTests.TestDatabaseGuard.class)
class SessionEnforcementIntegrationTests {
    static class TestDatabaseGuard
            implements ApplicationContextInitializer<ConfigurableApplicationContext> {
        @Override
        public void initialize(ConfigurableApplicationContext context) {
            String url = context.getEnvironment().getRequiredProperty("spring.datasource.url");
            if (!url.matches("jdbc:postgresql://[^/]+/[A-Za-z0-9_]+_event_test(?:\\?.*)?")) {
                throw new IllegalStateException("Session tests require a *_event_test database.");
            }
        }
    }

    private static final String PASSWORD = "learning-password";
    private static final String PARTICIPANT_INBOX = "/api/v1/participant/notifications";
    private static final String PARTNER_INBOX = "/api/v1/partner/notifications";

    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;

    private String username;
    private long userId;

    @BeforeEach
    void setup() {
        assertThat(jdbc.queryForObject("select current_database()", String.class)).endsWith("_event_test");
        username = "sess" + UUID.randomUUID().toString().replace("-", "").substring(0, 10);
        userId = jdbc.queryForObject("""
                insert into users(username, password_hash, full_name, email, email_verified_at, status)
                values (?, ?, 'Session Test User', ?, current_timestamp, 'ACTIVE') returning user_id
                """, Long.class, username, new BCryptPasswordEncoder().encode(PASSWORD), username + "@example.test");
        grant("PARTICIPANT");
    }

    @AfterEach
    void cleanup() {
        jdbc.update("delete from user_roles where user_id = ?", userId);
        jdbc.update("delete from users where user_id = ?", userId);
    }

    @Test
    void aLockEndsTheOpenSessionFromTheNextRequest() throws Exception {
        Cookie session = signIn();
        mvc.perform(get(PARTICIPANT_INBOX).cookie(session)).andExpect(status().isOk());

        lock();

        mvc.perform(get(PARTICIPANT_INBOX).cookie(session))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTHENTICATION_REQUIRED"));
    }

    @Test
    void aDisabledAccountIsBlockedEvenWithoutASessionCutoff() throws Exception {
        Cookie session = signIn();

        jdbc.update("update users set status = 'DISABLED' where user_id = ?", userId);

        mvc.perform(get(PARTICIPANT_INBOX).cookie(session)).andExpect(status().isUnauthorized());
    }

    @Test
    void aLockedSessionCannotChangeDataAndKeepsNoAccessAfterItsFirstRejection() throws Exception {
        Cookie session = signIn();

        lock();

        mvc.perform(post(PARTICIPANT_INBOX + "/read-all").with(csrf()).cookie(session))
                .andExpect(status().isUnauthorized());
        jdbc.update("update users set status = 'ACTIVE' where user_id = ?", userId);
        mvc.perform(get(PARTICIPANT_INBOX).cookie(session)).andExpect(status().isUnauthorized());
    }

    @Test
    void unlockingDoesNotResumeAnIdleSessionButANewSignInWorks() throws Exception {
        Cookie idleSession = signIn();

        lock();
        jdbc.update("update users set status = 'ACTIVE' where user_id = ?", userId);

        mvc.perform(get(PARTICIPANT_INBOX).cookie(idleSession)).andExpect(status().isUnauthorized());
        mvc.perform(get(PARTICIPANT_INBOX).cookie(signIn())).andExpect(status().isOk());
    }

    @Test
    void aLockedAccountCannotSignIn() throws Exception {
        lock();

        mvc.perform(post("/api/v1/auth/login").with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(credentials()))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ACCOUNT_NOT_ACTIVE"));
    }

    @Test
    void publicEndpointsKeepWorkingWithAnEndedSession() throws Exception {
        Cookie session = signIn();

        lock();

        mvc.perform(get("/api/v1/events").cookie(session)).andExpect(status().isOk());
        mvc.perform(post("/api/v1/chat/messages").with(csrf()).cookie(session)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"message\":\"Xin chào\"}"))
                .andExpect(result -> assertThat(result.getResponse().getStatus()).isNotIn(401, 403));
    }

    @Test
    void aRemovedRoleStopsWorkingWithoutSigningInAgainAndOtherRolesStay() throws Exception {
        grant("PARTNER");
        Cookie session = signIn();
        mvc.perform(get(PARTNER_INBOX).cookie(session)).andExpect(status().isOk());

        jdbc.update("delete from user_roles where user_id = ? and role_id = "
                + "(select role_id from roles where code = 'PARTNER')", userId);

        mvc.perform(get(PARTNER_INBOX).cookie(session))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ACCESS_DENIED"));
        mvc.perform(get(PARTICIPANT_INBOX).cookie(session)).andExpect(status().isOk());
    }

    @Test
    void aNewRoleStillRequiresSigningInAgain() throws Exception {
        Cookie session = signIn();

        grant("PARTNER");

        mvc.perform(get(PARTNER_INBOX).cookie(session)).andExpect(status().isForbidden());
        mvc.perform(get(PARTNER_INBOX).cookie(signIn())).andExpect(status().isOk());
    }

    @Test
    void aCutoffBeforeSignInLeavesTheSessionValid() throws Exception {
        jdbc.update("update users set sessions_valid_from = ? where user_id = ?",
                Timestamp.from(Instant.now().minusSeconds(60)), userId);

        mvc.perform(get(PARTICIPANT_INBOX).cookie(signIn())).andExpect(status().isOk());
    }

    @Test
    void aCutoffAfterSignInEndsAnActiveAccountsSessionAsAPasswordResetRequires() throws Exception {
        Cookie session = signIn();

        jdbc.update("update users set sessions_valid_from = ? where user_id = ?",
                Timestamp.from(Instant.now().plusSeconds(1)), userId);

        mvc.perform(get(PARTICIPANT_INBOX).cookie(session)).andExpect(status().isUnauthorized());
    }

    @Test
    void aSessionWithNoSignInTimeIsOlderThanAnyCutoffButValidWithoutOne() {
        Instant cutoff = Instant.parse("2026-11-07T00:00:00Z");

        assertThat(SessionEnforcementFilter.isStale(null, null)).isFalse();
        assertThat(SessionEnforcementFilter.isStale(null, cutoff)).isTrue();
        assertThat(SessionEnforcementFilter.isStale(cutoff.minusNanos(1), cutoff)).isTrue();
        assertThat(SessionEnforcementFilter.isStale(cutoff, cutoff)).isFalse();
    }

    private void lock() {
        jdbc.update("update users set status = 'DISABLED', sessions_valid_from = ? where user_id = ?",
                Timestamp.from(Instant.now().plusMillis(1)), userId);
    }

    private void grant(String role) {
        jdbc.update("insert into user_roles(user_id, role_id) select ?, role_id from roles where code = ?",
                userId, role);
    }

    private Cookie signIn() throws Exception {
        Cookie session = mvc.perform(post("/api/v1/auth/login").with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(credentials()))
                .andExpect(status().isOk())
                .andReturn().getResponse().getCookie("SESSION");
        assertThat(session).isNotNull();
        return session;
    }

    private String credentials() {
        return "{\"username\":\"" + username + "\",\"password\":\"" + PASSWORD + "\"}";
    }
}
