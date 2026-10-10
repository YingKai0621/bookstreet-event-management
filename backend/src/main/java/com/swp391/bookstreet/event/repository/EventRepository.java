package com.swp391.bookstreet.event.repository;

import com.swp391.bookstreet.event.entity.Event;
import com.swp391.bookstreet.event.entity.EventStatus;
import jakarta.persistence.LockModeType;
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

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select e from Event e where e.eventId = :id")
    Optional<Event> findByIdForUpdate(@Param("id") Long id);

}

