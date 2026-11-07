package com.swp391.bookstreet.notification.security;

import com.swp391.bookstreet.auth.entity.AccountStatus;
import com.swp391.bookstreet.auth.repository.UserRepository;
import com.swp391.bookstreet.common.exception.ApiException;
import com.swp391.bookstreet.notification.entity.NotificationRecipientRole;
import com.swp391.bookstreet.security.authentication.AuthenticatedPrincipal;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

@Component
public class NotificationCurrentUser {
    private final UserRepository userRepository;

    public NotificationCurrentUser(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    public Long requireParticipantId() {
        return requireUserId(NotificationRecipientRole.PARTICIPANT);
    }

    public Long requireUserId(NotificationRecipientRole role) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()
                || authentication instanceof AnonymousAuthenticationToken
                || authentication.getAuthorities().stream().noneMatch(
                        authority -> ("ROLE_" + role.name()).equals(authority.getAuthority()))
                || !(authentication.getPrincipal() instanceof AuthenticatedPrincipal principal)
                || principal.userId() == null || principal.userId() <= 0
                || !isActive(principal.userId())) {
            throw new ApiException(HttpStatus.FORBIDDEN, "ACCESS_DENIED",
                    "You do not have permission to access this resource.");
        }
        return principal.userId();
    }

    // An existing Session outlives account disabling, so the durable status is read on each call.
    private boolean isActive(Long userId) {
        return userRepository.findById(userId)
                .map(user -> user.getStatus() == AccountStatus.ACTIVE)
                .orElse(false);
    }
}
