package com.swp391.bookstreet.activity.repository;

import com.swp391.bookstreet.activity.entity.ActivityRevision;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ActivityRevisionRepository extends JpaRepository<ActivityRevision, Long> {
    Page<ActivityRevision> findByActivityId(Long activityId, Pageable pageable);
}
