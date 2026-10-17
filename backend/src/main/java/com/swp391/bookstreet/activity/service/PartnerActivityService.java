package com.swp391.bookstreet.activity.service;

import com.swp391.bookstreet.activity.dto.ActivityPageResponse;
import com.swp391.bookstreet.activity.dto.ActivityResponse;
import com.swp391.bookstreet.activity.dto.PartnerActivityRevisionResponse;
import com.swp391.bookstreet.activity.entity.Activity;
import com.swp391.bookstreet.activity.entity.ActivityStatus;
import com.swp391.bookstreet.activity.exception.ActivityApiException;
import com.swp391.bookstreet.activity.repository.ActivityRepository;
import com.swp391.bookstreet.activity.repository.ActivityRevisionRepository;
import com.swp391.bookstreet.activity.security.ActivityCurrentUser;
import com.swp391.bookstreet.booth.entity.Location;
import com.swp391.bookstreet.booth.repository.LocationRepository;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class PartnerActivityService {
    private final ActivityRepository activityRepository;
    private final ActivityRevisionRepository revisionRepository;
    private final LocationRepository locationRepository;
    private final ActivityCurrentUser currentUser;
    private final ActivityLifecycleService lifecycleService;
    private final ActivityLifecycleTransactionService lifecycleTransactions;

    public PartnerActivityService(ActivityRepository activityRepository,
            ActivityRevisionRepository revisionRepository,
            LocationRepository locationRepository, ActivityCurrentUser currentUser,
            ActivityLifecycleService lifecycleService,
            ActivityLifecycleTransactionService lifecycleTransactions) {
        this.activityRepository = activityRepository;
        this.revisionRepository = revisionRepository;
        this.locationRepository = locationRepository;
        this.currentUser = currentUser;
        this.lifecycleService = lifecycleService;
        this.lifecycleTransactions = lifecycleTransactions;
    }

    public ActivityPageResponse<ActivityResponse> list(int page, int size, String sort,
            Long eventId, String status, String search) {
        Long representativeUserId = currentUser.requirePartnerId();
        if (eventId != null && eventId <= 0) {
            throw new ActivityApiException(HttpStatus.BAD_REQUEST, "INVALID_FILTER",
                    "eventId must be positive.");
        }
        ActivityStatus statusFilter = parseStatus(status);
        lifecycleService.advanceDueActivities();
        var result = activityRepository.findForPartner(representativeUserId, eventId,
                statusFilter, normalizeSearch(search),
                ActivityPagination.of(page, size, sort));
        List<ActivityResponse> content = responses(result.getContent());
        return new ActivityPageResponse<>(content, result.getNumber(), result.getSize(),
                result.getTotalElements(), result.getTotalPages());
    }

    public ActivityResponse detail(Long activityId) {
        Long representativeUserId = currentUser.requirePartnerId();
        ownedActivity(activityId, representativeUserId);
        Activity current = lifecycleTransactions.advanceAndGet(activityId);
        return response(current);
    }

    public ActivityPageResponse<PartnerActivityRevisionResponse> revisions(Long activityId,
            int page, int size, String sort) {
        Long representativeUserId = currentUser.requirePartnerId();
        ownedActivity(activityId, representativeUserId);
        var result = revisionRepository.findByActivityId(activityId,
                ActivityPagination.revisions(page, size, sort));
        return new ActivityPageResponse<>(result.getContent().stream()
                .map(PartnerActivityRevisionResponse::from).toList(), result.getNumber(),
                result.getSize(), result.getTotalElements(), result.getTotalPages());
    }

    private List<ActivityResponse> responses(List<Activity> activities) {
        if (activities.isEmpty()) return List.of();
        Map<Long, Location> locations = new HashMap<>();
        locationRepository.findAllById(activities.stream().map(Activity::getLocationId)
                .distinct().toList()).forEach(value -> locations.put(value.getLocationId(), value));
        Map<Long, Long> partnerOrganizations = new HashMap<>();
        activityRepository.findPartnerOwnership(activities.stream()
                .map(Activity::getActivityId).toList()).forEach(value ->
                partnerOrganizations.put(value.getActivityId(),
                        value.getPartnerOrganizationId()));
        List<ActivityResponse> result = new ArrayList<>();
        for (Activity activity : activities) {
            Location location = locations.get(activity.getLocationId());
            Long partnerOrganizationId = partnerOrganizations.get(activity.getActivityId());
            if (location == null || partnerOrganizationId == null) throw notFound();
            result.add(ActivityResponse.partner(activity, location, partnerOrganizationId));
        }
        return List.copyOf(result);
    }

    private ActivityResponse response(Activity activity) {
        Location location = locationRepository.findById(activity.getLocationId())
                .orElseThrow(PartnerActivityService::notFound);
        Long partnerOrganizationId = activityRepository
                .findPartnerOwnership(List.of(activity.getActivityId())).stream()
                .findFirst().map(ActivityRepository.PartnerOwnership::getPartnerOrganizationId)
                .orElseThrow(PartnerActivityService::notFound);
        return ActivityResponse.partner(activity, location, partnerOrganizationId);
    }

    private Activity ownedActivity(Long activityId, Long representativeUserId) {
        return activityRepository.findOwnedByPartner(activityId, representativeUserId)
                .orElseThrow(PartnerActivityService::notFound);
    }

    private static ActivityStatus parseStatus(String status) {
        if (status == null || status.isBlank()) return null;
        try {
            return ActivityStatus.valueOf(status);
        } catch (IllegalArgumentException error) {
            throw new ActivityApiException(HttpStatus.BAD_REQUEST, "INVALID_FILTER",
                    "status is not a supported Activity status.");
        }
    }

    private static String normalizeSearch(String search) {
        if (search == null) return "";
        String normalized = search.trim();
        return normalized;
    }

    private static ActivityApiException notFound() {
        return new ActivityApiException(HttpStatus.NOT_FOUND,
                "ACTIVITY_NOT_FOUND", "Activity not found.");
    }
}
