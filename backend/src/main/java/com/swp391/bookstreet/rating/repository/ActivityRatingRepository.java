package com.swp391.bookstreet.rating.repository;

import com.swp391.bookstreet.rating.entity.ActivityRating;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ActivityRatingRepository extends JpaRepository<ActivityRating, Long> {
    List<ActivityRating> findByAttendanceIdIn(Collection<Long> attendanceIds);
}
