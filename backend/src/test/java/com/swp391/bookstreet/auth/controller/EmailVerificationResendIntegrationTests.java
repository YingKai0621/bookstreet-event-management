package com.swp391.bookstreet.auth.controller;

import com.swp391.bookstreet.auth.entity.User;
import com.swp391.bookstreet.auth.entity.UserToken;
import com.swp391.bookstreet.auth.entity.UserTokenType;
import com.swp391.bookstreet.auth.repository.UserRepository;
import com.swp391.bookstreet.auth.repository.UserTokenRepository;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mail.MailSendException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.session.Session;
import org.springframework.session.SessionRepository;
import org.springframework.session.web.http.CookieHttpSessionIdResolver;
import org.springframework.session.web.http.HttpSessionIdResolver;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class EmailVerificationResendIntegrationTests {

    private static final String RAW_PASSWORD = "learning-password";
    private final HttpSessionIdResolver sessionIdResolver = new CookieHttpSessionIdResolver();

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private UserTokenRepository userTokenRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private SessionRepository<? extends Session> sessionRepository;

    @MockitoBean
    private JavaMailSender mailSender;

    private Long createdUserId;
    private Cookie sessionCookie;

    @Test
    void authenticatedUserCanRequestAnotherVerificationMessage() throws Exception {
        User user = createUser("resend", "resend@example.com", false);
        sessionCookie = login(user.getUsername());

        performResend(sessionCookie)
                .andExpect(status().isNoContent());

        Optional<UserToken> tokenResult = findLatestToken(user.getId());

        assertThat(tokenResult).isPresent();
        assertThat(tokenResult.get().getUsedAt()).isNull();
        assertThat(tokenResult.get().getRevokedAt()).isNull();
        verify(mailSender).send(any(SimpleMailMessage.class));
    }

    @Test
    void alreadyVerifiedUserReceivesIdempotentSuccessWithoutMail() throws Exception {
        User user = createUser("verified", "verified@example.com", true);
        sessionCookie = login(user.getUsername());

        performResend(sessionCookie)
                .andExpect(status().isNoContent());

        assertThat(findLatestToken(user.getId())).isEmpty();
        verifyNoInteractions(mailSender);
    }

    @Test
    void userWithoutEmailReceivesEmailRequiredError() throws Exception {
        User user = createUser("noemail", null, false);
        sessionCookie = login(user.getUsername());

        performResend(sessionCookie)
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.code").value("EMAIL_REQUIRED"));

        assertThat(findLatestToken(user.getId())).isEmpty();
        verifyNoInteractions(mailSender);
    }

    @Test
    void secondImmediateResendIsRateLimited() throws Exception {
        User user = createUser("limited", "limited@example.com", false);
        sessionCookie = login(user.getUsername());

        performResend(sessionCookie)
                .andExpect(status().isNoContent());

        performResend(sessionCookie)
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code")
                        .value("EMAIL_VERIFICATION_RATE_LIMITED"));

        verify(mailSender, times(1)).send(any(SimpleMailMessage.class));
    }

    @Test
    void deliveryFailureReturnsServiceUnavailableAndRevokesNewToken() throws Exception {
        User user = createUser("mailfail", "mailfail@example.com", false);
        sessionCookie = login(user.getUsername());

        doThrow(new MailSendException("Simulated delivery failure"))
                .when(mailSender)
                .send(any(SimpleMailMessage.class));

        performResend(sessionCookie)
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("EMAIL_DELIVERY_UNAVAILABLE"));

        Optional<UserToken> tokenResult = findLatestToken(user.getId());

        assertThat(tokenResult).isPresent();
        assertThat(tokenResult.get().getRevokedAt()).isNotNull();
    }

    @Test
    void unauthenticatedResendIsRejected() throws Exception {
        mockMvc.perform(post("/api/v1/auth/email-verification/resend")
                        .with(csrf()))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTHENTICATION_REQUIRED"));
    }

    @AfterEach
    void cleanUpCommittedData() {
        if (sessionCookie != null) {
            deleteSession(sessionCookie);
        }

        if (createdUserId == null) {
            return;
        }

        jdbcTemplate.update("DELETE FROM user_tokens WHERE user_id = ?", createdUserId);
        jdbcTemplate.update("DELETE FROM user_roles WHERE user_id = ?", createdUserId);
        jdbcTemplate.update("DELETE FROM users WHERE user_id = ?", createdUserId);
    }

    private User createUser(String usernamePrefix, String email, boolean verified) {
        String suffix = uniqueSuffix();
        String username = usernamePrefix + suffix;
        String uniqueEmail = email;

        if (email != null) {
            uniqueEmail = suffix + email;
        }

        User user = new User(
                username,
                uniqueEmail,
                passwordEncoder.encode(RAW_PASSWORD),
                "Email Verification User"
        );

        if (verified) {
            user.setEmailVerifiedAt(Instant.now());
        }

        userRepository.saveAndFlush(user);
        createdUserId = user.getId();
        return user;
    }

    private Cookie login(String username) throws Exception {
        String requestBody = """
                {
                  "username": "%s",
                  "password": "%s"
                }
                """.formatted(username, RAW_PASSWORD);

        MvcResult result = mockMvc.perform(post("/api/v1/auth/login")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody))
                .andExpect(status().isOk())
                .andReturn();

        Cookie cookie = result.getResponse().getCookie("SESSION");
        assertThat(cookie).isNotNull();
        return cookie;
    }

    private ResultActions performResend(Cookie cookie) throws Exception {
        return mockMvc.perform(post("/api/v1/auth/email-verification/resend")
                .with(csrf())
                .cookie(cookie));
    }

    private Optional<UserToken> findLatestToken(Long userId) {
        return userTokenRepository.findFirstByUserIdAndTokenTypeOrderByCreatedAtDesc(
                userId,
                UserTokenType.EMAIL_VERIFICATION
        );
    }

    private void deleteSession(Cookie cookie) {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setCookies(cookie);

        List<String> sessionIds = sessionIdResolver.resolveSessionIds(request);

        if (!sessionIds.isEmpty()) {
            sessionRepository.deleteById(sessionIds.get(0));
        }
    }

    private String uniqueSuffix() {
        return UUID.randomUUID().toString().replace("-", "").substring(0, 10);
    }
}
