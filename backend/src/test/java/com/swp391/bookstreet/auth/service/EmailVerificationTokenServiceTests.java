package com.swp391.bookstreet.auth.service;

import com.swp391.bookstreet.auth.entity.User;
import com.swp391.bookstreet.auth.entity.UserToken;
import com.swp391.bookstreet.auth.entity.UserTokenType;
import com.swp391.bookstreet.auth.repository.UserRepository;
import com.swp391.bookstreet.auth.repository.UserTokenRepository;
import com.swp391.bookstreet.common.exception.ApiException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpStatus;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.fail;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class EmailVerificationTokenServiceTests {

    private static final Instant CURRENT_TIME = Instant.parse("2026-10-04T08:00:00Z");
    private static final Long USER_ID = 42L;
    private static final String RAW_TOKEN = "raw-email-verification-token";
    private static final String TOKEN_HASH =
            "0123456789abcdef0123456789abcdef"
                    + "0123456789abcdef0123456789abcdef";

    private UserTokenRepository userTokenRepository;
    private UserRepository userRepository;
    private EmailVerificationTokenGenerator tokenGenerator;
    private EmailVerificationTokenService tokenService;
    private User user;

    @BeforeEach
    void setUp() {
        userTokenRepository = mock(UserTokenRepository.class);
        userRepository = mock(UserRepository.class);
        tokenGenerator = mock(EmailVerificationTokenGenerator.class);
        Clock clock = Clock.fixed(CURRENT_TIME, ZoneOffset.UTC);

        tokenService = new EmailVerificationTokenService(
                userTokenRepository,
                userRepository,
                tokenGenerator,
                clock
        );

        user = mock(User.class);
        when(user.getId()).thenReturn(USER_ID);
    }

    @Test
    void issuesTokenWithHashAndSixtyMinuteLifetime() {
        allowTokenIssuance();
        when(tokenGenerator.generateRawToken()).thenReturn(RAW_TOKEN);
        when(tokenGenerator.hashToken(RAW_TOKEN)).thenReturn(TOKEN_HASH);

        IssuedEmailVerificationToken result = tokenService.issueToken(user);

        ArgumentCaptor<UserToken> tokenCaptor = ArgumentCaptor.forClass(UserToken.class);
        verify(userTokenRepository).saveAndFlush(tokenCaptor.capture());

        UserToken savedToken = tokenCaptor.getValue();

        assertThat(result.getRawToken()).isEqualTo(RAW_TOKEN);
        assertThat(result.getExpiresAt()).isEqualTo(CURRENT_TIME.plusSeconds(3600));
        assertThat(savedToken.getUser()).isSameAs(user);
        assertThat(savedToken.getTokenType()).isEqualTo(UserTokenType.EMAIL_VERIFICATION);
        assertThat(savedToken.getTokenHash()).isEqualTo(TOKEN_HASH);
        assertThat(savedToken.getTokenHash()).isNotEqualTo(RAW_TOKEN);
        assertThat(savedToken.getCreatedAt()).isEqualTo(CURRENT_TIME);
        assertThat(savedToken.getExpiresAt()).isEqualTo(CURRENT_TIME.plusSeconds(3600));
        assertThat(savedToken.getUsedAt()).isNull();
        assertThat(savedToken.getRevokedAt()).isNull();
    }

    @Test
    void revokesPreviousActiveTokensBeforeIssuingNewToken() {
        UserToken previousToken = new UserToken(
                user,
                UserTokenType.EMAIL_VERIFICATION,
                "previous-token-hash",
                CURRENT_TIME.minusSeconds(120),
                CURRENT_TIME.plusSeconds(3480)
        );

        when(userTokenRepository.findFirstByUserIdAndTokenTypeOrderByCreatedAtDesc(
                USER_ID,
                UserTokenType.EMAIL_VERIFICATION
        )).thenReturn(Optional.of(previousToken));
        when(userTokenRepository.countByUserIdAndTokenTypeAndCreatedAtAfter(
                USER_ID,
                UserTokenType.EMAIL_VERIFICATION,
                CURRENT_TIME.minusSeconds(3600)
        )).thenReturn(1L);
        when(userTokenRepository.findAllByUserIdAndTokenTypeAndUsedAtIsNullAndRevokedAtIsNull(
                USER_ID,
                UserTokenType.EMAIL_VERIFICATION
        )).thenReturn(List.of(previousToken));
        when(tokenGenerator.generateRawToken()).thenReturn(RAW_TOKEN);
        when(tokenGenerator.hashToken(RAW_TOKEN)).thenReturn(TOKEN_HASH);

        tokenService.issueToken(user);

        assertThat(previousToken.getRevokedAt()).isEqualTo(CURRENT_TIME);
        verify(userTokenRepository).saveAll(List.of(previousToken));
        verify(userTokenRepository).saveAndFlush(
                org.mockito.ArgumentMatchers.any(UserToken.class)
        );
    }

    @Test
    void rejectsIssuanceDuringSixtySecondCooldown() {
        UserToken recentToken = new UserToken(
                user,
                UserTokenType.EMAIL_VERIFICATION,
                "recent-token-hash",
                CURRENT_TIME.minusSeconds(59),
                CURRENT_TIME.plusSeconds(3541)
        );

        when(userTokenRepository.findFirstByUserIdAndTokenTypeOrderByCreatedAtDesc(
                USER_ID,
                UserTokenType.EMAIL_VERIFICATION
        )).thenReturn(Optional.of(recentToken));

        ApiException exception = captureRateLimitException();

        assertRateLimitException(exception);
        verify(userTokenRepository, never()).saveAndFlush(
                org.mockito.ArgumentMatchers.any(UserToken.class)
        );
    }

    @Test
    void rejectsSixthIssuanceWithinRollingHour() {
        UserToken tokenAtCooldownBoundary = new UserToken(
                user,
                UserTokenType.EMAIL_VERIFICATION,
                "boundary-token-hash",
                CURRENT_TIME.minusSeconds(60),
                CURRENT_TIME.plusSeconds(3540)
        );

        when(userTokenRepository.findFirstByUserIdAndTokenTypeOrderByCreatedAtDesc(
                USER_ID,
                UserTokenType.EMAIL_VERIFICATION
        )).thenReturn(Optional.of(tokenAtCooldownBoundary));
        when(userTokenRepository.countByUserIdAndTokenTypeAndCreatedAtAfter(
                USER_ID,
                UserTokenType.EMAIL_VERIFICATION,
                CURRENT_TIME.minusSeconds(3600)
        )).thenReturn(5L);

        ApiException exception = captureRateLimitException();

        assertRateLimitException(exception);
        verify(userTokenRepository, never()).saveAndFlush(
                org.mockito.ArgumentMatchers.any(UserToken.class)
        );
    }

    @Test
    void preparesResendForUnverifiedUserWithEmail() {
        when(userRepository.findByIdForUpdate(USER_ID)).thenReturn(Optional.of(user));
        when(user.getEmail()).thenReturn("reader@example.com");
        when(user.getEmailVerifiedAt()).thenReturn(null);
        allowTokenIssuance();
        when(tokenGenerator.generateRawToken()).thenReturn(RAW_TOKEN);
        when(tokenGenerator.hashToken(RAW_TOKEN)).thenReturn(TOKEN_HASH);

        Optional<EmailVerificationMessageRequested> result =
                tokenService.prepareResend(USER_ID);

        assertThat(result).isPresent();
        assertThat(result.get().getUserId()).isEqualTo(USER_ID);
        assertThat(result.get().getRecipientEmail()).isEqualTo("reader@example.com");
        assertThat(result.get().getRawToken()).isEqualTo(RAW_TOKEN);
        verify(userRepository).findByIdForUpdate(USER_ID);
        verify(userTokenRepository).saveAndFlush(
                org.mockito.ArgumentMatchers.any(UserToken.class)
        );
    }

    @Test
    void rejectsResendWhenUserHasNoEmail() {
        when(userRepository.findByIdForUpdate(USER_ID)).thenReturn(Optional.of(user));
        when(user.getEmail()).thenReturn(null);

        ApiException exception;

        try {
            tokenService.prepareResend(USER_ID);
            fail("Expected resend without email to be rejected.");
            return;
        } catch (ApiException caughtException) {
            exception = caughtException;
        }

        assertThat(exception.getStatus()).isEqualTo(HttpStatus.UNPROCESSABLE_CONTENT);
        assertThat(exception.getCode()).isEqualTo("EMAIL_REQUIRED");
        verify(userTokenRepository, never()).saveAndFlush(
                org.mockito.ArgumentMatchers.any(UserToken.class)
        );
    }

    @Test
    void alreadyVerifiedUserGetsIdempotentResendSuccess() {
        when(userRepository.findByIdForUpdate(USER_ID)).thenReturn(Optional.of(user));
        when(user.getEmail()).thenReturn("reader@example.com");
        when(user.getEmailVerifiedAt()).thenReturn(CURRENT_TIME.minusSeconds(60));

        Optional<EmailVerificationMessageRequested> result =
                tokenService.prepareResend(USER_ID);

        assertThat(result).isEmpty();
        verify(userTokenRepository, never()).saveAndFlush(
                org.mockito.ArgumentMatchers.any(UserToken.class)
        );
    }

    @Test
    void revokesUnusedTokenAfterDeliveryFailure() {
        UserToken token = mock(UserToken.class);
        when(token.getTokenType()).thenReturn(UserTokenType.EMAIL_VERIFICATION);
        when(token.getUsedAt()).thenReturn(null);
        when(token.getRevokedAt()).thenReturn(null);
        when(userTokenRepository.findById(99L)).thenReturn(Optional.of(token));

        tokenService.revokeTokenAfterDeliveryFailure(99L);

        verify(token).revoke(CURRENT_TIME);
        verify(userTokenRepository).saveAndFlush(token);
    }

    @Test
    void confirmsValidTokenAndRevokesOtherActiveTokens() {
        UserToken token = mock(UserToken.class);
        UserToken otherActiveToken = mock(UserToken.class);

        when(tokenGenerator.hashToken(RAW_TOKEN)).thenReturn(TOKEN_HASH);
        when(userTokenRepository.findByTokenHashAndTokenType(
                TOKEN_HASH,
                UserTokenType.EMAIL_VERIFICATION
        )).thenReturn(Optional.of(token));
        when(userTokenRepository.findByTokenHashAndTokenTypeForUpdate(
                TOKEN_HASH,
                UserTokenType.EMAIL_VERIFICATION
        )).thenReturn(Optional.of(token));
        when(token.getUser()).thenReturn(user);
        when(userRepository.findByIdForUpdate(USER_ID)).thenReturn(Optional.of(user));
        when(token.getUsedAt()).thenReturn(null);
        when(token.getRevokedAt()).thenReturn(null);
        when(token.getExpiresAt()).thenReturn(CURRENT_TIME.plusSeconds(300));
        when(token.getId()).thenReturn(21L);
        when(user.getEmail()).thenReturn("reader@example.com");
        when(user.getEmailVerifiedAt()).thenReturn(null);
        when(userTokenRepository
                .findAllByUserIdAndTokenTypeAndIdNotAndUsedAtIsNullAndRevokedAtIsNull(
                        USER_ID,
                        UserTokenType.EMAIL_VERIFICATION,
                        21L
                )).thenReturn(List.of(otherActiveToken));

        tokenService.confirmToken(RAW_TOKEN);

        verify(otherActiveToken).revoke(CURRENT_TIME);
        verify(user).setEmailVerifiedAt(CURRENT_TIME);
        verify(token).markUsed(CURRENT_TIME);
        verify(userTokenRepository).saveAll(List.of(otherActiveToken));
        verify(userTokenRepository).saveAndFlush(token);
        verify(userRepository).saveAndFlush(user);
    }

    @Test
    void rejectsUnknownConfirmationTokenWithGenericError() {
        when(tokenGenerator.hashToken(RAW_TOKEN)).thenReturn(TOKEN_HASH);
        when(userTokenRepository.findByTokenHashAndTokenType(
                TOKEN_HASH,
                UserTokenType.EMAIL_VERIFICATION
        )).thenReturn(Optional.empty());

        ApiException exception = captureInvalidConfirmationException();

        assertInvalidConfirmationException(exception);
    }

    @Test
    void rejectsExpiredConfirmationTokenWithSameGenericError() {
        UserToken token = mock(UserToken.class);

        when(tokenGenerator.hashToken(RAW_TOKEN)).thenReturn(TOKEN_HASH);
        when(userTokenRepository.findByTokenHashAndTokenType(
                TOKEN_HASH,
                UserTokenType.EMAIL_VERIFICATION
        )).thenReturn(Optional.of(token));
        when(userTokenRepository.findByTokenHashAndTokenTypeForUpdate(
                TOKEN_HASH,
                UserTokenType.EMAIL_VERIFICATION
        )).thenReturn(Optional.of(token));
        when(token.getUser()).thenReturn(user);
        when(userRepository.findByIdForUpdate(USER_ID)).thenReturn(Optional.of(user));
        when(token.getUsedAt()).thenReturn(null);
        when(token.getRevokedAt()).thenReturn(null);
        when(token.getExpiresAt()).thenReturn(CURRENT_TIME);

        ApiException exception = captureInvalidConfirmationException();

        assertInvalidConfirmationException(exception);
    }

    private void allowTokenIssuance() {
        when(userTokenRepository.findFirstByUserIdAndTokenTypeOrderByCreatedAtDesc(
                USER_ID,
                UserTokenType.EMAIL_VERIFICATION
        )).thenReturn(Optional.empty());
        when(userTokenRepository.countByUserIdAndTokenTypeAndCreatedAtAfter(
                USER_ID,
                UserTokenType.EMAIL_VERIFICATION,
                CURRENT_TIME.minusSeconds(3600)
        )).thenReturn(0L);
        when(userTokenRepository.findAllByUserIdAndTokenTypeAndUsedAtIsNullAndRevokedAtIsNull(
                USER_ID,
                UserTokenType.EMAIL_VERIFICATION
        )).thenReturn(List.of());
    }

    private ApiException captureRateLimitException() {
        try {
            tokenService.issueToken(user);
            fail("Expected token issuance to be rate limited.");
            return null;
        } catch (ApiException exception) {
            return exception;
        }
    }

    private void assertRateLimitException(ApiException exception) {
        assertThat(exception.getStatus()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
        assertThat(exception.getCode()).isEqualTo("EMAIL_VERIFICATION_RATE_LIMITED");
    }

    private ApiException captureInvalidConfirmationException() {
        try {
            tokenService.confirmToken(RAW_TOKEN);
            fail("Expected email verification confirmation to be rejected.");
            return null;
        } catch (ApiException exception) {
            return exception;
        }
    }

    private void assertInvalidConfirmationException(ApiException exception) {
        assertThat(exception.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(exception.getCode())
                .isEqualTo("INVALID_OR_EXPIRED_VERIFICATION_TOKEN");
    }
}
