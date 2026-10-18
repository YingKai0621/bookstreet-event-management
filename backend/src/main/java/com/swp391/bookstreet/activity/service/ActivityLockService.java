package com.swp391.bookstreet.activity.service;

import com.swp391.bookstreet.activity.entity.Activity;
import com.swp391.bookstreet.activity.entity.ActivityProposal;
import com.swp391.bookstreet.activity.entity.ActivityRequest;
import com.swp391.bookstreet.activity.exception.ActivityApiException;
import com.swp391.bookstreet.activity.repository.ActivityProposalRepository;
import com.swp391.bookstreet.activity.repository.ActivityRepository;
import com.swp391.bookstreet.activity.repository.ActivityRequestRepository;
import com.swp391.bookstreet.booth.entity.Location;
import com.swp391.bookstreet.booth.repository.LocationRepository;
import com.swp391.bookstreet.event.entity.Event;
import com.swp391.bookstreet.event.service.EventRootLockService;
import java.util.Collection;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ActivityLockService {
    private final EventRootLockService eventRootLockService;
    private final LocationRepository locationRepository;
    private final ActivityProposalRepository proposalRepository;
    private final ActivityRepository activityRepository;
    private final ActivityRequestRepository requestRepository;

    public ActivityLockService(EventRootLockService eventRootLockService,
            LocationRepository locationRepository,
            ActivityProposalRepository proposalRepository,
            ActivityRepository activityRepository,
            ActivityRequestRepository requestRepository) {
        this.eventRootLockService = eventRootLockService;
        this.locationRepository = locationRepository;
        this.proposalRepository = proposalRepository;
        this.activityRepository = activityRepository;
        this.requestRepository = requestRepository;
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public RootLocks lockRoot(Long eventId, Collection<Long> locationIds) {
        Event event = eventRootLockService.lock(eventId)
                .orElseThrow(ActivityLockService::eventNotFound);
        return new RootLocks(event, lockLocations(locationIds));
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public RootLocks lockOwnedRoot(Long eventId, Long organizerUserId,
            Collection<Long> locationIds) {
        Event event = eventRootLockService.lockOwned(eventId, organizerUserId)
                .orElseThrow(ActivityLockService::eventNotFound);
        return new RootLocks(event, lockLocations(locationIds));
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public ActivityLocks lockOwnedActivity(Long activityId, Long organizerUserId,
            Collection<Long> additionalLocationIds) {
        var route = activityRepository.findRouteById(activityId)
                .orElseThrow(ActivityLockService::activityNotFound);
        Event event = eventRootLockService.lockOwned(route.getEventId(), organizerUserId)
                .orElseThrow(ActivityLockService::activityNotFound);
        return lockActivityAfterEvent(event, activityId, additionalLocationIds);
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public ActivityLocks lockActivityRoot(Long activityId) {
        return lockActivityRoot(activityId, List.of());
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public ActivityLocks lockActivityRoot(Long activityId,
            Collection<Long> additionalLocationIds) {
        var route = activityRepository.findRouteById(activityId)
                .orElseThrow(ActivityLockService::activityNotFound);
        Event event = eventRootLockService.lock(route.getEventId())
                .orElseThrow(ActivityLockService::activityNotFound);
        return lockActivityAfterEvent(event, activityId, additionalLocationIds);
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public ProposalLocks lockProposalRoot(Long proposalId,
            Collection<Long> additionalLocationIds) {
        var initialRoute = proposalRepository.findRouteById(proposalId)
                .orElseThrow(ActivityLockService::proposalNotFound);
        Event event = eventRootLockService.lock(initialRoute.getEventId())
                .orElseThrow(ActivityLockService::proposalNotFound);
        return lockProposalAfterEvent(event, proposalId, additionalLocationIds);
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public ProposalLocks lockOwnedProposalRoot(Long proposalId, Long organizerUserId,
            Collection<Long> additionalLocationIds) {
        var initialRoute = proposalRepository.findRouteById(proposalId)
                .orElseThrow(ActivityLockService::proposalNotFound);
        Event event = eventRootLockService.lockOwned(initialRoute.getEventId(), organizerUserId)
                .orElseThrow(ActivityLockService::proposalNotFound);
        return lockProposalAfterEvent(event, proposalId, additionalLocationIds);
    }

    private ProposalLocks lockProposalAfterEvent(Event event, Long proposalId,
            Collection<Long> additionalLocationIds) {
        var lockedRoute = proposalRepository.findRouteById(proposalId)
                .filter(route -> route.getEventId().equals(event.getEventId()))
                .orElseThrow(ActivityLockService::proposalNotFound);
        List<Long> locationIds = new ArrayList<>();
        locationIds.add(lockedRoute.getLocationId());
        if (additionalLocationIds != null) locationIds.addAll(additionalLocationIds);
        List<Location> locations = lockLocations(locationIds);
        ActivityProposal proposal = proposalRepository.findByIdForUpdate(proposalId)
                .orElseThrow(ActivityLockService::proposalNotFound);
        return new ProposalLocks(event, locations, proposal);
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public ActivityProposal lockProposalAfterRoot(Long proposalId) {
        return proposalRepository.findByIdForUpdate(proposalId)
                .orElseThrow(() -> new ActivityApiException(HttpStatus.NOT_FOUND,
                        "ACTIVITY_PROPOSAL_NOT_FOUND", "Activity Proposal not found."));
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public Activity lockActivityAfterRoot(Long activityId) {
        return activityRepository.findByIdForUpdate(activityId)
                .orElseThrow(() -> new ActivityApiException(HttpStatus.NOT_FOUND,
                        "ACTIVITY_NOT_FOUND", "Activity not found."));
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public ActivityRequest lockRequestAfterActivity(Long requestId) {
        return requestRepository.findByIdForUpdate(requestId)
                .orElseThrow(() -> new ActivityApiException(HttpStatus.NOT_FOUND,
                        "ACTIVITY_REQUEST_NOT_FOUND", "Activity request not found."));
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public List<ActivityRequest> lockPendingRequestsAfterActivity(Long activityId) {
        return requestRepository.findPendingByActivityIdForUpdate(activityId);
    }

    private List<Location> lockLocations(Collection<Long> locationIds) {
        List<Long> orderedIds = Optional.ofNullable(locationIds).orElse(List.of()).stream()
                .distinct().sorted().toList();
        if (orderedIds.isEmpty()) return List.of();
        List<Location> locations = locationRepository
                .findAllByIdForUpdateOrderById(orderedIds);
        if (locations.size() != orderedIds.size()) {
            throw new ActivityApiException(HttpStatus.NOT_FOUND, "LOCATION_NOT_FOUND",
                    "Location not found.");
        }
        return List.copyOf(locations);
    }

    private ActivityLocks lockActivityAfterEvent(Event event, Long activityId,
            Collection<Long> additionalLocationIds) {
        Long currentLocationId = activityRepository.findLocationIdById(activityId)
                .orElseThrow(ActivityLockService::activityNotFound);
        List<Long> locationIds = new ArrayList<>();
        locationIds.add(currentLocationId);
        if (additionalLocationIds != null) locationIds.addAll(additionalLocationIds);
        List<Location> locations = lockLocations(locationIds);
        Activity activity = activityRepository.findByIdForUpdate(activityId)
                .orElseThrow(ActivityLockService::activityNotFound);
        return new ActivityLocks(event, locations, activity);
    }

    private static ActivityApiException eventNotFound() {
        return new ActivityApiException(HttpStatus.NOT_FOUND, "EVENT_NOT_FOUND",
                "Event not found.");
    }

    private static ActivityApiException activityNotFound() {
        return new ActivityApiException(HttpStatus.NOT_FOUND, "ACTIVITY_NOT_FOUND",
                "Activity not found.");
    }

    private static ActivityApiException proposalNotFound() {
        return new ActivityApiException(HttpStatus.NOT_FOUND,
                "ACTIVITY_PROPOSAL_NOT_FOUND", "Activity Proposal not found.");
    }

    public record RootLocks(Event event, List<Location> locations) {
        public Location location(Long locationId) {
            return locations.stream()
                    .filter(location -> location.getLocationId().equals(locationId))
                    .findFirst()
                    .orElseThrow(() -> new ActivityApiException(HttpStatus.NOT_FOUND,
                            "LOCATION_NOT_FOUND", "Location not found."));
        }
    }

    public record ActivityLocks(Event event, List<Location> locations, Activity activity) {
        public Location location(Long locationId) {
            return locations.stream()
                    .filter(location -> location.getLocationId().equals(locationId))
                    .findFirst()
                    .orElseThrow(() -> new ActivityApiException(HttpStatus.NOT_FOUND,
                            "LOCATION_NOT_FOUND", "Location not found."));
        }
    }

    public record ProposalLocks(Event event, List<Location> locations,
            ActivityProposal proposal) {
        public Location location(Long locationId) {
            return locations.stream()
                    .filter(location -> location.getLocationId().equals(locationId))
                    .findFirst()
                    .orElseThrow(() -> new ActivityApiException(HttpStatus.NOT_FOUND,
                            "LOCATION_NOT_FOUND", "Location not found."));
        }
    }
}
