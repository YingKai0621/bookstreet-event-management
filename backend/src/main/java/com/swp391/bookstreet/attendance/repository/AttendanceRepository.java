package com.swp391.bookstreet.attendance.repository;

import com.swp391.bookstreet.attendance.entity.Attendance;
import com.swp391.bookstreet.attendance.entity.AttendanceStatus;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AttendanceRepository extends JpaRepository<Attendance, Long> {
    Optional<Attendance> findByActivityRegistrationId(Long activityRegistrationId);

    List<Attendance> findByActivityRegistrationIdIn(Collection<Long> activityRegistrationIds);

    boolean existsByActivityRegistrationIdAndStatus(Long activityRegistrationId,
            AttendanceStatus status);
}
