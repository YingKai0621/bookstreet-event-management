package com.swp391.bookstreet.reward.repository;

import com.swp391.bookstreet.reward.entity.BoothVisit;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface BoothVisitRepository extends JpaRepository<BoothVisit, Long> {
    @Query("""
            select count(visit)
            from BoothVisit visit, EventRegistration registration
            where visit.eventRegistrationId = registration.eventRegistrationId
              and registration.userId = :userId
            """)
    long countByUserId(@Param("userId") Long userId);

    Optional<BoothVisit> findByEventRegistrationIdAndBoothAssignmentId(
            Long eventRegistrationId, Long boothAssignmentId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select visit
            from BoothVisit visit
            where visit.eventRegistrationId = :eventRegistrationId
              and visit.boothAssignmentId = :boothAssignmentId
            """)
    Optional<BoothVisit> findByIdentityForUpdate(
            @Param("eventRegistrationId") Long eventRegistrationId,
            @Param("boothAssignmentId") Long boothAssignmentId);

    boolean existsByEventRegistrationIdAndBoothAssignmentId(
            Long eventRegistrationId, Long boothAssignmentId);
}
