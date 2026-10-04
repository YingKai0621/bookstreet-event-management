package com.swp391.bookstreet.auth.repository;

import com.swp391.bookstreet.auth.entity.User;
import com.swp391.bookstreet.auth.entity.UserToken;
import com.swp391.bookstreet.auth.entity.UserTokenType;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@Transactional
class UserTokenRepositoryIntegrationTests {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private UserTokenRepository userTokenRepository;

    @Autowired
    private EntityManager entityManager;

    @Test
    void savesAndFindsEmailVerificationTokenByHashAndType() {
        User user = createUser();

        Instant createdAt = Instant.now().truncatedTo(ChronoUnit.MICROS);
        Instant expiresAt = createdAt.plus(60, ChronoUnit.MINUTES);
        String tokenHash = uniqueTokenHash();

        UserToken token = new UserToken(
                user,
                UserTokenType.EMAIL_VERIFICATION,
                tokenHash,
                createdAt,
                expiresAt
        );

        userTokenRepository.saveAndFlush(token);
        entityManager.clear();

        Optional<UserToken> tokenResult = userTokenRepository.findByTokenHashAndTokenType(
                tokenHash,
                UserTokenType.EMAIL_VERIFICATION
        );

        assertThat(tokenResult).isPresent();

        UserToken loadedToken = tokenResult.get();
        assertThat(loadedToken.getId()).isNotNull();
        assertThat(loadedToken.getUser().getId()).isEqualTo(user.getId());
        assertThat(loadedToken.getTokenType()).isEqualTo(UserTokenType.EMAIL_VERIFICATION);
        assertThat(loadedToken.getTokenHash()).isEqualTo(tokenHash);
        assertThat(loadedToken.getCreatedAt()).isEqualTo(createdAt);
        assertThat(loadedToken.getExpiresAt()).isEqualTo(expiresAt);
        assertThat(loadedToken.getUsedAt()).isNull();
        assertThat(loadedToken.getRevokedAt()).isNull();
    }

    @Test
    void persistsUsedTimestamp() {
        User user = createUser();

        Instant createdAt = Instant.now().truncatedTo(ChronoUnit.MICROS);
        Instant expiresAt = createdAt.plus(60, ChronoUnit.MINUTES);
        Instant usedAt = createdAt.plus(5, ChronoUnit.MINUTES);

        UserToken token = new UserToken(
                user,
                UserTokenType.EMAIL_VERIFICATION,
                uniqueTokenHash(),
                createdAt,
                expiresAt
        );

        token.markUsed(usedAt);

        userTokenRepository.saveAndFlush(token);
        Long tokenId = token.getId();
        entityManager.clear();

        UserToken loadedToken = userTokenRepository.findById(tokenId).orElseThrow();

        assertThat(loadedToken.getUsedAt()).isEqualTo(usedAt);
        assertThat(loadedToken.getRevokedAt()).isNull();
    }

    @Test
    void persistsRevokedTimestamp() {
        User user = createUser();

        Instant createdAt = Instant.now().truncatedTo(ChronoUnit.MICROS);
        Instant expiresAt = createdAt.plus(60, ChronoUnit.MINUTES);
        Instant revokedAt = createdAt.plus(10, ChronoUnit.MINUTES);

        UserToken token = new UserToken(
                user,
                UserTokenType.EMAIL_VERIFICATION,
                uniqueTokenHash(),
                createdAt,
                expiresAt
        );

        token.revoke(revokedAt);

        userTokenRepository.saveAndFlush(token);
        Long tokenId = token.getId();
        entityManager.clear();

        UserToken loadedToken = userTokenRepository.findById(tokenId).orElseThrow();

        assertThat(loadedToken.getUsedAt()).isNull();
        assertThat(loadedToken.getRevokedAt()).isEqualTo(revokedAt);
    }

    @Test
    void supportsIssuanceLimitAndActiveTokenQueries() {
        User user = createUser();
        Instant currentTime = Instant.now().truncatedTo(ChronoUnit.MICROS);

        UserToken olderToken = createToken(
                user,
                currentTime.minus(70, ChronoUnit.MINUTES)
        );
        UserToken activeToken = createToken(
                user,
                currentTime.minus(30, ChronoUnit.MINUTES)
        );
        UserToken revokedToken = createToken(
                user,
                currentTime.minus(20, ChronoUnit.MINUTES)
        );
        revokedToken.revoke(currentTime.minus(10, ChronoUnit.MINUTES));

        userTokenRepository.saveAllAndFlush(List.of(olderToken, activeToken, revokedToken));
        entityManager.clear();

        Optional<UserToken> latestTokenResult =
                userTokenRepository.findFirstByUserIdAndTokenTypeOrderByCreatedAtDesc(
                        user.getId(),
                        UserTokenType.EMAIL_VERIFICATION
                );
        long tokensWithinLastHour =
                userTokenRepository.countByUserIdAndTokenTypeAndCreatedAtAfter(
                        user.getId(),
                        UserTokenType.EMAIL_VERIFICATION,
                        currentTime.minus(60, ChronoUnit.MINUTES)
                );
        List<UserToken> activeTokens =
                userTokenRepository.findAllByUserIdAndTokenTypeAndUsedAtIsNullAndRevokedAtIsNull(
                        user.getId(),
                        UserTokenType.EMAIL_VERIFICATION
                );

        assertThat(latestTokenResult).isPresent();
        assertThat(latestTokenResult.get().getTokenHash())
                .isEqualTo(revokedToken.getTokenHash());
        assertThat(tokensWithinLastHour).isEqualTo(2);
        assertThat(activeTokens)
                .extracting(UserToken::getTokenHash)
                .containsExactlyInAnyOrder(
                        olderToken.getTokenHash(),
                        activeToken.getTokenHash()
                );
    }

    private User createUser() {
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 10);
        String username = "TokenUser" + suffix;
        String email = "token" + suffix + "@example.com";

        User user = new User(
                username,
                email,
                "bcrypt-hash-placeholder",
                "Token Test User"
        );

        return userRepository.saveAndFlush(user);
    }

    private String uniqueTokenHash() {
        String firstHalf = UUID.randomUUID().toString().replace("-", "");
        String secondHalf = UUID.randomUUID().toString().replace("-", "");
        return firstHalf + secondHalf;
    }

    private UserToken createToken(User user, Instant createdAt) {
        Instant expiresAt = createdAt.plus(60, ChronoUnit.MINUTES);

        return new UserToken(
                user,
                UserTokenType.EMAIL_VERIFICATION,
                uniqueTokenHash(),
                createdAt,
                expiresAt
        );
    }
}
