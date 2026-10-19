package com.swp391.bookstreet.registration.repository;

import com.swp391.bookstreet.registration.entity.ActivityRegistration;
import com.swp391.bookstreet.registration.entity.ActivityRegistrationStatus;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ActivityRegistrationRepository extends JpaRepository<ActivityRegistration, Long> {
    Optional<ActivityRegistration> findByEventRegistrationIdAndActivityId(
            Long eventRegistrationId, Long activityId);

    long countByActivityIdAndStatus(Long activityId, ActivityRegistrationStatus status);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select registration
            from ActivityRegistration registration
            where registration.eventRegistrationId = :eventRegistrationId
              and registration.activityId = :activityId
            """)
    Optional<ActivityRegistration> findByIdentityForUpdate(
            @Param("eventRegistrationId") Long eventRegistrationId,
            @Param("activityId") Long activityId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select registration
            from ActivityRegistration registration
            where registration.activityId = :activityId
            order by registration.activityRegistrationId
            """)
    List<ActivityRegistration> findByActivityIdForUpdate(@Param("activityId") Long activityId);

    @Query("""
            select case when count(registration) > 0 then true else false end
            from ActivityRegistration registration, Activity activity
            where registration.eventRegistrationId = :eventRegistrationId
              and registration.activityId = activity.activityId
              and registration.status = com.swp391.bookstreet.registration.entity.ActivityRegistrationStatus.ACTIVE
              and activity.status in (
                  com.swp391.bookstreet.activity.entity.ActivityStatus.PUBLISHED,
                  com.swp391.bookstreet.activity.entity.ActivityStatus.ONGOING
              )
            """)
    boolean existsSeatActiveByEventRegistrationId(
            @Param("eventRegistrationId") Long eventRegistrationId);
}
