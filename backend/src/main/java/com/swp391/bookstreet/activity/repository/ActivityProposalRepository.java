package com.swp391.bookstreet.activity.repository;

import com.swp391.bookstreet.activity.entity.ActivityProposal;
import jakarta.persistence.LockModeType;
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
}
