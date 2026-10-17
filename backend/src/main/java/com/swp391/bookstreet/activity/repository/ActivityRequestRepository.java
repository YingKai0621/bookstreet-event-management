package com.swp391.bookstreet.activity.repository;

import com.swp391.bookstreet.activity.entity.ActivityRequest;
import com.swp391.bookstreet.activity.entity.ActivityRequestStatus;
import com.swp391.bookstreet.activity.entity.ActivityRequestType;
import jakarta.persistence.LockModeType;
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
