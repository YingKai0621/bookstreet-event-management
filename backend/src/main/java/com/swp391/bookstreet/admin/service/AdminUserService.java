package com.swp391.bookstreet.admin.service;

import com.swp391.bookstreet.admin.dto.AdminCreateUserRequest;
import com.swp391.bookstreet.admin.dto.AdminDashboardStatsDto;
import com.swp391.bookstreet.admin.dto.AdminStatusUpdateRequest;
import com.swp391.bookstreet.admin.dto.AdminUpdateUserRequest;
import com.swp391.bookstreet.admin.dto.AdminUserDto;
import com.swp391.bookstreet.auth.entity.AccountStatus;
import com.swp391.bookstreet.auth.entity.Role;
import com.swp391.bookstreet.auth.entity.RoleCode;
import com.swp391.bookstreet.auth.entity.User;
import com.swp391.bookstreet.auth.entity.UserRole;
import com.swp391.bookstreet.auth.repository.RoleRepository;
import com.swp391.bookstreet.auth.repository.UserRepository;
import com.swp391.bookstreet.auth.repository.UserRoleRepository;
import com.swp391.bookstreet.event.entity.EventStatus;
import com.swp391.bookstreet.event.repository.EventRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class AdminUserService {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final UserRoleRepository userRoleRepository;
    private final EventRepository eventRepository;
    private final PasswordEncoder passwordEncoder;

    public AdminUserService(
            UserRepository userRepository,
            RoleRepository roleRepository,
            UserRoleRepository userRoleRepository,
            EventRepository eventRepository,
            PasswordEncoder passwordEncoder
    ) {
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.userRoleRepository = userRoleRepository;
        this.eventRepository = eventRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional(readOnly = true)
    public List<AdminUserDto> getAllUsers() {
        List<User> users = userRepository.findAllWithRoles();
        return users.stream().map(this::toDto).collect(Collectors.toList());
    }

    @Transactional
    public AdminUserDto createUser(AdminCreateUserRequest request) {
        String username = request.username().trim();
        if (userRepository.existsByUsernameIgnoreCase(username)) {
            throw new IllegalArgumentException("Tên đăng nhập đã tồn tại trong hệ thống.");
        }

        String email = request.email() != null && !request.email().isBlank() ? request.email().trim().toLowerCase() : null;
        if (email != null && userRepository.existsByEmailIgnoreCase(email)) {
            throw new IllegalArgumentException("Email đã được sử dụng bởi tài khoản khác.");
        }

        String rawPassword = request.password() != null && !request.password().isBlank() ? request.password() : "BookStreet@123";
        String passwordHash = passwordEncoder.encode(rawPassword);

        User user = new User(username, email, passwordHash, request.fullName().trim());
        if (request.phone() != null && !request.phone().isBlank()) {
            user.setPhoneNumber(request.phone().trim());
        }

        if (email != null) {
            user.setEmailVerifiedAt(Instant.now());
        }

        if ("locked".equalsIgnoreCase(request.status()) || "DISABLED".equalsIgnoreCase(request.status())) {
            user.setStatus(AccountStatus.DISABLED);
        } else {
            user.setStatus(AccountStatus.ACTIVE);
        }

        user = userRepository.save(user);

        // Assign Role
        String roleStr = request.role() != null ? request.role().toUpperCase() : "PARTICIPANT";
        RoleCode targetRoleCode;
        try {
            targetRoleCode = RoleCode.valueOf(roleStr);
        } catch (Exception e) {
            targetRoleCode = RoleCode.PARTICIPANT;
        }

        Role role = roleRepository.findByCode(targetRoleCode)
                .orElseGet(() -> roleRepository.findByCode(RoleCode.PARTICIPANT).orElseThrow());

        UserRole userRole = new UserRole(user, role);
        userRoleRepository.save(userRole);

        return toDto(userRepository.findByIdWithRoles(user.getId()).orElse(user));
    }

    @Transactional
    public AdminUserDto updateUser(Long userId, AdminUpdateUserRequest request) {
        User user = userRepository.findByIdWithRoles(userId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy người dùng với ID: " + userId));

        if (request.fullName() != null && !request.fullName().isBlank()) {
            user.setFullName(request.fullName().trim());
        }
        if (request.phone() != null) {
            user.setPhoneNumber(request.phone().trim());
        }
        if (request.email() != null && !request.email().isBlank()) {
            String newEmail = request.email().trim().toLowerCase();
            if (!newEmail.equalsIgnoreCase(user.getEmail()) && userRepository.existsByEmailIgnoreCase(newEmail)) {
                throw new IllegalArgumentException("Email đã tồn tại.");
            }
            user.setEmail(newEmail);
        }
        if (request.status() != null) {
            if ("locked".equalsIgnoreCase(request.status()) || "DISABLED".equalsIgnoreCase(request.status())) {
                user.setStatus(AccountStatus.DISABLED);
            } else {
                user.setStatus(AccountStatus.ACTIVE);
            }
        }

        // Update role if supplied
        if (request.role() != null && !request.role().isBlank()) {
            try {
                RoleCode targetCode = RoleCode.valueOf(request.role().toUpperCase());
                Role role = roleRepository.findByCode(targetCode).orElse(null);
                if (role != null) {
                    boolean hasRole = user.getUserRoles().stream()
                            .anyMatch(ur -> ur.getRole().getCode() == targetCode);
                    if (!hasRole) {
                        UserRole userRole = new UserRole(user, role);
                        userRoleRepository.save(userRole);
                    }
                }
            } catch (Exception ignored) {
            }
        }

        user = userRepository.save(user);
        return toDto(userRepository.findByIdWithRoles(user.getId()).orElse(user));
    }

    @Transactional
    public void updateUserStatus(Long userId, AdminStatusUpdateRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy người dùng với ID: " + userId));

        if ("locked".equalsIgnoreCase(request.status()) || "DISABLED".equalsIgnoreCase(request.status())) {
            user.setStatus(AccountStatus.DISABLED);
        } else {
            user.setStatus(AccountStatus.ACTIVE);
        }
        userRepository.save(user);
    }

    @Transactional
    public void resetPassword(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy người dùng với ID: " + userId));

        user.setPasswordHash(passwordEncoder.encode("BookStreet@123"));
        userRepository.save(user);
    }

    @Transactional(readOnly = true)
    public AdminDashboardStatsDto getDashboardStats() {
        List<User> allUsers = userRepository.findAllWithRoles();
        long userCount = allUsers.size();

        Map<String, Long> usersByRole = new HashMap<>();
        usersByRole.put("participant", 0L);
        usersByRole.put("partner", 0L);
        usersByRole.put("organizer", 0L);
        usersByRole.put("admin", 0L);

        for (User u : allUsers) {
            String primaryRole = resolvePrimaryRole(u);
            usersByRole.put(primaryRole, usersByRole.getOrDefault(primaryRole, 0L) + 1);
        }

        long eventCount = eventRepository.count();
        long openEventCount = eventRepository.findByStatus(EventStatus.ONGOING, PageRequest.of(0, 100)).getTotalElements()
                + eventRepository.findByStatus(EventStatus.PUBLISHED, PageRequest.of(0, 100)).getTotalElements();

        List<AdminDashboardStatsDto.AuditDayDto> auditByDay = new ArrayList<>();
        LocalDate today = LocalDate.now();
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd");

        for (int i = 6; i >= 0; i--) {
            LocalDate day = today.minusDays(i);
            auditByDay.add(new AdminDashboardStatsDto.AuditDayDto(day.format(formatter), 0L));
        }

        return new AdminDashboardStatsDto(
                userCount,
                eventCount,
                openEventCount,
                0L,
                0L,
                0L,
                usersByRole,
                auditByDay
        );
    }

    private AdminUserDto toDto(User user) {
        List<String> roleCodes = user.getUserRoles().stream()
                .map(ur -> ur.getRole().getCode().name().toLowerCase())
                .collect(Collectors.toList());

        String primaryRole = resolvePrimaryRole(user);

        String statusStr = user.getStatus() == AccountStatus.DISABLED ? "locked" : "active";

        return new AdminUserDto(
                user.getId(),
                "U-" + user.getId(),
                user.getUsername(),
                user.getFullName(),
                user.getEmail(),
                user.getPhoneNumber() != null ? user.getPhoneNumber() : "",
                primaryRole,
                primaryRole,
                roleCodes,
                statusStr,
                user.getEmailVerifiedAt(),
                user.getLastLoginAt(),
                user.getCreatedAt(),
                user.getAvatarUrl()
        );
    }

    private String resolvePrimaryRole(User user) {
        List<RoleCode> roles = user.getUserRoles().stream()
                .map(ur -> ur.getRole().getCode())
                .collect(Collectors.toList());

        if (roles.contains(RoleCode.ADMIN)) return "admin";
        if (roles.contains(RoleCode.ORGANIZER)) return "organizer";
        if (roles.contains(RoleCode.PARTNER)) return "partner";
        return "participant";
    }
}
