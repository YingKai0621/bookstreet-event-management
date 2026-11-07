package com.swp391.bookstreet.partner.service;

import com.swp391.bookstreet.booth.entity.BoothRequest;
import com.swp391.bookstreet.booth.entity.BoothRequestStatus;
import com.swp391.bookstreet.notification.entity.NotificationType;
import com.swp391.bookstreet.notification.service.NotificationCommand;
import com.swp391.bookstreet.notification.service.NotificationWriter;
import com.swp391.bookstreet.partner.entity.PartnerEventApplication;
import com.swp391.bookstreet.partner.entity.PartnerOrganization;
import com.swp391.bookstreet.partner.repository.PartnerEventApplicationRepository;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class PartnerOutcomeNotificationServiceTests {
    private final NotificationWriter writer = mock(NotificationWriter.class);
    private final PartnerOutcomeNotificationService service = new PartnerOutcomeNotificationService(
            writer, mock(PartnerEventApplicationRepository.class),
            mock(com.swp391.bookstreet.partner.repository.PartnerOrganizationRepository.class));

    @Test
    void selectedAndCompletedUseDifferentPersistedTransitionKeys() {
        BoothRequest request = request(BoothRequestStatus.SELECTED);
        Instant selectedAt = Instant.parse("2026-11-05T10:00:00Z");
        when(request.getSelectedAt()).thenReturn(selectedAt);
        service.boothChanged(request);

        when(request.getStatus()).thenReturn(BoothRequestStatus.COMPLETED);
        when(request.getCompletedAt()).thenReturn(selectedAt.plusSeconds(60));
        service.boothChanged(request);

        ArgumentCaptor<NotificationCommand> commands = ArgumentCaptor.forClass(NotificationCommand.class);
        verify(writer, org.mockito.Mockito.times(2)).write(commands.capture());
        assertThat(commands.getAllValues()).extracting(NotificationCommand::deduplicationKey)
                .containsExactly("partner:booth:17:SELECTED:" + selectedAt,
                        "partner:booth:17:COMPLETED:" + selectedAt.plusSeconds(60));
        assertThat(commands.getAllValues()).allSatisfy(command -> {
            assertThat(command.recipientUserId()).isEqualTo(42L);
            assertThat(command.type()).isEqualTo(NotificationType.PARTNER_BOOTH_REQUEST_STATUS_CHANGED);
            assertThat(command.boothRequestId()).isEqualTo(17L);
        });
    }

    @Test
    void withdrawalAndIndividualPaymentFailureHaveNoPartnerOutcome() {
        service.boothChanged(request(BoothRequestStatus.WITHDRAWN));
        service.boothChanged(request(BoothRequestStatus.PENDING));
        verifyNoInteractions(writer);
    }

    private BoothRequest request(BoothRequestStatus status) {
        BoothRequest request = mock(BoothRequest.class);
        PartnerEventApplication application = mock(PartnerEventApplication.class);
        PartnerOrganization organization = mock(PartnerOrganization.class);
        when(request.getStatus()).thenReturn(status);
        when(request.getBoothRequestId()).thenReturn(17L);
        when(request.getApplication()).thenReturn(application);
        when(application.getPartnerOrganization()).thenReturn(organization);
        when(organization.getRepresentativeUserId()).thenReturn(42L);
        return request;
    }
}
