package com.swp391.bookstreet.security.handler;

import com.swp391.bookstreet.common.response.ApiErrorResponse;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;

@Component
public class RestAuthenticationEntryPoint implements AuthenticationEntryPoint {

    private final ObjectMapper objectMapper;

    public RestAuthenticationEntryPoint(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    public void commence(
            HttpServletRequest request,
            HttpServletResponse response,
            AuthenticationException exception
    ) throws IOException, ServletException {
        ApiErrorResponse errorResponse = new ApiErrorResponse(
                "AUTHENTICATION_REQUIRED",
                "Authentication is required.",
                List.of(),
                Instant.now(),
                request.getRequestURI()
        );

        response.setStatus(HttpStatus.UNAUTHORIZED.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        if (request.getRequestURI().startsWith("/api/v1/organizer/feedbacks")
                || request.getRequestURI().startsWith("/api/v1/organizer/heritages")) {
            response.setHeader("Cache-Control", "no-store");
        }
        objectMapper.writeValue(response.getOutputStream(), errorResponse);
    }
}
