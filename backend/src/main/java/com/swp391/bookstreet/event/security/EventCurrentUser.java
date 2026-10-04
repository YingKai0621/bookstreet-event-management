package com.swp391.bookstreet.event.security;

import com.swp391.bookstreet.event.exception.EventException;
import com.swp391.bookstreet.security.authentication.AuthenticatedPrincipal;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

@Component
public class EventCurrentUser {

    public Long requireOrganizerId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();

        if (authentication == null || !authentication.isAuthenticated()
                || authentication instanceof AnonymousAuthenticationToken) {
            throw new EventException(HttpStatus.UNAUTHORIZED, "AUTHENTICATION_REQUIRED",
                    "An authenticated session is required.");
        }

        if (!hasOrganizerRole(authentication)) {
            throw accessDenied();
        }

        Object principalObject = authentication.getPrincipal();
        if (!(principalObject instanceof AuthenticatedPrincipal)) {
            throw accessDenied();
        }

        AuthenticatedPrincipal principal = (AuthenticatedPrincipal) principalObject;
        Long userId = principal.userId();

        if (userId == null || userId <= 0) {
            throw accessDenied();
        }

        if (!principal.emailVerified()) {
            throw accessDenied();
        }

        return userId;
    }

    private boolean hasOrganizerRole(Authentication authentication) {
        for (GrantedAuthority authority : authentication.getAuthorities()) {
            if ("ROLE_ORGANIZER".equals(authority.getAuthority())) {
                return true;
            }
        }

        return false;
    }

    private EventException accessDenied() {
        return new EventException(
                HttpStatus.FORBIDDEN,
                "ACCESS_DENIED",
                "You do not have permission to access this resource."
        );
    }
}

