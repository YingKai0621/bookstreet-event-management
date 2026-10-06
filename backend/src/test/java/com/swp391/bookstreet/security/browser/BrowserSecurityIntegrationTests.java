package com.swp391.bookstreet.security.browser;

import com.swp391.bookstreet.auth.dto.RegisterRequest;
import com.swp391.bookstreet.auth.service.AuthService;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
@DirtiesContext(classMode = DirtiesContext.ClassMode.BEFORE_CLASS)
class BrowserSecurityIntegrationTests {

    private static final String ALLOWED_ORIGIN = "http://localhost:5173";
    private static final String UNLISTED_ORIGIN = "https://unlisted.example";
    private static final String RAW_PASSWORD = "learning-password";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private AuthService authService;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void csrfEndpointReturnsUsableTokenAndReadableCookie() throws Exception {
        MvcResult csrfResult = requestCsrfToken();

        Cookie csrfCookie = csrfResult.getResponse().getCookie("XSRF-TOKEN");
        assertThat(csrfCookie).isNotNull();
        assertThat(csrfCookie.isHttpOnly()).isFalse();
        assertThat(csrfCookie.getSecure()).isFalse();
        assertThat(csrfCookie.getAttribute("SameSite")).isEqualTo("Lax");

        String responseToken = readJsonValue(csrfResult, "token");
        String responseHeaderName = readJsonValue(csrfResult, "headerName");

        assertThat(responseHeaderName).isEqualTo("X-XSRF-TOKEN");
        assertThat(responseToken).isEqualTo(csrfCookie.getValue());

        mockMvc.perform(post("/api/v1/auth/register")
                        .cookie(csrfCookie)
                        .header(responseHeaderName, responseToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isUnprocessableContent());
    }

    @Test
    void stateChangingRequestWithoutCsrfUsesStandardAccessDeniedResponse() throws Exception {
        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ACCESS_DENIED"))
                .andExpect(jsonPath("$.path").value("/api/v1/auth/register"));
    }

    @Test
    void configuredOriginReceivesCredentialedCorsHeaders() throws Exception {
        mockMvc.perform(get("/api/v1/auth/csrf")
                        .header(HttpHeaders.ORIGIN, ALLOWED_ORIGIN))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, ALLOWED_ORIGIN))
                .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_CREDENTIALS, "true"));
    }

    @Test
    void unlistedOriginIsRejected() throws Exception {
        mockMvc.perform(get("/api/v1/auth/csrf")
                        .header(HttpHeaders.ORIGIN, UNLISTED_ORIGIN))
                .andExpect(status().isForbidden())
                .andExpect(header().doesNotExist(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN));
    }

    @Test
    void configuredOriginPreflightRunsBeforeAuthentication() throws Exception {
        mockMvc.perform(options("/api/v1/organizer/events")
                        .header(HttpHeaders.ORIGIN, ALLOWED_ORIGIN)
                        .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "POST")
                        .header(
                                HttpHeaders.ACCESS_CONTROL_REQUEST_HEADERS,
                                "Accept, Content-Type, X-XSRF-TOKEN"
                        ))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, ALLOWED_ORIGIN))
                .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_CREDENTIALS, "true"))
                .andExpect(header().string(
                        HttpHeaders.ACCESS_CONTROL_ALLOW_METHODS,
                        containsString("POST")
                ))
                .andExpect(header().string(
                        HttpHeaders.ACCESS_CONTROL_ALLOW_HEADERS,
                        containsString("X-XSRF-TOKEN")
                ));
    }

    @Test
    void loginAndLogoutRotateCsrfToken() throws Exception {
        String username = "browser" + uniqueSuffix();
        register(username);

        MvcResult initialCsrfResult = requestCsrfToken();
        Cookie initialCsrfCookie = requireCookie(initialCsrfResult, "XSRF-TOKEN");
        String initialCsrfToken = readJsonValue(initialCsrfResult, "token");

        MvcResult loginResult = mockMvc.perform(post("/api/v1/auth/login")
                        .cookie(initialCsrfCookie)
                        .header("X-XSRF-TOKEN", initialCsrfToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(loginJson(username)))
                .andExpect(status().isOk())
                .andReturn();

        Cookie sessionCookie = requireCookie(loginResult, "SESSION");
        Cookie clearedLoginCsrfCookie = requireCookie(loginResult, "XSRF-TOKEN");
        assertThat(clearedLoginCsrfCookie.getMaxAge()).isZero();

        MvcResult authenticatedCsrfResult = mockMvc.perform(get("/api/v1/auth/csrf")
                        .cookie(sessionCookie))
                .andExpect(status().isOk())
                .andReturn();

        Cookie authenticatedCsrfCookie = requireCookie(authenticatedCsrfResult, "XSRF-TOKEN");
        String authenticatedCsrfToken = readJsonValue(authenticatedCsrfResult, "token");
        assertThat(authenticatedCsrfToken).isNotEqualTo(initialCsrfToken);

        MvcResult logoutResult = mockMvc.perform(post("/api/v1/auth/logout")
                        .cookie(sessionCookie, authenticatedCsrfCookie)
                        .header("X-XSRF-TOKEN", authenticatedCsrfToken))
                .andExpect(status().isNoContent())
                .andReturn();

        Cookie clearedSessionCookie = requireCookie(logoutResult, "SESSION");
        Cookie clearedLogoutCsrfCookie = requireCookie(logoutResult, "XSRF-TOKEN");
        assertThat(clearedSessionCookie.getMaxAge()).isZero();
        assertThat(clearedLogoutCsrfCookie.getMaxAge()).isZero();

        MvcResult loggedOutCsrfResult = requestCsrfToken();
        String loggedOutCsrfToken = readJsonValue(loggedOutCsrfResult, "token");
        assertThat(loggedOutCsrfToken).isNotEqualTo(authenticatedCsrfToken);
    }

    private MvcResult requestCsrfToken() throws Exception {
        return mockMvc.perform(get("/api/v1/auth/csrf"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.headerName").value("X-XSRF-TOKEN"))
                .andExpect(jsonPath("$.token").isNotEmpty())
                .andReturn();
    }

    private Cookie requireCookie(MvcResult result, String name) {
        Cookie cookie = result.getResponse().getCookie(name);
        assertThat(cookie).isNotNull();
        return cookie;
    }

    private String readJsonValue(MvcResult result, String fieldName) throws Exception {
        String responseBody = result.getResponse().getContentAsString();
        return objectMapper.readTree(responseBody).get(fieldName).asString();
    }

    private void register(String username) {
        RegisterRequest request = new RegisterRequest(
                username,
                "Browser Security Test",
                RAW_PASSWORD,
                RAW_PASSWORD,
                null
        );
        authService.register(request);
    }

    private String loginJson(String username) {
        return """
                {
                  "username": "%s",
                  "password": "%s"
                }
                """.formatted(username, RAW_PASSWORD);
    }

    private String uniqueSuffix() {
        return UUID.randomUUID().toString().replace("-", "").substring(0, 10);
    }
}
