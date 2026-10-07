package com.swp391.bookstreet.booth.repository;

import com.swp391.bookstreet.booth.entity.EventBoothConfig;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface EventBoothConfigRepository extends JpaRepository<EventBoothConfig, Long> {
    @EntityGraph(attributePaths = {"booth", "booth.location"})
    List<EventBoothConfig> findByEventIdOrderByBoothLocationCodeAsc(Long eventId);

    @EntityGraph(attributePaths = {"booth", "booth.location"})
    Optional<EventBoothConfig> findByEventIdAndBoothBoothId(Long eventId, Long boothId);

    @Query(value = """
            select exists (
                select 1
                from booth_holds h
                join event_booth_configs c
                  on c.event_booth_config_id = h.event_booth_config_id
                where c.booth_id = :boothId
                  and h.status = 'ACTIVE'
                  and h.expires_at > :now
            )
            """, nativeQuery = true)
    boolean existsCurrentActiveHoldForBooth(@Param("boothId") Long boothId,
            @Param("now") Instant now);

    @Query(value = """
            select exists (
                select 1
                from booth_holds h
                where h.event_booth_config_id = :configId
                  and h.status = 'ACTIVE'
                  and h.expires_at > :now
            )
            """, nativeQuery = true)
    boolean existsCurrentActiveHoldForConfig(@Param("configId") Long configId,
            @Param("now") Instant now);

    @Query(value = """
            select distinct held_config.booth_id
            from booth_holds h
            join event_booth_configs held_config
              on held_config.event_booth_config_id = h.event_booth_config_id
            join events held_event on held_event.event_id = held_config.event_id
            where h.status = 'ACTIVE'
              and h.expires_at > :now
              and held_event.start_at < :targetEnd
              and :targetStart < held_event.end_at
            """, nativeQuery = true)
    List<Long> findBoothIdsWithCurrentOverlappingHold(
            @Param("targetStart") Instant targetStart,
            @Param("targetEnd") Instant targetEnd,
            @Param("now") Instant now);
}
