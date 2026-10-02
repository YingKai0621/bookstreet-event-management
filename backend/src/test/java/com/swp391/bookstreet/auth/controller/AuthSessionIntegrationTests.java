package com.swp391.bookstreet.auth.controller;

import com.swp391.bookstreet.auth.dto.RegisterRequest;
import com.swp391.bookstreet.auth.service.AuthService;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletRequest;
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
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.cookie;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class AuthSessionIntegrationTests {

    private static final String RAW_PASSWORD = "learning-password";
    private final HttpSessionIdResolver httpSessionIdResolver = new CookieHttpSessionIdResolver();

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private AuthService authService;

    @Autowired
    private SessionRepository<? extends Session> sessionRepository;

    @Test
    void currentAccountUsesIdentityFromAuthenticatedSession() throws Exception {
        String username = "current" + uniqueSuffix();
        register(username);

        Cookie sessionCookie = login(username);

        mockMvc.perform(get("/api/v1/auth/me")
                        .cookie(sessionCookie))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.userId").isNumber())
                .andExpect(jsonPath("$.username").value(username))
                .andExpect(jsonPath("$.fullName").value("Session Test Account"))
                .andExpect(jsonPath("$.email").isEmpty())
                .andExpect(jsonPath("$.emailVerified").value(false))
                .andExpect(jsonPath("$.status").value("ACTIVE"))
                .andExpect(jsonPath("$.roles[0]").value("PARTICIPANT"))
                .andExpect(jsonPath("$.password").doesNotExist())
                .andExpect(jsonPath("$.passwordHash").doesNotExist());

        deleteSession(sessionCookie);
    }

    @Test
    void logoutInvalidatesRedisSessionAndOldCookieCannotAccessCurrentAccount() throws Exception {
        String username = "logout" + uniqueSuffix();
        register(username);

        Cookie sessionCookie = login(username);
        String sessionId = resolveSessionId(sessionCookie);

        Session sessionBeforeLogout = sessionRepository.findById(sessionId);
        assertThat(sessionBeforeLogout).isNotNull();

        mockMvc.perform(post("/api/v1/auth/logout")
                        .with(csrf())
                        .cookie(sessionCookie))
                .andExpect(status().isNoContent())
                .andExpect(content().string(""))
                .andExpect(cookie().maxAge("SESSION", 0));

        Session sessionAfterLogout = sessionRepository.findById(sessionId);
        assertThat(sessionAfterLogout).isNull();

        mockMvc.perform(get("/api/v1/auth/me")
                        .cookie(sessionCookie))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(post("/api/v1/auth/logout")
                        .with(csrf())
                        .cookie(sessionCookie))
                .andExpect(status().isNoContent());
    }

    @Test
    void currentAccountRejectsRequestWithoutSession() throws Exception {
        mockMvc.perform(get("/api/v1/auth/me"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void logoutRemainsProtectedByCsrf() throws Exception {
        String username = "logoutcsrf" + uniqueSuffix();
        register(username);

        Cookie sessionCookie = login(username);

        mockMvc.perform(post("/api/v1/auth/logout")
                        .cookie(sessionCookie))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/v1/auth/me")
                        .cookie(sessionCookie))
                .andExpect(status().isOk());

        deleteSession(sessionCookie);
    }

    private void register(String username) {
        RegisterRequest request = new RegisterRequest(
                username,
                "Session Test Account",
                RAW_PASSWORD,
                RAW_PASSWORD,
                null
        );

        authService.register(request);
    }

    private Cookie login(String username) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/auth/login")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(loginJson(username, RAW_PASSWORD)))
                .andExpect(status().isOk())
                .andReturn();

        Cookie sessionCookie = result.getResponse().getCookie("SESSION");
        assertThat(sessionCookie).isNotNull();
        return sessionCookie;
    }

    private void deleteSession(Cookie sessionCookie) {
        String sessionId = resolveSessionId(sessionCookie);
        sessionRepository.deleteById(sessionId);
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
