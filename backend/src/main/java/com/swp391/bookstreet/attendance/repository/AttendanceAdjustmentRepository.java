package com.swp391.bookstreet.attendance.repository;

import com.swp391.bookstreet.attendance.entity.AttendanceAdjustment;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.repository.Repository;

/** Append and read only: no update or deletion operations. */
public interface AttendanceAdjustmentRepository extends Repository<AttendanceAdjustment, Long> {
    AttendanceAdjustment save(AttendanceAdjustment adjustment);
    Optional<AttendanceAdjustment> findByIdempotencyKey(UUID key);
    Page<AttendanceAdjustment> findByActivityRegistrationId(Long registrationId, Pageable pageable);
}
