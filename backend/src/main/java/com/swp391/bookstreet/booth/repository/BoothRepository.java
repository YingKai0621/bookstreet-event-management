package com.swp391.bookstreet.booth.repository;

import com.swp391.bookstreet.booth.entity.Booth;
import java.util.List;
import java.util.Optional;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface BoothRepository extends JpaRepository<Booth, Long> {
    @Override
    @EntityGraph(attributePaths = "location")
    Page<Booth> findAll(Pageable pageable);

    @EntityGraph(attributePaths = "location")
    Page<Booth> findByLocationActive(boolean active, Pageable pageable);

    @EntityGraph(attributePaths = "location")
    @Query("select b from Booth b where b.location.active = true")
    List<Booth> findAllActive();

    @EntityGraph(attributePaths = "location")
    Optional<Booth> findByBoothId(Long boothId);

    boolean existsByImageUrl(String imageUrl);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @EntityGraph(attributePaths = "location")
    @Query("select booth from Booth booth where booth.boothId = :boothId")
    Optional<Booth> findByBoothIdForUpdate(@Param("boothId") Long boothId);
}
