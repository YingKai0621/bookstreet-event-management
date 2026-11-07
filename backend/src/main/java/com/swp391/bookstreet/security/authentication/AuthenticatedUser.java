package com.swp391.bookstreet.security.authentication;

import com.swp391.bookstreet.auth.entity.AccountStatus;
import com.swp391.bookstreet.auth.entity.RoleCode;
import com.swp391.bookstreet.auth.entity.User;
import com.swp391.bookstreet.auth.entity.UserRole;
import org.springframework.security.core.CredentialsContainer;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;


import java.io.Serial;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;

public final class AuthenticatedUser implements UserDetails, CredentialsContainer, AuthenticatedPrincipal {

    @Serial
    private static final long serialVersionUID = 1L;

    private final Long userId;
    private final String username;
    private String password;
    private final boolean enabled;
    private final boolean emailVerified;
    private final List<GrantedAuthority> authorities;
    private final Instant authenticatedAt;

    private AuthenticatedUser(
            Long userId,
            String username,
            String password,
            boolean enabled,
            boolean emailVerified,
            List<GrantedAuthority> authorities
    ) {
        this.userId = userId;
        this.username = username;
        this.password = password;
        this.enabled = enabled;
        this.emailVerified = emailVerified;
        this.authorities = List.copyOf(authorities);
        this.authenticatedAt = Instant.now();
    }

    public static AuthenticatedUser from(User user) {
        List<GrantedAuthority> authorities = new ArrayList<>();
        boolean emailVerified = user.getEmailVerifiedAt() != null;

        for (UserRole userRole : user.getUserRoles()) {
            RoleCode roleCode = userRole.getRole().getCode();

            if (requiresVerifiedEmail(roleCode) && !emailVerified) {
                continue;
            }

            String roleName = roleCode.name();
            String authorityName = "ROLE_" + roleName;

            GrantedAuthority authority = new SimpleGrantedAuthority(authorityName);
            authorities.add(authority);
        }

        boolean enabled = user.getStatus() == AccountStatus.ACTIVE;

        return new AuthenticatedUser(
                user.getId(),
                user.getUsername(),
                user.getPasswordHash(),
                enabled,
                emailVerified,
                authorities
        );
    }

    private static boolean requiresVerifiedEmail(RoleCode roleCode) {
        return roleCode == RoleCode.PARTNER
                || roleCode == RoleCode.ORGANIZER
                || roleCode == RoleCode.ADMIN;
    }

    public Long getUserId() {
        return userId;
    }

    /** Null only for a Session stored before this field existed. */
    public Instant getAuthenticatedAt() {
        return authenticatedAt;
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return authorities;
    }

    @Override
    public String getPassword() {
        return password;
    }

    @Override
    public String getUsername() {
        return username;
    }

    @Override
    public boolean isEnabled() {
        return enabled;
    }

    public boolean isEmailVerified() {
        return emailVerified;
    }

    @Override
    public void eraseCredentials() {
        password = null;
    }

    @Override
    public Long userId() {
        return userId;
    }

    @Override
    public boolean emailVerified() {
        return emailVerified;
    }
}
