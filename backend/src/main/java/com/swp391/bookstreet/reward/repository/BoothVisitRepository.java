package com.swp391.bookstreet.reward.repository;

import com.swp391.bookstreet.reward.entity.BoothVisit;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BoothVisitRepository extends JpaRepository<BoothVisit, Long> {
    Optional<BoothVisit> findByEventRegistrationIdAndBoothAssignmentId(
            Long eventRegistrationId, Long boothAssignmentId);

    boolean existsByEventRegistrationIdAndBoothAssignmentId(
            Long eventRegistrationId, Long boothAssignmentId);
}
