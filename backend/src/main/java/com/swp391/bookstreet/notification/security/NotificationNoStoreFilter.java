package com.swp391.bookstreet.notification.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class NotificationNoStoreFilter extends OncePerRequestFilter {
    private static final String[] NOTIFICATION_PATHS = {
            "/api/v1/participant/notifications",
            "/api/v1/partner/notifications",
            "/api/v1/organizer/notifications",
            "/api/v1/admin/notifications"
    };

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI();
        for (String notificationPath : NOTIFICATION_PATHS) {
            if (path.equals(notificationPath) || path.startsWith(notificationPath + "/")) {
                return false;
            }
        }
        return true;
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {
        response.setHeader("Cache-Control", "no-store");
        filterChain.doFilter(request, response);
    }
}
