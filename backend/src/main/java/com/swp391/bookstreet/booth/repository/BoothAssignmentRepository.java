package com.swp391.bookstreet.booth.repository;

import com.swp391.bookstreet.booth.entity.BoothAssignment;
import com.swp391.bookstreet.booth.entity.BoothAssignmentStatus;
import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface BoothAssignmentRepository extends JpaRepository<BoothAssignment, Long> {
    interface ScanTarget {
        Long getBoothAssignmentId();
        Long getEventId();
    }

    boolean existsByBoothHoldBoothHoldId(Long boothHoldId);

    @Query("""
            select assignment.boothAssignmentId as boothAssignmentId,
                   assignment.boothHold.eventBoothConfig.eventId as eventId
            from BoothAssignment assignment
            where cast(assignment.qrToken as string) = :token
            """)
    Optional<ScanTarget> resolveScanTarget(@Param("token") String token);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select assignment
            from BoothAssignment assignment
            where assignment.boothAssignmentId = :assignmentId
            """)
    Optional<BoothAssignment> findByIdForUpdate(@Param("assignmentId") Long assignmentId);

    @Query("""
            select case when count(assignment) > 0 then true else false end
            from BoothAssignment assignment
            where assignment.boothHold.eventBoothConfig.eventId = :eventId
            """)
    boolean existsByEventId(@Param("eventId") Long eventId);

    @EntityGraph(attributePaths = {
            "boothHold", "boothHold.boothRequest",
            "boothHold.boothRequest.application",
            "boothHold.boothRequest.application.partnerOrganization",
            "boothHold.boothRequest.booth", "boothHold.boothRequest.booth.location"
    })
    @Query("""
            select assignment
            from BoothAssignment assignment
            where assignment.boothHold.boothRequest.boothRequestId = :requestId
              and assignment.boothHold.boothRequest.application.partnerOrganization.representativeUserId = :userId
            """)
    Optional<BoothAssignment> findOwnedByRequestId(
            @Param("requestId") Long requestId,
            @Param("userId") Long userId);

    @Query(value = """
            select distinct config.booth_id
            from booth_assignments assignment
            join booth_holds hold on hold.booth_hold_id = assignment.booth_hold_id
            join event_booth_configs config
              on config.event_booth_config_id = hold.event_booth_config_id
            join events assigned_event on assigned_event.event_id = config.event_id
            where assignment.status = 'ACTIVE'
              and assigned_event.start_at < :targetEnd
              and :targetStart < assigned_event.end_at
            """, nativeQuery = true)
    List<Long> findBoothIdsWithOverlappingActiveAssignment(
            @Param("targetStart") Instant targetStart,
            @Param("targetEnd") Instant targetEnd);

    @Query(value = """
            select exists (
                select 1
                from booth_assignments assignment
                join booth_holds hold on hold.booth_hold_id = assignment.booth_hold_id
                join event_booth_configs config
                  on config.event_booth_config_id = hold.event_booth_config_id
                join events assigned_event on assigned_event.event_id = config.event_id
                where config.booth_id = :boothId
                  and assignment.status = 'ACTIVE'
                  and assigned_event.start_at < :targetEnd
                  and :targetStart < assigned_event.end_at
            )
            """, nativeQuery = true)
    boolean existsOverlappingActiveAssignment(
            @Param("boothId") Long boothId,
            @Param("targetStart") Instant targetStart,
            @Param("targetEnd") Instant targetEnd);

    boolean existsByBoothHoldBoothHoldIdAndStatus(
            Long boothHoldId, BoothAssignmentStatus status);

    @Query(value = """
            select exists (
                select 1
                from booth_assignments assignment
                join booth_holds hold on hold.booth_hold_id = assignment.booth_hold_id
                where hold.event_booth_config_id = :configId
                  and assignment.status = 'ACTIVE'
            )
            """, nativeQuery = true)
    boolean existsActiveAssignmentForConfig(@Param("configId") Long configId);

    @Query(value = """
            select exists (
                select 1
                from booth_assignments assignment
                join booth_holds hold on hold.booth_hold_id = assignment.booth_hold_id
                join event_booth_configs config
                  on config.event_booth_config_id = hold.event_booth_config_id
                where config.booth_id = :boothId
                  and assignment.status = 'ACTIVE'
            )
            """, nativeQuery = true)
    boolean existsActiveAssignmentForBooth(@Param("boothId") Long boothId);

    @Query(value = """
            select count(*)
            from booth_assignments assignment
            join booth_holds hold on hold.booth_hold_id = assignment.booth_hold_id
            join booth_requests request on request.booth_request_id = hold.booth_request_id
            where request.application_id = :applicationId
              and assignment.status = 'ACTIVE'
            """, nativeQuery = true)
    long countActiveByApplication(@Param("applicationId") Long applicationId);

    @EntityGraph(attributePaths = {
            "boothHold", "boothHold.eventBoothConfig",
            "boothHold.eventBoothConfig.booth",
            "boothHold.eventBoothConfig.booth.location",
            "boothHold.boothRequest", "boothHold.boothRequest.application",
            "boothHold.boothRequest.application.partnerOrganization"
    })
    @Query("""
            select assignment
            from BoothAssignment assignment
            where assignment.status = com.swp391.bookstreet.booth.entity.BoothAssignmentStatus.ACTIVE
              and assignment.boothHold.eventBoothConfig.eventId = :eventId
              and assignment.boothHold.boothRequest.application.partnerOrganization.id = :partnerOrganizationId
            order by assignment.boothHold.eventBoothConfig.booth.location.code,
                     assignment.boothAssignmentId
            """)
    List<BoothAssignment> findActiveOwnedByEventAndPartnerOrganization(
            @Param("eventId") Long eventId,
            @Param("partnerOrganizationId") Long partnerOrganizationId);

    @Query(value = """
            select exists (
                select 1
                from booth_assignments assignment
                join booth_holds hold on hold.booth_hold_id = assignment.booth_hold_id
                join event_booth_configs config
                  on config.event_booth_config_id = hold.event_booth_config_id
                where assignment.status = 'ACTIVE'
                  and config.event_id = :eventId
                  and config.booth_id = :boothId
            )
            """, nativeQuery = true)
    boolean existsActiveForEventAndBooth(
            @Param("eventId") Long eventId,
            @Param("boothId") Long boothId);

    @Query(value = """
            select exists (
                select 1
                from booth_assignments assignment
                join booth_holds hold on hold.booth_hold_id = assignment.booth_hold_id
                join event_booth_configs config
                  on config.event_booth_config_id = hold.event_booth_config_id
                join booth_requests request
                  on request.booth_request_id = hold.booth_request_id
                join partner_event_applications application
                  on application.application_id = request.application_id
                where assignment.status = 'ACTIVE'
                  and config.event_id = :eventId
                  and config.booth_id = :boothId
                  and application.partner_organization_id = :partnerOrganizationId
            )
            """, nativeQuery = true)
    boolean existsActiveOwnedForEventAndBooth(
            @Param("eventId") Long eventId,
            @Param("boothId") Long boothId,
            @Param("partnerOrganizationId") Long partnerOrganizationId);
}
