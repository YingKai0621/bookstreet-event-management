package com.swp391.bookstreet.activity.repository;

import com.swp391.bookstreet.activity.entity.ActivityProposal;
import com.swp391.bookstreet.activity.entity.ActivityProposalStatus;
import jakarta.persistence.LockModeType;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ActivityProposalRepository extends JpaRepository<ActivityProposal, Long> {
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
}
