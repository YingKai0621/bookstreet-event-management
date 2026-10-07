package com.swp391.bookstreet.booth.repository;

import com.swp391.bookstreet.booth.entity.BoothHold;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface BoothHoldRepository extends JpaRepository<BoothHold, Long> {
    @EntityGraph(attributePaths = {
            "boothRequest", "boothRequest.application",
            "boothRequest.application.partnerOrganization",
            "boothRequest.booth", "boothRequest.booth.location",
            "eventBoothConfig"
    })
    Optional<BoothHold> findByBoothRequestBoothRequestId(Long boothRequestId);

    @Query(value = """
            select *
            from booth_holds
            where status = 'ACTIVE'
              and expires_at <= :now
            order by expires_at, booth_hold_id
            for update skip locked
            """, nativeQuery = true)
    List<BoothHold> findDueActiveForUpdate(@Param("now") Instant now);
}
