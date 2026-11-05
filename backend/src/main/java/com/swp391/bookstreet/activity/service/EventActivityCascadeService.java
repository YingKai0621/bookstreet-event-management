package com.swp391.bookstreet.activity.service;

import com.swp391.bookstreet.attendance.service.ActivityParticipationLifecycleService;
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
    private final ActivityParticipationLifecycleService participation;
    private final ActivityPartnerNotificationService notificationService;

    public EventActivityCascadeService(LocationRepository locationRepository,
            ActivityProposalRepository proposalRepository,
            ActivityRepository activityRepository,
            ActivityRequestRepository requestRepository,
            ActivityPartnerNotificationService notificationService, ActivityParticipationLifecycleService participation) {
        this.locationRepository = locationRepository;
        this.proposalRepository = proposalRepository;
        this.activityRepository = activityRepository;
        this.requestRepository = requestRepository;
        this.notificationService = notificationService;
        this.participation = participation;
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public List<Long> cancelEvent(Long eventId, String reason, Instant now) {
        lockAffectedLocations(eventId);
        closeOpenProposals(eventId, now, false);
        List<Long> seatActiveActivityIds = new ArrayList<>();
        for (Activity activity : activityRepository.findByEventIdForUpdate(eventId)) {
            boolean wasSeatActive = activity.getStatus() == ActivityStatus.PUBLISHED
                    || activity.getStatus() == ActivityStatus.ONGOING;
            if (activity.getStatus() == ActivityStatus.DRAFT
                    || wasSeatActive) {
                activity.cancel(reason, ActivityCancellationSource.EVENT_CANCELLATION, now);
            }
            if (wasSeatActive) {
                seatActiveActivityIds.add(activity.getActivityId());
            }
            closePendingRequests(activity.getActivityId(), now, false);
        }
        return List.copyOf(seatActiveActivityIds);
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void completeEvent(Long eventId, Instant now) {
        lockAffectedLocations(eventId);
        closeOpenProposals(eventId, now, true);
        for (Activity activity : activityRepository.findByEventIdForUpdate(eventId)) {
            activity.advanceTimedLifecycle(now);
            boolean cancelledBySystem = activity.getStatus() == ActivityStatus.DRAFT;
            if (activity.getStatus() == ActivityStatus.DRAFT) {
                activity.cancel(EVENT_COMPLETION_REASON,
                        ActivityCancellationSource.SYSTEM, now);
                notificationService.activityCancelledBySystem(activity, now);
            }
            closePendingRequests(activity.getActivityId(), now, !cancelledBySystem);
            participation.finalizeCompleted(activity, now);
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

    private void closeOpenProposals(Long eventId, Instant now, boolean notifySystemClosure) {
        proposalRepository.findByEventIdAndStatusInForUpdate(eventId, OPEN_PROPOSAL_STATUSES)
                .forEach(proposal -> {
                    if (proposal.cancelIfOpen(now) && notifySystemClosure) {
                        notificationService.proposalChanged(proposal.getActivityProposalId(),
                                ActivityPartnerMessageType.PROPOSAL_CLOSED_BY_SYSTEM,
                                "The proposal was closed because the Event completed.", now);
                    }
                });
    }

    private void closePendingRequests(Long activityId, Instant now,
            boolean notifySystemClosure) {
        requestRepository.findPendingByActivityIdForUpdate(activityId)
                .forEach(request -> {
                    if (request.cancelIfPending(now) && notifySystemClosure) {
                        notificationService.activityChanged(activityId,
                                request.getActivityRequestId(),
                                ActivityPartnerMessageType.REQUEST_CLOSED_BY_SYSTEM,
                                "The request was closed because the Event completed.", now);
                    }
                });
    }
}
