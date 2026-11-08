package com.swp391.bookstreet.admin.service;

import com.swp391.bookstreet.admin.dto.AdminCreateUserRequest;
import com.swp391.bookstreet.admin.dto.AdminPageResponse;
import com.swp391.bookstreet.admin.dto.AdminStatusUpdateRequest;
import com.swp391.bookstreet.admin.dto.AdminUpdateUserRequest;
import com.swp391.bookstreet.admin.dto.AdminUserResponse;
import com.swp391.bookstreet.admin.entity.AdminAuditAction;
import com.swp391.bookstreet.admin.repository.AdminUserRepository;
import com.swp391.bookstreet.auth.entity.AccountStatus;
import com.swp391.bookstreet.auth.entity.Role;
import com.swp391.bookstreet.auth.entity.RoleCode;
import com.swp391.bookstreet.auth.entity.User;
import com.swp391.bookstreet.auth.entity.UserRole;
import com.swp391.bookstreet.auth.repository.RoleRepository;
import com.swp391.bookstreet.auth.repository.UserRepository;
import com.swp391.bookstreet.auth.repository.UserRoleRepository;
import com.swp391.bookstreet.auth.service.EmailVerificationMessageRequested;
import com.swp391.bookstreet.auth.service.EmailVerificationTokenService;
import com.swp391.bookstreet.auth.service.IssuedEmailVerificationToken;
import com.swp391.bookstreet.common.exception.ApiException;
import com.swp391.bookstreet.event.entity.EventStatus;
import com.swp391.bookstreet.event.repository.EventRepository;
import com.swp391.bookstreet.notification.entity.NotificationRecipientRole;
import com.swp391.bookstreet.notification.service.NotificationStreamsRevoked;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import jakarta.persistence.criteria.Subquery;
import org.hibernate.exception.ConstraintViolationException;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * UC-A01 and UC-A02 under BR-113, BR-114 and BR-115. Every real change writes its audit row in the same
 * transaction, and a command that repeats the current state changes nothing and writes no row.
 */
@Service
public class AdminUserService {

    private static final int MAX_SEARCH_LENGTH = 100;
    private static final List<RoleCode> MANAGEABLE_ROLES =
            List.of(RoleCode.PARTNER, RoleCode.ORGANIZER, RoleCode.ADMIN);
    private static final Set<EventStatus> OPEN_EVENT_STATUSES =
            EnumSet.of(EventStatus.DRAFT, EventStatus.PUBLISHED, EventStatus.ONGOING);
    private static final Map<String, Sort> SORTS = Map.of(
            "createdAt,desc", Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id")),
            "createdAt,asc", Sort.by(Sort.Order.asc("createdAt"), Sort.Order.asc("id")),
            "username,asc", Sort.by(Sort.Order.asc("username"), Sort.Order.asc("id")),
            "username,desc", Sort.by(Sort.Order.desc("username"), Sort.Order.desc("id")));

    private final UserRepository userRepository;
    private final AdminUserRepository adminUserRepository;
    private final RoleRepository roleRepository;
    private final UserRoleRepository userRoleRepository;
    private final EventRepository eventRepository;
    private final PasswordEncoder passwordEncoder;
    private final EmailVerificationTokenService emailVerificationTokenService;
    private final ApplicationEventPublisher eventPublisher;
    private final AdminAuditWriter auditWriter;
    private final AdminGuard adminGuard;
    private final Clock clock;

    public AdminUserService(
            UserRepository userRepository,
            AdminUserRepository adminUserRepository,
            RoleRepository roleRepository,
            UserRoleRepository userRoleRepository,
            EventRepository eventRepository,
            PasswordEncoder passwordEncoder,
            EmailVerificationTokenService emailVerificationTokenService,
            ApplicationEventPublisher eventPublisher,
            AdminAuditWriter auditWriter,
            AdminGuard adminGuard,
            Clock clock
    ) {
        this.userRepository = userRepository;
        this.adminUserRepository = adminUserRepository;
        this.roleRepository = roleRepository;
        this.userRoleRepository = userRoleRepository;
        this.eventRepository = eventRepository;
        this.passwordEncoder = passwordEncoder;
        this.emailVerificationTokenService = emailVerificationTokenService;
        this.eventPublisher = eventPublisher;
        this.auditWriter = auditWriter;
        this.adminGuard = adminGuard;
        this.clock = clock;
    }

    // ---- UC-A01 browse ---------------------------------------------------------------------------------

