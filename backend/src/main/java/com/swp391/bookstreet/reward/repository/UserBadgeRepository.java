package com.swp391.bookstreet.reward.repository;

import com.swp391.bookstreet.reward.entity.UserBadge;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserBadgeRepository extends JpaRepository<UserBadge, Long> {
    Optional<UserBadge> findByUserIdAndBadgeId(Long userId, Long badgeId);

    boolean existsByUserIdAndBadgeId(Long userId, Long badgeId);

    long countByUserId(Long userId);
}
