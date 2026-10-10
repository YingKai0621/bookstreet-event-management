package com.swp391.bookstreet.event.repository;

import com.swp391.bookstreet.event.entity.Event;
import com.swp391.bookstreet.event.entity.EventStatus;
import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface EventRepository extends JpaRepository<Event, Long> {
    Page<Event> findByOrganizerUserId(Long organizerUserId, Pageable pageable);
    Page<Event> findByStatus(EventStatus status, Pageable pageable);
    Optional<Event> findByEventIdAndStatus(Long eventId, EventStatus status);
    Optional<Event> findByEventIdAndOrganizerUserId(Long eventId, Long organizerUserId);

    /**
     * Every Booth request, Hold, Payment and Assignment is rooted in a Partner Event
     * application by the active V1-V8 foreign-key graph. Therefore the first application
     * is also the first possible external participation record for the Event.
     */
    @Query(value = """
            select exists (
                select 1
                from partner_event_applications
                where event_id = :eventId
            )
            """, nativeQuery = true)
    boolean existsExternalParticipation(@Param("eventId") Long eventId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select e from Event e where e.eventId = :id")
    Optional<Event> findByIdForUpdate(@Param("id") Long id);

    @Query(value = """
            select event_id
            from events
            where (status = 'PUBLISHED' and start_at <= :now)
               or (status = 'ONGOING' and end_at <= :now)
            order by event_id
            limit 100
            """, nativeQuery = true)
    List<Long> findDueLifecycleIds(@Param("now") Instant now);

}

