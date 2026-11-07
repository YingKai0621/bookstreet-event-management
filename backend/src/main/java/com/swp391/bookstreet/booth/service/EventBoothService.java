package com.swp391.bookstreet.booth.service;

import com.swp391.bookstreet.booth.dto.BoothPageResponse;
import com.swp391.bookstreet.booth.dto.EventBoothConfigRequest;
import com.swp391.bookstreet.booth.dto.EventBoothResponse;
import com.swp391.bookstreet.booth.entity.Booth;
import com.swp391.bookstreet.booth.entity.BoothAvailability;
import com.swp391.bookstreet.booth.entity.EventBoothConfig;
import com.swp391.bookstreet.booth.exception.BoothApiException;
import com.swp391.bookstreet.booth.repository.BoothRepository;
import com.swp391.bookstreet.booth.repository.BoothAssignmentRepository;
import com.swp391.bookstreet.booth.repository.EventBoothConfigRepository;
import com.swp391.bookstreet.booth.security.BoothCurrentUser;
import com.swp391.bookstreet.event.entity.Event;
import com.swp391.bookstreet.event.entity.EventStatus;
import com.swp391.bookstreet.event.repository.EventRepository;
import com.swp391.bookstreet.event.service.EventRootLockService;
import java.math.BigDecimal;
import java.time.Clock;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class EventBoothService {
    private static final BigDecimal MINIMUM_PAID_RENTAL_PRICE = new BigDecimal("5000");
    private static final List<EventStatus> PUBLIC_EVENT_STATUSES =
            List.of(EventStatus.PUBLISHED, EventStatus.ONGOING);

    private final EventRepository eventRepository;
    private final EventRootLockService eventRootLockService;
    private final BoothRepository boothRepository;
    private final EventBoothConfigRepository configRepository;
    private final BoothAssignmentRepository assignmentRepository;
    private final BoothCurrentUser currentUser;
    private final BoothHoldExpiryService expiryService;
    private final Clock clock;

    public EventBoothService(EventRepository eventRepository, BoothRepository boothRepository,
            EventRootLockService eventRootLockService,
            EventBoothConfigRepository configRepository, BoothCurrentUser currentUser,
            BoothAssignmentRepository assignmentRepository,
            BoothHoldExpiryService expiryService, Clock clock) {
        this.eventRepository = eventRepository;
        this.eventRootLockService = eventRootLockService;
        this.boothRepository = boothRepository;
        this.configRepository = configRepository;
        this.assignmentRepository = assignmentRepository;
        this.currentUser = currentUser;
        this.expiryService = expiryService;
        this.clock = clock;
    }

    public List<EventBoothResponse> listOwnedConfigurations(Long eventId) {
        Event event = ownedEvent(eventId);
        expiryService.expireDueHolds();
        Set<Long> heldBoothIds = heldBooths(event);
        Set<Long> assignedBoothIds = assignedBooths(event);
        return configRepository.findByEventIdOrderByBoothLocationCodeAsc(eventId).stream()
                .map(config -> EventBoothResponse.configured(config,
                        availability(config, heldBoothIds, assignedBoothIds)))
                .toList();
    }

    @Transactional
    public EventBoothResponse configure(Long eventId, Long boothId,
            EventBoothConfigRequest request) {
        expiryService.expireDueHolds();
        Event event = eventRootLockService.lockOwned(eventId, currentUser.requireOrganizerId())
                .orElseThrow(EventBoothService::eventNotFound);
        if (event.getStatus() != EventStatus.DRAFT
                && (event.getStatus() != EventStatus.PUBLISHED
                    || !clock.instant().isBefore(event.getStartAt()))) {
            throw new BoothApiException(HttpStatus.CONFLICT, "EVENT_NOT_EDITABLE",
                    "Booth configuration requires a Draft or a Published Event before its start.");
        }
        requireSupportedPrice(request.rentalPrice());
        Booth booth = boothRepository.findByBoothIdForUpdate(boothId)
                .orElseThrow(EventBoothService::boothNotFound);
        if (request.enabled() && !booth.getLocation().isActive()) {
            throw new BoothApiException(HttpStatus.UNPROCESSABLE_CONTENT,
                    "EVENT_BOOTH_CONFIGURATION_INVALID",
                    "An inactive physical Booth cannot be enabled for an Event.", "enabled");
        }

        EventBoothConfig config = configRepository.findByEventIdAndBoothIdForUpdate(
                        eventId, boothId)
                .orElse(null);
        if (config != null && config.isEnabled() && !request.enabled()) {
            if (configRepository.existsCurrentActiveHoldForConfig(
                    config.getEventBoothConfigId())) {
                throw new BoothApiException(HttpStatus.CONFLICT, "BOOTH_HAS_ACTIVE_HOLD",
                        "A Booth configuration with an Active Hold cannot be disabled.");
            }
            if (assignmentRepository.existsActiveAssignmentForConfig(
                    config.getEventBoothConfigId())) {
                throw new BoothApiException(HttpStatus.CONFLICT,
                        "BOOTH_HAS_ACTIVE_ASSIGNMENT",
                        "A Booth configuration with an Active Assignment cannot be disabled.");
            }
        }

        if (config == null) {
            config = EventBoothConfig.create(eventId, booth, request.rentalPrice(),
                    request.enabled(), clock.instant());
        } else {
            config.update(request.rentalPrice(), request.enabled(), clock.instant());
        }
        config = configRepository.saveAndFlush(config);
        return EventBoothResponse.configured(config,
                availability(config, heldBooths(event), assignedBooths(event)));
    }

    public BoothPageResponse<EventBoothResponse> listPublic(Long eventId, int page, int size,
            String sort, BoothAvailability availabilityFilter, String categoryCode) {
        BoothPagination.SortSpec sortSpec = BoothPagination.publicSort(page, size, sort);
        Event event = publicEvent(eventId);
        expiryService.expireDueHolds();
        List<Booth> booths = boothRepository.findAllActive();
        Map<Long, EventBoothConfig> configs = configsByBooth(eventId);
        Set<Long> heldBoothIds = heldBooths(event);
        Set<Long> assignedBoothIds = assignedBooths(event);
        String normalizedCategory = normalizeFilter(categoryCode);

        List<EventBoothResponse> matching = new ArrayList<>();
        for (Booth booth : booths) {
            if (normalizedCategory != null && (booth.getCategoryCode() == null
                    || !booth.getCategoryCode().equalsIgnoreCase(normalizedCategory))) {
                continue;
            }
            EventBoothConfig config = configs.get(booth.getBoothId());
            EventBoothResponse response = config == null
                    ? EventBoothResponse.unconfigured(eventId, booth)
                    : EventBoothResponse.configured(config,
                            availability(config, heldBoothIds, assignedBoothIds));
            if (availabilityFilter == null || response.availability() == availabilityFilter) {
                matching.add(response);
            }
        }
        matching.sort(comparator(sortSpec));

        int from = Math.min(page * size, matching.size());
        int to = Math.min(from + size, matching.size());
        return BoothPageResponse.of(List.copyOf(matching.subList(from, to)), page, size,
                matching.size());
    }

    public EventBoothResponse publicDetail(Long eventId, Long boothId) {
        Event event = publicEvent(eventId);
        expiryService.expireDueHolds();
        Booth booth = boothRepository.findByBoothId(boothId)
                .filter(candidate -> candidate.getLocation().isActive())
                .orElseThrow(EventBoothService::eventBoothNotFound);
        EventBoothConfig config = configRepository.findByEventIdAndBoothBoothId(eventId, boothId)
                .orElse(null);
        if (config == null) {
            return EventBoothResponse.unconfigured(eventId, booth);
        }
        return EventBoothResponse.configured(config,
                availability(config, heldBooths(event), assignedBooths(event)));
    }

    private Event ownedEvent(Long eventId) {
        Long ownerId = currentUser.requireOrganizerId();
        return eventRepository.findByEventIdAndOrganizerUserId(eventId, ownerId)
                .orElseThrow(EventBoothService::eventNotFound);
    }

    private Event publicEvent(Long eventId) {
        return eventRepository.findByEventIdAndStatusIn(eventId, PUBLIC_EVENT_STATUSES)
                .orElseThrow(EventBoothService::eventNotFound);
    }

    private Map<Long, EventBoothConfig> configsByBooth(Long eventId) {
        Map<Long, EventBoothConfig> configs = new HashMap<>();
        for (EventBoothConfig config :
                configRepository.findByEventIdOrderByBoothLocationCodeAsc(eventId)) {
            configs.put(config.getBooth().getBoothId(), config);
        }
        return configs;
    }

    private Set<Long> heldBooths(Event event) {
        return new HashSet<>(configRepository.findBoothIdsWithCurrentOverlappingHold(
                event.getStartAt(), event.getEndAt()));
    }

    private Set<Long> assignedBooths(Event event) {
        return new HashSet<>(assignmentRepository.findBoothIdsWithOverlappingActiveAssignment(
                event.getStartAt(), event.getEndAt()));
    }

    private static BoothAvailability availability(EventBoothConfig config,
            Set<Long> heldBoothIds, Set<Long> assignedBoothIds) {
        if (!config.isEnabled() || !config.getBooth().getLocation().isActive()) {
            return BoothAvailability.UNAVAILABLE;
        }
        Long boothId = config.getBooth().getBoothId();
        if (assignedBoothIds.contains(boothId)) {
            return BoothAvailability.ASSIGNED;
        }
        return heldBoothIds.contains(boothId) ? BoothAvailability.ON_HOLD
                : BoothAvailability.AVAILABLE;
    }

    private static void requireSupportedPrice(BigDecimal rentalPrice) {
        if (rentalPrice != null && rentalPrice.signum() > 0
                && rentalPrice.compareTo(MINIMUM_PAID_RENTAL_PRICE) < 0) {
            throw new BoothApiException(HttpStatus.UNPROCESSABLE_CONTENT,
                    "EVENT_BOOTH_PRICE_INVALID",
                    "Rental price must be zero or at least 5000 VND.", "rentalPrice");
        }
    }

    private static Comparator<EventBoothResponse> comparator(BoothPagination.SortSpec spec) {
        Comparator<EventBoothResponse> comparator;
        if ("rentalPrice".equals(spec.field())) {
            Comparator<BigDecimal> money = spec.direction() == Sort.Direction.ASC
                    ? Comparator.nullsLast(Comparator.naturalOrder())
                    : Comparator.nullsLast(Comparator.reverseOrder());
            comparator = Comparator.comparing(EventBoothResponse::rentalPrice, money);
        } else {
            comparator = "name".equals(spec.field())
                    ? Comparator.comparing(response -> response.booth().name(),
                            String.CASE_INSENSITIVE_ORDER)
                    : Comparator.comparing(response -> response.booth().code(),
                            String.CASE_INSENSITIVE_ORDER);
            if (spec.direction() == Sort.Direction.DESC) {
                comparator = comparator.reversed();
            }
        }
        return comparator.thenComparing(response -> response.booth().boothId());
    }

    private static String normalizeFilter(String value) {
        if (value == null || value.isBlank()) return null;
        return value.trim().toUpperCase(Locale.ROOT);
    }

    private static BoothApiException eventNotFound() {
        return new BoothApiException(HttpStatus.NOT_FOUND, "EVENT_NOT_FOUND", "Event not found.");
    }

    private static BoothApiException boothNotFound() {
        return new BoothApiException(HttpStatus.NOT_FOUND, "BOOTH_NOT_FOUND", "Booth not found.");
    }

    private static BoothApiException eventBoothNotFound() {
        return new BoothApiException(HttpStatus.NOT_FOUND, "EVENT_BOOTH_NOT_FOUND",
                "Event Booth not found.");
    }
}
