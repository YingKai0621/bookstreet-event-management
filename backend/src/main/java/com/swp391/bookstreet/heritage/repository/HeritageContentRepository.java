package com.swp391.bookstreet.heritage.repository;

import com.swp391.bookstreet.heritage.entity.HeritageContent;
import com.swp391.bookstreet.heritage.entity.HeritageContentStatus;
import java.time.Instant;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface HeritageContentRepository extends JpaRepository<HeritageContent, Long>,
        JpaSpecificationExecutor<HeritageContent> {

    Page<HeritageContent> findByStatus(HeritageContentStatus status, Pageable pageable);

    Optional<HeritageContent> findByPublicCodeAndStatus(
            String publicCode,
            HeritageContentStatus status
    );

    boolean existsByPublicCode(String publicCode);

    boolean existsByImageUrl(String imageUrl);

    @Query(value = "select 1 from pg_advisory_xact_lock(hashtext(:namespace))", nativeQuery = true)
    Integer lockPublicCodeNamespace(@Param("namespace") String namespace);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            update HeritageContent heritage
            set heritage.title = :title,
                heritage.summary = :summary,
                heritage.content = :content,
                heritage.imageUrl = :imageUrl,
                heritage.locationText = :locationText,
                heritage.updatedAt = :operationTime
            where heritage.heritageContentId = :heritageContentId
              and heritage.updatedAt = :expectedUpdatedAt
            """)
    int updateContentGuarded(
            @Param("heritageContentId") Long heritageContentId,
            @Param("expectedUpdatedAt") Instant expectedUpdatedAt,
            @Param("title") String title,
            @Param("summary") String summary,
            @Param("content") String content,
            @Param("imageUrl") String imageUrl,
            @Param("locationText") String locationText,
            @Param("operationTime") Instant operationTime
    );

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            update HeritageContent heritage
            set heritage.status = :targetStatus,
                heritage.publishedAt = :operationTime,
                heritage.updatedAt = :operationTime
            where heritage.heritageContentId = :heritageContentId
              and heritage.updatedAt = :expectedUpdatedAt
              and heritage.status = :sourceStatus
              and heritage.publishedAt is null
            """)
    int publishGuarded(
            @Param("heritageContentId") Long heritageContentId,
            @Param("expectedUpdatedAt") Instant expectedUpdatedAt,
            @Param("sourceStatus") HeritageContentStatus sourceStatus,
            @Param("targetStatus") HeritageContentStatus targetStatus,
            @Param("operationTime") Instant operationTime
    );

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            update HeritageContent heritage
            set heritage.status = :targetStatus,
                heritage.updatedAt = :operationTime
            where heritage.heritageContentId = :heritageContentId
              and heritage.updatedAt = :expectedUpdatedAt
              and heritage.status = :sourceStatus
              and heritage.publishedAt is not null
            """)
    int transitionGuarded(
            @Param("heritageContentId") Long heritageContentId,
            @Param("expectedUpdatedAt") Instant expectedUpdatedAt,
            @Param("sourceStatus") HeritageContentStatus sourceStatus,
            @Param("targetStatus") HeritageContentStatus targetStatus,
            @Param("operationTime") Instant operationTime
    );

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            delete from HeritageContent heritage
            where heritage.heritageContentId = :heritageContentId
              and heritage.updatedAt = :expectedUpdatedAt
              and heritage.status = :status
              and heritage.publishedAt is null
            """)
    int deleteDraftGuarded(
            @Param("heritageContentId") Long heritageContentId,
            @Param("expectedUpdatedAt") Instant expectedUpdatedAt,
            @Param("status") HeritageContentStatus status
    );
}
