package com.swp391.bookstreet.activity.service;

import com.swp391.bookstreet.activity.repository.ActivityPartnerNotificationContext;
import com.swp391.bookstreet.activity.repository.ActivityProposalRepository;
import com.swp391.bookstreet.activity.repository.ActivityRepository;
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
    private final ApplicationEventPublisher eventPublisher;

    public ActivityPartnerNotificationService(ActivityProposalRepository proposalRepository,
            ActivityRepository activityRepository, ApplicationEventPublisher eventPublisher) {
        this.proposalRepository = proposalRepository;
        this.activityRepository = activityRepository;
        this.eventPublisher = eventPublisher;
    }

    public void proposalChanged(Long proposalId, ActivityPartnerMessageType messageType,
            String detail, Instant occurredAt) {
        publish(proposalId, messageType, detail, occurredAt,
                proposalRepository.findPartnerNotificationContext(proposalId));
    }

    public void activityChanged(Long activityId, Long referenceId,
            ActivityPartnerMessageType messageType, String detail, Instant occurredAt) {
        publish(referenceId, messageType, detail, occurredAt,
                activityRepository.findPartnerNotificationContext(activityId));
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
