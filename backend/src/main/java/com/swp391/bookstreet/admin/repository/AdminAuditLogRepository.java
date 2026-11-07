package com.swp391.bookstreet.admin.repository;

import com.swp391.bookstreet.admin.entity.AdminAuditLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

public interface AdminAuditLogRepository
        extends JpaRepository<AdminAuditLog, Long>, JpaSpecificationExecutor<AdminAuditLog> {

    @Override
    @EntityGraph(attributePaths = "actor")
    Page<AdminAuditLog> findAll(Specification<AdminAuditLog> specification, Pageable pageable);
}
