package com.swp391.bookstreet.auth.service;

import com.swp391.bookstreet.auth.entity.User;
import com.swp391.bookstreet.auth.entity.UserToken;
import com.swp391.bookstreet.auth.entity.UserTokenType;
import com.swp391.bookstreet.auth.repository.UserRepository;
import com.swp391.bookstreet.auth.repository.UserTokenRepository;
import com.swp391.bookstreet.common.exception.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Service
public class EmailVerificationTokenService {

    private static final Duration TOKEN_LIFETIME = Duration.ofMinutes(60);
    private static final Duration ISSUANCE_COOLDOWN = Duration.ofSeconds(60);
    private static final Duration HOURLY_LIMIT_WINDOW = Duration.ofHours(1);
    private static final long MAXIMUM_ISSUANCES_PER_HOUR = 5;

    private final UserTokenRepository userTokenRepository;
    private final UserRepository userRepository;
    private final EmailVerificationTokenGenerator tokenGenerator;
    private final Clock clock;

    public EmailVerificationTokenService(
            UserTokenRepository userTokenRepository,
            UserRepository userRepository,
            EmailVerificationTokenGenerator tokenGenerator,
            Clock clock
    ) {
        this.userTokenRepository = userTokenRepository;
        this.userRepository = userRepository;
        this.tokenGenerator = tokenGenerator;
        this.clock = clock;
    }

    @Transactional
    public IssuedEmailVerificationToken issueToken(User user) {
        return createToken(user);
    }

    @Transactional
    public Optional<EmailVerificationMessageRequested> prepareResend(Long userId) {
        Optional<User> userResult = userRepository.findByIdForUpdate(userId);

        if (userResult.isEmpty()) {
            throw authenticationRequired();
        }

        User user = userResult.get();

        if (user.getEmail() == null || user.getEmail().isBlank()) {
            throw emailRequired();
        }

        if (user.getEmailVerifiedAt() != null) {
            return Optional.empty();
        }

        IssuedEmailVerificationToken issuedToken = createToken(user);
        EmailVerificationMessageRequested messageRequested =
                new EmailVerificationMessageRequested(
                        user.getId(),
                        issuedToken.getTokenId(),
                        user.getEmail(),
                        issuedToken.getRawToken()
                );

        return Optional.of(messageRequested);
    }

    /**
     * Used when an Admin replaces an unverified email: every pending token for the old address is revoked,
     * and a new one is issued only when the existing issue limits allow it, so the change itself never
     * fails on a limit. The User can request another message later through the existing resend flow.
     */
    @Transactional
    public Optional<EmailVerificationMessageRequested> reissueAfterEmailChange(User user) {
        Instant currentTime = clock.instant();
        revokePreviousActiveTokens(user.getId(), currentTime);

        if (user.getEmail() == null || user.getEmailVerifiedAt() != null
                || !withinIssueLimits(user.getId(), currentTime)) {
            return Optional.empty();
        }

        IssuedEmailVerificationToken issuedToken = createToken(user);
        return Optional.of(new EmailVerificationMessageRequested(
                user.getId(),
                issuedToken.getTokenId(),
                user.getEmail(),
                issuedToken.getRawToken()
        ));
    }

    private boolean withinIssueLimits(Long userId, Instant currentTime) {
        Optional<UserToken> latestToken =
                userTokenRepository.findFirstByUserIdAndTokenTypeOrderByCreatedAtDesc(
                        userId,
                        UserTokenType.EMAIL_VERIFICATION
                );
        if (latestToken.isPresent()
                && currentTime.isBefore(latestToken.get().getCreatedAt().plus(ISSUANCE_COOLDOWN))) {
            return false;
        }
        return userTokenRepository.countByUserIdAndTokenTypeAndCreatedAtAfter(
                userId,
                UserTokenType.EMAIL_VERIFICATION,
                currentTime.minus(HOURLY_LIMIT_WINDOW)
        ) < MAXIMUM_ISSUANCES_PER_HOUR;
    }

    private IssuedEmailVerificationToken createToken(User user) {
        Instant currentTime = clock.instant();

        enforceCooldown(user.getId(), currentTime);
        enforceHourlyLimit(user.getId(), currentTime);
        revokePreviousActiveTokens(user.getId(), currentTime);

        String rawToken = tokenGenerator.generateRawToken();
        String tokenHash = tokenGenerator.hashToken(rawToken);
        Instant expiresAt = currentTime.plus(TOKEN_LIFETIME);

        UserToken userToken = new UserToken(
                user,
                UserTokenType.EMAIL_VERIFICATION,
                tokenHash,
                currentTime,
                expiresAt
        );

        userTokenRepository.saveAndFlush(userToken);

        return new IssuedEmailVerificationToken(userToken.getId(), rawToken, expiresAt);
    }

