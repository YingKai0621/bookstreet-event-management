package com.swp391.bookstreet.security.authentication;

import com.swp391.bookstreet.auth.dto.RegisterRequest;
import com.swp391.bookstreet.auth.entity.AccountStatus;
import com.swp391.bookstreet.auth.entity.RoleCode;
import com.swp391.bookstreet.auth.entity.User;
import com.swp391.bookstreet.auth.repository.UserRepository;
import com.swp391.bookstreet.auth.service.AuthService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@Transactional
class DatabaseAuthenticationIntegrationTests {

    private static final String RAW_PASSWORD = "learning-password";

    @Autowired
    private AuthenticationManager authenticationManager;

    @Autowired
    private AuthService authService;

    @Autowired
    private UserRepository userRepository;

    @Test
    void authenticatesActiveUserCaseInsensitivelyWithDatabaseRole() {
        String username = "security" + uniqueSuffix();
        register(username);

        Authentication authentication = authenticate(username.toUpperCase(), RAW_PASSWORD);

        assertThat(authentication.isAuthenticated()).isTrue();
        assertThat(authentication.getPrincipal()).isInstanceOf(AuthenticatedUser.class);

        AuthenticatedUser principal = (AuthenticatedUser) authentication.getPrincipal();
        User savedUser = userRepository.findByUsernameIgnoreCase(username).orElseThrow();

        assertThat(principal.getUserId()).isEqualTo(savedUser.getId());
        assertThat(principal.getUsername()).isEqualTo(username);

        List<String> authorityNames = new ArrayList<>();
        for (GrantedAuthority authority : principal.getAuthorities()) {
            authorityNames.add(authority.getAuthority());
        }

        assertThat(authorityNames).containsExactly("ROLE_" + RoleCode.PARTICIPANT.name());
        assertThat(principal.getPassword()).isNull();
    }

    @Test
    void rejectsIncorrectPasswordWithGenericAuthenticationFailure() {
        String username = "wrongpass" + uniqueSuffix();
        register(username);

        try {
            authenticate(username, "incorrect-password");
            throw new AssertionError("Expected authentication to reject an incorrect password.");
        } catch (BadCredentialsException exception) {
            assertThat(exception).isNotNull();
        }
    }

    @Test
    void rejectsUnknownUsernameWithSameGenericAuthenticationFailure() {
        String unknownUsername = "missing" + uniqueSuffix();

        try {
            authenticate(unknownUsername, RAW_PASSWORD);
            throw new AssertionError("Expected authentication to reject an unknown username.");
        } catch (BadCredentialsException exception) {
            assertThat(exception).isNotNull();
        }
    }

    @Test
    void rejectsDisabledAccount() {
        String username = "disabled" + uniqueSuffix();
        register(username);

        User user = userRepository.findByUsernameIgnoreCase(username).orElseThrow();
        user.setStatus(AccountStatus.DISABLED);
        userRepository.saveAndFlush(user);

        try {
            authenticate(username, RAW_PASSWORD);
            throw new AssertionError("Expected authentication to reject a disabled account.");
        } catch (DisabledException exception) {
            assertThat(exception).isNotNull();
        }
    }

    private void register(String username) {
        authService.register(new RegisterRequest(
                username,
                "Security Test Account",
                RAW_PASSWORD,
                RAW_PASSWORD,
                null
        ));
    }

    private Authentication authenticate(String username, String password) {
        return authenticationManager.authenticate(
                UsernamePasswordAuthenticationToken.unauthenticated(username, password)
        );
    }

    private String uniqueSuffix() {
        return UUID.randomUUID().toString().replace("-", "").substring(0, 10);
    }
}
