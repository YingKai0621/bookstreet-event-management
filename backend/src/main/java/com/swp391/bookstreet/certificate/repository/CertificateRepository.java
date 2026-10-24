package com.swp391.bookstreet.certificate.repository;

import com.swp391.bookstreet.certificate.entity.Certificate;
import com.swp391.bookstreet.certificate.entity.CertificateStatus;
import jakarta.persistence.LockModeType;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
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

    @Query(value = """
            select c.*
            from certificates c
            join attendances att on c.attendance_id = att.attendance_id
            join activity_registrations ar on att.activity_registration_id = ar.activity_registration_id
            join event_registrations er on ar.event_registration_id = er.event_registration_id
            join activities act on ar.activity_id = act.activity_id
            where er.user_id = :participantId
              and (:eventId is null or er.event_id = :eventId)
              and (:activityId is null or ar.activity_id = :activityId)
              and (:status is null or c.status = :status)
            """,
            countQuery = """
            select count(c.certificate_id)
            from certificates c
            join attendances att on c.attendance_id = att.attendance_id
            join activity_registrations ar on att.activity_registration_id = ar.activity_registration_id
            join event_registrations er on ar.event_registration_id = er.event_registration_id
            where er.user_id = :participantId
              and (:eventId is null or er.event_id = :eventId)
              and (:activityId is null or ar.activity_id = :activityId)
              and (:status is null or c.status = :status)
            """,
            nativeQuery = true)
    Page<Certificate> findOwnedCertificates(
            @Param("participantId") Long participantId,
            @Param("eventId") Long eventId,
            @Param("activityId") Long activityId,
            @Param("status") String status,
            Pageable pageable);

    @Query("""
            select new com.swp391.bookstreet.certificate.repository.CertificateDetailRecord(c, act, ev)
            from Certificate c, Attendance att, ActivityRegistration ar, EventRegistration er, Activity act, Event ev
            where c.attendanceId = att.attendanceId
              and att.activityRegistrationId = ar.activityRegistrationId
              and ar.eventRegistrationId = er.eventRegistrationId
              and ar.activityId = act.activityId
              and act.eventId = ev.eventId
              and c.certificateId = :certificateId
              and er.userId = :participantId
            """)
    Optional<CertificateDetailRecord> findOwnedDetail(
            @Param("certificateId") Long certificateId,
            @Param("participantId") Long participantId);
}

