package com.swp391.bookstreet.rating.repository;

import com.swp391.bookstreet.rating.entity.ActivityRating;
import jakarta.persistence.LockModeType;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ActivityRatingRepository extends JpaRepository<ActivityRating, Long> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from ActivityRating r where r.attendanceId = :attendanceId")
    Optional<ActivityRating> findByAttendanceIdForUpdate(
            @Param("attendanceId") Long attendanceId);

    Optional<ActivityRating> findByAttendanceId(Long attendanceId);

    List<ActivityRating> findByAttendanceIdIn(Collection<Long> attendanceIds);

    @Query("""
            select r
            from ActivityRating r, Attendance att, ActivityRegistration ar, EventRegistration er
            where r.attendanceId = att.attendanceId
              and att.activityRegistrationId = ar.activityRegistrationId
              and ar.eventRegistrationId = er.eventRegistrationId
              and er.userId = :userId
              and ar.activityId = :activityId
            """)
    Optional<ActivityRating> findOwnedRating(
            @Param("userId") Long userId,
            @Param("activityId") Long activityId);
}
