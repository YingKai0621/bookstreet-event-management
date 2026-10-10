package com.swp391.bookstreet.booth.repository;

import com.swp391.bookstreet.booth.entity.BoothRequest;
import com.swp391.bookstreet.booth.entity.BoothRequestStatus;
import jakarta.persistence.LockModeType;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface BoothRequestRepository extends JpaRepository<BoothRequest, Long> {
    @EntityGraph(attributePaths = {
            "application", "application.partnerOrganization", "booth", "booth.location", "hold"
    })
    @Query(value = """
            select request
            from BoothRequest request
            where request.application.partnerOrganization.representativeUserId = :userId
              and (:eventId is null or request.application.eventId = :eventId)
              and (:status is null or request.status = :status)
            """,
            countQuery = """
                    select count(request)
                    from BoothRequest request
                    where request.application.partnerOrganization.representativeUserId = :userId
                      and (:eventId is null or request.application.eventId = :eventId)
                      and (:status is null or request.status = :status)
                    """)
    Page<BoothRequest> findOwned(
            @Param("userId") Long userId,
            @Param("eventId") Long eventId,
            @Param("status") BoothRequestStatus status,
            Pageable pageable
    );

    @EntityGraph(attributePaths = {
            "application", "application.partnerOrganization", "booth", "booth.location", "hold"
    })
    @Query("""
            select request
            from BoothRequest request
            where request.boothRequestId = :requestId
              and request.application.partnerOrganization.representativeUserId = :userId
            """)
    Optional<BoothRequest> findOwnedById(
            @Param("requestId") Long requestId,
            @Param("userId") Long userId
    );

    @Query("""
            select request.application.eventId
            from BoothRequest request
            where request.boothRequestId = :requestId
              and request.application.partnerOrganization.representativeUserId = :userId
            """)
    Optional<Long> findOwnedEventIdById(
            @Param("requestId") Long requestId,
            @Param("userId") Long userId
    );

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @EntityGraph(attributePaths = {
            "application", "application.partnerOrganization", "booth", "booth.location"
    })
    @Query("""
            select request
            from BoothRequest request
            where request.boothRequestId = :requestId
              and request.application.partnerOrganization.representativeUserId = :userId
            """)
    Optional<BoothRequest> findOwnedByIdForUpdate(
            @Param("requestId") Long requestId,
            @Param("userId") Long userId
    );

    @EntityGraph(attributePaths = {
            "application", "application.partnerOrganization", "booth", "booth.location", "hold"
    })
    @Query(value = """
            select request
            from BoothRequest request
            where request.application.eventId = :eventId
              and (:boothId is null or request.booth.boothId = :boothId)
              and (:status is null or request.status = :status)
            """,
            countQuery = """
                    select count(request)
                    from BoothRequest request
                    where request.application.eventId = :eventId
                      and (:boothId is null or request.booth.boothId = :boothId)
                      and (:status is null or request.status = :status)
                    """)
    Page<BoothRequest> findForOrganizer(
            @Param("eventId") Long eventId,
            @Param("boothId") Long boothId,
            @Param("status") BoothRequestStatus status,
            Pageable pageable
    );

    @EntityGraph(attributePaths = {
            "application", "application.partnerOrganization", "booth", "booth.location", "hold"
    })
    @Query("""
            select request
            from BoothRequest request
            where request.boothRequestId = :requestId
              and request.application.eventId = :eventId
            """)
    Optional<BoothRequest> findForOrganizerById(
            @Param("requestId") Long requestId,
            @Param("eventId") Long eventId
    );

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @EntityGraph(attributePaths = {
            "application", "application.partnerOrganization", "booth", "booth.location"
    })
    @Query("""
            select request
            from BoothRequest request
            where request.boothRequestId = :requestId
              and request.application.eventId = :eventId
            """)
    Optional<BoothRequest> findForOrganizerByIdForUpdate(
            @Param("requestId") Long requestId,
            @Param("eventId") Long eventId
    );

    boolean existsByApplication_IdAndBooth_BoothIdAndStatusIn(
            Long applicationId,
            Long boothId,
            Collection<BoothRequestStatus> statuses
    );

    boolean existsByApplication_IdAndBooth_BoothIdAndStatus(
            Long applicationId,
            Long boothId,
            BoothRequestStatus status
    );

    @Query(value = """
            select count(*)
            from booth_holds hold
            join booth_requests request
              on request.booth_request_id = hold.booth_request_id
            where request.application_id = :applicationId
              and hold.status = 'ACTIVE'
            """, nativeQuery = true)
    long countCurrentActiveHolds(@Param("applicationId") Long applicationId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select request
            from BoothRequest request
            where request.application.eventId = :eventId
              and request.booth.boothId = :boothId
              and request.status = :status
            order by request.boothRequestId
            """)
    List<BoothRequest> findCompetingForUpdate(
            @Param("eventId") Long eventId,
            @Param("boothId") Long boothId,
            @Param("status") BoothRequestStatus status);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select request
            from BoothRequest request
            where request.application.eventId = :eventId
              and request.status in :statuses
            order by request.boothRequestId
            """)
    List<BoothRequest> findByEventIdAndStatusInForUpdate(
            @Param("eventId") Long eventId,
            @Param("statuses") Collection<BoothRequestStatus> statuses);
}
