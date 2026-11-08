package com.swp391.bookstreet.admin.repository;

import com.swp391.bookstreet.auth.entity.User;
import com.swp391.bookstreet.event.entity.EventStatus;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** Admin account queries: the paged list and the role-removal guards of BR-115. */
public interface AdminUserRepository extends JpaRepository<User, Long>, JpaSpecificationExecutor<User> {

    @EntityGraph(attributePaths = {"userRoles", "userRoles.role"})
    @Query("select distinct u from User u where u.id in :userIds")
    List<User> findAllWithRolesByIdIn(@Param("userIds") Collection<Long> userIds);

    @Query("""
            select count(event) > 0 from Event event
            where event.organizerUserId = :userId and event.status in :statuses
            """)
    boolean ownsEventWithStatusIn(@Param("userId") Long userId,
            @Param("statuses") Collection<EventStatus> statuses);

    @Query("""
            select count(organization) > 0 from PartnerOrganization organization
            where organization.representativeUserId = :userId
              and organization.status = com.swp391.bookstreet.partner.entity.PartnerOrganization.OrganizationStatus.ACTIVE
            """)
    boolean representsActiveOrganization(@Param("userId") Long userId);
}
