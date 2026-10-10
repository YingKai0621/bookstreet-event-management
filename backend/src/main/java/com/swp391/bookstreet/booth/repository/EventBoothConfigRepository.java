package com.swp391.bookstreet.booth.repository;

import com.swp391.bookstreet.booth.entity.EventBoothConfig;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface EventBoothConfigRepository extends JpaRepository<EventBoothConfig, Long> {
    @EntityGraph(attributePaths = {"booth", "booth.location"})
    List<EventBoothConfig> findByEventIdOrderByBoothLocationCodeAsc(Long eventId);

    @EntityGraph(attributePaths = {"booth", "booth.location"})
    Optional<EventBoothConfig> findByEventIdAndBoothBoothId(Long eventId, Long boothId);

    @Modifying
    @Query("delete from EventBoothConfig config where config.eventId = :eventId")
    int deleteByEventId(@Param("eventId") Long eventId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @EntityGraph(attributePaths = {"booth", "booth.location"})
    @Query("""
            select config
            from EventBoothConfig config
            where config.eventId = :eventId
              and config.booth.boothId = :boothId
            """)
    Optional<EventBoothConfig> findByEventIdAndBoothIdForUpdate(
            @Param("eventId") Long eventId,
            @Param("boothId") Long boothId
    );

    @Query(value = """
            select exists (
                select 1
                from booth_holds h
                join event_booth_configs c
                  on c.event_booth_config_id = h.event_booth_config_id
                where c.booth_id = :boothId
                  and h.status = 'ACTIVE'
            )
            """, nativeQuery = true)
    boolean existsCurrentActiveHoldForBooth(@Param("boothId") Long boothId);

    @Query(value = """
            select exists (
                select 1
                from booth_holds h
                where h.event_booth_config_id = :configId
                  and h.status = 'ACTIVE'
            )
            """, nativeQuery = true)
    boolean existsCurrentActiveHoldForConfig(@Param("configId") Long configId);

    @Query(value = """
            select distinct held_config.booth_id
            from booth_holds h
            join event_booth_configs held_config
              on held_config.event_booth_config_id = h.event_booth_config_id
            join events held_event on held_event.event_id = held_config.event_id
            where h.status = 'ACTIVE'
              and held_event.start_at < :targetEnd
              and :targetStart < held_event.end_at
            """, nativeQuery = true)
    List<Long> findBoothIdsWithCurrentOverlappingHold(
            @Param("targetStart") Instant targetStart,
            @Param("targetEnd") Instant targetEnd);

    @Query(value = """
            select exists (
                select 1
                from booth_holds hold
                join event_booth_configs held_config
                  on held_config.event_booth_config_id = hold.event_booth_config_id
                join events held_event
                  on held_event.event_id = held_config.event_id
                where held_config.booth_id = :boothId
                  and hold.status = 'ACTIVE'
                  and held_event.start_at < :targetEnd
                  and :targetStart < held_event.end_at
            )
            """, nativeQuery = true)
    boolean existsCurrentOverlappingHoldForBooth(
            @Param("boothId") Long boothId,
            @Param("targetStart") Instant targetStart,
            @Param("targetEnd") Instant targetEnd
    );
}
