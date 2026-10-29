package com.swp391.bookstreet.documentation;

import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.redirectedUrl;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@DirtiesContext(classMode = DirtiesContext.ClassMode.BEFORE_CLASS)
class OpenApiIntegrationTests {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void openApiDocumentIsPubliclyAvailable() throws Exception {
        mockMvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.openapi").exists())
                .andExpect(jsonPath("$.paths").exists());
    }

    @Test
    void swaggerUiIsPubliclyAvailable() throws Exception {
        mockMvc.perform(get("/swagger-ui.html"))
                .andExpect(status().isFound())
                .andExpect(redirectedUrl("/swagger-ui/index.html"));
    }

    @Test
    void openApiDocumentDescribesAuthenticationInputLimits() throws Exception {
        mockMvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.components.schemas.RegisterRequest.properties.username.minLength").value(3))
                .andExpect(jsonPath("$.components.schemas.RegisterRequest.properties.username.maxLength").value(20))
                .andExpect(jsonPath("$.components.schemas.RegisterRequest.properties.fullName.minLength").value(2))
                .andExpect(jsonPath("$.components.schemas.RegisterRequest.properties.fullName.maxLength").value(50))
                .andExpect(jsonPath("$.components.schemas.RegisterRequest.properties.password.minLength").value(8))
                .andExpect(jsonPath("$.components.schemas.RegisterRequest.properties.password.maxLength").value(64))
                .andExpect(jsonPath("$.components.schemas.LoginRequest.properties.username.minLength").value(3))
                .andExpect(jsonPath("$.components.schemas.LoginRequest.properties.username.maxLength").value(20))
                .andExpect(jsonPath("$.components.schemas.LoginRequest.properties.password.maxLength").value(64))
                .andExpect(jsonPath("$.components.schemas.ConfirmEmailVerificationRequest.properties.token.minLength")
                        .value(43))
                .andExpect(jsonPath("$.components.schemas.ConfirmEmailVerificationRequest.properties.token.maxLength")
                        .value(43));
    }

