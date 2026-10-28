package com.swp391.bookstreet.reward.security;

import com.swp391.bookstreet.common.exception.ApiException;
import com.swp391.bookstreet.security.authentication.AuthenticatedPrincipal;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

@Component
public class RewardManagementCurrentUser {
    public Long requireOrganizerId() { return requireRole("ROLE_ORGANIZER"); }
    public void requireAdmin() { requireRole("ROLE_ADMIN"); }

    private Long requireRole(String role) {
        var authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()
                || authentication instanceof AnonymousAuthenticationToken) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "AUTHENTICATION_REQUIRED",
                    "An authenticated session is required.");
        }
        if (!(authentication.getPrincipal() instanceof AuthenticatedPrincipal principal)
                || principal.userId() == null || principal.userId() <= 0 || !principal.emailVerified()
                || authentication.getAuthorities().stream().noneMatch(a -> role.equals(a.getAuthority()))) {
            throw new ApiException(HttpStatus.FORBIDDEN, "ACCESS_DENIED",
                    "You do not have permission to access this resource.");
        }
        return principal.userId();
    }
}