    @Transactional(readOnly = true)
    public AdminPageResponse<AdminUserResponse> listUsers(String page, String size, String search,
            String role, String status, String sort) {
        Sort order = SORTS.get(sort == null ? "createdAt,desc" : sort);
        if (order == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_SORT", "sort has an unsupported value.");
        }
        String searchTerm = search == null ? "" : search.strip();
        if (searchTerm.length() > MAX_SEARCH_LENGTH) {
            throw AdminPaging.invalidFilter("search must not exceed " + MAX_SEARCH_LENGTH + " characters.");
        }
        RoleCode roleFilter = AdminPaging.optionalEnum(RoleCode.class, role, "role");
        AccountStatus statusFilter = AdminPaging.optionalEnum(AccountStatus.class, status, "status");

        Specification<User> filter = (root, query, builder) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (!searchTerm.isEmpty()) {
                String pattern = "%" + escapeLike(searchTerm.toLowerCase(Locale.ROOT)) + "%";
                predicates.add(builder.or(
                        builder.like(builder.lower(root.get("username")), pattern, '\\'),
                        builder.like(builder.lower(root.get("fullName")), pattern, '\\'),
                        builder.like(builder.lower(builder.coalesce(root.get("email"), "")), pattern, '\\')));
            }
            if (roleFilter != null) {
                Subquery<Long> holders = query.subquery(Long.class);
                Root<UserRole> userRole = holders.from(UserRole.class);
                holders.select(userRole.get("user").get("id"))
                        .where(builder.equal(userRole.get("role").get("code"), roleFilter));
                predicates.add(root.get("id").in(holders));
            }
            if (statusFilter != null) {
                predicates.add(builder.equal(root.get("status"), statusFilter));
            }
            return builder.and(predicates.toArray(Predicate[]::new));
        };

