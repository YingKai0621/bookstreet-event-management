package com.swp391.bookstreet.auth.repository;

import com.swp391.bookstreet.auth.entity.UserRole;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserRoleRepository extends JpaRepository<UserRole, Long> {
}
