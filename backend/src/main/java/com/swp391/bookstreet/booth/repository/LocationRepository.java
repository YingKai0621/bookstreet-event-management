package com.swp391.bookstreet.booth.repository;

import com.swp391.bookstreet.booth.entity.Location;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LocationRepository extends JpaRepository<Location, Long> {
    boolean existsByCode(String code);
}
