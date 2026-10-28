package com.swp391.bookstreet.reward.repository;

import com.swp391.bookstreet.reward.entity.Badge;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface BadgeRepository extends JpaRepository<Badge, Long> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select badge
            from Badge badge
            where badge.active = true
              and badge.requiredPoints <= :totalPoints
            order by badge.badgeId
            """)
    List<Badge> findActiveEligibleForUpdate(@Param("totalPoints") long totalPoints);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select badge
            from Badge badge
            where badge.badgeId = :badgeId
            """)
    Optional<Badge> findByBadgeIdForUpdate(@Param("badgeId") Long badgeId);

    boolean existsByNameIgnoreCase(String name);
}
