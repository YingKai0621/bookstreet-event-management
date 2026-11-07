package com.swp391.bookstreet.feedback.repository;

import com.swp391.bookstreet.feedback.entity.GeneralFeedback;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface GeneralFeedbackRepository extends JpaRepository<GeneralFeedback, Long>,
        JpaSpecificationExecutor<GeneralFeedback> {

    @Override
    @EntityGraph(attributePaths = "event")
    Page<GeneralFeedback> findAll(Specification<GeneralFeedback> specification, Pageable pageable);

    @EntityGraph(attributePaths = {"event", "submittedBy", "lastHandledBy"})
    @Query("select feedback from GeneralFeedback feedback where feedback.generalFeedbackId = :feedbackId")
    Optional<GeneralFeedback> findDetailById(@Param("feedbackId") Long feedbackId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select feedback from GeneralFeedback feedback where feedback.generalFeedbackId = :feedbackId")
    Optional<GeneralFeedback> findByIdForUpdate(@Param("feedbackId") Long feedbackId);
}
