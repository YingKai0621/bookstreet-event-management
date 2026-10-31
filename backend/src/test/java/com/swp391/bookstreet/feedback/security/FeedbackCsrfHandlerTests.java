package com.swp391.bookstreet.feedback.security;

import static org.assertj.core.api.Assertions.assertThat;

import com.swp391.bookstreet.security.handler.RestAccessDeniedHandler;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.web.csrf.MissingCsrfTokenException;
import tools.jackson.databind.ObjectMapper;

class FeedbackCsrfHandlerTests {

    @Test
    void publicFeedbackCsrfFailureUsesFrozenErrorAndNoStore() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/v1/public/feedbacks");
        request.setRequestURI("/api/v1/public/feedbacks");
        MockHttpServletResponse response = new MockHttpServletResponse();

        new RestAccessDeniedHandler(new ObjectMapper()).handle(
                request,
                response,
                new MissingCsrfTokenException("missing")
        );

        assertThat(response.getStatus()).isEqualTo(403);
        assertThat(response.getHeader("Cache-Control")).isEqualTo("no-store");
        assertThat(response.getContentAsString()).contains("\"code\":\"CSRF_INVALID\"");
        assertThat(response.getContentAsString()).contains("\"path\":\"/api/v1/public/feedbacks\"");
    }
}