    @Transactional
    public void confirmToken(String rawToken) {
        String tokenHash = tokenGenerator.hashToken(rawToken);

        Optional<UserToken> initialTokenResult =
                userTokenRepository.findByTokenHashAndTokenType(
                        tokenHash,
                        UserTokenType.EMAIL_VERIFICATION
                );

        if (initialTokenResult.isEmpty()) {
            throw invalidOrExpiredToken();
        }

        Long userId = initialTokenResult.get().getUser().getId();
        Optional<User> userResult = userRepository.findByIdForUpdate(userId);

        if (userResult.isEmpty()) {
            throw invalidOrExpiredToken();
        }

        Optional<UserToken> lockedTokenResult =
                userTokenRepository.findByTokenHashAndTokenTypeForUpdate(
                        tokenHash,
                        UserTokenType.EMAIL_VERIFICATION
                );

        if (lockedTokenResult.isEmpty()) {
            throw invalidOrExpiredToken();
        }

        UserToken token = lockedTokenResult.get();
        Instant currentTime = clock.instant();

        validateTokenCanBeConfirmed(token, currentTime);

        User user = userResult.get();

        if (user.getEmail() == null || user.getEmailVerifiedAt() != null) {
            throw invalidOrExpiredToken();
        }

        revokeOtherActiveTokens(userId, token.getId(), currentTime);

        user.setEmailVerifiedAt(currentTime);
        token.markUsed(currentTime);

        userTokenRepository.saveAndFlush(token);
        userRepository.saveAndFlush(user);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void revokeTokenAfterDeliveryFailure(Long tokenId) {
        Optional<UserToken> tokenResult = userTokenRepository.findById(tokenId);

        if (tokenResult.isEmpty()) {
            return;
        }

        UserToken token = tokenResult.get();

        if (token.getTokenType() != UserTokenType.EMAIL_VERIFICATION) {
            return;
        }

        if (token.getUsedAt() != null || token.getRevokedAt() != null) {
            return;
        }

        token.revoke(clock.instant());
        userTokenRepository.saveAndFlush(token);
    }

    private void enforceCooldown(Long userId, Instant currentTime) {
        Optional<UserToken> latestTokenResult =
                userTokenRepository.findFirstByUserIdAndTokenTypeOrderByCreatedAtDesc(
                        userId,
                        UserTokenType.EMAIL_VERIFICATION
                );

        if (latestTokenResult.isEmpty()) {
            return;
        }

        UserToken latestToken = latestTokenResult.get();
        Instant nextAllowedIssuanceTime = latestToken.getCreatedAt().plus(ISSUANCE_COOLDOWN);

        if (currentTime.isBefore(nextAllowedIssuanceTime)) {
            throw rateLimitExceeded();
        }
    }

    private void enforceHourlyLimit(Long userId, Instant currentTime) {
        Instant windowStart = currentTime.minus(HOURLY_LIMIT_WINDOW);

        long recentIssuanceCount =
                userTokenRepository.countByUserIdAndTokenTypeAndCreatedAtAfter(
                        userId,
                        UserTokenType.EMAIL_VERIFICATION,
                        windowStart
                );

        if (recentIssuanceCount >= MAXIMUM_ISSUANCES_PER_HOUR) {
            throw rateLimitExceeded();
        }
    }

    private void revokePreviousActiveTokens(Long userId, Instant currentTime) {
        List<UserToken> activeTokens =
                userTokenRepository.findAllByUserIdAndTokenTypeAndUsedAtIsNullAndRevokedAtIsNull(
                        userId,
                        UserTokenType.EMAIL_VERIFICATION
                );

        for (UserToken activeToken : activeTokens) {
            activeToken.revoke(currentTime);
        }

        userTokenRepository.saveAll(activeTokens);
    }

    private void validateTokenCanBeConfirmed(UserToken token, Instant currentTime) {
        if (token.getUsedAt() != null) {
            throw invalidOrExpiredToken();
        }

        if (token.getRevokedAt() != null) {
            throw invalidOrExpiredToken();
        }

        if (!token.getExpiresAt().isAfter(currentTime)) {
            throw invalidOrExpiredToken();
        }
    }

    private void revokeOtherActiveTokens(
            Long userId,
            Long confirmedTokenId,
            Instant currentTime
    ) {
        List<UserToken> otherActiveTokens =
                userTokenRepository
                        .findAllByUserIdAndTokenTypeAndIdNotAndUsedAtIsNullAndRevokedAtIsNull(
                                userId,
                                UserTokenType.EMAIL_VERIFICATION,
                                confirmedTokenId
                        );

        for (UserToken otherActiveToken : otherActiveTokens) {
            otherActiveToken.revoke(currentTime);
        }

        userTokenRepository.saveAll(otherActiveTokens);
    }

    private ApiException rateLimitExceeded() {
        return new ApiException(
                HttpStatus.TOO_MANY_REQUESTS,
                "EMAIL_VERIFICATION_RATE_LIMITED",
                "Please wait before requesting another verification email."
        );
    }

    private ApiException authenticationRequired() {
        return new ApiException(
                HttpStatus.UNAUTHORIZED,
                "AUTHENTICATION_REQUIRED",
                "Authentication is required."
        );
    }

    private ApiException emailRequired() {
        return new ApiException(
                HttpStatus.UNPROCESSABLE_CONTENT,
                "EMAIL_REQUIRED",
                "An email address is required before requesting verification."
        );
    }

    private ApiException invalidOrExpiredToken() {
        return new ApiException(
                HttpStatus.BAD_REQUEST,
                "INVALID_OR_EXPIRED_VERIFICATION_TOKEN",
                "The email verification token is invalid or expired."
        );
    }
}
