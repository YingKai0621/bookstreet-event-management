package com.swp391.bookstreet.auth.repository;

import com.swp391.bookstreet.auth.entity.User;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {

    @EntityGraph(attributePaths = {"userRoles", "userRoles.role"})
    Optional<User> findByUsernameIgnoreCase(String username);

    @EntityGraph(attributePaths = {"userRoles", "userRoles.role"})
    @Query("select distinct u from User u where u.id = :userId")
    Optional<User> findByIdWithRoles(@Param("userId") Long userId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select u from User u where u.id = :userId")
    Optional<User> findByIdForUpdate(@Param("userId") Long userId);

    boolean existsByUsernameIgnoreCase(String username);

    boolean existsByEmailIgnoreCase(String email);

    Optional<User> findByEmailIgnoreCase(String email);

    @Query(value = """
            select u.user_id from users u
            join user_roles ur on ur.user_id = u.user_id
            join roles r on r.role_id = ur.role_id
            where r.code = 'ADMIN' and u.status = 'ACTIVE' and u.email_verified_at is not null
            order by u.user_id
            for update of u
            """, nativeQuery = true)
    java.util.List<Long> lockActiveAdminIds();

    @EntityGraph(attributePaths = {"userRoles", "userRoles.role"})
    @Query("select distinct u from User u order by u.id asc")
    java.util.List<User> findAllWithRoles();
}
