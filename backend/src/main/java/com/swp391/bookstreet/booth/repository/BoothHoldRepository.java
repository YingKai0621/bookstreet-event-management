package com.swp391.bookstreet.booth.repository;

import com.swp391.bookstreet.booth.entity.BoothHold;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface BoothHoldRepository extends JpaRepository<BoothHold, Long> {
    @Query("""
            select distinct hold.eventBoothConfig.eventId from BoothHold hold
            where hold.status = com.swp391.bookstreet.booth.entity.BoothHoldStatus.ACTIVE
              and hold.expiresAt <= :now
            order by hold.eventBoothConfig.eventId
            """)
    List<Long> findDueEventIds(@Param("now") Instant now);

    @EntityGraph(attributePaths = {
            "boothRequest", "boothRequest.application",
            "boothRequest.application.partnerOrganization",
            "boothRequest.booth", "boothRequest.booth.location",
            "eventBoothConfig"
    })
    Optional<BoothHold> findByBoothRequestBoothRequestId(Long boothRequestId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @EntityGraph(attributePaths = {
            "boothRequest", "boothRequest.application",
            "boothRequest.application.partnerOrganization",
            "boothRequest.booth", "boothRequest.booth.location",
            "eventBoothConfig"
    })
    @Query("""
            select hold
            from BoothHold hold
            where hold.boothHoldId = :holdId
            """)
    Optional<BoothHold> findByIdForUpdate(@Param("holdId") Long holdId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @EntityGraph(attributePaths = {
            "boothRequest", "boothRequest.application",
            "boothRequest.application.partnerOrganization",
            "boothRequest.booth", "boothRequest.booth.location",
            "eventBoothConfig"
    })
    @Query("""
            select hold
            from BoothHold hold
            where hold.boothRequest.boothRequestId = :requestId
              and hold.boothRequest.application.partnerOrganization.representativeUserId = :userId
            """)
    Optional<BoothHold> findOwnedByRequestIdForUpdate(
            @Param("requestId") Long requestId,
            @Param("userId") Long userId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select hold
            from BoothHold hold
            where hold.eventBoothConfig.eventId = :eventId
            order by hold.boothHoldId
            """)
    List<BoothHold> findByEventIdForUpdate(@Param("eventId") Long eventId);

}
