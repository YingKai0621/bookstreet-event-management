package com.swp391.bookstreet.auth.repository;

import com.swp391.bookstreet.auth.entity.UserToken;
import com.swp391.bookstreet.auth.entity.UserTokenType;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface UserTokenRepository extends JpaRepository<UserToken, Long> {

    Optional<UserToken> findByTokenHashAndTokenType(
            String tokenHash,
            UserTokenType tokenType
    );

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select token
            from UserToken token
            where token.tokenHash = :tokenHash
              and token.tokenType = :tokenType
            """)
    Optional<UserToken> findByTokenHashAndTokenTypeForUpdate(
            @Param("tokenHash") String tokenHash,
            @Param("tokenType") UserTokenType tokenType
    );

    Optional<UserToken> findFirstByUserIdAndTokenTypeOrderByCreatedAtDesc(
            Long userId,
            UserTokenType tokenType
    );

    long countByUserIdAndTokenTypeAndCreatedAtAfter(
            Long userId,
            UserTokenType tokenType,
            Instant createdAfter
    );

    List<UserToken> findAllByUserIdAndTokenTypeAndUsedAtIsNullAndRevokedAtIsNull(
            Long userId,
            UserTokenType tokenType
    );

    List<UserToken> findAllByUserIdAndTokenTypeAndIdNotAndUsedAtIsNullAndRevokedAtIsNull(
            Long userId,
            UserTokenType tokenType,
            Long excludedTokenId
    );
}