    @Test
    void openApiDocumentIncludesEmailVerificationEndpoints() throws Exception {
        mockMvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.paths['/api/v1/auth/email-verification/confirm'].post")
                        .exists())
                .andExpect(jsonPath("$.paths['/api/v1/auth/email-verification/resend'].post")
                        .exists());
    }

    @Test
    void openApiDocumentIncludesCsrfEndpoint() throws Exception {
        mockMvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.paths['/api/v1/auth/csrf'].get").exists());
    }

    @Test
    void openApiDocumentDescribesApplicationPaginationAsQueryParameters() throws Exception {
        mockMvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath(
                        "$.paths['/api/v1/partner/applications'].get.parameters[?(@.name == 'page')]"
                ).exists())
                .andExpect(jsonPath(
                        "$.paths['/api/v1/partner/applications'].get.parameters[?(@.name == 'size')]"
                ).exists())
                .andExpect(jsonPath(
                        "$.paths['/api/v1/partner/applications'].get.parameters[?(@.name == 'sort')]"
                ).exists())
                .andExpect(jsonPath(
                        "$.paths['/api/v1/partner/applications'].get.parameters[?(@.name == 'pageable')]"
                ).isEmpty())
                .andExpect(jsonPath(
                        "$.paths['/api/v1/organizer/events/{eventId}/applications'].get.parameters[?(@.name == 'page')]"
                ).exists())
                .andExpect(jsonPath(
                        "$.paths['/api/v1/organizer/events/{eventId}/applications'].get.parameters[?(@.name == 'size')]"
                ).exists())
                .andExpect(jsonPath(
                        "$.paths['/api/v1/organizer/events/{eventId}/applications'].get.parameters[?(@.name == 'sort')]"
                ).exists())
                .andExpect(jsonPath(
                        "$.paths['/api/v1/organizer/events/{eventId}/applications'].get.parameters[?(@.name == 'pageable')]"
                ).isEmpty());
    }

    @Test
    void openApiDocumentDescribesBoothEndpointsAndSeparatePaginationParameters() throws Exception {
        mockMvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.paths['/api/v1/organizer/booths'].post").exists())
                .andExpect(jsonPath("$.paths['/api/v1/organizer/events/{eventId}/booth-configs/{boothId}'].put")
                        .exists())
                .andExpect(jsonPath("$.paths['/api/v1/events/{eventId}/booths'].get").exists())
                .andExpect(jsonPath("$.paths['/api/v1/events/{eventId}/booths/{boothId}'].get").exists())
                .andExpect(jsonPath(
                        "$.paths['/api/v1/organizer/events/{eventId}/booth-requests'].get"
                ).exists())
                .andExpect(jsonPath(
                        "$.paths['/api/v1/organizer/events/{eventId}/booth-requests/{boothRequestId}/select'].post"
                ).exists())
                .andExpect(jsonPath(
                        "$.paths['/api/v1/organizer/events/{eventId}/booth-requests/{boothRequestId}/reject'].post"
                ).exists())
                .andExpect(jsonPath(
                        "$.paths['/api/v1/organizer/booths'].get.parameters[?(@.name == 'page')]"
                ).exists())
                .andExpect(jsonPath(
                        "$.paths['/api/v1/organizer/booths'].get.parameters[?(@.name == 'size')]"
                ).exists())
                .andExpect(jsonPath(
                        "$.paths['/api/v1/organizer/booths'].get.parameters[?(@.name == 'sort')]"
                ).exists())
                .andExpect(jsonPath(
                        "$.paths['/api/v1/events/{eventId}/booths'].get.parameters[?(@.name == 'pageable')]"
                ).isEmpty())
                .andExpect(jsonPath(
                        "$.components.schemas.UpdateBoothRequest.properties.empty"
                ).doesNotExist());
    }

    @Test
    void openApiDocumentIncludesOrganizerActivityRequestEndpoints() throws Exception {
        mockMvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath(
                        "$.paths['/api/v1/organizer/activity-change-requests'].get")
                        .exists())
                .andExpect(jsonPath(
                        "$.paths['/api/v1/organizer/activity-change-requests/{requestId}'].get")
                        .exists())
                .andExpect(jsonPath(
                        "$.paths['/api/v1/organizer/activity-change-requests/{requestId}/approve'].post")
                        .exists())
                .andExpect(jsonPath(
                        "$.paths['/api/v1/organizer/activity-change-requests/{requestId}/reject'].post")
                        .exists())
                .andExpect(jsonPath(
                        "$.paths['/api/v1/organizer/activity-cancellation-requests'].get")
                        .exists())
                .andExpect(jsonPath(
                        "$.paths['/api/v1/organizer/activity-cancellation-requests/{requestId}'].get")
                        .exists())
                .andExpect(jsonPath(
                        "$.paths['/api/v1/organizer/activity-cancellation-requests/{requestId}/approve'].post")
                        .exists())
                .andExpect(jsonPath(
                        "$.paths['/api/v1/organizer/activity-cancellation-requests/{requestId}/reject'].post")
                        .exists());
    }

    @Test
    void openApiDocumentIncludesSprint7RewardEndpoints() throws Exception {
        mockMvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.paths['/api/v1/participant/booth-visits/scan'].post").exists())
                .andExpect(jsonPath("$.paths['/api/v1/participant/rewards/summary'].get").exists())
                .andExpect(jsonPath("$.paths['/api/v1/participant/rewards/point-transactions'].get").exists())
                .andExpect(jsonPath("$.paths['/api/v1/participant/rewards/badges'].get").exists())
                .andExpect(jsonPath("$.paths['/api/v1/organizer/events/{eventId}/booth-visits/summary'].get")
                        .exists())
                .andExpect(jsonPath("$.paths['/api/v1/organizer/events/{eventId}/booth-visit-groups'].get")
                        .exists())
                .andExpect(jsonPath("$.paths['/api/v1/organizer/events/{eventId}/booth-visits'].get")
                        .exists())
                .andExpect(jsonPath("$.paths['/api/v1/admin/badges'].get").exists())
                .andExpect(jsonPath("$.paths['/api/v1/admin/badges/{badgeId}'].get").exists())
                .andExpect(jsonPath("$.paths['/api/v1/admin/badges'].post").exists())
                .andExpect(jsonPath("$.paths['/api/v1/admin/badges/{badgeId}'].put").exists())
                .andExpect(jsonPath("$.paths['/api/v1/admin/badges/{badgeId}/synchronize-awards'].post")
                        .exists());
    }

    @Test
    void unsafeRequestWithoutCsrfTokenIsRejected() throws Exception {
        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void csrfCookieAndHeaderAllowRequestToReachValidation() throws Exception {
        MockHttpServletResponse csrfResponse = mockMvc.perform(get("/api/v1/auth/csrf"))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse();

        Cookie csrfCookie = csrfResponse.getCookie("XSRF-TOKEN");
        assertThat(csrfCookie).isNotNull();
        assertThat(csrfCookie.isHttpOnly()).isFalse();

        String csrfToken = csrfCookie.getValue();

        mockMvc.perform(post("/api/v1/auth/register")
                        .cookie(csrfCookie)
                        .header("X-XSRF-TOKEN", csrfToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isUnprocessableContent());
    }
}
