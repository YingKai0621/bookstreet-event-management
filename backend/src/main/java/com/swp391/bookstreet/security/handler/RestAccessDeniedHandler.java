package com.swp391.bookstreet.security.handler;

import com.swp391.bookstreet.common.response.ApiErrorResponse;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.web.csrf.InvalidCsrfTokenException;
import org.springframework.security.web.csrf.MissingCsrfTokenException;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;

@Component
public class RestAccessDeniedHandler implements AccessDeniedHandler {

    private final ObjectMapper objectMapper;

    public RestAccessDeniedHandler(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    public void handle(
            HttpServletRequest request,
            HttpServletResponse response,
            AccessDeniedException exception
    ) throws IOException, ServletException {
        boolean csrfFailure = exception instanceof MissingCsrfTokenException
                || exception instanceof InvalidCsrfTokenException;
        boolean feedbackRequest = request.getRequestURI().startsWith("/api/v1/public/feedbacks")
                || request.getRequestURI().startsWith("/api/v1/organizer/feedbacks");
        boolean heritageRequest = request.getRequestURI().startsWith("/api/v1/heritages")
                || request.getRequestURI().startsWith("/api/v1/organizer/heritages")
                || request.getRequestURI().startsWith("/api/v1/organizer/heritage-images");
        boolean contractCsrfFailure = csrfFailure
                && (request.getRequestURI().startsWith("/api/v1/admin/badges")
                    || feedbackRequest
                    || heritageRequest);
        ApiErrorResponse errorResponse = new ApiErrorResponse(
                contractCsrfFailure ? "CSRF_INVALID" : "ACCESS_DENIED",
                contractCsrfFailure ? "CSRF token is missing or invalid."
                        : "You do not have permission to access this resource.",
                List.of(),
                Instant.now(),
                request.getRequestURI()
        );

        response.setStatus(HttpStatus.FORBIDDEN.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        if (feedbackRequest || heritageRequest) {
            response.setHeader("Cache-Control", "no-store");
        }
        objectMapper.writeValue(response.getOutputStream(), errorResponse);
    }
}
