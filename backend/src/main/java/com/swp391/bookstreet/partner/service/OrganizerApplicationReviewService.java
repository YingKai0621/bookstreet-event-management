package com.swp391.bookstreet.partner.service;

import com.swp391.bookstreet.event.entity.Event;
import com.swp391.bookstreet.event.entity.EventStatus;
import com.swp391.bookstreet.event.service.EventRootLockService;
import com.swp391.bookstreet.partner.dto.OrganizerApplicationResponse;
import com.swp391.bookstreet.partner.dto.ReviewPartnerApplicationRequest;
import com.swp391.bookstreet.partner.entity.PartnerEventApplication;
import com.swp391.bookstreet.partner.repository.PartnerEventApplicationRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;

@Service
public class OrganizerApplicationReviewService {

    private final PartnerEventApplicationRepository applicationRepository;
    private final EventRootLockService eventRootLockService;
    private final PartnerOrganizationGuard organizationGuard;
    private final PartnerOutcomeNotificationService outcomeNotifications;
    private final Clock clock;

    public OrganizerApplicationReviewService(
            PartnerEventApplicationRepository applicationRepository,
            EventRootLockService eventRootLockService,
            PartnerOrganizationGuard organizationGuard,
            PartnerOutcomeNotificationService outcomeNotifications,
            Clock clock
    ) {
        this.applicationRepository = applicationRepository;
        this.eventRootLockService = eventRootLockService;
        this.organizationGuard = organizationGuard;
        this.outcomeNotifications = outcomeNotifications;
        this.clock = clock;
    }

    @Transactional
    public OrganizerApplicationResponse approve(
            Long applicationId,
            Long organizerUserId,
            ReviewPartnerApplicationRequest request
    ) {
        return review(
                applicationId,
                organizerUserId,
                request,
                PartnerEventApplication.ApplicationStatus.APPROVED
        );
    }

    @Transactional
    public OrganizerApplicationResponse reject(
            Long applicationId,
            Long organizerUserId,
            ReviewPartnerApplicationRequest request
    ) {
        return review(
                applicationId,
                organizerUserId,
                request,
                PartnerEventApplication.ApplicationStatus.REJECTED
        );
    }

    private OrganizerApplicationResponse review(
            Long applicationId,
            Long organizerUserId,
            ReviewPartnerApplicationRequest request,
            PartnerEventApplication.ApplicationStatus decision
    ) {
        Long eventId = applicationRepository.findEventIdById(applicationId)
                .orElseThrow(() -> new PartnerApiException(
                        HttpStatus.NOT_FOUND,
                        "APPLICATION_NOT_FOUND",
                        "Application was not found."
                ));

        Event event = eventRootLockService.lock(eventId)
                .orElseThrow(() -> new PartnerApiException(
                        HttpStatus.NOT_FOUND,
                        "APPLICATION_NOT_FOUND",
                        "Application was not found."
                ));
        if (!event.getOrganizerUserId().equals(organizerUserId)) {
            throw new PartnerApiException(
                    HttpStatus.FORBIDDEN,
                    "EVENT_ACCESS_DENIED",
                    "You do not have access to this Event."
            );
        }
        PartnerEventApplication application = applicationRepository
                .findWithLockById(applicationId)
                .filter(candidate -> candidate.getEventId().equals(eventId))
                .orElseThrow(() -> new PartnerApiException(
                        HttpStatus.NOT_FOUND,
                        "APPLICATION_NOT_FOUND",
                        "Application was not found."
                ));

        if (decision == PartnerEventApplication.ApplicationStatus.APPROVED) {
            organizationGuard.requireActive(application.getPartnerOrganization());
        }
        if (event.getStatus() == EventStatus.CANCELLED) {
            throw new PartnerApiException(
                    HttpStatus.CONFLICT,
                    "EVENT_NOT_ACCEPTING_APPLICATIONS",
                    "Applications for a Cancelled Event can no longer be reviewed."
            );
        }

        if (application.getStatus() != PartnerEventApplication.ApplicationStatus.PENDING) {
            throw new PartnerApiException(
                    HttpStatus.CONFLICT,
                    "APPLICATION_NOT_PENDING",
                    "Only a Pending application can be reviewed."
            );
        }

        String reviewNote = request == null ? null : request.reviewNote();
        if (decision == PartnerEventApplication.ApplicationStatus.APPROVED) {
            application.approve(reviewNote, clock.instant());
        } else {
            application.reject(reviewNote, clock.instant());
        }
        outcomeNotifications.applicationReviewed(application);

        return new OrganizerApplicationResponse(
                application.getId(),
                application.getEventId(),
                application.getPartnerOrganization().getId(),
                application.getPartnerOrganization().getName(),
                application.getPartnerOrganization().getStatus().name(),
                application.getPartnerOrganization().getCategoryCode(),
                application.getStatus().name(),
                application.getApplicationNote(),
                application.getReviewNote(),
                application.getSubmittedAt(),
                application.getReviewedAt(),
                application.getWithdrawnAt()
        );
    }
}
