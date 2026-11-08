package com.swp391.bookstreet.activity.repository;

import com.swp391.bookstreet.activity.entity.ActivityProposal;
import com.swp391.bookstreet.activity.entity.ActivityProposalStatus;
import jakarta.persistence.LockModeType;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.time.Instant;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ActivityProposalRepository extends JpaRepository<ActivityProposal, Long> {
    interface ProposalRoute {
        Long getApplicationId();
        Long getEventId();
        Long getLocationId();
    }

    interface PartnerProposalView {
        Long getActivityProposalId();
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
        String getTitle();
        String getDescription();
        String getActivityType();
        Instant getProposedStartAt();
        Instant getProposedEndAt();
        Integer getCapacity();
        String getStatus();
        String getReviewNote();
        Instant getSubmittedAt();
        Instant getUpdatedAt();
        Instant getReviewedAt();
        Instant getWithdrawnAt();
        Instant getCancelledAt();
        Long getActivityId();
    }

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select proposal
            from ActivityProposal proposal
            where proposal.activityProposalId = :proposalId
            """)
    Optional<ActivityProposal> findByIdForUpdate(@Param("proposalId") Long proposalId);

    @Query("""
            select distinct proposal.locationId
            from ActivityProposal proposal, PartnerEventApplication application
            where proposal.applicationId = application.id
              and application.eventId = :eventId
              and proposal.status in :statuses
            """)
    List<Long> findLocationIdsByEventIdAndStatusIn(
            @Param("eventId") Long eventId,
            @Param("statuses") Collection<ActivityProposalStatus> statuses);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select proposal
            from ActivityProposal proposal, PartnerEventApplication application
            where proposal.applicationId = application.id
              and application.eventId = :eventId
              and proposal.status in :statuses
            order by proposal.activityProposalId
            """)
    List<ActivityProposal> findByEventIdAndStatusInForUpdate(
            @Param("eventId") Long eventId,
            @Param("statuses") Collection<ActivityProposalStatus> statuses);

    @Query(value = """
            select proposal.activity_proposal_id as activityProposalId,
                   application.event_id as eventId,
                   event.name as eventName,
                   application.partner_organization_id as partnerOrganizationId,
                   organization.name as partnerOrganizationName,
                   organization.status as partnerOrganizationStatus,
                   location.location_id as locationId,
                   location.code as locationCode,
                   location.name as locationName,
                   location.location_type as locationType,
                   location.max_capacity as locationMaxCapacity,
                   location.is_active as locationActive,
                   proposal.title as title,
                   proposal.description as description,
                   proposal.activity_type as activityType,
                   proposal.proposed_start_at as proposedStartAt,
                   proposal.proposed_end_at as proposedEndAt,
                   proposal.capacity as capacity,
                   proposal.status as status,
                   proposal.review_note as reviewNote,
                   proposal.submitted_at as submittedAt,
                   proposal.updated_at as updatedAt,
                   proposal.reviewed_at as reviewedAt,
                   proposal.withdrawn_at as withdrawnAt,
                   proposal.cancelled_at as cancelledAt,
                   activity.activity_id as activityId
            from activity_proposals proposal
            join partner_event_applications application
              on application.application_id = proposal.application_id
            join partner_organizations organization
              on organization.partner_organization_id = application.partner_organization_id
            join events event on event.event_id = application.event_id
            join locations location on location.location_id = proposal.location_id
            left join activities activity
              on activity.source_proposal_id = proposal.activity_proposal_id
            where organization.representative_user_id = :representativeUserId
              and (:eventId is null or application.event_id = :eventId)
              and (:status is null or proposal.status = :status)
              and (:search is null
                   or lower(proposal.title) like lower(concat('%', :search, '%'))
                   or lower(coalesce(proposal.description, '')) like lower(concat('%', :search, '%'))
                   or lower(proposal.activity_type) like lower(concat('%', :search, '%'))
                   or lower(event.name) like lower(concat('%', :search, '%'))
                   or lower(location.name) like lower(concat('%', :search, '%')))
            """, countQuery = """
            select count(*)
            from activity_proposals proposal
            join partner_event_applications application
              on application.application_id = proposal.application_id
            join partner_organizations organization
              on organization.partner_organization_id = application.partner_organization_id
            join events event on event.event_id = application.event_id
            join locations location on location.location_id = proposal.location_id
            where organization.representative_user_id = :representativeUserId
              and (:eventId is null or application.event_id = :eventId)
              and (:status is null or proposal.status = :status)
              and (:search is null
                   or lower(proposal.title) like lower(concat('%', :search, '%'))
                   or lower(coalesce(proposal.description, '')) like lower(concat('%', :search, '%'))
                   or lower(proposal.activity_type) like lower(concat('%', :search, '%'))
                   or lower(event.name) like lower(concat('%', :search, '%'))
                   or lower(location.name) like lower(concat('%', :search, '%')))
            """, nativeQuery = true)
    Page<PartnerProposalView> findPartnerProposals(
            @Param("representativeUserId") Long representativeUserId,
            @Param("eventId") Long eventId,
            @Param("status") String status,
            @Param("search") String search,
            Pageable pageable);

    @Query(value = """
            select proposal.activity_proposal_id as activityProposalId,
                   application.event_id as eventId,
                   event.name as eventName,
                   application.partner_organization_id as partnerOrganizationId,
                   organization.name as partnerOrganizationName,
                   organization.status as partnerOrganizationStatus,
                   location.location_id as locationId,
                   location.code as locationCode,
                   location.name as locationName,
                   location.location_type as locationType,
                   location.max_capacity as locationMaxCapacity,
                   location.is_active as locationActive,
                   proposal.title as title,
                   proposal.description as description,
                   proposal.activity_type as activityType,
                   proposal.proposed_start_at as proposedStartAt,
                   proposal.proposed_end_at as proposedEndAt,
                   proposal.capacity as capacity,
                   proposal.status as status,
                   proposal.review_note as reviewNote,
                   proposal.submitted_at as submittedAt,
                   proposal.updated_at as updatedAt,
                   proposal.reviewed_at as reviewedAt,
                   proposal.withdrawn_at as withdrawnAt,
                   proposal.cancelled_at as cancelledAt,
                   activity.activity_id as activityId
            from activity_proposals proposal
            join partner_event_applications application
              on application.application_id = proposal.application_id
            join partner_organizations organization
              on organization.partner_organization_id = application.partner_organization_id
            join events event on event.event_id = application.event_id
            join locations location on location.location_id = proposal.location_id
            left join activities activity
              on activity.source_proposal_id = proposal.activity_proposal_id
            where event.organizer_user_id = :organizerUserId
              and (:eventId is null or application.event_id = :eventId)
              and (:status is null or proposal.status = :status)
              and (:locationId is null or proposal.location_id = :locationId)
              and (:search is null
                   or lower(proposal.title) like lower(concat('%', :search, '%'))
                   or lower(coalesce(proposal.description, '')) like lower(concat('%', :search, '%'))
                   or lower(proposal.activity_type) like lower(concat('%', :search, '%'))
                   or lower(event.name) like lower(concat('%', :search, '%'))
                   or lower(location.name) like lower(concat('%', :search, '%')))
            """, countQuery = """
            select count(*)
            from activity_proposals proposal
            join partner_event_applications application
              on application.application_id = proposal.application_id
            join events event on event.event_id = application.event_id
            join locations location on location.location_id = proposal.location_id
            where event.organizer_user_id = :organizerUserId
              and (:eventId is null or application.event_id = :eventId)
              and (:status is null or proposal.status = :status)
              and (:locationId is null or proposal.location_id = :locationId)
              and (:search is null
                   or lower(proposal.title) like lower(concat('%', :search, '%'))
                   or lower(coalesce(proposal.description, '')) like lower(concat('%', :search, '%'))
                   or lower(proposal.activity_type) like lower(concat('%', :search, '%'))
                   or lower(event.name) like lower(concat('%', :search, '%'))
                   or lower(location.name) like lower(concat('%', :search, '%')))
            """, nativeQuery = true)
    Page<PartnerProposalView> findOrganizerProposals(
            @Param("organizerUserId") Long organizerUserId,
            @Param("eventId") Long eventId,
            @Param("status") String status,
            @Param("locationId") Long locationId,
            @Param("search") String search,
            Pageable pageable);

    @Query(value = """
            select proposal.activity_proposal_id as activityProposalId,
                   application.event_id as eventId,
                   event.name as eventName,
                   application.partner_organization_id as partnerOrganizationId,
                   organization.name as partnerOrganizationName,
                   organization.status as partnerOrganizationStatus,
                   location.location_id as locationId,
                   location.code as locationCode,
                   location.name as locationName,
                   location.location_type as locationType,
                   location.max_capacity as locationMaxCapacity,
                   location.is_active as locationActive,
                   proposal.title as title,
                   proposal.description as description,
                   proposal.activity_type as activityType,
                   proposal.proposed_start_at as proposedStartAt,
                   proposal.proposed_end_at as proposedEndAt,
                   proposal.capacity as capacity,
                   proposal.status as status,
                   proposal.review_note as reviewNote,
                   proposal.submitted_at as submittedAt,
                   proposal.updated_at as updatedAt,
                   proposal.reviewed_at as reviewedAt,
                   proposal.withdrawn_at as withdrawnAt,
                   proposal.cancelled_at as cancelledAt,
                   activity.activity_id as activityId
            from activity_proposals proposal
            join partner_event_applications application
              on application.application_id = proposal.application_id
            join partner_organizations organization
              on organization.partner_organization_id = application.partner_organization_id
            join events event on event.event_id = application.event_id
            join locations location on location.location_id = proposal.location_id
            left join activities activity
              on activity.source_proposal_id = proposal.activity_proposal_id
            where proposal.activity_proposal_id = :proposalId
              and organization.representative_user_id = :representativeUserId
            """, nativeQuery = true)
    Optional<PartnerProposalView> findOwnedPartnerView(
            @Param("proposalId") Long proposalId,
            @Param("representativeUserId") Long representativeUserId);

    @Query(value = """
            select proposal.activity_proposal_id as activityProposalId,
                   application.event_id as eventId,
                   event.name as eventName,
                   application.partner_organization_id as partnerOrganizationId,
                   organization.name as partnerOrganizationName,
                   organization.status as partnerOrganizationStatus,
                   location.location_id as locationId,
                   location.code as locationCode,
                   location.name as locationName,
                   location.location_type as locationType,
                   location.max_capacity as locationMaxCapacity,
                   location.is_active as locationActive,
                   proposal.title as title,
                   proposal.description as description,
                   proposal.activity_type as activityType,
                   proposal.proposed_start_at as proposedStartAt,
                   proposal.proposed_end_at as proposedEndAt,
                   proposal.capacity as capacity,
                   proposal.status as status,
                   proposal.review_note as reviewNote,
                   proposal.submitted_at as submittedAt,
                   proposal.updated_at as updatedAt,
                   proposal.reviewed_at as reviewedAt,
                   proposal.withdrawn_at as withdrawnAt,
                   proposal.cancelled_at as cancelledAt,
                   activity.activity_id as activityId
            from activity_proposals proposal
            join partner_event_applications application
              on application.application_id = proposal.application_id
            join partner_organizations organization
              on organization.partner_organization_id = application.partner_organization_id
            join events event on event.event_id = application.event_id
            join locations location on location.location_id = proposal.location_id
            left join activities activity
              on activity.source_proposal_id = proposal.activity_proposal_id
            where proposal.activity_proposal_id = :proposalId
              and event.organizer_user_id = :organizerUserId
            """, nativeQuery = true)
    Optional<PartnerProposalView> findOwnedOrganizerView(
            @Param("proposalId") Long proposalId,
            @Param("organizerUserId") Long organizerUserId);

    @Query(value = """
            select proposal.application_id as applicationId,
                   application.event_id as eventId,
                   proposal.location_id as locationId
            from activity_proposals proposal
            join partner_event_applications application
              on application.application_id = proposal.application_id
            where proposal.activity_proposal_id = :proposalId
            """, nativeQuery = true)
    Optional<ProposalRoute> findRouteById(@Param("proposalId") Long proposalId);

    @Query(value = """
            select proposal.application_id as applicationId,
                   application.event_id as eventId,
                   proposal.location_id as locationId
            from activity_proposals proposal
            join partner_event_applications application
              on application.application_id = proposal.application_id
            join partner_organizations organization
              on organization.partner_organization_id = application.partner_organization_id
            where proposal.activity_proposal_id = :proposalId
              and organization.representative_user_id = :representativeUserId
            """, nativeQuery = true)
    Optional<ProposalRoute> findOwnedRoute(
            @Param("proposalId") Long proposalId,
            @Param("representativeUserId") Long representativeUserId);

    @Query(value = """
            select case
                       when representative.email_verified_at is not null
                            and representative.email is not null
                            and btrim(representative.email) <> ''
                       then representative.email
                       else null
                   end as recipientEmail,
                   event.name as eventName,
                   proposal.title as activityTitle
            from activity_proposals proposal
            join partner_event_applications application
              on application.application_id = proposal.application_id
            join partner_organizations organization
              on organization.partner_organization_id = application.partner_organization_id
            join users representative
              on representative.user_id = organization.representative_user_id
            join events event on event.event_id = application.event_id
            where proposal.activity_proposal_id = :proposalId
            """, nativeQuery = true)
    Optional<ActivityPartnerNotificationContext> findPartnerNotificationContext(
            @Param("proposalId") Long proposalId);

    @Query(value = """
            select proposal.activity_proposal_id
            from activity_proposals proposal
            where proposal.status in ('PENDING', 'NEED_CHANGES')
              and proposal.proposed_start_at <= :now
            order by proposal.activity_proposal_id
            limit 100
            """, nativeQuery = true)
    List<Long> findDueOpenProposalIds(@Param("now") Instant now);
}
