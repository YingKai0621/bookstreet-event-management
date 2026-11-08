package com.swp391.bookstreet.activity.repository;

import com.swp391.bookstreet.activity.entity.ActivityRequest;
import com.swp391.bookstreet.activity.entity.ActivityRequestStatus;
import com.swp391.bookstreet.activity.entity.ActivityRequestType;
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

public interface ActivityRequestRepository extends JpaRepository<ActivityRequest, Long> {
    interface OwnedRequestRoute {
        Long getRequestId();
        Long getActivityId();
    }

    interface OrganizerRequestRoute {
        Long getRequestId();
        Long getActivityId();
        Long getRequestedLocationId();
    }

    interface OrganizerRequestContextView {
        Long getRequestId();
        Long getActivityId();
        Long getEventId();
        String getEventName();
        Long getPartnerOrganizationId();
        String getPartnerOrganizationName();
        String getPartnerOrganizationStatus();
        Long getLocationId();
        String getLocationCode();
        String getLocationName();
        String getLocationType();
        Integer getLocationMaxCapacity();
        boolean getLocationActive();
        String getActivityTitle();
        String getActivityDescription();
        String getActivityType();
        Instant getStartAt();
        Instant getEndAt();
        Integer getActivityCapacity();
        String getActivityImageUrl();
        String getActivityStatus();
        Long getRequestedLocationId();
        String getRequestedLocationCode();
        String getRequestedLocationName();
        String getRequestedLocationType();
        Integer getRequestedLocationMaxCapacity();
        Boolean getRequestedLocationActive();
    }

    boolean existsByActivityIdAndStatus(Long activityId, ActivityRequestStatus status);

    @Query("""
            select request
            from ActivityRequest request, Activity activity, ActivityProposal proposal,
                 PartnerEventApplication application
            where request.activityId = activity.activityId
              and request.requestType = :requestType
              and activity.sourceProposalId = proposal.activityProposalId
              and proposal.applicationId = application.id
              and application.partnerOrganization.representativeUserId = :representativeUserId
              and (:eventId is null or activity.eventId = :eventId)
              and (:status is null or request.status = :status)
              and (:late is null or request.late = :late)
              and (lower(request.reason) like lower(concat('%', :search, '%'))
                   or lower(coalesce(request.requestedTitle, '')) like lower(concat('%', :search, '%'))
                   or lower(activity.title) like lower(concat('%', :search, '%')))
            """)
    Page<ActivityRequest> findOwnedRequests(
            @Param("representativeUserId") Long representativeUserId,
            @Param("requestType") ActivityRequestType requestType,
            @Param("eventId") Long eventId,
            @Param("status") ActivityRequestStatus status,
            @Param("late") Boolean late,
            @Param("search") String search,
            Pageable pageable);

    @Query("""
            select request
            from ActivityRequest request, Activity activity, Event event,
                 ActivityProposal proposal, PartnerEventApplication application
            where request.activityId = activity.activityId
              and activity.eventId = event.eventId
              and activity.sourceProposalId = proposal.activityProposalId
              and proposal.applicationId = application.id
              and request.requestType = :requestType
              and event.organizerUserId = :organizerUserId
              and (:eventId is null or activity.eventId = :eventId)
              and (:status is null or request.status = :status)
              and (:late is null or request.late = :late)
              and (:search is null
                   or lower(request.reason) like lower(concat('%', :search, '%'))
                   or lower(coalesce(request.requestedTitle, '')) like lower(concat('%', :search, '%'))
                   or lower(activity.title) like lower(concat('%', :search, '%'))
                   or lower(activity.activityType) like lower(concat('%', :search, '%'))
                   or lower(event.name) like lower(concat('%', :search, '%'))
                   or lower(application.partnerOrganization.name)
                        like lower(concat('%', :search, '%')))
            """)
    Page<ActivityRequest> findOrganizerRequests(
            @Param("organizerUserId") Long organizerUserId,
            @Param("requestType") ActivityRequestType requestType,
            @Param("eventId") Long eventId,
            @Param("status") ActivityRequestStatus status,
            @Param("late") Boolean late,
            @Param("search") String search,
            Pageable pageable);

