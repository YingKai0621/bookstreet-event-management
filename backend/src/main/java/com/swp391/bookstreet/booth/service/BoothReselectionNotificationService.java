package com.swp391.bookstreet.booth.service;

import com.swp391.bookstreet.booth.entity.BoothRequest;
import com.swp391.bookstreet.event.entity.Event;
import com.swp391.bookstreet.notification.service.OrganizerWorkItemNotificationService;
import java.time.Instant;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** Creates the Organizer work item only while another Booth candidate is selectable. */
@Service
public class BoothReselectionNotificationService {
    private final BoothSelectionEligibilityService selectionEligibility;
    private final OrganizerWorkItemNotificationService organizerNotifications;

    public BoothReselectionNotificationService(
            BoothSelectionEligibilityService selectionEligibility,
            OrganizerWorkItemNotificationService organizerNotifications) {
        this.selectionEligibility = selectionEligibility;
        this.organizerNotifications = organizerNotifications;
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void notifyIfEligible(Event event, BoothRequest releasedRequest,
            Instant releasedAt) {
        if (selectionEligibility.hasEligibleAlternative(event, releasedRequest, releasedAt)) {
            organizerNotifications.boothReselectionRequired(event, releasedRequest);
        }
    }
}
