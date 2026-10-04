package com.swp391.bookstreet.event.security;

import com.swp391.bookstreet.event.exception.EventException;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

@Component
public class EventCurrentUser {
    public Long requireOrganizerId() {
        var authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()
                || authentication instanceof AnonymousAuthenticationToken) {
            throw new EventException(HttpStatus.UNAUTHORIZED, "AUTHENTICATION_REQUIRED",
                    "An authenticated session is required.");
        }
        boolean organizer = authentication.getAuthorities().stream()
                .anyMatch(authority -> "ROLE_ORGANIZER".equals(authority.getAuthority()));
        if (!organizer) {
            throw new EventException(HttpStatus.FORBIDDEN, "ORGANIZER_ROLE_REQUIRED",
                    "The ORGANIZER role is required.");
        }
        if (!(authentication.getPrincipal() instanceof EventPrincipal principal)
                || principal.userId() == null || principal.userId() <= 0) {
            // Fail closed until Auth supplies the agreed identity contract.
            throw new EventException(HttpStatus.FORBIDDEN, "EVENT_ACCESS_DENIED",
                    "The session does not contain a supported user identity.");
        }
        if (!principal.emailVerified()) {
            throw new EventException(HttpStatus.FORBIDDEN, "EVENT_ACCESS_DENIED",
                    "A verified email is required.");
        }
        return principal.userId();
    }
}

