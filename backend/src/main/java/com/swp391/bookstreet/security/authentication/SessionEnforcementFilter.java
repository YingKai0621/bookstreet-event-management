package com.swp391.bookstreet.security.authentication;

import com.swp391.bookstreet.auth.entity.AccountStatus;
import com.swp391.bookstreet.auth.entity.User;
import com.swp391.bookstreet.auth.repository.UserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import java.io.IOException;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Applies BR-114 to every request that carries a signed-in Session. A locked account or stale Session
 * continues as anonymous, so protected APIs answer 401 while public ones keep working. A removed role
 * stops counting at once, and a role added after sign-in still needs a new sign-in as BR-76 requires,
 * because authorities are only ever narrowed here.
 *
 * <p>Built directly in SecurityConfiguration rather than declared as a bean, so that Spring Boot does
 * not also register it as a servlet filter outside the security chain.
 */
public class SessionEnforcementFilter extends OncePerRequestFilter {
    private static final String ROLE_PREFIX = "ROLE_";

    private final UserRepository users;

    public SessionEnforcementFilter(UserRepository users) {
        this.users = users;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
            FilterChain chain) throws ServletException, IOException {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getPrincipal() instanceof AuthenticatedUser principal) {
            User user = users.findByIdWithRoles(principal.getUserId()).orElse(null);
            if (user == null || user.getStatus() != AccountStatus.ACTIVE
                    || isStale(principal.getAuthenticatedAt(), user.getSessionsValidFrom())) {
                endSession(request);
            } else {
                applyCurrentRoles(authentication, user);
            }
        }
        chain.doFilter(request, response);
    }

    /** A Session created before authenticatedAt existed has none, so it counts as older than any lock. */
    static boolean isStale(Instant authenticatedAt, Instant sessionsValidFrom) {
        if (sessionsValidFrom == null) return false;
        return authenticatedAt == null || authenticatedAt.isBefore(sessionsValidFrom);
    }

    private static void endSession(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        if (session != null) {
            session.invalidate();
        }
        SecurityContextHolder.setContext(SecurityContextHolder.createEmptyContext());
    }

    private static void applyCurrentRoles(Authentication authentication, User user) {
        Set<String> heldRoles = user.getUserRoles().stream()
                .map(userRole -> ROLE_PREFIX + userRole.getRole().getCode().name())
                .collect(Collectors.toSet());
        Collection<? extends GrantedAuthority> stored = authentication.getAuthorities();
        List<GrantedAuthority> effective = stored.stream()
                .filter(authority -> !authority.getAuthority().startsWith(ROLE_PREFIX)
                        || heldRoles.contains(authority.getAuthority()))
                .map(GrantedAuthority.class::cast)
                .toList();
        if (effective.size() == stored.size()) return;

        UsernamePasswordAuthenticationToken narrowed = UsernamePasswordAuthenticationToken.authenticated(
                authentication.getPrincipal(), authentication.getCredentials(), effective);
        narrowed.setDetails(authentication.getDetails());
        // Applies to this request only: nothing saves this context back to the Session.
        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(narrowed);
        SecurityContextHolder.setContext(context);
    }
}
