package com.swp391.bookstreet.activity.service;

import com.swp391.bookstreet.activity.repository.ActivityPartnerNotificationContext;
import com.swp391.bookstreet.activity.repository.ActivityProposalRepository;
import com.swp391.bookstreet.activity.repository.ActivityRepository;
import com.swp391.bookstreet.activity.repository.ActivityRequestRepository;
import java.time.Instant;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.context.ApplicationEventPublisher;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class ActivityPartnerNotificationServiceTests {

    @Test
    void proposalNotificationCapturesRecipientAndCommittedFacts() {
        ActivityProposalRepository proposals = mock(ActivityProposalRepository.class);
        ActivityRepository activities = mock(ActivityRepository.class);
        ApplicationEventPublisher publisher = mock(ApplicationEventPublisher.class);
        ActivityPartnerNotificationContext context =
                mock(ActivityPartnerNotificationContext.class);
        when(context.getRecipientEmail()).thenReturn(" Partner@Example.com ");
        when(context.getEventName()).thenReturn("BookStreet Festival");
        when(context.getActivityTitle()).thenReturn("Author Talk");
        when(proposals.findPartnerNotificationContext(42L))
                .thenReturn(Optional.of(context));
        var service = new ActivityPartnerNotificationService(proposals, activities,
                mock(ActivityRequestRepository.class), mock(ActivityPartnerOutcomeService.class), publisher);
        Instant occurredAt = Instant.parse("2026-10-17T04:00:00Z");

        service.proposalChanged(42L, ActivityPartnerMessageType.PROPOSAL_APPROVED,
                "Approved by the Organizer.", occurredAt);

        ArgumentCaptor<ActivityPartnerMessageRequested> captor =
                ArgumentCaptor.forClass(ActivityPartnerMessageRequested.class);
        verify(publisher).publishEvent(captor.capture());
        ActivityPartnerMessageRequested event = captor.getValue();
        assertThat(event.referenceId()).isEqualTo(42L);
        assertThat(event.recipientEmails()).containsExactly("partner@example.com");
        assertThat(event.eventName()).isEqualTo("BookStreet Festival");
        assertThat(event.activityTitle()).isEqualTo("Author Talk");
        assertThat(event.occurredAt()).isEqualTo(occurredAt);
    }

    @Test
    void directOrganizerActivityWithoutPartnerContextPublishesNothing() {
        ActivityProposalRepository proposals = mock(ActivityProposalRepository.class);
        ActivityRepository activities = mock(ActivityRepository.class);
        ApplicationEventPublisher publisher = mock(ApplicationEventPublisher.class);
        when(activities.findPartnerNotificationContext(91L)).thenReturn(Optional.empty());
        var service = new ActivityPartnerNotificationService(proposals, activities,
                mock(ActivityRequestRepository.class), mock(ActivityPartnerOutcomeService.class), publisher);

        service.activityChanged(91L, 91L,
                ActivityPartnerMessageType.ACTIVITY_CANCELLED_BY_ORGANIZER,
                "Cancelled by the Organizer.", Instant.parse("2026-10-17T04:00:00Z"));

        verifyNoInteractions(publisher);
    }
}
