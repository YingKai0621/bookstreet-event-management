package com.swp391.bookstreet.reward.security;

import com.swp391.bookstreet.common.exception.ApiException;
import com.swp391.bookstreet.security.authentication.AuthenticatedPrincipal;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

@Component
public class RewardCurrentUser {
    public Long requireParticipantId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()
                || authentication instanceof AnonymousAuthenticationToken
                || authentication.getAuthorities().stream().noneMatch(
                        authority -> "ROLE_PARTICIPANT".equals(authority.getAuthority()))
                || !(authentication.getPrincipal() instanceof AuthenticatedPrincipal principal)
                || principal.userId() == null || principal.userId() <= 0) {
            throw new ApiException(HttpStatus.FORBIDDEN, "ACCESS_DENIED",
                    "You do not have permission to access this resource.");
        }
        return principal.userId();
    }
}
