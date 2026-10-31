package com.swp391.bookstreet.security.authorization;

import com.swp391.bookstreet.auth.dto.RegisterRequest;
import com.swp391.bookstreet.auth.entity.Role;
import com.swp391.bookstreet.auth.entity.RoleCode;
import com.swp391.bookstreet.auth.entity.User;
import com.swp391.bookstreet.auth.entity.UserRole;
import com.swp391.bookstreet.auth.repository.RoleRepository;
import com.swp391.bookstreet.auth.repository.UserRepository;
import com.swp391.bookstreet.auth.repository.UserRoleRepository;
import com.swp391.bookstreet.auth.service.AuthService;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.session.Session;
import org.springframework.session.SessionRepository;
import org.springframework.session.web.http.CookieHttpSessionIdResolver;
import org.springframework.session.web.http.HttpSessionIdResolver;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
@Import(AuthAuthorizationIntegrationTests.AuthorizationTestController.class)
class AuthAuthorizationIntegrationTests {

    private static final String RAW_PASSWORD = "learning-password";
    private final HttpSessionIdResolver httpSessionIdResolver = new CookieHttpSessionIdResolver();

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private AuthService authService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RoleRepository roleRepository;

    @Autowired
    private UserRoleRepository userRoleRepository;

    @Autowired
    private SessionRepository<? extends Session> sessionRepository;

    @Test
    void unauthenticatedRequestReturnsStandardJsonError() throws Exception {
        MvcResult result = mockMvc.perform(get("/api/v1/auth/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.code").value("AUTHENTICATION_REQUIRED"))
                .andExpect(jsonPath("$.message").value("Authentication is required."))
                .andExpect(jsonPath("$.fieldErrors").isArray())
                .andExpect(jsonPath("$.timestamp").exists())
                .andExpect(jsonPath("$.path").value("/api/v1/auth/me"))
                .andReturn();

        Cookie sessionCookie = result.getResponse().getCookie("SESSION");
        if (sessionCookie != null) {
            deleteSession(sessionCookie);
        }
    }

    @Test
    void publicEventGetDoesNotRequireAuthentication() throws Exception {
        mockMvc.perform(get("/api/v1/events/999999999"))
                .andExpect(status().isNotFound());
    }

    @Test
    void participantCannotAccessOrganizerOrPartnerEndpoints() throws Exception {
        String username = "part" + uniqueSuffix();
        register(username, null);

        Cookie sessionCookie = login(username);

        mockMvc.perform(get("/api/v1/organizer/authorization-test")
                        .cookie(sessionCookie))
                .andExpect(status().isForbidden())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.code").value("ACCESS_DENIED"))
                .andExpect(jsonPath("$.path").value("/api/v1/organizer/authorization-test"));

        mockMvc.perform(get("/api/v1/partner/authorization-test")
                        .cookie(sessionCookie))
                .andExpect(status().isForbidden())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.code").value("ACCESS_DENIED"))
                .andExpect(jsonPath("$.path").value("/api/v1/partner/authorization-test"));

        mockMvc.perform(post("/api/v1/events/1/applications")
                        .with(csrf())
                        .cookie(sessionCookie))
                .andExpect(status().isForbidden())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.code").value("ACCESS_DENIED"))
                .andExpect(jsonPath("$.path").value("/api/v1/events/1/applications"));

        deleteSession(sessionCookie);
    }

    @Test
    void organizerRoleCanAccessOrganizerEndpoint() throws Exception {
        String username = "organizer" + uniqueSuffix();
        register(username, username + "@example.com");
        assignVerifiedRole(username, RoleCode.ORGANIZER);

        Cookie sessionCookie = login(username);

        mockMvc.perform(get("/api/v1/organizer/authorization-test")
                        .cookie(sessionCookie))
                .andExpect(status().isOk())
                .andExpect(content().string("ORGANIZER_ACCESS_GRANTED"));

        deleteSession(sessionCookie);
    }

