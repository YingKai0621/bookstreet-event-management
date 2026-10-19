package com.swp391.bookstreet.registration.repository;

import com.swp391.bookstreet.registration.entity.EventRegistration;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface EventRegistrationRepository extends JpaRepository<EventRegistration, Long> {
    Optional<EventRegistration> findByUserIdAndEventId(Long userId, Long eventId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select registration
            from EventRegistration registration
            where registration.userId = :userId
              and registration.eventId = :eventId
            """)
    Optional<EventRegistration> findByUserIdAndEventIdForUpdate(
            @Param("userId") Long userId,
            @Param("eventId") Long eventId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select registration
            from EventRegistration registration
            where registration.eventId = :eventId
            order by registration.eventRegistrationId
            """)
    List<EventRegistration> findByEventIdForUpdate(@Param("eventId") Long eventId);

    boolean existsByEventId(Long eventId);
}
