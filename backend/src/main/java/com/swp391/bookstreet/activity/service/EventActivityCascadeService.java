package com.swp391.bookstreet.activity.service;

import com.swp391.bookstreet.activity.entity.Activity;
import com.swp391.bookstreet.activity.entity.ActivityCancellationSource;
import com.swp391.bookstreet.activity.entity.ActivityProposalStatus;
import com.swp391.bookstreet.activity.entity.ActivityStatus;
import com.swp391.bookstreet.activity.repository.ActivityProposalRepository;
import com.swp391.bookstreet.activity.repository.ActivityRepository;
import com.swp391.bookstreet.activity.repository.ActivityRequestRepository;
import com.swp391.bookstreet.booth.repository.LocationRepository;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class EventActivityCascadeService {
    public static final String EVENT_COMPLETION_REASON =
            "Sự kiện đã kết thúc trước khi hoạt động được công bố.";
    private static final List<ActivityProposalStatus> OPEN_PROPOSAL_STATUSES = List.of(
            ActivityProposalStatus.PENDING, ActivityProposalStatus.NEED_CHANGES);

    private final LocationRepository locationRepository;
    private final ActivityProposalRepository proposalRepository;
    private final ActivityRepository activityRepository;
    private final ActivityRequestRepository requestRepository;

    public EventActivityCascadeService(LocationRepository locationRepository,
            ActivityProposalRepository proposalRepository,
            ActivityRepository activityRepository,
            ActivityRequestRepository requestRepository) {
        this.locationRepository = locationRepository;
        this.proposalRepository = proposalRepository;
        this.activityRepository = activityRepository;
        this.requestRepository = requestRepository;
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void cancelEvent(Long eventId, String reason, Instant now) {
        lockAffectedLocations(eventId);
        closeOpenProposals(eventId, now);
        for (Activity activity : activityRepository.findByEventIdForUpdate(eventId)) {
            if (activity.getStatus() == ActivityStatus.DRAFT
                    || activity.getStatus() == ActivityStatus.PUBLISHED
                    || activity.getStatus() == ActivityStatus.ONGOING) {
                activity.cancel(reason, ActivityCancellationSource.EVENT_CANCELLATION, now);
            }
            closePendingRequests(activity.getActivityId(), now);
        }
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void completeEvent(Long eventId, Instant now) {
        lockAffectedLocations(eventId);
        closeOpenProposals(eventId, now);
        for (Activity activity : activityRepository.findByEventIdForUpdate(eventId)) {
            activity.advanceTimedLifecycle(now);
            if (activity.getStatus() == ActivityStatus.DRAFT) {
                activity.cancel(EVENT_COMPLETION_REASON,
                        ActivityCancellationSource.SYSTEM, now);
            }
            closePendingRequests(activity.getActivityId(), now);
        }
    }

    private void lockAffectedLocations(Long eventId) {
        List<Long> locationIds = new ArrayList<>(
                activityRepository.findNonCancelledLocationIdsByEventId(eventId));
        locationIds.addAll(proposalRepository.findLocationIdsByEventIdAndStatusIn(
                eventId, OPEN_PROPOSAL_STATUSES));
        List<Long> orderedIds = locationIds.stream().distinct().sorted().toList();
        if (!orderedIds.isEmpty()) {
            locationRepository.findAllByIdForUpdateOrderById(orderedIds);
        }
    }

    private void closeOpenProposals(Long eventId, Instant now) {
        proposalRepository.findByEventIdAndStatusInForUpdate(eventId, OPEN_PROPOSAL_STATUSES)
                .forEach(proposal -> proposal.cancelIfOpen(now));
    }

    private void closePendingRequests(Long activityId, Instant now) {
        requestRepository.findPendingByActivityIdForUpdate(activityId)
                .forEach(request -> request.cancelIfPending(now));
    }
}
