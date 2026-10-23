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

    List<ActivityRating> findByAttendanceIdIn(Collection<Long> attendanceIds);
}
