package com.swp391.bookstreet.activity.security;

import com.swp391.bookstreet.activity.exception.ActivityApiException;
import com.swp391.bookstreet.security.authentication.AuthenticatedPrincipal;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

@Component
public class ActivityCurrentUser {
    public Long requireOrganizerId() {
        return requireRole("ROLE_ORGANIZER");
    }

    public Long requirePartnerId() {
        return requireRole("ROLE_PARTNER");
    }

    private Long requireRole(String role) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()
                || authentication instanceof AnonymousAuthenticationToken
                || authentication.getAuthorities().stream()
                        .noneMatch(authority -> role.equals(authority.getAuthority()))
                || !(authentication.getPrincipal() instanceof AuthenticatedPrincipal principal)
                || principal.userId() == null || principal.userId() <= 0
                || !principal.emailVerified()) {
            throw new ActivityApiException(HttpStatus.FORBIDDEN, "ACCESS_DENIED",
                    "You do not have permission to access this resource.");
        }
        return principal.userId();
    }
}
