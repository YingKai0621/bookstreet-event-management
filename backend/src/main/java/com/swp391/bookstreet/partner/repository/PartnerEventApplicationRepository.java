package com.swp391.bookstreet.partner.repository;

import com.swp391.bookstreet.partner.entity.PartnerEventApplication;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;

public interface PartnerEventApplicationRepository
        extends JpaRepository<PartnerEventApplication, Long> {

    @Query("SELECT application.eventId FROM PartnerEventApplication application "
            + "WHERE application.id = :applicationId")
    Optional<Long> findEventIdById(@Param("applicationId") Long applicationId);

    @EntityGraph(attributePaths = "partnerOrganization")
    Optional<PartnerEventApplication> findByEventIdAndPartnerOrganization_RepresentativeUserId(
            Long eventId,
            Long representativeUserId
    );

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT application FROM PartnerEventApplication application WHERE application.id = :applicationId")
    Optional<PartnerEventApplication> findWithLockById(
            @Param("applicationId") Long applicationId
    );

    Page<PartnerEventApplication> findAllByPartnerOrganization_RepresentativeUserId(
            Long representativeUserId,
            Pageable pageable
    );

    @Query(value = """
            SELECT EXISTS (
                SELECT 1
                FROM partner_event_applications a
                JOIN events e ON e.event_id = a.event_id
                WHERE a.application_id = :applicationId
                  AND e.organizer_user_id = :organizerUserId
            )
            """, nativeQuery = true)
    boolean existsByIdAndEventOrganizerUserId(
            @Param("applicationId") Long applicationId,
            @Param("organizerUserId") Long organizerUserId
    );

    @Query(value = """
            SELECT a.application_id AS applicationId,
                   a.event_id AS eventId,
                   po.partner_organization_id AS partnerOrganizationId,
                   po.name AS partnerOrganizationName,
                   po.status AS partnerOrganizationStatus,
                   po.category_code AS partnerCategoryCode,
                   a.status AS status,
                   a.application_note AS applicationNote,
                   a.review_note AS reviewNote,
                   a.submitted_at AS submittedAt,
                   a.reviewed_at AS reviewedAt,
                   a.withdrawn_at AS withdrawnAt
            FROM partner_event_applications a
            JOIN partner_organizations po
              ON po.partner_organization_id = a.partner_organization_id
            JOIN events e
              ON e.event_id = a.event_id
            WHERE a.application_id = :applicationId
              AND e.organizer_user_id = :organizerUserId
            """, nativeQuery = true)
    Optional<OrganizerApplicationRow> findOrganizerApplicationById(
            @Param("applicationId") Long applicationId,
            @Param("organizerUserId") Long organizerUserId
    );

    Optional<PartnerEventApplication> findByIdAndPartnerOrganization_RepresentativeUserId(
            Long applicationId,
            Long representativeUserId
    );

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<PartnerEventApplication> findWithLockByIdAndPartnerOrganization_RepresentativeUserId(
            Long applicationId,
            Long representativeUserId
    );

    boolean existsByPartnerOrganization_IdAndEventId(
            Long partnerOrganizationId,
            Long eventId
    );

    @Query(value = """
            SELECT representative.email
            FROM partner_event_applications application
            JOIN partner_organizations organization
              ON organization.partner_organization_id = application.partner_organization_id
            JOIN users representative
              ON representative.user_id = organization.representative_user_id
            WHERE application.event_id = :eventId
              AND application.status IN ('PENDING', 'APPROVED')
              AND representative.email_verified_at IS NOT NULL
              AND representative.email IS NOT NULL
              AND BTRIM(representative.email) <> ''
            ORDER BY application.application_id
            """, nativeQuery = true)
    List<String> findEventCancellationRecipientEmails(@Param("eventId") Long eventId);

    @Query("""
            select distinct application.partnerOrganization.representativeUserId
            from PartnerEventApplication application
            where application.eventId = :eventId
              and application.status in :statuses
            """)
    List<Long> findAffectedRepresentativeIds(@Param("eventId") Long eventId,
            @Param("statuses") java.util.Collection<PartnerEventApplication.ApplicationStatus> statuses);

    @Query(value = """
            SELECT a.application_id AS applicationId,
                   a.event_id AS eventId,
                   po.partner_organization_id AS partnerOrganizationId,
                   po.name AS partnerOrganizationName,
                   po.status AS partnerOrganizationStatus,
                   po.category_code AS partnerCategoryCode,
                   a.status AS status,
                   a.application_note AS applicationNote,
                   a.review_note AS reviewNote,
                   a.submitted_at AS submittedAt,
                   a.reviewed_at AS reviewedAt,
                   a.withdrawn_at AS withdrawnAt
            FROM partner_event_applications a
            JOIN partner_organizations po
              ON po.partner_organization_id = a.partner_organization_id
            JOIN events e
              ON e.event_id = a.event_id
            WHERE a.event_id = :eventId
              AND e.organizer_user_id = :organizerUserId
              AND (:status IS NULL OR a.status = :status)
            """,
            countQuery = """
                    SELECT COUNT(*)
                    FROM partner_event_applications a
                    JOIN events e ON e.event_id = a.event_id
                    WHERE a.event_id = :eventId
                      AND e.organizer_user_id = :organizerUserId
                      AND (:status IS NULL OR a.status = :status)
                    """,
            nativeQuery = true)
    Page<OrganizerApplicationRow> findOrganizerApplications(
            @Param("eventId") Long eventId,
            @Param("organizerUserId") Long organizerUserId,
            @Param("status") String status,
            Pageable pageable
    );

    @Query(value = "SELECT EXISTS (SELECT 1 FROM events WHERE event_id = :eventId)",
            nativeQuery = true)
    boolean existsEventById(@Param("eventId") Long eventId);

    @Query(value = """
            SELECT EXISTS (
                SELECT 1 FROM events
                WHERE event_id = :eventId
                  AND organizer_user_id = :organizerUserId
            )
            """, nativeQuery = true)
    boolean existsEventByIdAndOrganizerUserId(
            @Param("eventId") Long eventId,
            @Param("organizerUserId") Long organizerUserId
    );
}
