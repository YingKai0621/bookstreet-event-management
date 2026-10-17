package com.swp391.bookstreet.booth.repository;

import com.swp391.bookstreet.booth.entity.Location;
import com.swp391.bookstreet.booth.entity.LocationType;
import jakarta.persistence.LockModeType;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface LocationRepository extends JpaRepository<Location, Long>,
        JpaSpecificationExecutor<Location> {
    boolean existsByCode(String code);

    boolean existsByCodeIgnoreCase(String code);

    boolean existsByCodeIgnoreCaseAndLocationIdNot(String code, Long locationId);

    List<Location> findByLocationTypeNotAndActiveTrueOrderByCodeAscLocationIdAsc(
            LocationType locationType);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select l from Location l where l.locationId = :locationId")
    Optional<Location> findByIdForUpdate(@Param("locationId") Long locationId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select l
            from Location l
            where l.locationId in :locationIds
            order by l.locationId
            """)
    List<Location> findAllByIdForUpdateOrderById(
            @Param("locationIds") Collection<Long> locationIds);
}
