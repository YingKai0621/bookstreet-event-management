package com.swp391.bookstreet.auth.service;

import com.swp391.bookstreet.auth.dto.AccountResponse;
import com.swp391.bookstreet.auth.dto.LoginRequest;
import com.swp391.bookstreet.auth.dto.LoginResponse;
import com.swp391.bookstreet.auth.dto.LoginUserResponse;
import com.swp391.bookstreet.auth.dto.RegisterRequest;
import com.swp391.bookstreet.auth.entity.Role;
import com.swp391.bookstreet.auth.entity.RoleCode;
import com.swp391.bookstreet.auth.entity.User;
import com.swp391.bookstreet.auth.entity.UserRole;
import com.swp391.bookstreet.auth.repository.RoleRepository;
import com.swp391.bookstreet.auth.repository.UserRepository;
import com.swp391.bookstreet.auth.repository.UserRoleRepository;
import com.swp391.bookstreet.common.exception.ApiException;
import com.swp391.bookstreet.security.authentication.AuthenticatedUser;
import org.hibernate.exception.ConstraintViolationException;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final UserRoleRepository userRoleRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final EmailVerificationTokenService emailVerificationTokenService;
    private final ApplicationEventPublisher eventPublisher;

    public AuthService(
            UserRepository userRepository,
            RoleRepository roleRepository,
            UserRoleRepository userRoleRepository,
            PasswordEncoder passwordEncoder,
            AuthenticationManager authenticationManager,
            EmailVerificationTokenService emailVerificationTokenService,
            ApplicationEventPublisher eventPublisher
    ) {
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.userRoleRepository = userRoleRepository;
        this.passwordEncoder = passwordEncoder;
        this.authenticationManager = authenticationManager;
        this.emailVerificationTokenService = emailVerificationTokenService;
        this.eventPublisher = eventPublisher;
    }

    @Transactional
    public AccountResponse register(RegisterRequest request) {
        validatePasswordConfirmation(request);
        validateUniqueUsername(request.username());

        String email = normalizeOptionalEmail(request.email());
        validateUniqueEmail(email);

        Optional<Role> participantRoleResult = roleRepository.findByCode(RoleCode.PARTICIPANT);

        if (participantRoleResult.isEmpty()) {
            throw new ApiException(
                    HttpStatus.INTERNAL_SERVER_ERROR,
                    "SYSTEM_ROLE_NOT_FOUND",
                    "The PARTICIPANT system role is not configured."
            );
        }

        Role participantRole = participantRoleResult.get();

        User user = new User(
                request.username(),
                email,
                passwordEncoder.encode(request.password()),
                request.fullName()
        );

        try {
            userRepository.saveAndFlush(user);
            UserRole userRole = user.addRole(participantRole);
            userRoleRepository.saveAndFlush(userRole);

            if (email != null) {
                requestEmailVerification(user);
            }
        } catch (DataIntegrityViolationException exception) {
            throw mapDuplicateConstraint(exception);
        }

        return new AccountResponse(
                user.getId(),
                user.getUsername(),
                user.getFullName(),
                user.getEmail(),
                user.getEmailVerifiedAt() != null,
                user.getStatus(),
                List.of(participantRole.getCode())
        );
    }

    private void requestEmailVerification(User user) {
        IssuedEmailVerificationToken issuedToken =
                emailVerificationTokenService.issueToken(user);

        EmailVerificationMessageRequested event =
                new EmailVerificationMessageRequested(
                        user.getId(),
                        issuedToken.getTokenId(),
                        user.getEmail(),
                        issuedToken.getRawToken()
                );

        eventPublisher.publishEvent(event);
    }

    @Transactional
    public LoginResult login(LoginRequest request) {
        Authentication authenticationRequest = UsernamePasswordAuthenticationToken.unauthenticated(
                request.username(),
                request.password()
        );

        Authentication authenticationResult;

        try {
            authenticationResult = authenticationManager.authenticate(authenticationRequest);
        } catch (DisabledException exception) {
            throw new ApiException(
                    HttpStatus.FORBIDDEN,
                    "ACCOUNT_NOT_ACTIVE",
                    "The account is not active."
            );
        } catch (AuthenticationException exception) {
            throw new ApiException(
                    HttpStatus.UNAUTHORIZED,
                    "INVALID_CREDENTIALS",
                    "Invalid username or password."
            );
        }

        Object principalObject = authenticationResult.getPrincipal();

        if (!(principalObject instanceof AuthenticatedUser)) {
            throw new ApiException(
                    HttpStatus.INTERNAL_SERVER_ERROR,
                    "AUTHENTICATION_PRINCIPAL_INVALID",
                    "The authenticated user could not be loaded."
            );
        }

        AuthenticatedUser authenticatedUser = (AuthenticatedUser) principalObject;
        Optional<User> userResult = userRepository.findByIdWithRoles(authenticatedUser.getUserId());

        if (userResult.isEmpty()) {
            throw new ApiException(
                    HttpStatus.INTERNAL_SERVER_ERROR,
                    "AUTHENTICATED_USER_NOT_FOUND",
                    "The authenticated user could not be loaded."
            );
        }

        User user = userResult.get();
        user.setLastLoginAt(Instant.now());
        userRepository.saveAndFlush(user);

        List<RoleCode> roles = new ArrayList<>();

        for (UserRole userRole : user.getUserRoles()) {
            roles.add(userRole.getRole().getCode());
        }

        Collections.sort(roles);

        LoginUserResponse userResponse = new LoginUserResponse(
                user.getId(),
                user.getUsername(),
                user.getFullName(),
                roles
        );

        LoginResponse loginResponse = new LoginResponse(userResponse);
        return new LoginResult(authenticationResult, loginResponse);
    }

    @Transactional(readOnly = true)
    public AccountResponse getCurrentAccount(Long userId) {
        Optional<User> userResult = userRepository.findByIdWithRoles(userId);

        if (userResult.isEmpty()) {
            throw new ApiException(
                    HttpStatus.UNAUTHORIZED,
                    "AUTHENTICATION_REQUIRED",
                    "Authentication is required."
            );
        }

        User user = userResult.get();
        List<RoleCode> roles = new ArrayList<>();

        for (UserRole userRole : user.getUserRoles()) {
            roles.add(userRole.getRole().getCode());
        }

        Collections.sort(roles);

        return new AccountResponse(
                user.getId(),
                user.getUsername(),
                user.getFullName(),
                user.getEmail(),
                user.getEmailVerifiedAt() != null,
                user.getStatus(),
                roles
        );
    }

    private void validatePasswordConfirmation(RegisterRequest request) {
        if (!Objects.equals(request.password(), request.confirmPassword())) {
            throw new ApiException(
                    HttpStatus.UNPROCESSABLE_CONTENT,
                    "PASSWORD_CONFIRMATION_MISMATCH",
                    "Password and confirmPassword must match."
            );
        }
    }

    private void validateUniqueUsername(String username) {
        if (userRepository.existsByUsernameIgnoreCase(username)) {
            throw usernameAlreadyExists();
        }
    }

    private void validateUniqueEmail(String email) {
        if (email != null && userRepository.existsByEmailIgnoreCase(email)) {
            throw emailAlreadyExists();
        }
    }

    private String normalizeOptionalEmail(String email) {
        if (email == null) {
            return null;
        }

        if (email.isBlank()) {
            return null;
        }

        return email.strip();
    }

    private ApiException mapDuplicateConstraint(DataIntegrityViolationException exception) {
        Throwable cause = exception;
        while (cause != null) {
            if (cause instanceof ConstraintViolationException constraintViolation) {
                if ("uk_users_username_ci".equals(constraintViolation.getConstraintName())) {
                    return usernameAlreadyExists();
                }
                if ("uk_users_email_ci".equals(constraintViolation.getConstraintName())) {
                    return emailAlreadyExists();
                }
            }
            cause = cause.getCause();
        }
        throw exception;
    }

    private ApiException usernameAlreadyExists() {
        return new ApiException(
                HttpStatus.CONFLICT,
                "USERNAME_ALREADY_EXISTS",
                "Username is already in use."
        );
    }

    private ApiException emailAlreadyExists() {
        return new ApiException(
                HttpStatus.CONFLICT,
                "EMAIL_ALREADY_EXISTS",
                "Email is already in use."
        );
    }
}