    @Test
    void partnerRoleCanAccessPartnerEndpoint() throws Exception {
        String username = "partner" + uniqueSuffix();
        register(username, username + "@example.com");
        assignVerifiedRole(username, RoleCode.PARTNER);

        Cookie sessionCookie = login(username);

        mockMvc.perform(get("/api/v1/partner/authorization-test")
                        .cookie(sessionCookie))
                .andExpect(status().isOk())
                .andExpect(content().string("PARTNER_ACCESS_GRANTED"));

        mockMvc.perform(post("/api/v1/events/1/applications")
                        .with(csrf())
                        .cookie(sessionCookie)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PARTNER_ORGANIZATION_REQUIRED"));

        deleteSession(sessionCookie);
    }

    @Test
    void adminKeepsExistingOrganizerAccessButCannotAccessOrganizerFeedback() throws Exception {
        String username = "admin" + uniqueSuffix();
        register(username, username + "@example.com");
        assignVerifiedRole(username, RoleCode.ADMIN);

        Cookie sessionCookie = login(username);

        mockMvc.perform(get("/api/v1/organizer/dashboard")
                        .cookie(sessionCookie))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/organizer/feedbacks")
                        .cookie(sessionCookie))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ACCESS_DENIED"));

        deleteSession(sessionCookie);
    }

    @Test
    void unverifiedPartnerRoleCannotAccessPartnerEndpoint() throws Exception {
        String username = "uvpartner" + uniqueSuffix();
        register(username, username + "@example.com");
        assignRoleWithoutVerifyingEmail(username, RoleCode.PARTNER);

        Cookie sessionCookie = login(username);

        mockMvc.perform(get("/api/v1/partner/authorization-test")
                        .cookie(sessionCookie))
                .andExpect(status().isForbidden())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.code").value("ACCESS_DENIED"));

        deleteSession(sessionCookie);
    }

    @Test
    void emailVerificationDoesNotElevateExistingSessionButReloginDoes() throws Exception {
        String username = "refresh" + uniqueSuffix();
        register(username, username + "@example.com");
        assignRoleWithoutVerifyingEmail(username, RoleCode.PARTNER);

        Cookie unverifiedSessionCookie = login(username);

        User user = userRepository.findByUsernameIgnoreCase(username).orElseThrow();
        user.setEmailVerifiedAt(Instant.now());
        userRepository.saveAndFlush(user);

        mockMvc.perform(get("/api/v1/partner/authorization-test")
                        .cookie(unverifiedSessionCookie))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ACCESS_DENIED"));

        Cookie verifiedSessionCookie = login(username);

        mockMvc.perform(get("/api/v1/partner/authorization-test")
                        .cookie(verifiedSessionCookie))
                .andExpect(status().isOk())
                .andExpect(content().string("PARTNER_ACCESS_GRANTED"));

        deleteSession(unverifiedSessionCookie);
        deleteSession(verifiedSessionCookie);
    }

    private void register(String username, String email) {
        RegisterRequest request = new RegisterRequest(
                username,
                "Authorization Test Account",
                RAW_PASSWORD,
                RAW_PASSWORD,
                email
        );

        authService.register(request);
    }

    private void assignVerifiedRole(String username, RoleCode roleCode) {
        User user = userRepository.findByUsernameIgnoreCase(username).orElseThrow();
        Role role = roleRepository.findByCode(roleCode).orElseThrow();

        user.setEmailVerifiedAt(Instant.now());
        userRepository.saveAndFlush(user);

        UserRole userRole = user.addRole(role);
        userRoleRepository.saveAndFlush(userRole);
    }

    private void assignRoleWithoutVerifyingEmail(String username, RoleCode roleCode) {
        User user = userRepository.findByUsernameIgnoreCase(username).orElseThrow();
        Role role = roleRepository.findByCode(roleCode).orElseThrow();

        UserRole userRole = user.addRole(role);
        userRoleRepository.saveAndFlush(userRole);
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

    @RestController
    static class AuthorizationTestController {

        @GetMapping("/api/v1/organizer/authorization-test")
        String organizerEndpoint() {
            return "ORGANIZER_ACCESS_GRANTED";
        }

        @GetMapping("/api/v1/partner/authorization-test")
        String partnerEndpoint() {
            return "PARTNER_ACCESS_GRANTED";
        }

    }
}
