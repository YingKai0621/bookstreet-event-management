package com.swp391.bookstreet.auth.service;

import com.swp391.bookstreet.auth.dto.PasswordResetConfirmRequest;
import com.swp391.bookstreet.auth.entity.AccountStatus;
import com.swp391.bookstreet.auth.entity.User;
import com.swp391.bookstreet.auth.entity.UserToken;
import com.swp391.bookstreet.auth.entity.UserTokenType;
import com.swp391.bookstreet.auth.repository.UserRepository;
import com.swp391.bookstreet.auth.repository.UserTokenRepository;
import com.swp391.bookstreet.common.exception.ApiException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Optional;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * BR-120. A request never reveals whether an account exists, is unverified, is locked or has reached a
 * limit: every such case ends silently. A successful reset ends the User's earlier Sessions.
 */
@Service
public class PasswordResetService {
    private static final Duration TOKEN_LIFETIME = Duration.ofMinutes(30);
    private static final Duration ISSUANCE_COOLDOWN = Duration.ofSeconds(60);
    private static final Duration HOURLY_LIMIT_WINDOW = Duration.ofHours(1);
    private static final long MAXIMUM_ISSUANCES_PER_HOUR = 5;
    private static final UserTokenType TYPE = UserTokenType.PASSWORD_RESET;

    private final UserRepository users;
    private final UserTokenRepository tokens;
    private final EmailVerificationTokenGenerator tokenGenerator;
    private final PasswordEncoder passwordEncoder;
    private final ApplicationEventPublisher events;
    private final Clock clock;

    public PasswordResetService(UserRepository users, UserTokenRepository tokens,
            EmailVerificationTokenGenerator tokenGenerator, PasswordEncoder passwordEncoder,
            ApplicationEventPublisher events, Clock clock) {
        this.users = users;
        this.tokens = tokens;
        this.tokenGenerator = tokenGenerator;
        this.passwordEncoder = passwordEncoder;
        this.events = events;
        this.clock = clock;
    }

    @Transactional
    public void request(String email) {
        Optional<User> match = users.findByEmailIgnoreCase(email);
        if (match.isEmpty()) return;
        // Locking the User serializes concurrent requests, so the issue limits cannot be passed twice.
        User user = users.findByIdForUpdate(match.get().getId()).orElse(null);
        if (user == null || user.getStatus() != AccountStatus.ACTIVE || user.getEmailVerifiedAt() == null) return;

        Instant now = now();
        if (limitReached(user.getId(), now)) return;
        tokens.findAllByUserIdAndTokenTypeAndUsedAtIsNullAndRevokedAtIsNull(user.getId(), TYPE)
                .forEach(active -> active.revoke(now));

        String rawToken = tokenGenerator.generateRawToken();
        UserToken token = tokens.saveAndFlush(
                new UserToken(user, TYPE, tokenGenerator.hashToken(rawToken), now, now.plus(TOKEN_LIFETIME)));
        events.publishEvent(new PasswordResetMessageRequested(user.getId(), token.getId(), user.getEmail(), rawToken));
    }

    @Transactional
    public void confirm(PasswordResetConfirmRequest request) {
        if (!request.newPassword().equals(request.confirmPassword())) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_CONTENT, "PASSWORD_CONFIRMATION_MISMATCH",
                    "The password confirmation does not match.");
        }
        if (request.token() == null || request.token().isBlank()) throw invalidToken();

        String tokenHash = tokenGenerator.hashToken(request.token());
        UserToken found = tokens.findByTokenHashAndTokenType(tokenHash, TYPE).orElseThrow(PasswordResetService::invalidToken);
        // Same lock order as email confirmation: the User first, then the token.
        User user = users.findByIdForUpdate(found.getUser().getId()).orElseThrow(PasswordResetService::invalidToken);
        UserToken token = tokens.findByTokenHashAndTokenTypeForUpdate(tokenHash, TYPE)
                .orElseThrow(PasswordResetService::invalidToken);

        Instant now = now();
        if (token.getUsedAt() != null || token.getRevokedAt() != null || !token.getExpiresAt().isAfter(now)
                || user.getStatus() != AccountStatus.ACTIVE) {
            throw invalidToken();
        }

        user.setPasswordHash(passwordEncoder.encode(request.newPassword()));
        user.setSessionsValidFrom(now);
        token.markUsed(now);
        tokens.findAllByUserIdAndTokenTypeAndIdNotAndUsedAtIsNullAndRevokedAtIsNull(user.getId(), TYPE, token.getId())
                .forEach(other -> other.revoke(now));
        tokens.flush();
        users.saveAndFlush(user);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void revokeAfterDeliveryFailure(Long tokenId) {
        tokens.findById(tokenId)
                .filter(token -> token.getTokenType() == TYPE)
                .filter(token -> token.getUsedAt() == null && token.getRevokedAt() == null)
                .ifPresent(token -> token.revoke(now()));
    }

    private boolean limitReached(Long userId, Instant now) {
        boolean coolingDown = tokens.findFirstByUserIdAndTokenTypeOrderByCreatedAtDesc(userId, TYPE)
                .map(latest -> now.isBefore(latest.getCreatedAt().plus(ISSUANCE_COOLDOWN)))
                .orElse(false);
        return coolingDown || tokens.countByUserIdAndTokenTypeAndCreatedAtAfter(
                userId, TYPE, now.minus(HOURLY_LIMIT_WINDOW)) >= MAXIMUM_ISSUANCES_PER_HOUR;
    }

    /** Truncated to the database precision, so a stored cutoff never rounds past a later sign-in. */
    private Instant now() {
        return clock.instant().truncatedTo(ChronoUnit.MICROS);
    }

    private static ApiException invalidToken() {
        return new ApiException(HttpStatus.BAD_REQUEST, "INVALID_OR_EXPIRED_PASSWORD_RESET_TOKEN",
                "The password reset link is invalid or has expired.");
    }
}
