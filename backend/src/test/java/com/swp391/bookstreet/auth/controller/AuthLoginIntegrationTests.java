package com.swp391.bookstreet.auth.controller;

import com.swp391.bookstreet.auth.dto.RegisterRequest;
import com.swp391.bookstreet.auth.entity.AccountStatus;
import com.swp391.bookstreet.auth.entity.User;
import com.swp391.bookstreet.auth.repository.UserRepository;
import com.swp391.bookstreet.auth.service.AuthService;
import com.swp391.bookstreet.security.authentication.AuthenticatedUser;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.session.Session;
import org.springframework.session.SessionRepository;
import org.springframework.session.web.http.CookieHttpSessionIdResolver;
import org.springframework.session.web.http.HttpSessionIdResolver;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.hasItems;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = "bookstreet.browser-security.session-cookie-secure=true")
@AutoConfigureMockMvc
@Transactional
class AuthLoginIntegrationTests {

    private static final String RAW_PASSWORD = "learning-password";
    private final HttpSessionIdResolver httpSessionIdResolver = new CookieHttpSessionIdResolver();

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private AuthService authService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private SessionRepository<? extends Session> sessionRepository;

    @Test
    void loginCreatesRedisSessionAndUpdatesLastLoginTime() throws Exception {
        String username = "login" + uniqueSuffix();
        register(username);

        User userBeforeLogin = userRepository.findByUsernameIgnoreCase(username).orElseThrow();
        assertThat(userBeforeLogin.getLastLoginAt()).isNull();

        MvcResult result = mockMvc.perform(post("/api/v1/auth/login")
                        .with(csrf())
                        .secure(true)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(loginJson(username.toUpperCase(), RAW_PASSWORD)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.userId").value(userBeforeLogin.getId()))
                .andExpect(jsonPath("$.user.username").value(username))
                .andExpect(jsonPath("$.user.fullName").value("Login Test Account"))
                .andExpect(jsonPath("$.user.roles[0]").value("PARTICIPANT"))
                .andExpect(jsonPath("$.user.password").doesNotExist())
                .andExpect(jsonPath("$.user.passwordHash").doesNotExist())
                .andExpect(jsonPath("$.user.email").doesNotExist())
                .andReturn();

        User userAfterLogin = userRepository.findByUsernameIgnoreCase(username).orElseThrow();
        assertThat(userAfterLogin.getLastLoginAt()).isNotNull();

        Cookie sessionCookie = result.getResponse().getCookie("SESSION");
        assertThat(sessionCookie).isNotNull();
        assertThat(sessionCookie.isHttpOnly()).isTrue();
        assertThat(sessionCookie.getSecure()).isTrue();
        assertThat(sessionCookie.getAttribute("SameSite")).isEqualTo("Lax");

        String sessionId = resolveSessionId(sessionCookie);
        Session storedSession = sessionRepository.findById(sessionId);

        assertThat(storedSession).isNotNull();

        Object contextAttribute = storedSession.getAttribute(
                HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY
        );

        assertThat(contextAttribute).isInstanceOf(SecurityContext.class);

        SecurityContext securityContext = (SecurityContext) contextAttribute;
        Authentication authentication = securityContext.getAuthentication();

        assertThat(authentication).isNotNull();
        assertThat(authentication.isAuthenticated()).isTrue();
        assertThat(authentication.getPrincipal()).isInstanceOf(AuthenticatedUser.class);

        AuthenticatedUser authenticatedUser = (AuthenticatedUser) authentication.getPrincipal();
        assertThat(authenticatedUser.getUserId()).isEqualTo(userBeforeLogin.getId());
        assertThat(authenticatedUser.getPassword()).isNull();

        sessionRepository.deleteById(sessionId);
    }

    @Test
    void loginRejectsIncorrectPasswordWithGenericError() throws Exception {
        String username = "wrongpass" + uniqueSuffix();
        register(username);

        mockMvc.perform(post("/api/v1/auth/login")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(loginJson(username, "x")))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"))
                .andExpect(jsonPath("$.message").value("Invalid username or password."));

        User user = userRepository.findByUsernameIgnoreCase(username).orElseThrow();
        assertThat(user.getLastLoginAt()).isNull();
    }

    @Test
    void loginHidesUnknownUsernameBehindSameGenericError() throws Exception {
        String unknownUsername = "missing" + uniqueSuffix();

        mockMvc.perform(post("/api/v1/auth/login")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(loginJson(unknownUsername, RAW_PASSWORD)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"))
                .andExpect(jsonPath("$.message").value("Invalid username or password."));
    }

    @Test
    void loginRejectsDisabledAccount() throws Exception {
        String username = "disabled" + uniqueSuffix();
        register(username);

        User user = userRepository.findByUsernameIgnoreCase(username).orElseThrow();
        user.setStatus(AccountStatus.DISABLED);
        userRepository.saveAndFlush(user);

        mockMvc.perform(post("/api/v1/auth/login")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(loginJson(username, RAW_PASSWORD)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ACCOUNT_NOT_ACTIVE"));

        User userAfterLoginAttempt = userRepository.findByUsernameIgnoreCase(username).orElseThrow();
        assertThat(userAfterLoginAttempt.getLastLoginAt()).isNull();
    }

    @Test
    void loginReportsRequestValidationErrors() throws Exception {
        mockMvc.perform(post("/api/v1/auth/login")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(loginJson("", "")))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.fieldErrors[*].field").value(hasItems("username", "password")));
    }

    @Test
    void loginRejectsUsernameOutsideApprovedFormat() throws Exception {
        mockMvc.perform(post("/api/v1/auth/login")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(loginJson("partner_demo", RAW_PASSWORD)))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.fieldErrors[*].field").value(hasItem("username")));
    }

    @Test
    void loginRejectsOversizedPasswordBeforeAuthentication() throws Exception {
        mockMvc.perform(post("/api/v1/auth/login")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(loginJson("validlogin", "a".repeat(65))))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.fieldErrors[*].field").value(hasItem("password")));
    }

    @Test
    void loginRemainsProtectedByCsrf() throws Exception {
        String username = "logincsrf" + uniqueSuffix();
        register(username);

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(loginJson(username, RAW_PASSWORD)))
                .andExpect(status().isForbidden());

        User user = userRepository.findByUsernameIgnoreCase(username).orElseThrow();
        assertThat(user.getLastLoginAt()).isNull();
    }

    private void register(String username) {
        RegisterRequest request = new RegisterRequest(
                username,
                "Login Test Account",
                RAW_PASSWORD,
                RAW_PASSWORD,
                null
        );

        authService.register(request);
    }

    private String resolveSessionId(Cookie sessionCookie) {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setCookies(sessionCookie);

        List<String> sessionIds = httpSessionIdResolver.resolveSessionIds(request);
        assertThat(sessionIds).hasSize(1);
        return sessionIds.get(0);
    }

    private String loginJson(String username, String password) {
        return """
                {
                  "username": "%s",
                  "password": "%s"
                }
                """.formatted(username, password);
    }

    private String uniqueSuffix() {
        return UUID.randomUUID().toString().replace("-", "").substring(0, 10);
    }
}
