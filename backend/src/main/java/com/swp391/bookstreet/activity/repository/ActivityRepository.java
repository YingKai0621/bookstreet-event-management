package com.swp391.bookstreet.activity.repository;

import com.swp391.bookstreet.activity.entity.Activity;
import com.swp391.bookstreet.activity.entity.ActivityStatus;
import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ActivityRepository extends JpaRepository<Activity, Long> {
    @Query("select a.activityId from Activity a where a.attendanceQrToken = :token")
    Optional<Long> findIdByAttendanceQrToken(@Param("token") java.util.UUID token);
    interface ActivityRoute {
        Long getEventId();
        Long getLocationId();
    }

    interface PartnerOwnership {
        Long getActivityId();
        Long getPartnerOrganizationId();
    }

    interface PartnerActivityRoute {
        Long getActivityId();
        Long getEventId();
        Long getLocationId();
        Long getPartnerOrganizationId();
    }

    Optional<Activity> findBySourceProposalId(Long sourceProposalId);

    Optional<Activity> findByActivityIdAndPublishedAtIsNotNull(Long activityId);

    boolean existsByEventId(Long eventId);

    @Query("""
            select activity
            from Activity activity
            where activity.status in :statuses
              and (:eventId is null or activity.eventId = :eventId)
              and (:activityType = ''
                   or lower(activity.activityType) = lower(:activityType))
              and (:locationId is null or activity.locationId = :locationId)
              and (:search = ''
                   or lower(activity.title) like lower(concat('%', :search, '%'))
                   or lower(activity.activityType) like lower(concat('%', :search, '%'))
                   or lower(coalesce(activity.description, '')) like lower(concat('%', :search, '%')))
            """)
    Page<Activity> findPublic(
            @Param("statuses") Collection<ActivityStatus> statuses,
            @Param("eventId") Long eventId,
            @Param("activityType") String activityType,
            @Param("locationId") Long locationId,
            @Param("search") String search,
            Pageable pageable);

    @Query(value = """
            select count(*)
            from activities activity
            join activity_proposals proposal
              on proposal.activity_proposal_id = activity.source_proposal_id
            join partner_event_applications application
              on application.application_id = proposal.application_id
            where activity.event_id = :eventId
              and application.partner_organization_id = :partnerOrganizationId
              and activity.status <> 'CANCELLED'
            """, nativeQuery = true)
    long countOfficialPartnerActivities(
            @Param("eventId") Long eventId,
            @Param("partnerOrganizationId") Long partnerOrganizationId);

    @Query("""
            select activity.eventId as eventId, activity.locationId as locationId
            from Activity activity
            where activity.activityId = :activityId
            """)
    Optional<ActivityRoute> findRouteById(@Param("activityId") Long activityId);

    @Query("""
            select activity.locationId
            from Activity activity
            where activity.activityId = :activityId
            """)
    Optional<Long> findLocationIdById(@Param("activityId") Long activityId);

    @Query("""
            select activity
            from Activity activity, Event event
            where activity.eventId = event.eventId
              and event.organizerUserId = :organizerUserId
              and (:eventId is null or activity.eventId = :eventId)
              and (:status is null or activity.status = :status)
              and (:search is null
                   or lower(activity.title) like lower(concat('%', :search, '%'))
                   or lower(activity.activityType) like lower(concat('%', :search, '%'))
                   or lower(coalesce(activity.description, '')) like lower(concat('%', :search, '%')))
            """)
    Page<Activity> findForOrganizer(
            @Param("organizerUserId") Long organizerUserId,
            @Param("eventId") Long eventId,
            @Param("status") ActivityStatus status,
            @Param("search") String search,
            Pageable pageable);

    @Query("""
            select activity
            from Activity activity, Event event
            where activity.activityId = :activityId
              and activity.eventId = event.eventId
              and event.organizerUserId = :organizerUserId
            """)
    Optional<Activity> findOwnedById(
            @Param("activityId") Long activityId,
            @Param("organizerUserId") Long organizerUserId);

    @Query("""
            select activity
            from Activity activity, ActivityProposal proposal,
                 PartnerEventApplication application
            where activity.sourceProposalId = proposal.activityProposalId
              and proposal.applicationId = application.id
              and application.partnerOrganization.representativeUserId = :representativeUserId
              and (:eventId is null or activity.eventId = :eventId)
              and (:status is null or activity.status = :status)
              and (lower(activity.title) like lower(concat('%', :search, '%'))
                   or lower(activity.activityType) like lower(concat('%', :search, '%'))
                   or lower(coalesce(activity.description, '')) like lower(concat('%', :search, '%')))
            """)
    Page<Activity> findForPartner(
            @Param("representativeUserId") Long representativeUserId,
            @Param("eventId") Long eventId,
            @Param("status") ActivityStatus status,
            @Param("search") String search,
            Pageable pageable);

    @Query("""
            select activity
            from Activity activity, ActivityProposal proposal,
                 PartnerEventApplication application
            where activity.activityId = :activityId
              and activity.sourceProposalId = proposal.activityProposalId
              and proposal.applicationId = application.id
              and application.partnerOrganization.representativeUserId = :representativeUserId
            """)
    Optional<Activity> findOwnedByPartner(
            @Param("activityId") Long activityId,
            @Param("representativeUserId") Long representativeUserId);

    @Query("""
            select activity.activityId as activityId,
                   activity.eventId as eventId,
                   activity.locationId as locationId,
                   application.partnerOrganization.id as partnerOrganizationId
            from Activity activity, ActivityProposal proposal,
                 PartnerEventApplication application
            where activity.activityId = :activityId
              and activity.sourceProposalId = proposal.activityProposalId
              and proposal.applicationId = application.id
              and application.partnerOrganization.representativeUserId = :representativeUserId
            """)
    Optional<PartnerActivityRoute> findPartnerRoute(
            @Param("activityId") Long activityId,
            @Param("representativeUserId") Long representativeUserId);

    @Query(value = """
            select activity.activity_id as activityId,
                   application.partner_organization_id as partnerOrganizationId
            from activities activity
            join activity_proposals proposal
              on proposal.activity_proposal_id = activity.source_proposal_id
            join partner_event_applications application
              on application.application_id = proposal.application_id
            where activity.activity_id in :activityIds
            """, nativeQuery = true)
    List<PartnerOwnership> findPartnerOwnership(
            @Param("activityIds") Collection<Long> activityIds);

    @Query(value = """
            select case
                       when representative.email_verified_at is not null
                            and representative.email is not null
                            and btrim(representative.email) <> ''
                       then representative.email
                       else null
                   end as recipientEmail,
                   event.name as eventName,
                   activity.title as activityTitle
            from activities activity
            join activity_proposals proposal
              on proposal.activity_proposal_id = activity.source_proposal_id
            join partner_event_applications application
              on application.application_id = proposal.application_id
            join partner_organizations organization
              on organization.partner_organization_id = application.partner_organization_id
            join users representative
              on representative.user_id = organization.representative_user_id
            join events event on event.event_id = activity.event_id
            where activity.activity_id = :activityId
            """, nativeQuery = true)
    Optional<ActivityPartnerNotificationContext> findPartnerNotificationContext(
            @Param("activityId") Long activityId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select activity from Activity activity where activity.activityId = :activityId")
    Optional<Activity> findByIdForUpdate(@Param("activityId") Long activityId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select activity
            from Activity activity
            where activity.eventId = :eventId
            order by activity.activityId
            """)
    List<Activity> findByEventIdForUpdate(@Param("eventId") Long eventId);

    @Query("""
            select distinct activity.locationId
            from Activity activity
            where activity.eventId = :eventId
              and activity.status <> com.swp391.bookstreet.activity.entity.ActivityStatus.CANCELLED
            """)
    List<Long> findNonCancelledLocationIdsByEventId(@Param("eventId") Long eventId);

    @Query("""
            select case when count(activity) > 0 then true else false end
            from Activity activity
            where activity.eventId = :eventId
              and activity.status <> com.swp391.bookstreet.activity.entity.ActivityStatus.CANCELLED
              and (activity.startAt < :eventStartAt or activity.endAt > :eventEndAt)
            """)
    boolean existsNonCancelledOutsideEventInterval(
            @Param("eventId") Long eventId,
            @Param("eventStartAt") Instant eventStartAt,
            @Param("eventEndAt") Instant eventEndAt);

    @Query("""
            select case when count(activity) > 0 then true else false end
            from Activity activity
            where activity.locationId = :locationId
              and activity.status <> com.swp391.bookstreet.activity.entity.ActivityStatus.CANCELLED
              and activity.endAt > :now
            """)
    boolean existsCurrentOrFutureAtLocation(
            @Param("locationId") Long locationId,
            @Param("now") Instant now);

    @Query("""
            select coalesce(max(activity.capacity), 0)
            from Activity activity
            where activity.locationId = :locationId
              and activity.status <> com.swp391.bookstreet.activity.entity.ActivityStatus.CANCELLED
              and activity.endAt > :now
            """)
    int findMaximumCurrentOrFutureCapacityAtLocation(
            @Param("locationId") Long locationId,
            @Param("now") Instant now);

    @Query("""
            select activity.activityId
            from Activity activity
            where activity.status in :statuses
              and (activity.startAt <= :now or activity.endAt <= :now)
            order by activity.activityId
            """)
    List<Long> findDueLifecycleIds(
            @Param("statuses") Collection<ActivityStatus> statuses,
            @Param("now") Instant now);

    @Query("""
            select case when count(activity) > 0 then true else false end
            from Activity activity
            where activity.locationId = :locationId
              and activity.status <> com.swp391.bookstreet.activity.entity.ActivityStatus.CANCELLED
              and activity.startAt < :endAt
              and :startAt < activity.endAt
              and (:excludedActivityId is null or activity.activityId <> :excludedActivityId)
            """)
    boolean existsScheduleConflict(
            @Param("locationId") Long locationId,
            @Param("startAt") Instant startAt,
            @Param("endAt") Instant endAt,
            @Param("excludedActivityId") Long excludedActivityId);

    @Query("""
            select distinct activity.locationId
            from Activity activity
            where activity.locationId in :locationIds
              and activity.status <> com.swp391.bookstreet.activity.entity.ActivityStatus.CANCELLED
              and activity.startAt < :endAt
              and :startAt < activity.endAt
            """)
    List<Long> findConflictingLocationIds(
            @Param("locationIds") Collection<Long> locationIds,
            @Param("startAt") Instant startAt,
            @Param("endAt") Instant endAt);
}
