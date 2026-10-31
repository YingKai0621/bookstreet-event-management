package com.swp391.bookstreet.booth.service;

import com.swp391.bookstreet.activity.repository.ActivityRepository;
import com.swp391.bookstreet.booth.dto.BoothPageResponse;
import com.swp391.bookstreet.booth.dto.BoothResponse;
import com.swp391.bookstreet.booth.dto.CreateBoothRequest;
import com.swp391.bookstreet.booth.dto.UpdateBoothRequest;
import com.swp391.bookstreet.booth.entity.Booth;
import com.swp391.bookstreet.booth.entity.Location;
import com.swp391.bookstreet.booth.exception.BoothApiException;
import com.swp391.bookstreet.booth.repository.BoothRepository;
import com.swp391.bookstreet.booth.repository.BoothAssignmentRepository;
import com.swp391.bookstreet.booth.repository.EventBoothConfigRepository;
import com.swp391.bookstreet.booth.repository.LocationRepository;
import com.swp391.bookstreet.booth.security.BoothCurrentUser;
import java.net.URI;
import java.net.URISyntaxException;
import java.time.Clock;
import java.time.Instant;
import java.util.Locale;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class BoothCatalogService {
    private final BoothRepository boothRepository;
    private final LocationRepository locationRepository;
    private final EventBoothConfigRepository configRepository;
    private final BoothAssignmentRepository assignmentRepository;
    private final ActivityRepository activityRepository;
    private final BoothCurrentUser currentUser;
    private final BoothHoldExpiryService expiryService;
    private final Clock clock;

    public BoothCatalogService(BoothRepository boothRepository,
            LocationRepository locationRepository,
            EventBoothConfigRepository configRepository,
            BoothAssignmentRepository assignmentRepository,
            ActivityRepository activityRepository, BoothCurrentUser currentUser,
            BoothHoldExpiryService expiryService, Clock clock) {
        this.boothRepository = boothRepository;
        this.locationRepository = locationRepository;
        this.configRepository = configRepository;
        this.assignmentRepository = assignmentRepository;
        this.activityRepository = activityRepository;
        this.currentUser = currentUser;
        this.expiryService = expiryService;
        this.clock = clock;
    }

    @Transactional
    public BoothResponse create(CreateBoothRequest request) {
        currentUser.requireOrganizerId();
        String code = requiredLocationCode(request.code());
        if (locationRepository.existsByCodeIgnoreCase(code)) {
            throw codeAlreadyExists();
        }
        Instant now = clock.instant();
        Location location = Location.createBooth(code, required(request.name(), "name", 100),
                optional(request.description()), request.maxCapacity(), request.mapX(), request.mapY(), now);
        Booth booth = Booth.create(location, optional(request.categoryCode()),
                optional(request.note()), optionalImageUrl(request.imageUrl()));
        try {
            return BoothResponse.from(boothRepository.saveAndFlush(booth));
        } catch (DataIntegrityViolationException exception) {
            throw codeAlreadyExists();
        }
    }

    public BoothPageResponse<BoothResponse> list(int page, int size, String sort, Boolean active) {
        currentUser.requireOrganizerId();
        var pageable = BoothPagination.organizer(page, size, sort);
        var result = active == null ? boothRepository.findAll(pageable)
                : boothRepository.findByLocationActive(active, pageable);
        return BoothPageResponse.from(result.map(BoothResponse::from));
    }

    public BoothResponse detail(Long boothId) {
        currentUser.requireOrganizerId();
        return BoothResponse.from(find(boothId));
    }

    @Transactional
    public BoothResponse update(Long boothId, UpdateBoothRequest request) {
        currentUser.requireOrganizerId();
        if (request.isEmpty()) {
            throw validation("At least one field must be supplied.", null);
        }
        // Expiry takes Event locks in its own transactions, before this physical Booth lock.
        if (request.contains("active") && Boolean.FALSE.equals(request.getActive())) {
            expiryService.expireDueHolds();
        }
        Booth booth = boothRepository.findByBoothIdForUpdate(boothId)
                .orElseThrow(() -> new BoothApiException(HttpStatus.NOT_FOUND,
                        "BOOTH_NOT_FOUND", "Booth not found."));
        Location location = booth.getLocation();
        boolean active = request.contains("active")
                ? requiredBoolean(request.getActive(), "active") : location.isActive();
        if (location.isActive() && !active) {
            if (configRepository.existsCurrentActiveHoldForBooth(boothId)) {
                throw new BoothApiException(HttpStatus.CONFLICT, "BOOTH_HAS_ACTIVE_HOLD",
                        "A Booth with an Active Hold cannot be deactivated.");
            }
            if (assignmentRepository.existsActiveAssignmentForBooth(boothId)) {
                throw new BoothApiException(HttpStatus.CONFLICT,
                        "BOOTH_HAS_ACTIVE_ASSIGNMENT",
                        "A Booth with an Active Assignment cannot be deactivated.");
            }
        }

        String name = request.contains("name")
                ? required(request.getName(), "name", 100) : location.getName();
        String description = request.contains("description")
                ? optional(request.getDescription()) : location.getDescription();
        Integer capacity = request.contains("maxCapacity")
                ? requiredPositive(request.getMaxCapacity(), "maxCapacity") : location.getMaxCapacity();
        var mapX = request.contains("mapX") ? request.getMapX() : location.getMapX();
        var mapY = request.contains("mapY") ? request.getMapY() : location.getMapY();
        String category = request.contains("categoryCode")
                ? optional(request.getCategoryCode()) : booth.getCategoryCode();
        String note = request.contains("note")
                ? optional(request.getNote()) : booth.getNote();
        String imageUrl = request.contains("imageUrl")
                ? optionalImageUrl(request.getImageUrl()) : booth.getImageUrl();
        if (request.contains("code")) {
            String newCode = requiredLocationCode(request.getCode());
            location.setCode(newCode);
        }

        Instant now = clock.instant();
        if (location.isActive() && !active
                && activityRepository.existsCurrentOrFutureAtLocation(boothId, now)) {
            throw new BoothApiException(HttpStatus.CONFLICT,
                    "LOCATION_HAS_ACTIVE_ACTIVITIES",
                    "Location cannot be deactivated while current or future Activities use it.");
        }
        if (capacity < location.getMaxCapacity()) {
            int usedCapacity = activityRepository.findMaximumCurrentOrFutureCapacityAtLocation(
                    boothId, now);
            if (capacity < usedCapacity) {
                throw new BoothApiException(HttpStatus.CONFLICT, "LOCATION_CAPACITY_IN_USE",
                        "Location capacity is below an applicable Activity capacity.");
            }
        }

        location.update(name, description, capacity, mapX, mapY, active, now);
        booth.updateDetails(category, note, imageUrl);
        try {
            boothRepository.flush();
        } catch (DataIntegrityViolationException exception) {
            throw codeAlreadyExists();
        }
        return BoothResponse.from(booth);
    }

    private Booth find(Long boothId) {
        return boothRepository.findByBoothId(boothId).orElseThrow(() ->
                new BoothApiException(HttpStatus.NOT_FOUND, "BOOTH_NOT_FOUND", "Booth not found."));
    }

    private static String required(String value, String field, int maxLength) {
        if (value == null || value.trim().isEmpty() || value.trim().length() > maxLength) {
            throw validation(field + " is required and must not exceed " + maxLength
                    + " characters.", field);
        }
        return value.trim();
    }

    private static Integer requiredPositive(Integer value, String field) {
        if (value == null || value <= 0) {
            throw validation(field + " must be positive.", field);
        }
        return value;
    }

    private static String requiredLocationCode(String value) {
        String code = required(value, "code", 30).toUpperCase(Locale.ROOT);
        if (!code.matches("[A-Z0-9_-]{1,30}")) {
            throw validation("code may contain only A-Z, 0-9, underscore or hyphen.", "code");
        }
        return code;
    }

    private static boolean requiredBoolean(Boolean value, String field) {
        if (value == null) {
            throw validation(field + " must not be null.", field);
        }
        return value;
    }

    private static String optional(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private static String optionalImageUrl(String value) {
        String normalized = optional(value);
        if (normalized == null) return null;
        if (normalized.length() > 2048) {
            throw validation("imageUrl must not exceed 2048 characters.", "imageUrl");
        }
        try {
            URI uri = new URI(normalized);
            boolean localPath = uri.getScheme() == null && uri.getHost() == null
                    && uri.getQuery() == null && uri.getFragment() == null
                    && normalized.startsWith("/") && !normalized.startsWith("//")
                    && !normalized.contains("\\");
            boolean remoteUrl = uri.isAbsolute()
                    && ("http".equalsIgnoreCase(uri.getScheme())
                        || "https".equalsIgnoreCase(uri.getScheme()))
                    && uri.getHost() != null;
            if (!localPath && !remoteUrl) {
                throw validation("imageUrl must be an HTTP(S) URL or a local public path.",
                        "imageUrl");
            }
            return normalized;
        } catch (URISyntaxException error) {
            throw validation("imageUrl must be a valid URL.", "imageUrl");
        }
    }

    private static BoothApiException validation(String message, String field) {
        return new BoothApiException(HttpStatus.UNPROCESSABLE_CONTENT, "VALIDATION_FAILED",
                message, field);
    }

    private static BoothApiException codeAlreadyExists() {
        return new BoothApiException(HttpStatus.CONFLICT, "BOOTH_CODE_ALREADY_EXISTS",
                "A Booth with this code already exists.");
    }
}
