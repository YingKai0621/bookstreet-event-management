package com.swp391.bookstreet.auth.service;

import com.swp391.bookstreet.auth.dto.AccountResponse;
import com.swp391.bookstreet.auth.dto.RegisterRequest;
import com.swp391.bookstreet.auth.entity.Role;
import com.swp391.bookstreet.auth.entity.RoleCode;
import com.swp391.bookstreet.auth.entity.User;
import com.swp391.bookstreet.auth.entity.UserRole;
import com.swp391.bookstreet.auth.repository.RoleRepository;
import com.swp391.bookstreet.auth.repository.UserRepository;
import com.swp391.bookstreet.auth.repository.UserRoleRepository;
import com.swp391.bookstreet.common.exception.ApiException;
import org.hibernate.exception.ConstraintViolationException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Objects;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final UserRoleRepository userRoleRepository;
    private final PasswordEncoder passwordEncoder;

    public AuthService(
            UserRepository userRepository,
            RoleRepository roleRepository,
            UserRoleRepository userRoleRepository,
            PasswordEncoder passwordEncoder
    ) {
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.userRoleRepository = userRoleRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional
    public AccountResponse register(RegisterRequest request) {
        validatePasswordConfirmation(request);
        validateUniqueUsername(request.username());

        String email = normalizeOptionalEmail(request.email());
        validateUniqueEmail(email);

        Role participantRole = roleRepository.findByCode(RoleCode.PARTICIPANT)
                .orElseThrow(() -> new ApiException(
                        HttpStatus.INTERNAL_SERVER_ERROR,
                        "SYSTEM_ROLE_NOT_FOUND",
                        "The PARTICIPANT system role is not configured."
                ));

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
        return email == null || email.isBlank() ? null : email;
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
