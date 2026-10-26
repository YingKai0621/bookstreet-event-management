package com.swp391.bookstreet.attendance.repository;

import com.swp391.bookstreet.attendance.entity.Attendance;
import com.swp391.bookstreet.attendance.entity.AttendanceStatus;
import jakarta.persistence.LockModeType;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AttendanceRepository extends JpaRepository<Attendance, Long> {
    @Query("""
            select count(a) > 0 from Attendance a, ActivityRegistration r
            where a.activityRegistrationId = r.activityRegistrationId
              and r.activityId = :activityId
              and a.status = com.swp391.bookstreet.attendance.entity.AttendanceStatus.VALID
            """)
    boolean existsValidByActivityId(@Param("activityId") Long activityId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select a from Attendance a where a.activityRegistrationId in :ids order by a.attendanceId")
    List<Attendance> findAllForUpdate(@Param("ids") Collection<Long> ids);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select a from Attendance a where a.attendanceId = :attendanceId")
    Optional<Attendance> findByIdForUpdate(@Param("attendanceId") Long attendanceId);

    Optional<Attendance> findByActivityRegistrationId(Long activityRegistrationId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select a from Attendance a where a.activityRegistrationId = :activityRegistrationId")
    Optional<Attendance> findByActivityRegistrationIdForUpdate(
            @Param("activityRegistrationId") Long activityRegistrationId);

    List<Attendance> findByActivityRegistrationIdIn(Collection<Long> activityRegistrationIds);

    boolean existsByActivityRegistrationIdAndStatus(Long activityRegistrationId,
            AttendanceStatus status);
}
