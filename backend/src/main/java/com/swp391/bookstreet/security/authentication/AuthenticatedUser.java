package com.swp391.bookstreet.security.authentication;

import com.swp391.bookstreet.auth.entity.AccountStatus;
import com.swp391.bookstreet.auth.entity.User;
import com.swp391.bookstreet.auth.entity.UserRole;
import org.springframework.security.core.CredentialsContainer;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.io.Serial;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;

public final class AuthenticatedUser implements UserDetails, CredentialsContainer {

    @Serial
    private static final long serialVersionUID = 1L;

    private final Long userId;
    private final String username;
    private String password;
    private final boolean enabled;
    private final List<GrantedAuthority> authorities;

    private AuthenticatedUser(
            Long userId,
            String username,
            String password,
            boolean enabled,
            List<GrantedAuthority> authorities
    ) {
        this.userId = userId;
        this.username = username;
        this.password = password;
        this.enabled = enabled;
        this.authorities = List.copyOf(authorities);
    }

    public static AuthenticatedUser from(User user) {
        List<GrantedAuthority> authorities = new ArrayList<>();

        for (UserRole userRole : user.getUserRoles()) {
            String roleName = userRole.getRole().getCode().name();
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
                authorities
        );
    }

    public Long getUserId() {
        return userId;
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

    @Override
    public void eraseCredentials() {
        password = null;
    }
}
