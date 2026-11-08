package com.swp391.bookstreet.auth.controller;

import com.swp391.bookstreet.auth.service.PasswordResetMailService;
import jakarta.servlet.http.Cookie;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.ApplicationContextInitializer;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mail.MailSendException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
        "spring.datasource.url=${EVENT_TEST_DATABASE_URL}",
        "logging.level.root=ERROR"
})
@AutoConfigureMockMvc
@EnabledIfEnvironmentVariable(named = "EVENT_TEST_DATABASE_URL", matches = ".+")
@ContextConfiguration(initializers = PasswordResetIntegrationTests.TestDatabaseGuard.class)
class PasswordResetIntegrationTests {
    static class TestDatabaseGuard
            implements ApplicationContextInitializer<ConfigurableApplicationContext> {
        @Override
        public void initialize(ConfigurableApplicationContext context) {
            String url = context.getEnvironment().getRequiredProperty("spring.datasource.url");
            if (!url.matches("jdbc:postgresql://[^/]+/[A-Za-z0-9_]+_event_test(?:\\?.*)?")) {
                throw new IllegalStateException("Password reset tests require a *_event_test database.");
            }
        }
    }

    private static final String REQUEST = "/api/v1/auth/password-reset/request";
    private static final String CONFIRM = "/api/v1/auth/password-reset/confirm";
    private static final String OLD_PASSWORD = "learning-password";
    private static final String NEW_PASSWORD = "brand-new-password";

    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @MockitoBean PasswordResetMailService mailService;

    private final List<Long> users = new ArrayList<>();

    @BeforeEach
    void setup() {
        assertThat(jdbc.queryForObject("select current_database()", String.class)).endsWith("_event_test");
        reset(mailService);
    }

    @AfterEach
    void cleanup() {
        users.forEach(id -> {
            jdbc.update("delete from user_tokens where user_id = ?", id);
            jdbc.update("delete from user_roles where user_id = ?", id);
            jdbc.update("delete from users where user_id = ?", id);
        });
    }

    @Test
    void everyRequestGetsTheSameAnswerButOnlyAnActiveVerifiedAccountGetsMail() throws Exception {
        Account active = account(true, "ACTIVE");
        Account unverified = account(false, "ACTIVE");
        Account locked = account(true, "DISABLED");

        for (String email : List.of(active.email().toUpperCase(), unverified.email(), locked.email(),
                "nobody-" + UUID.randomUUID() + "@example.test")) {
            requestReset(email)
                    .andExpect(status().isAccepted())
                    .andExpect(jsonPath("$.message").value(PasswordResetController.NEUTRAL_MESSAGE));
        }

        verify(mailService, times(1)).sendResetMessage(anyString(), anyString());
        verify(mailService).sendResetMessage(eq(active.email()), anyString());
        assertThat(tokenCount(unverified.id())).isZero();
        assertThat(tokenCount(locked.id())).isZero();
    }

    @Test
    void theStoredTokenIsAHashThatExpiresAfterThirtyMinutes() throws Exception {
        Account account = account(true, "ACTIVE");

        String rawToken = requestAndCapture(account);

        var row = jdbc.queryForMap("select token_hash, created_at, expires_at from user_tokens "
                + "where user_id = ? and token_type = 'PASSWORD_RESET'", account.id());
        assertThat(row.get("token_hash")).isNotEqualTo(rawToken);
        assertThat(String.valueOf(row.get("token_hash"))).doesNotContain(rawToken);
        Instant created = ((Timestamp) row.get("created_at")).toInstant();
        Instant expires = ((Timestamp) row.get("expires_at")).toInstant();
        assertThat(Duration.between(created, expires)).isEqualTo(Duration.ofMinutes(30));
    }

    @Test
    void issueLimitsApplySilently() throws Exception {
        Account account = account(true, "ACTIVE");
        requestAndCapture(account);

        requestReset(account.email()).andExpect(status().isAccepted());
        assertThat(tokenCount(account.id())).isOne();

        jdbc.update("update user_tokens set created_at = current_timestamp - interval '2 minutes' where user_id = ?",
                account.id());
        for (int i = 0; i < 4; i++) {
            jdbc.update("""
                    insert into user_tokens(user_id, token_type, token_hash, created_at, expires_at)
                    values (?, 'PASSWORD_RESET', ?, current_timestamp - interval '10 minutes',
                        current_timestamp + interval '20 minutes')
                    """, account.id(), UUID.randomUUID().toString());
        }
        reset(mailService);

        requestReset(account.email()).andExpect(status().isAccepted());

        verify(mailService, never()).sendResetMessage(anyString(), anyString());
        assertThat(tokenCount(account.id())).isEqualTo(5);
    }

    @Test
    void aNewLinkRevokesTheEarlierOne() throws Exception {
        Account account = account(true, "ACTIVE");
        String first = requestAndCapture(account);
        jdbc.update("update user_tokens set created_at = current_timestamp - interval '2 minutes' where user_id = ?",
                account.id());

        String second = requestAndCapture(account);

        confirm(first, NEW_PASSWORD, NEW_PASSWORD)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_OR_EXPIRED_PASSWORD_RESET_TOKEN"));
        confirm(second, NEW_PASSWORD, NEW_PASSWORD).andExpect(status().isNoContent());
    }

    @Test
    void aResetChangesThePasswordAndEndsEarlierSessions() throws Exception {
        Account account = account(true, "ACTIVE");
        Cookie earlierSession = signIn(account, OLD_PASSWORD);
        mvc.perform(get("/api/v1/auth/me").cookie(earlierSession)).andExpect(status().isOk());
        String rawToken = requestAndCapture(account);

        confirm(rawToken, NEW_PASSWORD, NEW_PASSWORD).andExpect(status().isNoContent());

        mvc.perform(get("/api/v1/auth/me").cookie(earlierSession)).andExpect(status().isUnauthorized());
        login(account, OLD_PASSWORD).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/auth/me").cookie(signIn(account, NEW_PASSWORD))).andExpect(status().isOk());
        confirm(rawToken, "another-password", "another-password")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_OR_EXPIRED_PASSWORD_RESET_TOKEN"));
    }

