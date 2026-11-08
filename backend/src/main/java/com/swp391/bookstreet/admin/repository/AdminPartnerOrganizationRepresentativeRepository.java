package com.swp391.bookstreet.admin.repository;

import com.swp391.bookstreet.auth.entity.User;
import jakarta.persistence.EntityManager;
import java.util.Collection;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Repository;

@Repository
public class AdminPartnerOrganizationRepresentativeRepository {
    private final EntityManager entityManager;

    public AdminPartnerOrganizationRepresentativeRepository(EntityManager entityManager) {
        this.entityManager = entityManager;
    }

    public Map<Long, User> findAllWithRoles(Collection<Long> userIds) {
        if (userIds.isEmpty()) return Map.of();
        return entityManager.createQuery("""
                        select distinct representative
                        from User representative
                        left join fetch representative.userRoles userRole
                        left join fetch userRole.role
                        where representative.id in :userIds
                        """, User.class)
                .setParameter("userIds", userIds)
                .getResultList().stream()
                .collect(Collectors.toMap(User::getId, Function.identity()));
    }
}
