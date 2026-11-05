package com.swp391.bookstreet.activity.service;

import com.swp391.bookstreet.activity.repository.ActivityPartnerNotificationContext;
import com.swp391.bookstreet.activity.repository.ActivityProposalRepository;
import com.swp391.bookstreet.activity.repository.ActivityRepository;
import com.swp391.bookstreet.activity.repository.ActivityRequestRepository;
import com.swp391.bookstreet.activity.entity.Activity;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;

@Service
public class ActivityPartnerNotificationService {
    private static final Logger LOGGER =
            LoggerFactory.getLogger(ActivityPartnerNotificationService.class);

    private final ActivityProposalRepository proposalRepository;
    private final ActivityRepository activityRepository;
    private final ActivityRequestRepository requestRepository;
    private final ActivityPartnerOutcomeService outcomes;
    private final ApplicationEventPublisher eventPublisher;

    public ActivityPartnerNotificationService(ActivityProposalRepository proposalRepository,
            ActivityRepository activityRepository, ActivityRequestRepository requestRepository,
            ActivityPartnerOutcomeService outcomes, ApplicationEventPublisher eventPublisher) {
        this.proposalRepository = proposalRepository;
        this.activityRepository = activityRepository;
        this.requestRepository = requestRepository;
        this.outcomes = outcomes;
        this.eventPublisher = eventPublisher;
    }

    public void proposalChanged(Long proposalId, ActivityPartnerMessageType messageType,
            String detail, Instant occurredAt) {
        proposalRepository.findById(proposalId).ifPresent(outcomes::proposalChanged);
        publish(proposalId, messageType, detail, occurredAt,
                proposalRepository.findPartnerNotificationContext(proposalId));
    }

    public void activityChanged(Long activityId, Long referenceId,
            ActivityPartnerMessageType messageType, String detail, Instant occurredAt) {
        if (messageType == ActivityPartnerMessageType.ACTIVITY_CANCELLED_BY_ORGANIZER) {
            activityRepository.findById(activityId)
                    .ifPresent(activity -> outcomes.activityCancelled(activity, occurredAt));
        } else {
            requestRepository.findById(referenceId).ifPresent(outcomes::requestChanged);
        }
        publish(referenceId, messageType, detail, occurredAt,
                activityRepository.findPartnerNotificationContext(activityId));
    }

    public void activityCancelledBySystem(Activity activity, Instant occurredAt) {
        outcomes.activityCancelled(activity, occurredAt);
    }

    private void publish(Long referenceId, ActivityPartnerMessageType messageType,
            String detail, Instant occurredAt,
            Optional<ActivityPartnerNotificationContext> context) {
        if (context.isEmpty()) {
            LOGGER.debug("Activity Partner notification skipped because no Partner context "
                    + "exists for messageType={} and referenceId={}", messageType, referenceId);
            return;
        }
        ActivityPartnerNotificationContext value = context.get();
        List<String> recipients = value.getRecipientEmail() == null
                ? List.of() : List.of(value.getRecipientEmail());
        eventPublisher.publishEvent(new ActivityPartnerMessageRequested(
                referenceId, messageType, recipients, value.getEventName(),
                value.getActivityTitle(), detail, occurredAt));
    }
}