    @Test
    void wrongExpiredAndLockedCasesGetTheSameErrorAndChangeNothing() throws Exception {
        Account account = account(true, "ACTIVE");
        String rawToken = requestAndCapture(account);
        String hashBefore = passwordHash(account);

        for (String token : List.of("not-a-real-token", "", UUID.randomUUID().toString())) {
            confirm(token, NEW_PASSWORD, NEW_PASSWORD)
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("INVALID_OR_EXPIRED_PASSWORD_RESET_TOKEN"));
        }

        jdbc.update("update user_tokens set expires_at = current_timestamp - interval '1 second' where user_id = ?",
                account.id());
        confirm(rawToken, NEW_PASSWORD, NEW_PASSWORD)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_OR_EXPIRED_PASSWORD_RESET_TOKEN"));

        jdbc.update("update user_tokens set expires_at = current_timestamp + interval '10 minutes' where user_id = ?",
                account.id());
        jdbc.update("update users set status = 'DISABLED' where user_id = ?", account.id());
        confirm(rawToken, NEW_PASSWORD, NEW_PASSWORD)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_OR_EXPIRED_PASSWORD_RESET_TOKEN"));

        assertThat(passwordHash(account)).isEqualTo(hashBefore);
        assertThat(jdbc.queryForObject("select status from users where user_id = ?", String.class, account.id()))
                .isEqualTo("DISABLED");
    }

    @Test
    void invalidInputIsRejected() throws Exception {
        Account account = account(true, "ACTIVE");
        String rawToken = requestAndCapture(account);

        requestReset("not-an-email").andExpect(status().isUnprocessableContent());
        confirm(rawToken, NEW_PASSWORD, "different-password")
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.code").value("PASSWORD_CONFIRMATION_MISMATCH"));
        confirm(rawToken, "short", "short").andExpect(status().isUnprocessableContent());
        confirm(rawToken, NEW_PASSWORD, NEW_PASSWORD).andExpect(status().isNoContent());
    }

    @Test
    void aFailedMailRevokesItsLinkAndKeepsTheAnswerNeutral() throws Exception {
        Account account = account(true, "ACTIVE");
        doThrow(new MailSendException("SMTP unavailable")).when(mailService)
                .sendResetMessage(anyString(), anyString());

        requestReset(account.email()).andExpect(status().isAccepted());

        assertThat(jdbc.queryForObject("select count(*) from user_tokens where user_id = ? "
                + "and token_type = 'PASSWORD_RESET' and revoked_at is not null", Integer.class, account.id())).isOne();
    }

    @Test
    void bothStepsRequireCsrfProof() throws Exception {
        mvc.perform(post(REQUEST).contentType(MediaType.APPLICATION_JSON).content("{\"email\":\"a@example.test\"}"))
                .andExpect(status().isForbidden());
        mvc.perform(post(CONFIRM).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"token\":\"x\",\"newPassword\":\"brand-new-password\",\"confirmPassword\":\"brand-new-password\"}"))
                .andExpect(status().isForbidden());
    }

    private String requestAndCapture(Account account) throws Exception {
        reset(mailService);
        requestReset(account.email()).andExpect(status().isAccepted());
        ArgumentCaptor<String> token = ArgumentCaptor.forClass(String.class);
        verify(mailService).sendResetMessage(eq(account.email()), token.capture());
        return token.getValue();
    }

    private ResultActions requestReset(String email) throws Exception {
        return mvc.perform(post(REQUEST).with(csrf()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"" + email + "\"}"));
    }

    private ResultActions confirm(String token, String password, String confirmation) throws Exception {
        return mvc.perform(post(CONFIRM).with(csrf()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"token\":\"" + token + "\",\"newPassword\":\"" + password
                        + "\",\"confirmPassword\":\"" + confirmation + "\"}"));
    }

    private ResultActions login(Account account, String password) throws Exception {
        return mvc.perform(post("/api/v1/auth/login").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"username\":\"" + account.username() + "\",\"password\":\"" + password + "\"}"));
    }

    private Cookie signIn(Account account, String password) throws Exception {
        Cookie session = login(account, password).andExpect(status().isOk())
                .andReturn().getResponse().getCookie("SESSION");
        assertThat(session).isNotNull();
        return session;
    }

    private int tokenCount(long userId) {
        return jdbc.queryForObject("select count(*) from user_tokens where user_id = ? and token_type = 'PASSWORD_RESET'",
                Integer.class, userId);
    }

    private String passwordHash(Account account) {
        return jdbc.queryForObject("select password_hash from users where user_id = ?", String.class, account.id());
    }

    private Account account(boolean verified, String accountStatus) {
        String username = "reset" + UUID.randomUUID().toString().replace("-", "").substring(0, 10);
        String email = username + "@example.test";
        long id = jdbc.queryForObject("""
                insert into users(username, password_hash, full_name, email, email_verified_at, status)
                values (?, ?, 'Reset Test User', ?, case when ? then current_timestamp end, ?)
                returning user_id
                """, Long.class, username, new BCryptPasswordEncoder().encode(OLD_PASSWORD), email, verified, accountStatus);
        jdbc.update("insert into user_roles(user_id, role_id) select ?, role_id from roles where code = 'PARTICIPANT'", id);
        users.add(id);
        return new Account(id, username, email);
    }

    record Account(long id, String username, String email) {
    }
}
