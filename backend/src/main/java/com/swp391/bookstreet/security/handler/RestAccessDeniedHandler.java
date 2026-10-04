package com.swp391.bookstreet.security.handler;

import com.swp391.bookstreet.common.response.ApiErrorResponse;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
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
        String path = request.getRequestURI();
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        boolean partnerEndpoint = path.startsWith("/api/v1/partner/")
                || path.equals("/api/v1/partner")
                || path.matches("/api/v1/events/[^/]+/applications");
        boolean hasPartnerRole = authentication != null && authentication.getAuthorities().stream()
                .anyMatch(authority -> "ROLE_PARTNER".equals(authority.getAuthority()));
        String code = partnerEndpoint && !hasPartnerRole
                ? "PARTNER_ROLE_REQUIRED" : "ACCESS_DENIED";
        ApiErrorResponse errorResponse = new ApiErrorResponse(
                code,
                "You do not have permission to access this resource.",
                List.of(),
                Instant.now(),
                request.getRequestURI()
        );

        response.setStatus(HttpStatus.FORBIDDEN.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        objectMapper.writeValue(response.getOutputStream(), errorResponse);
    }
}
