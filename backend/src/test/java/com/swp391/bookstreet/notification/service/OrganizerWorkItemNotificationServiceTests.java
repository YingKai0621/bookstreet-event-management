package com.swp391.bookstreet.notification.service;

import com.swp391.bookstreet.activity.entity.ActivityProposal;
import com.swp391.bookstreet.activity.entity.ActivityProposalStatus;
import com.swp391.bookstreet.activity.entity.ActivityRequest;
import com.swp391.bookstreet.activity.entity.ActivityRequestStatus;
import com.swp391.bookstreet.activity.entity.ActivityRequestType;
import com.swp391.bookstreet.booth.entity.BoothRequest;
import com.swp391.bookstreet.booth.entity.BoothRequestStatus;
import com.swp391.bookstreet.event.entity.Event;
import com.swp391.bookstreet.notification.entity.NotificationRecipientRole;
import com.swp391.bookstreet.notification.entity.NotificationType;
import com.swp391.bookstreet.partner.entity.PartnerEventApplication;
import java.time.Instant;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class OrganizerWorkItemNotificationServiceTests {
    private static final Long ORGANIZER_ID = 42L;
    private static final Instant TRANSITION_AT = Instant.parse("2026-11-05T08:30:00Z");

    private NotificationWriter writer;
    private OrganizerWorkItemNotificationService service;
    private Event event;

    @BeforeEach
    void setUp() {
        writer = mock(NotificationWriter.class);
        service = new OrganizerWorkItemNotificationService(writer);
        event = mock(Event.class);
        when(event.getOrganizerUserId()).thenReturn(ORGANIZER_ID);
    }

    @Test
    void submissionsUseOrganizerOwnerAudienceAndTheirExactWorkItemReference() {
        PartnerEventApplication application = mock(PartnerEventApplication.class);
        when(application.getStatus()).thenReturn(PartnerEventApplication.ApplicationStatus.PENDING);
        when(application.getSubmittedAt()).thenReturn(TRANSITION_AT);
        when(application.getId()).thenReturn(101L);
        service.applicationSubmitted(event, application);

        BoothRequest boothRequest = mock(BoothRequest.class);
        when(boothRequest.getStatus()).thenReturn(BoothRequestStatus.PENDING);
        when(boothRequest.getSubmittedAt()).thenReturn(TRANSITION_AT);
        when(boothRequest.getBoothRequestId()).thenReturn(202L);
        service.boothRequestSubmitted(event, boothRequest);

        ActivityProposal proposal = mock(ActivityProposal.class);
        when(proposal.getStatus()).thenReturn(ActivityProposalStatus.PENDING);
        when(proposal.getSubmittedAt()).thenReturn(TRANSITION_AT);
        when(proposal.getActivityProposalId()).thenReturn(303L);
        service.activityProposalSubmitted(event, proposal, false);

        ActivityRequest change = mock(ActivityRequest.class);
        when(change.getStatus()).thenReturn(ActivityRequestStatus.PENDING);
        when(change.getRequestType()).thenReturn(ActivityRequestType.CHANGE);
        when(change.getSubmittedAt()).thenReturn(TRANSITION_AT);
        when(change.getActivityRequestId()).thenReturn(404L);
        service.activityChangeRequestSubmitted(event, change);

        ActivityRequest cancellation = mock(ActivityRequest.class);
        when(cancellation.getStatus()).thenReturn(ActivityRequestStatus.PENDING);
        when(cancellation.getRequestType()).thenReturn(ActivityRequestType.CANCELLATION);
        when(cancellation.getSubmittedAt()).thenReturn(TRANSITION_AT);
        when(cancellation.getActivityRequestId()).thenReturn(505L);
        when(cancellation.isLate()).thenReturn(true);
        service.activityCancellationRequestSubmitted(event, cancellation);

        ArgumentCaptor<NotificationCommand> captor = ArgumentCaptor.forClass(NotificationCommand.class);
        verify(writer, org.mockito.Mockito.times(5)).write(captor.capture());
        assertCommand(captor.getAllValues().get(0), NotificationType.ORGANIZER_NEW_PARTNER_APPLICATION, 101L, null, null, null);
        assertCommand(captor.getAllValues().get(1), NotificationType.ORGANIZER_NEW_BOOTH_REQUEST, null, 202L, null, null);
        assertCommand(captor.getAllValues().get(2), NotificationType.ORGANIZER_ACTIVITY_PROPOSAL_SUBMITTED, null, null, 303L, null);
        assertCommand(captor.getAllValues().get(3), NotificationType.ORGANIZER_NEW_ACTIVITY_CHANGE_REQUEST, null, null, null, 404L);
        assertCommand(captor.getAllValues().get(4), NotificationType.ORGANIZER_NEW_ACTIVITY_CANCELLATION_REQUEST, null, null, null, 505L);
        NotificationCommand lateCancellation = captor.getAllValues().get(4);
        assertThat(lateCancellation.message()).contains("gửi trễ");
        assertThat(lateCancellation.message()).doesNotContain("isLate", "cutoff");
    }

    @Test
    void proposalResubmissionUsesItsUpdatedTransitionAndCreatesANewDeduplicationKey() {
        ActivityProposal proposal = mock(ActivityProposal.class);
        when(proposal.getStatus()).thenReturn(ActivityProposalStatus.PENDING);
        when(proposal.getActivityProposalId()).thenReturn(303L);
        when(proposal.getSubmittedAt()).thenReturn(TRANSITION_AT.minusSeconds(60));
        when(proposal.getUpdatedAt()).thenReturn(TRANSITION_AT);

        service.activityProposalSubmitted(event, proposal, true);

        ArgumentCaptor<NotificationCommand> captor = ArgumentCaptor.forClass(NotificationCommand.class);
        verify(writer).write(captor.capture());
        assertThat(captor.getValue().createdAt()).isEqualTo(TRANSITION_AT);
        assertThat(captor.getValue().deduplicationKey()).contains(TRANSITION_AT.toString());
        assertThat(captor.getValue().title()).contains("gửi lại");
    }

    @Test
    void nonPendingTransitionsAndMismatchedActivityRequestKindsAreSuppressed() {
        PartnerEventApplication withdrawnApplication = mock(PartnerEventApplication.class);
        when(withdrawnApplication.getStatus())
                .thenReturn(PartnerEventApplication.ApplicationStatus.WITHDRAWN);
        service.applicationSubmitted(event, withdrawnApplication);

        BoothRequest withdrawnBoothRequest = mock(BoothRequest.class);
        when(withdrawnBoothRequest.getStatus()).thenReturn(BoothRequestStatus.WITHDRAWN);
        service.boothRequestSubmitted(event, withdrawnBoothRequest);

        ActivityRequest changeRequest = mock(ActivityRequest.class);
        when(changeRequest.getStatus()).thenReturn(ActivityRequestStatus.PENDING);
        when(changeRequest.getRequestType()).thenReturn(ActivityRequestType.CHANGE);
        service.activityCancellationRequestSubmitted(event, changeRequest);

        ActivityRequest cancellationRequest = mock(ActivityRequest.class);
        when(cancellationRequest.getStatus()).thenReturn(ActivityRequestStatus.PENDING);
        when(cancellationRequest.getRequestType()).thenReturn(ActivityRequestType.CANCELLATION);
        service.activityChangeRequestSubmitted(event, cancellationRequest);

        verify(writer, never()).write(any());
    }

    @Test
    void reselectionReferencesReleasedRequestAndOnlyAcceptedTerminalStates() {
        BoothRequest releasedRequest = mock(BoothRequest.class);
        when(releasedRequest.getBoothRequestId()).thenReturn(909L);
        when(releasedRequest.getStatus()).thenReturn(BoothRequestStatus.PAYMENT_EXPIRED);
        when(releasedRequest.getPaymentExpiredAt()).thenReturn(TRANSITION_AT);

        service.boothReselectionRequired(event, releasedRequest);

        ArgumentCaptor<NotificationCommand> captor = ArgumentCaptor.forClass(NotificationCommand.class);
        verify(writer).write(captor.capture());
        assertThat(captor.getValue().recipientUserId()).isEqualTo(ORGANIZER_ID);
        assertThat(captor.getValue().recipientRole()).isEqualTo(NotificationRecipientRole.ORGANIZER);
        assertThat(captor.getValue().type()).isEqualTo(NotificationType.ORGANIZER_BOOTH_RESELECTION_REQUIRED);
        assertThat(captor.getValue().boothRequestId()).isEqualTo(909L);
        assertThat(captor.getValue().createdAt()).isEqualTo(TRANSITION_AT);

        when(releasedRequest.getStatus()).thenReturn(BoothRequestStatus.PENDING);
        service.boothReselectionRequired(event, releasedRequest);
        verify(writer, org.mockito.Mockito.times(1)).write(any());
    }

    private void assertCommand(NotificationCommand command, NotificationType type,
            Long applicationId, Long boothRequestId, Long proposalId, Long activityRequestId) {
        assertThat(command.recipientUserId()).isEqualTo(ORGANIZER_ID);
        assertThat(command.recipientRole()).isEqualTo(NotificationRecipientRole.ORGANIZER);
        assertThat(command.type()).isEqualTo(type);
        assertThat(command.partnerEventApplicationId()).isEqualTo(applicationId);
        assertThat(command.boothRequestId()).isEqualTo(boothRequestId);
        assertThat(command.activityProposalId()).isEqualTo(proposalId);
        assertThat(command.activityRequestId()).isEqualTo(activityRequestId);
        assertThat(command.createdAt()).isEqualTo(TRANSITION_AT);
    }
}
