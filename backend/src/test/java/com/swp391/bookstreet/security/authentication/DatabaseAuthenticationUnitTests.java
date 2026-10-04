package com.swp391.bookstreet.security.authentication;

import com.swp391.bookstreet.auth.entity.AccountStatus;
import com.swp391.bookstreet.auth.entity.Role;
import com.swp391.bookstreet.auth.entity.RoleCode;
import com.swp391.bookstreet.auth.entity.User;
import com.swp391.bookstreet.auth.entity.UserRole;
import com.swp391.bookstreet.auth.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.authentication.ProviderManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class DatabaseAuthenticationUnitTests {

    private static final String USERNAME = "book_lover";
    private static final String RAW_PASSWORD = "learning-password";

    private UserRepository userRepository;
    private PasswordEncoder passwordEncoder;
    private AuthenticationManager authenticationManager;

    @BeforeEach
    void setUp() {
        userRepository = mock(UserRepository.class);
        passwordEncoder = new BCryptPasswordEncoder();

        DatabaseUserDetailsService userDetailsService = new DatabaseUserDetailsService(userRepository);
        DaoAuthenticationProvider provider = new DaoAuthenticationProvider(userDetailsService);
        provider.setPasswordEncoder(passwordEncoder);
        authenticationManager = new ProviderManager(provider);
    }

    @Test
    void authenticatesActiveUserAndErasesPasswordHashFromPrincipal() {
        User user = userWithStatus(AccountStatus.ACTIVE);
        when(userRepository.findByUsernameIgnoreCase(USERNAME.toUpperCase()))
                .thenReturn(Optional.of(user));

        Authentication authentication = authenticate(USERNAME.toUpperCase(), RAW_PASSWORD);

        assertThat(authentication.isAuthenticated()).isTrue();
        assertThat(authentication.getPrincipal()).isInstanceOf(AuthenticatedUser.class);
        assertThat(authentication.getPrincipal()).isInstanceOf(AuthenticatedPrincipal.class);

        AuthenticatedUser principal = (AuthenticatedUser) authentication.getPrincipal();
        assertThat(principal.getUserId()).isEqualTo(42L);
        assertThat(principal.getUsername()).isEqualTo(USERNAME);

        List<String> authorityNames = new ArrayList<>();
        for (GrantedAuthority authority : principal.getAuthorities()) {
            authorityNames.add(authority.getAuthority());
        }

        assertThat(authorityNames).containsExactly("ROLE_PARTICIPANT");
        assertThat(principal.isEmailVerified()).isFalse();
        assertThat(principal.getPassword()).isNull();
    }

    @Test
    void doesNotGrantPartnerAuthorityWhenEmailIsNotVerified() {
        User user = userWithRole(RoleCode.PARTNER, null);

        AuthenticatedUser principal = AuthenticatedUser.from(user);

        List<String> authorityNames = authorityNames(principal);
        assertThat(authorityNames).isEmpty();
        assertThat(principal.isEmailVerified()).isFalse();
    }

    @Test
    void grantsPartnerAuthorityWhenEmailIsVerified() {
        User user = userWithRole(RoleCode.PARTNER, Instant.now());

        AuthenticatedUser principal = AuthenticatedUser.from(user);

        List<String> authorityNames = authorityNames(principal);
        assertThat(authorityNames).containsExactly("ROLE_PARTNER");
        assertThat(principal.isEmailVerified()).isTrue();
    }

    @Test
    void rejectsIncorrectPassword() {
        User user = userWithStatus(AccountStatus.ACTIVE);
        when(userRepository.findByUsernameIgnoreCase(USERNAME))
                .thenReturn(Optional.of(user));

        try {
            authenticate(USERNAME, "incorrect-password");
            throw new AssertionError("Expected authentication to reject an incorrect password.");
        } catch (BadCredentialsException exception) {
            assertThat(exception).isNotNull();
        }
    }

    @Test
    void hidesUnknownUsernameBehindBadCredentials() {
        when(userRepository.findByUsernameIgnoreCase(USERNAME)).thenReturn(Optional.empty());

        try {
            authenticate(USERNAME, RAW_PASSWORD);
            throw new AssertionError("Expected authentication to reject an unknown username.");
        } catch (BadCredentialsException exception) {
            assertThat(exception).isNotNull();
        }
    }

    @Test
    void rejectsDisabledAccount() {
        User user = userWithStatus(AccountStatus.DISABLED);
        when(userRepository.findByUsernameIgnoreCase(USERNAME))
                .thenReturn(Optional.of(user));

        try {
            authenticate(USERNAME, RAW_PASSWORD);
            throw new AssertionError("Expected authentication to reject a disabled account.");
        } catch (DisabledException exception) {
            assertThat(exception).isNotNull();
        }
    }

    private User userWithStatus(AccountStatus status) {
        User user = userWithRole(RoleCode.PARTICIPANT, null);
        when(user.getStatus()).thenReturn(status);
        return user;
    }

    private User userWithRole(RoleCode roleCode, Instant emailVerifiedAt) {
        Role role = mock(Role.class);
        when(role.getCode()).thenReturn(roleCode);

        UserRole userRole = mock(UserRole.class);
        when(userRole.getRole()).thenReturn(role);

        User user = mock(User.class);
        when(user.getId()).thenReturn(42L);
        when(user.getUsername()).thenReturn(USERNAME);
        when(user.getPasswordHash()).thenReturn(passwordEncoder.encode(RAW_PASSWORD));
        when(user.getStatus()).thenReturn(AccountStatus.ACTIVE);
        when(user.getEmailVerifiedAt()).thenReturn(emailVerifiedAt);
        when(user.getUserRoles()).thenReturn(Set.of(userRole));
        return user;
    }

    private List<String> authorityNames(AuthenticatedUser principal) {
        List<String> authorityNames = new ArrayList<>();

        for (GrantedAuthority authority : principal.getAuthorities()) {
            authorityNames.add(authority.getAuthority());
        }

        return authorityNames;
    }

    private Authentication authenticate(String username, String password) {
        return authenticationManager.authenticate(
                UsernamePasswordAuthenticationToken.unauthenticated(username, password)
        );
    }
}
