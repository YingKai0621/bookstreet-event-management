package com.swp391.bookstreet.certificate.repository;

import com.swp391.bookstreet.certificate.entity.Certificate;
import jakarta.persistence.LockModeType;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CertificateRepository extends JpaRepository<Certificate, Long> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from Certificate c where c.attendanceId = :attendanceId")
    Optional<Certificate> findByAttendanceIdForUpdate(
            @Param("attendanceId") Long attendanceId);

    boolean existsByCertificateCode(String certificateCode);

    List<Certificate> findByAttendanceIdIn(Collection<Long> attendanceIds);
}
