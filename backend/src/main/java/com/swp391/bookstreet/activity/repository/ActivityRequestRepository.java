package com.swp391.bookstreet.activity.repository;

import com.swp391.bookstreet.activity.entity.ActivityRequest;
import com.swp391.bookstreet.activity.entity.ActivityRequestStatus;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ActivityRequestRepository extends JpaRepository<ActivityRequest, Long> {
    boolean existsByActivityIdAndStatus(Long activityId, ActivityRequestStatus status);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select request
            from ActivityRequest request
            where request.activityRequestId = :requestId
            """)
    Optional<ActivityRequest> findByIdForUpdate(@Param("requestId") Long requestId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select request
            from ActivityRequest request
            where request.activityId = :activityId
              and request.status = com.swp391.bookstreet.activity.entity.ActivityRequestStatus.PENDING
            order by request.activityRequestId
            """)
    List<ActivityRequest> findPendingByActivityIdForUpdate(
            @Param("activityId") Long activityId);
}
