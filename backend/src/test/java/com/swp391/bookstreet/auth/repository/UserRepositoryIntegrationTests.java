package com.swp391.bookstreet.auth.repository;

import com.swp391.bookstreet.auth.entity.Role;
import com.swp391.bookstreet.auth.entity.RoleCode;
import com.swp391.bookstreet.auth.entity.User;
import com.swp391.bookstreet.auth.entity.UserRole;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@Transactional
class UserRepositoryIntegrationTests {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RoleRepository roleRepository;

    @Autowired
    private UserRoleRepository userRoleRepository;

    @Autowired
    private EntityManager entityManager;

    @Test
    void findsUserAndRolesByUsernameIgnoringCase() {
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 10);
        String username = "BookLover" + suffix;
        String email = "reader" + suffix + "@example.com";

        Role participantRole = roleRepository.findByCode(RoleCode.PARTICIPANT)
                .orElseThrow();

        User user = new User(username, email, "bcrypt-hash-placeholder", "Book Lover");
        userRepository.saveAndFlush(user);

        UserRole userRole = user.addRole(participantRole);
        userRoleRepository.saveAndFlush(userRole);

        entityManager.clear();

        User loadedUser = userRepository.findByUsernameIgnoreCase(username.toLowerCase())
                .orElseThrow();

        assertThat(loadedUser.getUsername()).isEqualTo(username);
        assertThat(loadedUser.getUserRoles())
                .extracting(assignment -> assignment.getRole().getCode())
                .containsExactly(RoleCode.PARTICIPANT);
    }

    @Test
    void checksUsernameAndEmailIgnoringCase() {
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 10);
        String username = "CaseUser" + suffix;
        String email = "CaseEmail" + suffix + "@example.com";

        userRepository.saveAndFlush(
                new User(username, email, "bcrypt-hash-placeholder", "Case User")
        );

        assertThat(userRepository.existsByUsernameIgnoreCase(username.toLowerCase())).isTrue();
        assertThat(userRepository.existsByEmailIgnoreCase(email.toLowerCase())).isTrue();
    }
}
