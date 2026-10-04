package com.swp391.bookstreet.event;

import com.swp391.bookstreet.event.exception.EventException;
import com.swp391.bookstreet.event.security.EventCurrentUser;
import com.swp391.bookstreet.security.authentication.AuthenticatedPrincipal;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import static org.assertj.core.api.Assertions.*;

class EventCurrentUserTests {
    private final EventCurrentUser currentUser = new EventCurrentUser();

    @AfterEach
    void clearContext() { SecurityContextHolder.clearContext(); }

    @Test
    void missingSessionIsUnauthorized() {
        assertError(401, "AUTHENTICATION_REQUIRED");
    }

    @Test
    void anonymousSessionIsUnauthorized() {
        SecurityContextHolder.getContext().setAuthentication(new AnonymousAuthenticationToken(
                "test-key", "anonymousUser", List.of(new SimpleGrantedAuthority("ROLE_ANONYMOUS"))));
        assertError(401, "AUTHENTICATION_REQUIRED");
    }

    @Test
    void unverifiedOrganizerIsForbidden() {
        authenticate(new Identity(7L, false), "ROLE_ORGANIZER");
        assertError(403, "ACCESS_DENIED");
    }

    @Test
    void participantCannotManageEvents() {
        authenticate(new Identity(7L, true), "ROLE_PARTICIPANT");
        assertError(403, "ACCESS_DENIED");
    }

    @Test
    void unsupportedPrincipalCannotClaimOwnership() {
        authenticate("7", "ROLE_ORGANIZER");
        assertError(403, "ACCESS_DENIED");
    }

    @Test
    void invalidUserIdCannotClaimOwnership() {
        authenticate(new Identity(0L, true), "ROLE_ORGANIZER");
        assertError(403, "ACCESS_DENIED");
    }

    @Test
    void verifiedOrganizerUsesAuthenticatedIdentity() {
        authenticate(new Identity(7L, true), "ROLE_ORGANIZER");
        assertThat(currentUser.requireOrganizerId()).isEqualTo(7L);
    }

    private void authenticate(Object principal, String role) {
        SecurityContextHolder.getContext().setAuthentication(
                UsernamePasswordAuthenticationToken.authenticated(principal, null,
                        List.of(new SimpleGrantedAuthority(role))));
    }

    private void assertError(int status, String code) {
        assertThatThrownBy(currentUser::requireOrganizerId).isInstanceOfSatisfying(
                EventException.class, error -> {
                    assertThat(error.getStatus().value()).isEqualTo(status);
                    assertThat(error.getCode()).isEqualTo(code);
                });
    }

    record Identity(Long userId, boolean emailVerified) implements AuthenticatedPrincipal {
    }
}