    @Query(value = """
            select request.activity_request_id as requestId,
                   activity.activity_id as activityId,
                   activity.event_id as eventId,
                   event.name as eventName,
                   organization.partner_organization_id as partnerOrganizationId,
                   organization.name as partnerOrganizationName,
                   organization.status as partnerOrganizationStatus,
                   current_location.location_id as locationId,
                   current_location.code as locationCode,
                   current_location.name as locationName,
                   current_location.location_type as locationType,
                   current_location.max_capacity as locationMaxCapacity,
                   current_location.is_active as locationActive,
                   activity.title as activityTitle,
                   activity.description as activityDescription,
                   activity.activity_type as activityType,
                   activity.start_at as startAt,
                   activity.end_at as endAt,
                   activity.capacity as activityCapacity,
                   activity.image_url as activityImageUrl,
                   activity.status as activityStatus,
                   requested_location.location_id as requestedLocationId,
                   requested_location.code as requestedLocationCode,
                   requested_location.name as requestedLocationName,
                   requested_location.location_type as requestedLocationType,
                   requested_location.max_capacity as requestedLocationMaxCapacity,
                   requested_location.is_active as requestedLocationActive
            from activity_requests request
            join activities activity on activity.activity_id = request.activity_id
            join events event on event.event_id = activity.event_id
            join activity_proposals proposal
              on proposal.activity_proposal_id = activity.source_proposal_id
            join partner_event_applications application
              on application.application_id = proposal.application_id
            join partner_organizations organization
              on organization.partner_organization_id = application.partner_organization_id
            join locations current_location
              on current_location.location_id = activity.location_id
            left join locations requested_location
              on requested_location.location_id = request.requested_location_id
            where request.activity_request_id in :requestIds
              and event.organizer_user_id = :organizerUserId
            """, nativeQuery = true)
    List<OrganizerRequestContextView> findOrganizerRequestContexts(
            @Param("requestIds") Collection<Long> requestIds,
            @Param("organizerUserId") Long organizerUserId);

    @Query("""
            select request
            from ActivityRequest request, Activity activity, ActivityProposal proposal,
                 PartnerEventApplication application
            where request.activityRequestId = :requestId
              and request.activityId = activity.activityId
              and request.requestType = :requestType
              and activity.sourceProposalId = proposal.activityProposalId
              and proposal.applicationId = application.id
              and application.partnerOrganization.representativeUserId = :representativeUserId
            """)
    Optional<ActivityRequest> findOwnedRequest(
            @Param("requestId") Long requestId,
            @Param("representativeUserId") Long representativeUserId,
            @Param("requestType") ActivityRequestType requestType);

    @Query("""
            select request
            from ActivityRequest request, Activity activity, Event event
            where request.activityRequestId = :requestId
              and request.activityId = activity.activityId
              and activity.eventId = event.eventId
              and request.requestType = :requestType
              and event.organizerUserId = :organizerUserId
            """)
    Optional<ActivityRequest> findOrganizerRequest(
            @Param("requestId") Long requestId,
            @Param("organizerUserId") Long organizerUserId,
            @Param("requestType") ActivityRequestType requestType);

    @Query("""
            select request.activityRequestId as requestId,
                   request.activityId as activityId,
                   request.requestedLocationId as requestedLocationId
            from ActivityRequest request, Activity activity, Event event
            where request.activityRequestId = :requestId
              and request.activityId = activity.activityId
              and activity.eventId = event.eventId
              and request.requestType = :requestType
              and event.organizerUserId = :organizerUserId
            """)
    Optional<OrganizerRequestRoute> findOrganizerRequestRoute(
            @Param("requestId") Long requestId,
            @Param("organizerUserId") Long organizerUserId,
            @Param("requestType") ActivityRequestType requestType);

    @Query("""
            select request.activityRequestId as requestId,
                   request.activityId as activityId
            from ActivityRequest request, Activity activity, ActivityProposal proposal,
                 PartnerEventApplication application
            where request.activityRequestId = :requestId
              and request.activityId = activity.activityId
              and request.requestType = :requestType
              and activity.sourceProposalId = proposal.activityProposalId
              and proposal.applicationId = application.id
              and application.partnerOrganization.representativeUserId = :representativeUserId
            """)
    Optional<OwnedRequestRoute> findOwnedRequestRoute(
            @Param("requestId") Long requestId,
            @Param("representativeUserId") Long representativeUserId,
            @Param("requestType") ActivityRequestType requestType);

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
