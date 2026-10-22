package com.swp391.bookstreet.registration.repository;

import com.swp391.bookstreet.registration.entity.ActivityRegistration;
import com.swp391.bookstreet.registration.entity.ActivityRegistrationStatus;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ActivityRegistrationRepository extends JpaRepository<ActivityRegistration, Long> {
    interface ActiveSchedule {
        Long getActivityId();
        java.time.Instant getStartAt();
        java.time.Instant getEndAt();
    }

    interface ActivitySeatCount {
        Long getActivityId();
        long getSeatCount();
    }

    interface ActivityRatingAggregate {
        Long getActivityId();
        long getScoreSum();
        long getRatingCount();
    }

    Optional<ActivityRegistration> findByEventRegistrationIdAndActivityId(
            Long eventRegistrationId, Long activityId);

    long countByActivityIdAndStatus(Long activityId, ActivityRegistrationStatus status);

    @Query(value = """
            select registration
            from ActivityRegistration registration, EventRegistration eventRegistration,
                 Activity activity, Location location
            where registration.eventRegistrationId = eventRegistration.eventRegistrationId
              and registration.activityId = activity.activityId
              and activity.locationId = location.locationId
              and eventRegistration.userId = :userId
              and (:eventId is null or activity.eventId = :eventId)
              and (:registrationStatus is null or registration.status = :registrationStatus)
              and (:activityStatus is null or activity.status = :activityStatus)
              and (:search = ''
                   or lower(activity.title) like lower(concat('%', :search, '%'))
                   or lower(activity.activityType) like lower(concat('%', :search, '%'))
                   or lower(location.code) like lower(concat('%', :search, '%'))
                   or lower(location.name) like lower(concat('%', :search, '%')))
              and (:outcome = ''
                   or (:outcome = 'CANCELLED' and registration.status =
                       com.swp391.bookstreet.registration.entity.ActivityRegistrationStatus.CANCELLED)
                   or (:outcome = 'ATTENDED' and registration.status <>
                       com.swp391.bookstreet.registration.entity.ActivityRegistrationStatus.CANCELLED
                       and exists (select attendance.attendanceId from Attendance attendance
                                   where attendance.activityRegistrationId =
                                         registration.activityRegistrationId
                                     and attendance.status =
                                         com.swp391.bookstreet.attendance.entity.AttendanceStatus.VALID))
                   or (:outcome = 'NO_SHOW' and registration.status =
                       com.swp391.bookstreet.registration.entity.ActivityRegistrationStatus.NO_SHOW
                       and not exists (select attendance.attendanceId from Attendance attendance
                                       where attendance.activityRegistrationId =
                                             registration.activityRegistrationId
                                         and attendance.status =
                                             com.swp391.bookstreet.attendance.entity.AttendanceStatus.VALID))
                   or (:outcome = 'ACTIVE' and registration.status =
                       com.swp391.bookstreet.registration.entity.ActivityRegistrationStatus.ACTIVE
                       and not exists (select attendance.attendanceId from Attendance attendance
                                       where attendance.activityRegistrationId =
                                             registration.activityRegistrationId
                                         and attendance.status =
                                             com.swp391.bookstreet.attendance.entity.AttendanceStatus.VALID)))
            """,
            countQuery = """
            select count(registration)
            from ActivityRegistration registration, EventRegistration eventRegistration,
                 Activity activity, Location location
            where registration.eventRegistrationId = eventRegistration.eventRegistrationId
              and registration.activityId = activity.activityId
              and activity.locationId = location.locationId
              and eventRegistration.userId = :userId
              and (:eventId is null or activity.eventId = :eventId)
              and (:registrationStatus is null or registration.status = :registrationStatus)
              and (:activityStatus is null or activity.status = :activityStatus)
              and (:search = ''
                   or lower(activity.title) like lower(concat('%', :search, '%'))
                   or lower(activity.activityType) like lower(concat('%', :search, '%'))
                   or lower(location.code) like lower(concat('%', :search, '%'))
                   or lower(location.name) like lower(concat('%', :search, '%')))
              and (:outcome = ''
                   or (:outcome = 'CANCELLED' and registration.status =
                       com.swp391.bookstreet.registration.entity.ActivityRegistrationStatus.CANCELLED)
                   or (:outcome = 'ATTENDED' and registration.status <>
                       com.swp391.bookstreet.registration.entity.ActivityRegistrationStatus.CANCELLED
                       and exists (select attendance.attendanceId from Attendance attendance
                                   where attendance.activityRegistrationId =
                                         registration.activityRegistrationId
                                     and attendance.status =
                                         com.swp391.bookstreet.attendance.entity.AttendanceStatus.VALID))
                   or (:outcome = 'NO_SHOW' and registration.status =
                       com.swp391.bookstreet.registration.entity.ActivityRegistrationStatus.NO_SHOW
                       and not exists (select attendance.attendanceId from Attendance attendance
                                       where attendance.activityRegistrationId =
                                             registration.activityRegistrationId
                                         and attendance.status =
                                             com.swp391.bookstreet.attendance.entity.AttendanceStatus.VALID))
                   or (:outcome = 'ACTIVE' and registration.status =
                       com.swp391.bookstreet.registration.entity.ActivityRegistrationStatus.ACTIVE
                       and not exists (select attendance.attendanceId from Attendance attendance
                                       where attendance.activityRegistrationId =
                                             registration.activityRegistrationId
                                         and attendance.status =
                                             com.swp391.bookstreet.attendance.entity.AttendanceStatus.VALID)))
            """)
    Page<ActivityRegistration> findOwned(
            @Param("userId") Long userId,
            @Param("eventId") Long eventId,
            @Param("registrationStatus") ActivityRegistrationStatus registrationStatus,
            @Param("outcome") String outcome,
            @Param("activityStatus") com.swp391.bookstreet.activity.entity.ActivityStatus activityStatus,
            @Param("search") String search,
            Pageable pageable);

    @Query("""
            select registration
            from ActivityRegistration registration, EventRegistration eventRegistration
            where registration.activityRegistrationId = :activityRegistrationId
              and registration.eventRegistrationId = eventRegistration.eventRegistrationId
              and eventRegistration.userId = :userId
            """)
    Optional<ActivityRegistration> findOwnedById(
            @Param("activityRegistrationId") Long activityRegistrationId,
            @Param("userId") Long userId);

    @Query("""
            select activity.activityId as activityId, activity.startAt as startAt,
                   activity.endAt as endAt
            from ActivityRegistration registration, EventRegistration eventRegistration,
                 Activity activity
            where registration.eventRegistrationId = eventRegistration.eventRegistrationId
              and registration.activityId = activity.activityId
              and eventRegistration.userId = :userId
              and registration.status =
                  com.swp391.bookstreet.registration.entity.ActivityRegistrationStatus.ACTIVE
              and activity.status in (
                  com.swp391.bookstreet.activity.entity.ActivityStatus.PUBLISHED,
                  com.swp391.bookstreet.activity.entity.ActivityStatus.ONGOING)
            order by activity.activityId
            """)
    List<ActiveSchedule> findActiveSchedules(@Param("userId") Long userId);

    @Query("""
            select registration.activityId as activityId, count(registration) as seatCount
            from ActivityRegistration registration, Activity activity
            where registration.activityId in :activityIds
              and registration.activityId = activity.activityId
              and registration.status = com.swp391.bookstreet.registration.entity.ActivityRegistrationStatus.ACTIVE
              and activity.status in (
                  com.swp391.bookstreet.activity.entity.ActivityStatus.PUBLISHED,
                  com.swp391.bookstreet.activity.entity.ActivityStatus.ONGOING
              )
            group by registration.activityId
            """)
    List<ActivitySeatCount> countSeatActiveByActivityIds(
            @Param("activityIds") List<Long> activityIds);

    @Query(value = """
            select registration.activity_id as activityId,
                   sum(rating.rating_score) as scoreSum,
                   count(rating.activity_rating_id) as ratingCount
            from activity_ratings rating
            join attendances attendance
              on attendance.attendance_id = rating.attendance_id
             and attendance.status = 'VALID'
            join activity_registrations registration
              on registration.activity_registration_id = attendance.activity_registration_id
            where rating.status = 'ACTIVE'
              and registration.activity_id in :activityIds
            group by registration.activity_id
            """, nativeQuery = true)
    List<ActivityRatingAggregate> aggregateEligibleRatings(
            @Param("activityIds") List<Long> activityIds);

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

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select registration
            from ActivityRegistration registration
            where registration.eventRegistrationId = :eventRegistrationId
            order by registration.activityRegistrationId
            """)
    List<ActivityRegistration> findByEventRegistrationIdForUpdate(
            @Param("eventRegistrationId") Long eventRegistrationId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select registration
            from ActivityRegistration registration
            where registration.eventRegistrationId in :eventRegistrationIds
            order by registration.activityRegistrationId
            """)
    List<ActivityRegistration> findByEventRegistrationIdsForUpdate(
            @Param("eventRegistrationIds") List<Long> eventRegistrationIds);

    interface EventRegistrationSeatCount {
        Long getEventRegistrationId();
        long getSeatActiveActivityCount();
    }

    @Query("""
            select registration.eventRegistrationId as eventRegistrationId,
                   count(registration) as seatActiveActivityCount
            from ActivityRegistration registration, Activity activity
            where registration.eventRegistrationId in :eventRegistrationIds
              and registration.activityId = activity.activityId
              and registration.status = com.swp391.bookstreet.registration.entity.ActivityRegistrationStatus.ACTIVE
              and activity.status in (
                  com.swp391.bookstreet.activity.entity.ActivityStatus.PUBLISHED,
                  com.swp391.bookstreet.activity.entity.ActivityStatus.ONGOING
              )
            group by registration.eventRegistrationId
            """)
    List<EventRegistrationSeatCount> countSeatActiveByEventRegistrationIds(
            @Param("eventRegistrationIds") List<Long> eventRegistrationIds);
}
