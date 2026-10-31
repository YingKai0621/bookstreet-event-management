package com.swp391.bookstreet.feedback.repository;

import com.swp391.bookstreet.feedback.entity.GeneralFeedback;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface GeneralFeedbackRepository extends JpaRepository<GeneralFeedback, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select feedback from GeneralFeedback feedback where feedback.generalFeedbackId = :feedbackId")
    Optional<GeneralFeedback> findByIdForUpdate(@Param("feedbackId") Long feedbackId);
}
