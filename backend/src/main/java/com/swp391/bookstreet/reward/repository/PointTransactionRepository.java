package com.swp391.bookstreet.reward.repository;

import com.swp391.bookstreet.reward.entity.PointTransaction;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PointTransactionRepository extends JpaRepository<PointTransaction, Long> {
    Optional<PointTransaction> findByBoothVisitId(Long boothVisitId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select pointTransaction
            from PointTransaction pointTransaction
            where pointTransaction.boothVisitId = :boothVisitId
            """)
    Optional<PointTransaction> findByBoothVisitIdForUpdate(
            @Param("boothVisitId") Long boothVisitId);

    @Query("""
            select coalesce(sum(transaction.points), 0)
            from PointTransaction transaction, BoothVisit visit, EventRegistration registration
            where transaction.boothVisitId = visit.boothVisitId
              and visit.eventRegistrationId = registration.eventRegistrationId
              and registration.userId = :userId
            """)
    long sumPointsByUserId(@Param("userId") Long userId);
}
