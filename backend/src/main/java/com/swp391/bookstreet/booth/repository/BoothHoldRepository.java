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

    @Query(value = """
            select distinct config.event_id
            from {h-schema}booth_holds hold
            join {h-schema}event_booth_configs config
              on config.event_booth_config_id = hold.event_booth_config_id
            join {h-schema}booth_requests request
              on request.booth_request_id = hold.booth_request_id
            join {h-schema}partner_event_applications application
              on application.application_id = request.application_id
            join {h-schema}partner_organizations organization
              on organization.partner_organization_id = application.partner_organization_id
            where hold.status = 'ACTIVE'
              and organization.status = 'ACTIVE'
              and hold.expires_at > :now
              and hold.expires_at <= :threshold
              and hold.created_at < hold.expires_at - (:windowMinutes * interval '1 minute')
              and not exists (
                  select 1 from {h-schema}booth_payments payment
                  where payment.booth_hold_id = hold.booth_hold_id
                    and (payment.reconciliation_required
                         or payment.status in ('PENDING', 'SUCCESS')))
              and not exists (
                  select 1 from {h-schema}notifications notification
                  where notification.booth_request_id = hold.booth_request_id
                    and notification.notification_type = 'PARTNER_BOOTH_HOLD_EXPIRING')
            order by config.event_id
            """, nativeQuery = true)
    List<Long> findEventIdsWithHoldsToRemind(@Param("now") Instant now,
            @Param("threshold") Instant threshold, @Param("windowMinutes") int windowMinutes);

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
