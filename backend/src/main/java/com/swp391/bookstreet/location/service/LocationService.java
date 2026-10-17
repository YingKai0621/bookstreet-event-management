package com.swp391.bookstreet.location.service;

import com.swp391.bookstreet.activity.repository.ActivityRepository;
import com.swp391.bookstreet.activity.security.ActivityCurrentUser;
import com.swp391.bookstreet.booth.entity.BoothAssignment;
import com.swp391.bookstreet.booth.entity.Location;
import com.swp391.bookstreet.booth.entity.LocationType;
import com.swp391.bookstreet.booth.repository.BoothAssignmentRepository;
import com.swp391.bookstreet.booth.repository.LocationRepository;
import com.swp391.bookstreet.event.repository.EventRepository;
import com.swp391.bookstreet.location.dto.CreateLocationRequest;
import com.swp391.bookstreet.location.dto.LocationPageResponse;
import com.swp391.bookstreet.location.dto.LocationSummary;
import com.swp391.bookstreet.location.dto.UpdateLocationRequest;
import com.swp391.bookstreet.location.exception.LocationApiException;
import com.swp391.bookstreet.partner.entity.PartnerEventApplication;
import com.swp391.bookstreet.partner.repository.PartnerEventApplicationRepository;
import jakarta.persistence.criteria.Predicate;
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class LocationService {
    private final LocationRepository locationRepository;
    private final ActivityRepository activityRepository;
    private final BoothAssignmentRepository assignmentRepository;
    private final PartnerEventApplicationRepository applicationRepository;
    private final EventRepository eventRepository;
    private final ActivityCurrentUser currentUser;
    private final LocationConstraintTranslator constraintTranslator;
    private final Clock clock;

    public LocationService(LocationRepository locationRepository,
            ActivityRepository activityRepository,
            BoothAssignmentRepository assignmentRepository,
            PartnerEventApplicationRepository applicationRepository,
            EventRepository eventRepository, ActivityCurrentUser currentUser,
            LocationConstraintTranslator constraintTranslator, Clock clock) {
        this.locationRepository = locationRepository;
        this.activityRepository = activityRepository;
        this.assignmentRepository = assignmentRepository;
        this.applicationRepository = applicationRepository;
        this.eventRepository = eventRepository;
        this.currentUser = currentUser;
        this.constraintTranslator = constraintTranslator;
        this.clock = clock;
    }

    public LocationPageResponse<LocationSummary> list(int page, int size, String sort,
            LocationType type, Boolean active, String search) {
        currentUser.requireOrganizerId();
        if (type == LocationType.BOOTH) {
            throw new LocationApiException(HttpStatus.BAD_REQUEST, "INVALID_FILTER",
                    "Organizer shared Location API does not manage BOOTH Locations.");
        }
        var pageable = LocationPagination.of(page, size, sort);
        var result = locationRepository.findAll(filters(type, active, search), pageable)
                .map(location -> LocationSummary.shared(location, true, null));
        return LocationPageResponse.from(result);
    }

    @Transactional
    public LocationSummary create(CreateLocationRequest request) {
        currentUser.requireOrganizerId();
        String code = LocationValidation.code(request.code());
        LocationType type = LocationValidation.sharedType(request.locationType());
        if (locationRepository.existsByCodeIgnoreCase(code)) {
            throw duplicateCode();
        }
        Location location = Location.createShared(code, LocationValidation.name(request.name()),
                type, LocationValidation.optionalDescription(request.description()),
                LocationValidation.positiveCapacity(request.maxCapacity()), request.mapX(),
                request.mapY(), clock.instant());
        try {
            return LocationSummary.shared(locationRepository.saveAndFlush(location), true, null);
        } catch (DataIntegrityViolationException error) {
            constraintTranslator.rethrow(error);
            throw error;
        }
    }

    @Transactional
    public LocationSummary update(Long locationId, UpdateLocationRequest request) {
        currentUser.requireOrganizerId();
        if (request.isEmpty()) {
            throw LocationValidation.validation("At least one field must be supplied.", null);
        }
        Location location = locationRepository.findByIdForUpdate(locationId)
                .filter(value -> value.getLocationType() != LocationType.BOOTH)
                .orElseThrow(LocationService::notFound);

        String code = request.contains("code")
                ? LocationValidation.code(request.getCode()) : location.getCode();
        String name = request.contains("name")
                ? LocationValidation.name(request.getName()) : location.getName();
        String description = request.contains("description")
                ? LocationValidation.optionalDescription(request.getDescription())
                : location.getDescription();
        Integer capacity = request.contains("maxCapacity")
                ? LocationValidation.positiveCapacity(request.getMaxCapacity())
                : location.getMaxCapacity();
        boolean active = request.contains("active")
                ? LocationValidation.requiredBoolean(request.getActive(), "active")
                : location.isActive();
        var mapX = request.contains("mapX") ? request.getMapX() : location.getMapX();
        var mapY = request.contains("mapY") ? request.getMapY() : location.getMapY();

        if (!code.equals(location.getCode())
                && locationRepository.existsByCodeIgnoreCaseAndLocationIdNot(code, locationId)) {
            throw duplicateCode();
        }
        Instant now = clock.instant();
        if (location.isActive() && !active
                && activityRepository.existsCurrentOrFutureAtLocation(locationId, now)) {
            throw new LocationApiException(HttpStatus.CONFLICT,
                    "LOCATION_HAS_ACTIVE_ACTIVITIES",
                    "Location cannot be deactivated while current or future Activities use it.");
        }
        if (capacity < location.getMaxCapacity()) {
            int usedCapacity = activityRepository.findMaximumCurrentOrFutureCapacityAtLocation(
                    locationId, now);
            if (capacity < usedCapacity) {
                throw new LocationApiException(HttpStatus.CONFLICT, "LOCATION_CAPACITY_IN_USE",
                        "Location capacity is below an applicable Activity capacity.");
            }
        }

        location.setCode(code);
        location.update(name, description, capacity, mapX, mapY, active, now);
        try {
            locationRepository.flush();
        } catch (DataIntegrityViolationException error) {
            constraintTranslator.rethrow(error);
            throw error;
        }
        return LocationSummary.shared(location, true, null);
    }

    public List<LocationSummary> listEligibleForPartner(Long eventId, Instant startAt,
            Instant endAt) {
        Long representativeUserId = currentUser.requirePartnerId();
        validateIntervalFilter(startAt, endAt);
        if (!eventRepository.existsById(eventId)) {
            throw new LocationApiException(HttpStatus.NOT_FOUND, "EVENT_NOT_FOUND",
                    "Event not found.");
        }
        PartnerEventApplication application = applicationRepository
                .findByEventIdAndPartnerOrganization_RepresentativeUserId(
                        eventId, representativeUserId)
                .filter(value -> value.getStatus()
                        == PartnerEventApplication.ApplicationStatus.APPROVED)
                .orElseThrow(() -> new LocationApiException(HttpStatus.CONFLICT,
                        "PARTNER_APPLICATION_NOT_APPROVED",
                        "Partner application must be approved for this Event."));

        List<Location> sharedLocations = locationRepository
                .findByLocationTypeNotAndActiveTrueOrderByCodeAscLocationIdAsc(LocationType.BOOTH);
        List<BoothAssignment> assignments = assignmentRepository
                .findActiveOwnedByEventAndPartnerOrganization(eventId,
                        application.getPartnerOrganization().getId());
        Set<Long> locationIds = new HashSet<>();
        sharedLocations.forEach(location -> locationIds.add(location.getLocationId()));
        assignments.forEach(assignment -> locationIds.add(assignedLocation(assignment)
                .getLocationId()));
        Set<Long> conflicts = conflictingLocations(locationIds, startAt, endAt);

        List<LocationSummary> result = new ArrayList<>();
        sharedLocations.forEach(location -> result.add(summary(location, null, conflicts)));
        assignments.forEach(assignment -> result.add(summary(assignedLocation(assignment),
                assignment.getBoothAssignmentId(), conflicts)));
        result.sort(Comparator.comparing(LocationSummary::code)
                .thenComparing(LocationSummary::locationId));
        return List.copyOf(result);
    }

    private Set<Long> conflictingLocations(Collection<Long> locationIds, Instant startAt,
            Instant endAt) {
        if (startAt == null || locationIds.isEmpty()) return Set.of();
        return Set.copyOf(activityRepository.findConflictingLocationIds(
                locationIds, startAt, endAt));
    }

    private static LocationSummary summary(Location location, Long assignmentId,
            Set<Long> conflicts) {
        String reason = !location.isActive() ? "LOCATION_NOT_ACTIVE"
                : conflicts.contains(location.getLocationId())
                        ? "ACTIVITY_LOCATION_TIME_CONFLICT" : null;
        boolean eligible = reason == null;
        return assignmentId == null
                ? LocationSummary.shared(location, eligible, reason)
                : LocationSummary.assignedBooth(location, assignmentId, eligible, reason);
    }

    private static Location assignedLocation(BoothAssignment assignment) {
        return assignment.getBoothHold().getEventBoothConfig().getBooth().getLocation();
    }

    private static void validateIntervalFilter(Instant startAt, Instant endAt) {
        if ((startAt == null) != (endAt == null)
                || (startAt != null && !startAt.isBefore(endAt))) {
            throw new LocationApiException(HttpStatus.BAD_REQUEST, "INVALID_FILTER",
                    "startAt and endAt must appear together and startAt must be before endAt.");
        }
    }

    private static Specification<Location> filters(LocationType type, Boolean active,
            String search) {
        String term = search == null ? null : search.trim().toLowerCase(Locale.ROOT);
        return (root, query, builder) -> {
            List<Predicate> predicates = new ArrayList<>();
            predicates.add(builder.notEqual(root.get("locationType"), LocationType.BOOTH));
            if (type != null) predicates.add(builder.equal(root.get("locationType"), type));
            if (active != null) predicates.add(builder.equal(root.get("active"), active));
            if (term != null && !term.isEmpty()) {
                String pattern = "%" + term.replace("%", "\\%").replace("_", "\\_") + "%";
                predicates.add(builder.or(
                        builder.like(builder.lower(root.<String>get("code")), pattern, '\\'),
                        builder.like(builder.lower(root.<String>get("name")), pattern, '\\'),
                        builder.like(builder.lower(root.<String>get("description")), pattern, '\\')));
            }
            return builder.and(predicates.toArray(Predicate[]::new));
        };
    }

    private static LocationApiException duplicateCode() {
        return new LocationApiException(HttpStatus.CONFLICT, "LOCATION_CODE_ALREADY_EXISTS",
                "A Location with this code already exists.");
    }

    private static LocationApiException notFound() {
        return new LocationApiException(HttpStatus.NOT_FOUND, "LOCATION_NOT_FOUND",
                "Location not found.");
    }
}
