package com.swp391.bookstreet.reward.repository;

import com.swp391.bookstreet.reward.entity.PointTransaction;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PointTransactionRepository extends JpaRepository<PointTransaction, Long> {
    Optional<PointTransaction> findByBoothVisitId(Long boothVisitId);
}
