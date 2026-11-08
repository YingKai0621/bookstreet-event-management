package com.swp391.bookstreet.admin.service;

import com.swp391.bookstreet.admin.dto.AdminPageResponse;
import com.swp391.bookstreet.admin.dto.AdminPartnerOrganizationResponse;
import com.swp391.bookstreet.admin.dto.AdminPartnerOrganizationStatusRequest;
import com.swp391.bookstreet.admin.entity.AdminAuditAction;
import com.swp391.bookstreet.admin.repository.AdminPartnerOrganizationRepresentativeRepository;
import com.swp391.bookstreet.auth.entity.RoleCode;
import com.swp391.bookstreet.auth.entity.User;
import com.swp391.bookstreet.auth.repository.UserRepository;
import com.swp391.bookstreet.common.exception.ApiException;
import com.swp391.bookstreet.partner.entity.PartnerOrganization;
import com.swp391.bookstreet.partner.repository.PartnerOrganizationRepository;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import jakarta.persistence.criteria.Subquery;
import java.time.Clock;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class AdminPartnerOrganizationService {
    private static final int MAX_SEARCH_LENGTH = 100;

    private final PartnerOrganizationRepository organizations;
    private final AdminPartnerOrganizationRepresentativeRepository representatives;
    private final UserRepository users;
    private final AdminAuditWriter auditWriter;
    private final Clock clock;

    public AdminPartnerOrganizationService(
            PartnerOrganizationRepository organizations,
            AdminPartnerOrganizationRepresentativeRepository representatives,
            UserRepository users,
            AdminAuditWriter auditWriter,
            Clock clock
    ) {
        this.organizations = organizations;
        this.representatives = representatives;
        this.users = users;
        this.auditWriter = auditWriter;
        this.clock = clock;
    }

    public AdminPageResponse<AdminPartnerOrganizationResponse> list(
            String page,
            String size,
            String search,
            String status,
            String sort
    ) {
        String normalizedSearch = normalizeSearch(search);
        PartnerOrganization.OrganizationStatus statusFilter = AdminPaging.optionalEnum(
                PartnerOrganization.OrganizationStatus.class, status, "status");
        Page<PartnerOrganization> result = organizations.findAll(
                filter(normalizedSearch, statusFilter),
                AdminPaging.of(page, size, sort(sort)));
        Map<Long, User> representativeById = representatives.findAllWithRoles(
                result.getContent().stream()
                        .map(PartnerOrganization::getRepresentativeUserId)
                        .toList());
        return AdminPageResponse.from(result, organization -> response(
                organization, representativeById.get(organization.getRepresentativeUserId())));
    }

    public AdminPartnerOrganizationResponse detail(String organizationId) {
        PartnerOrganization organization = organizations.findById(positiveId(organizationId))
                .orElseThrow(AdminPartnerOrganizationService::notFound);
        return response(organization, representative(organization.getRepresentativeUserId()));
    }

    @Transactional
    public AdminPartnerOrganizationResponse changeStatus(
            String organizationId,
            AdminPartnerOrganizationStatusRequest request
    ) {
        long id = positiveId(organizationId);
        PartnerOrganization.OrganizationStatus requestedStatus = requestedStatus(request);
        String reason = AdminReason.normalize(request == null ? null : request.reason());
        PartnerOrganization organization = organizations.findByIdForUpdate(id)
                .orElseThrow(AdminPartnerOrganizationService::notFound);

        if (organization.getStatus() == requestedStatus) {
            return response(organization, representative(organization.getRepresentativeUserId()));
        }
        User representative = users.findByIdForUpdate(organization.getRepresentativeUserId())
                .orElseThrow(() -> new IllegalStateException(
                        "Partner organization representative was not found."));
        if (requestedStatus == PartnerOrganization.OrganizationStatus.ACTIVE
                && !hasPartnerRole(representative)) {
            throw new ApiException(HttpStatus.CONFLICT, "PARTNER_ROLE_REQUIRED",
                    "The representative must hold the PARTNER role before the organization can be unlocked.");
        }

        PartnerOrganization.OrganizationStatus previousStatus = organization.getStatus();
        organization.changeStatus(requestedStatus, clock.instant());
        auditWriter.write(
                requestedStatus == PartnerOrganization.OrganizationStatus.INACTIVE
                        ? AdminAuditAction.ORGANIZATION_LOCKED
                        : AdminAuditAction.ORGANIZATION_UNLOCKED,
                organization.getId(),
                organization.getName(),
                reason,
                Map.of("from", previousStatus.name(), "to", requestedStatus.name()));
        return response(organization, representative);
    }

    private static Specification<PartnerOrganization> filter(
            String search,
            PartnerOrganization.OrganizationStatus status
    ) {
        return (root, query, builder) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (status != null) predicates.add(builder.equal(root.get("status"), status));
            if (search != null) {
                String pattern = "%" + escapeLike(search.toLowerCase(Locale.ROOT)) + "%";
                Subquery<Long> matchingRepresentative = query.subquery(Long.class);
                Root<User> user = matchingRepresentative.from(User.class);
                matchingRepresentative.select(user.get("id")).where(
                        builder.equal(user.get("id"), root.get("representativeUserId")),
                        builder.or(
                                builder.like(builder.lower(user.get("username")), pattern, '\\'),
                                builder.like(builder.lower(user.get("fullName")), pattern, '\\')));
                predicates.add(builder.or(
                        builder.like(builder.lower(root.get("name")), pattern, '\\'),
                        builder.exists(matchingRepresentative)));
            }
            return builder.and(predicates.toArray(Predicate[]::new));
        };
    }

    private static Sort sort(String value) {
        String requested = value == null ? "name,asc" : value;
        return switch (requested) {
            case "name,asc" -> Sort.by(Sort.Order.asc("name"), Sort.Order.asc("id"));
            case "name,desc" -> Sort.by(Sort.Order.desc("name"), Sort.Order.desc("id"));
            case "createdAt,asc" -> Sort.by(Sort.Order.asc("createdAt"), Sort.Order.asc("id"));
            case "createdAt,desc" -> Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id"));
            default -> throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_SORT",
                    "sort has an unsupported value.");
        };
    }

    private static String normalizeSearch(String search) {
        if (search == null || search.isBlank()) return null;
        String normalized = search.strip().replaceAll("\\s+", " ");
        if (normalized.codePointCount(0, normalized.length()) > MAX_SEARCH_LENGTH) {
            throw AdminPaging.invalidFilter("search must contain at most "
                    + MAX_SEARCH_LENGTH + " characters.");
        }
        return normalized;
    }

    private static String escapeLike(String value) {
        return value.replace("\\", "\\\\")
                .replace("%", "\\%")
                .replace("_", "\\_");
    }

    private static PartnerOrganization.OrganizationStatus requestedStatus(
            AdminPartnerOrganizationStatusRequest request
    ) {
        if (request == null || request.status() == null) {
            throw validation("status is required.");
        }
        try {
            return PartnerOrganization.OrganizationStatus.valueOf(request.status());
        } catch (IllegalArgumentException exception) {
            throw validation("status must be ACTIVE or INACTIVE.");
        }
    }

    private User representative(Long userId) {
        User user = representatives.findAllWithRoles(List.of(userId)).get(userId);
        if (user == null) {
            throw new IllegalStateException("Partner organization representative was not found.");
        }
        return user;
    }

    private static AdminPartnerOrganizationResponse response(
            PartnerOrganization organization,
            User representative
    ) {
        if (representative == null) {
            throw new IllegalStateException("Partner organization representative was not found.");
        }
        return AdminPartnerOrganizationResponse.from(organization, representative);
    }

    private static boolean hasPartnerRole(User representative) {
        return representative.getUserRoles().stream()
                .anyMatch(userRole -> userRole.getRole().getCode() == RoleCode.PARTNER);
    }

    private static long positiveId(String value) {
        try {
            long id = Long.parseLong(value);
            if (id > 0) return id;
        } catch (NumberFormatException ignored) {
            // A malformed path identifier is deliberately indistinguishable from an unknown row.
        }
        throw notFound();
    }

    private static ApiException validation(String message) {
        return new ApiException(HttpStatus.UNPROCESSABLE_CONTENT, "VALIDATION_FAILED", message);
    }

    private static ApiException notFound() {
        return new ApiException(HttpStatus.NOT_FOUND, "PARTNER_ORGANIZATION_NOT_FOUND",
                "Partner organization was not found.");
    }
}