        Page<User> found = adminUserRepository.findAll(filter, AdminPaging.of(page, size, order));
        Map<Long, User> withRoles = found.isEmpty() ? Map.of() : adminUserRepository
                .findAllWithRolesByIdIn(found.getContent().stream().map(User::getId).toList())
                .stream()
                .collect(Collectors.toMap(User::getId, Function.identity()));
        Page<User> ordered = new PageImpl<>(
                found.getContent().stream().map(user -> withRoles.getOrDefault(user.getId(), user)).toList(),
                found.getPageable(),
                found.getTotalElements());
        return AdminPageResponse.from(ordered, AdminUserResponse::from);
    }

    @Transactional(readOnly = true)
    public AdminUserResponse getUser(String userId) {
        return AdminUserResponse.from(loadWithRoles(parseUserId(userId)));
    }

    // ---- UC-A01 create and update ----------------------------------------------------------------------

    @Transactional
    public AdminUserResponse createUser(AdminCreateUserRequest request) {
        if (!Objects.equals(request.password(), request.confirmPassword())) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_CONTENT, "PASSWORD_CONFIRMATION_MISMATCH",
                    "Password and confirmPassword must match.");
        }
        if (userRepository.existsByUsernameIgnoreCase(request.username())) {
            throw usernameAlreadyExists();
        }
        if (request.email() != null && userRepository.existsByEmailIgnoreCase(request.email())) {
            throw emailAlreadyExists();
        }
        Role participant = roleRepository.findByCode(RoleCode.PARTICIPANT)
                .orElseThrow(() -> new IllegalStateException("The PARTICIPANT system role is not configured."));

        User user = new User(request.username(), request.email(),
                passwordEncoder.encode(request.password()), request.fullName());
        user.setPhoneNumber(request.phone());
        try {
            userRepository.saveAndFlush(user);
            userRoleRepository.saveAndFlush(user.addRole(participant));
        } catch (DataIntegrityViolationException exception) {
            throw mapDuplicateConstraint(exception);
        }

        if (user.getEmail() != null) {
            IssuedEmailVerificationToken token = emailVerificationTokenService.issueToken(user);
            eventPublisher.publishEvent(new EmailVerificationMessageRequested(
                    user.getId(), token.getTokenId(), user.getEmail(), token.getRawToken()));
        }
        auditWriter.write(AdminAuditAction.USER_CREATED, user.getId(), user.getUsername(), null,
                Map.of("roles", List.of(RoleCode.PARTICIPANT.name())));
        return AdminUserResponse.from(user);
    }

    @Transactional
    public AdminUserResponse updateUser(Long actorUserId, String userId, AdminUpdateUserRequest request) {
        Long targetId = parseUserId(userId);
        loadWithRoles(targetId);
        if (targetId.equals(actorUserId)) {
            throw new ApiException(HttpStatus.CONFLICT, "ADMIN_SELF_UPDATE_NOT_ALLOWED",
                    "Admin updates their own account through their profile.");
        }
        User user = lockAndLoad(targetId);

        List<String> changedFields = new ArrayList<>();
        if (request.fullName() != null && !request.fullName().equals(user.getFullName())) {
            user.setFullName(request.fullName());
            changedFields.add("fullName");
        }
        if (request.phone() != null) {
            String phone = request.phone().isEmpty() ? null : request.phone();
            if (!Objects.equals(phone, user.getPhoneNumber())) {
                user.setPhoneNumber(phone);
                changedFields.add("phone");
            }
        }
        boolean emailChanged = false;
        if (request.email() != null && !request.email().equals(user.getEmail())) {
            if (user.getEmailVerifiedAt() != null) {
                throw new ApiException(HttpStatus.CONFLICT, "VERIFIED_EMAIL_LOCKED",
                        "A verified email cannot be changed.");
            }
            if (!request.email().equalsIgnoreCase(user.getEmail())
                    && userRepository.existsByEmailIgnoreCase(request.email())) {
                throw emailAlreadyExists();
            }
            user.setEmail(request.email());
            changedFields.add("email");
            emailChanged = true;
        }

        if (changedFields.isEmpty()) {
            return AdminUserResponse.from(user);
        }
        try {
            userRepository.saveAndFlush(user);
        } catch (DataIntegrityViolationException exception) {
            throw mapDuplicateConstraint(exception);
        }
        if (emailChanged) {
            emailVerificationTokenService.reissueAfterEmailChange(user).ifPresent(eventPublisher::publishEvent);
        }
        auditWriter.write(AdminAuditAction.USER_UPDATED, user.getId(), user.getUsername(), null,
                Map.of("changedFields", List.copyOf(changedFields)));
        return AdminUserResponse.from(user);
    }

    // ---- UC-A01 lock and unlock ------------------------------------------------------------------------

    @Transactional
    public AdminUserResponse updateStatus(Long actorUserId, String userId, AdminStatusUpdateRequest request) {
        AccountStatus requested = parseStatus(request == null ? null : request.status());
        String reason = AdminReason.normalize(request.reason());
        Long targetId = parseUserId(userId);
        User current = loadWithRoles(targetId);
        if (current.getStatus() == requested) {
            return AdminUserResponse.from(current);
        }

        if (requested == AccountStatus.DISABLED) {
            if (targetId.equals(actorUserId)) {
                throw new ApiException(HttpStatus.CONFLICT, "ADMIN_SELF_LOCK_NOT_ALLOWED",
                        "Admin cannot lock their own account.");
            }
            // Locks the active Admin rows in User ID order before the target row, so concurrent commands queue.
            adminGuard.requireAnotherActiveAdmin(targetId);
        }
        User user = lockAndLoad(targetId);
        AccountStatus previous = user.getStatus();
        if (previous == requested) {
            return AdminUserResponse.from(user);
        }

        user.setStatus(requested);
        if (requested == AccountStatus.DISABLED) {
            // Sessions from before the lock stay unusable after a later unlock.
            user.setSessionsValidFrom(clock.instant().truncatedTo(ChronoUnit.MICROS));
            eventPublisher.publishEvent(new NotificationStreamsRevoked(user.getId(), null));
        }
        userRepository.saveAndFlush(user);
        auditWriter.write(
                requested == AccountStatus.DISABLED ? AdminAuditAction.USER_LOCKED : AdminAuditAction.USER_UNLOCKED,
                user.getId(), user.getUsername(), reason,
                Map.of("from", previous.name(), "to", requested.name()));
        return AdminUserResponse.from(user);
    }

    // ---- UC-A02 roles ----------------------------------------------------------------------------------

    @Transactional
    public AdminUserResponse assignRole(String userId, String roleCode) {
        RoleCode role = parseManageableRole(roleCode);
        Long targetId = parseUserId(userId);
        User user = lockAndLoad(targetId);
        if (holds(user, role)) {
            return AdminUserResponse.from(user);
        }
        if (user.getStatus() != AccountStatus.ACTIVE) {
            throw new ApiException(HttpStatus.CONFLICT, "TARGET_ACCOUNT_NOT_ACTIVE",
                    "A role can only be assigned to an active account.");
        }
        if (user.getEmail() == null || user.getEmailVerifiedAt() == null) {
            throw new ApiException(HttpStatus.CONFLICT, "VERIFIED_EMAIL_REQUIRED",
                    "A role can only be assigned to an account with a verified email.");
        }

        Role assigned = roleRepository.findByCode(role)
                .orElseThrow(() -> new IllegalStateException("The " + role + " system role is not configured."));
        userRoleRepository.saveAndFlush(user.addRole(assigned));
        auditWriter.write(AdminAuditAction.ROLE_ASSIGNED, user.getId(), user.getUsername(), null,
                Map.of("role", role.name()));
        return AdminUserResponse.from(user);
    }

    @Transactional
    public AdminUserResponse removeRole(Long actorUserId, String userId, String roleCode) {
        RoleCode role = parseManageableRole(roleCode);
        Long targetId = parseUserId(userId);
        User current = loadWithRoles(targetId);
        if (!holds(current, role)) {
            return AdminUserResponse.from(current);
        }

        if (role == RoleCode.ADMIN) {
            if (targetId.equals(actorUserId)) {
                throw new ApiException(HttpStatus.CONFLICT, "ADMIN_SELF_ROLE_REMOVAL_NOT_ALLOWED",
                        "Admin cannot remove their own ADMIN role.");
            }
            adminGuard.requireAnotherActiveAdmin(targetId);
        }
        User user = lockAndLoad(targetId);
        if (!holds(user, role)) {
            return AdminUserResponse.from(user);
        }
        if (role == RoleCode.ORGANIZER && adminUserRepository.ownsEventWithStatusIn(targetId, OPEN_EVENT_STATUSES)) {
            throw new ApiException(HttpStatus.CONFLICT, "ORGANIZER_OWNS_OPEN_EVENTS",
                    "The User still owns a DRAFT, PUBLISHED or ONGOING Event.");
        }
        if (role == RoleCode.PARTNER && adminUserRepository.representsActiveOrganization(targetId)) {
            throw new ApiException(HttpStatus.CONFLICT, "PARTNER_ORGANIZATION_ACTIVE",
                    "The User represents an active Partner organization. Lock the organization first.");
        }

        userRoleRepository.delete(user.removeRole(role));
        userRoleRepository.flush();
        eventPublisher.publishEvent(new NotificationStreamsRevoked(
                user.getId(), NotificationRecipientRole.valueOf(role.name())));
        auditWriter.write(AdminAuditAction.ROLE_REMOVED, user.getId(), user.getUsername(), null,
                Map.of("role", role.name()));
        return AdminUserResponse.from(user);
    }

    // ---- helpers ---------------------------------------------------------------------------------------

    private User loadWithRoles(Long userId) {
        return userRepository.findByIdWithRoles(userId).orElseThrow(AdminUserService::userNotFound);
    }

    /** Takes the row lock, then returns the managed User with its roles loaded. */
    private User lockAndLoad(Long userId) {
        userRepository.findByIdForUpdate(userId).orElseThrow(AdminUserService::userNotFound);
        return loadWithRoles(userId);
    }

    private static boolean holds(User user, RoleCode role) {
        return user.getUserRoles().stream().anyMatch(userRole -> userRole.getRole().getCode() == role);
    }

    /** A malformed or non-positive ID is reported as an unknown account, as section 1 of the contract requires. */
    private static Long parseUserId(String value) {
        try {
            long id = Long.parseLong(value);
            if (id > 0) {
                return id;
            }
        } catch (NumberFormatException ignored) {
            // reported as not found below
        }
        throw userNotFound();
    }

    private static AccountStatus parseStatus(String value) {
        if ("ACTIVE".equals(value)) return AccountStatus.ACTIVE;
        if ("DISABLED".equals(value)) return AccountStatus.DISABLED;
        throw new ApiException(HttpStatus.UNPROCESSABLE_CONTENT, "VALIDATION_FAILED",
                "status must be exactly ACTIVE or DISABLED.");
    }

    private static RoleCode parseManageableRole(String value) {
        for (RoleCode role : MANAGEABLE_ROLES) {
            if (role.name().equals(value)) return role;
        }
        throw new ApiException(HttpStatus.UNPROCESSABLE_CONTENT, "ROLE_NOT_MANAGEABLE",
                "Only PARTNER, ORGANIZER and ADMIN can be assigned or removed.");
    }

    private static String escapeLike(String value) {
        return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }

    private static ApiException userNotFound() {
        return new ApiException(HttpStatus.NOT_FOUND, "ADMIN_USER_NOT_FOUND", "The account does not exist.");
    }

    private static ApiException usernameAlreadyExists() {
        return new ApiException(HttpStatus.CONFLICT, "USERNAME_ALREADY_EXISTS", "Username is already in use.");
    }

    private static ApiException emailAlreadyExists() {
        return new ApiException(HttpStatus.CONFLICT, "EMAIL_ALREADY_EXISTS", "Email is already in use.");
    }

    private static ApiException mapDuplicateConstraint(DataIntegrityViolationException exception) {
        Throwable cause = exception;
        while (cause != null) {
            if (cause instanceof ConstraintViolationException violation) {
                if ("uk_users_username_ci".equals(violation.getConstraintName())) return usernameAlreadyExists();
                if ("uk_users_email_ci".equals(violation.getConstraintName())) return emailAlreadyExists();
            }
            cause = cause.getCause();
        }
        throw exception;
    }

}
