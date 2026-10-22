package com.swp391.bookstreet.certificate.repository;

import com.swp391.bookstreet.certificate.entity.Certificate;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CertificateRepository extends JpaRepository<Certificate, Long> {
    List<Certificate> findByAttendanceIdIn(Collection<Long> attendanceIds);
}
