package com.swp391.bookstreet.activity.service;

import com.swp391.bookstreet.activity.dto.ActivityPageResponse;
import com.swp391.bookstreet.activity.dto.ActivityRatingSummaryResponse;
import com.swp391.bookstreet.activity.dto.PublicActivityResponse;
import com.swp391.bookstreet.activity.entity.Activity;
import com.swp391.bookstreet.activity.entity.ActivityStatus;
import com.swp391.bookstreet.activity.exception.ActivityApiException;
import com.swp391.bookstreet.activity.repository.ActivityRepository;
import com.swp391.bookstreet.booth.entity.Location;
import com.swp391.bookstreet.booth.repository.LocationRepository;
import com.swp391.bookstreet.event.entity.Event;
import com.swp391.bookstreet.event.repository.EventRepository;
import com.swp391.bookstreet.registration.repository.ActivityRegistrationRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class PublicActivityService {
    private static final List<ActivityStatus> DEFAULT_STATUSES = List.of(
            ActivityStatus.PUBLISHED, ActivityStatus.ONGOING);

    private final ActivityRepository activityRepository;
    private final EventRepository eventRepository;
    private final LocationRepository locationRepository;
    private final ActivityRegistrationRepository registrationRepository;
    private final ActivityLifecycleService lifecycleService;
    private final ActivityLifecycleTransactionService lifecycleTransactions;
    private final Clock clock;

    public PublicActivityService(ActivityRepository activityRepository,
            EventRepository eventRepository, LocationRepository locationRepository,
            ActivityRegistrationRepository registrationRepository,
            ActivityLifecycleService lifecycleService,
            ActivityLifecycleTransactionService lifecycleTransactions, Clock clock) {
        this.activityRepository = activityRepository;
        this.eventRepository = eventRepository;
        this.locationRepository = locationRepository;
        this.registrationRepository = registrationRepository;
        this.lifecycleService = lifecycleService;
        this.lifecycleTransactions = lifecycleTransactions;
        this.clock = clock;
    }

    public ActivityPageResponse<PublicActivityResponse> list(int page, int size, String sort,
            Long eventId, String status, String activityType, Long locationId, String search) {
        requirePositiveFilter(eventId, "eventId");
        requirePositiveFilter(locationId, "locationId");
        var statuses = publicStatuses(status);
        var normalizedActivityType = normalizeActivityType(activityType);
        var normalizedSearch = normalizeSearch(search);
        var pageable = ActivityPagination.publicActivities(page, size, sort);
        lifecycleService.advanceDueActivities();
        var result = activityRepository.findPublic(statuses, eventId, normalizedActivityType,
                locationId, normalizedSearch, pageable);
        return new ActivityPageResponse<>(responses(result.getContent()), result.getNumber(),
                result.getSize(), result.getTotalElements(), result.getTotalPages());
    }

    public PublicActivityResponse detail(Long activityId) {
        if (activityId == null || activityId <= 0) throw notFound();
        Activity visible = activityRepository.findByActivityIdAndPublishedAtIsNotNull(activityId)
                .orElseThrow(PublicActivityService::notFound);
        if (visible.getStatus() != ActivityStatus.CANCELLED) {
            lifecycleTransactions.advance(activityId);
        }
        Activity activity = activityRepository.findByActivityIdAndPublishedAtIsNotNull(activityId)
                .orElseThrow(PublicActivityService::notFound);
        return responses(List.of(activity)).getFirst();
    }

    private List<PublicActivityResponse> responses(List<Activity> activities) {
        if (activities.isEmpty()) return List.of();
        List<Long> activityIds = activities.stream().map(Activity::getActivityId).toList();
        Map<Long, Event> events = eventRepository.findAllById(activities.stream()
                        .map(Activity::getEventId).collect(Collectors.toSet())).stream()
                .collect(Collectors.toMap(Event::getEventId, Function.identity()));
        Map<Long, Location> locations = locationRepository.findAllById(activities.stream()
                        .map(Activity::getLocationId).collect(Collectors.toSet())).stream()
                .collect(Collectors.toMap(Location::getLocationId, Function.identity()));
        Map<Long, Long> seatCounts = registrationRepository
                .countSeatActiveByActivityIds(activityIds).stream()
                .collect(Collectors.toMap(
                        ActivityRegistrationRepository.ActivitySeatCount::getActivityId,
                        ActivityRegistrationRepository.ActivitySeatCount::getSeatCount));
        Map<Long, ActivityRatingSummaryResponse> ratings = new HashMap<>();
        registrationRepository.aggregateEligibleRatings(activityIds).forEach(aggregate -> {
            BigDecimal average = BigDecimal.valueOf(aggregate.getScoreSum())
                    .divide(BigDecimal.valueOf(aggregate.getRatingCount()), 2,
                            RoundingMode.HALF_UP)
                    .stripTrailingZeros();
            ratings.put(aggregate.getActivityId(), new ActivityRatingSummaryResponse(
                    average, aggregate.getRatingCount()));
        });
        Instant now = clock.instant();
        return activities.stream().map(activity -> PublicActivityResponse.from(activity,
                requireEvent(events, activity.getEventId()),
                requireLocation(locations, activity.getLocationId()),
                seatCounts.getOrDefault(activity.getActivityId(), 0L),
                ratings.getOrDefault(activity.getActivityId(),
                        ActivityRatingSummaryResponse.empty()), now)).toList();
    }

    private static List<ActivityStatus> publicStatuses(String status) {
        if (status == null) return DEFAULT_STATUSES;
        return switch (status.trim().toUpperCase(Locale.ROOT)) {
            case "PUBLISHED" -> List.of(ActivityStatus.PUBLISHED);
            case "ONGOING" -> List.of(ActivityStatus.ONGOING);
            case "COMPLETED" -> List.of(ActivityStatus.COMPLETED);
            default -> throw new ActivityApiException(HttpStatus.BAD_REQUEST,
                    "INVALID_ACTIVITY_STATUS_FILTER",
                    "Status must be PUBLISHED, ONGOING or COMPLETED.");
        };
    }

    private static String normalizeActivityType(String value) {
        if (value == null) return "";
        String normalized = value.trim().replaceAll("\\s+", " ");
        if (normalized.isEmpty() || normalized.length() > 50) {
            throw invalidFilter("activityType must contain between 1 and 50 characters.");
        }
        return normalized;
    }

    private static String normalizeSearch(String value) {
        if (value == null) return "";
        String normalized = value.trim().replaceAll("\\s+", " ");
        return normalized;
    }

    private static void requirePositiveFilter(Long value, String field) {
        if (value != null && value <= 0) {
            throw invalidFilter(field + " must be a positive identifier.");
        }
    }

    private static Event requireEvent(Map<Long, Event> events, Long eventId) {
        Event event = events.get(eventId);
        if (event == null) throw notFound();
        return event;
    }

    private static Location requireLocation(Map<Long, Location> locations, Long locationId) {
        Location location = locations.get(locationId);
        if (location == null) throw notFound();
        return location;
    }

    private static ActivityApiException invalidFilter(String message) {
        return new ActivityApiException(HttpStatus.BAD_REQUEST, "INVALID_FILTER", message);
    }

    private static ActivityApiException notFound() {
        return new ActivityApiException(HttpStatus.NOT_FOUND, "ACTIVITY_NOT_FOUND",
                "Activity not found.");
    }
}
