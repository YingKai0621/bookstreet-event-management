package com.swp391.bookstreet.registration.repository;

import com.swp391.bookstreet.registration.entity.EventRegistration;
import com.swp391.bookstreet.registration.entity.EventRegistrationStatus;
import com.swp391.bookstreet.event.entity.EventStatus;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface EventRegistrationRepository extends JpaRepository<EventRegistration, Long> {
    Optional<EventRegistration> findByUserIdAndEventId(Long userId, Long eventId);

    @Query(value = """
            select registration
            from EventRegistration registration
            join fetch registration.event event
            where registration.userId = :userId
              and (:status is null or registration.status = :status)
              and (:eventStatus is null or event.status = :eventStatus)
              and (:search = '' or lower(event.name) like lower(concat('%', :search, '%')))
            """, countQuery = """
            select count(registration)
            from EventRegistration registration
            join registration.event event
            where registration.userId = :userId
              and (:status is null or registration.status = :status)
              and (:eventStatus is null or event.status = :eventStatus)
              and (:search = '' or lower(event.name) like lower(concat('%', :search, '%')))
            """)
    Page<EventRegistration> findOwned(
            @Param("userId") Long userId,
            @Param("status") EventRegistrationStatus status,
            @Param("eventStatus") EventStatus eventStatus,
            @Param("search") String search,
            Pageable pageable);

    @Query("""
            select registration
            from EventRegistration registration
            join fetch registration.event
            where registration.eventRegistrationId = :eventRegistrationId
              and registration.userId = :userId
            """)
    Optional<EventRegistration> findOwnedById(
            @Param("eventRegistrationId") Long eventRegistrationId,
            @Param("userId") Long userId);

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
