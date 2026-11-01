package com.swp391.bookstreet.heritage.repository;

import com.swp391.bookstreet.heritage.entity.HeritageContent;
import com.swp391.bookstreet.heritage.entity.HeritageContentStatus;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

public interface HeritageContentRepository extends JpaRepository<HeritageContent, Long>,
        JpaSpecificationExecutor<HeritageContent> {

    Page<HeritageContent> findByStatus(HeritageContentStatus status, Pageable pageable);

    Optional<HeritageContent> findByPublicCodeAndStatus(
            String publicCode,
            HeritageContentStatus status
    );

    boolean existsByPublicCode(String publicCode);
}
