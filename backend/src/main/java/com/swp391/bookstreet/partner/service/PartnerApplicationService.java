package com.swp391.bookstreet.partner.service;

import com.swp391.bookstreet.event.entity.Event;
import com.swp391.bookstreet.event.entity.EventStatus;
import com.swp391.bookstreet.event.service.EventRootLockService;
import com.swp391.bookstreet.notification.service.OrganizerWorkItemNotificationService;
import com.swp391.bookstreet.partner.dto.PartnerApplicationResponse;
import com.swp391.bookstreet.partner.dto.SubmitPartnerApplicationRequest;
import com.swp391.bookstreet.partner.entity.PartnerEventApplication;
import com.swp391.bookstreet.partner.entity.PartnerOrganization;
import com.swp391.bookstreet.partner.repository.PartnerEventApplicationRepository;
import com.swp391.bookstreet.partner.repository.PartnerOrganizationRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;

@Service
@Transactional(readOnly = true)
public class PartnerApplicationService {

    private final PartnerOrganizationRepository organizationRepository;
    private final PartnerOrganizationGuard organizationGuard;
    private final PartnerEventApplicationRepository applicationRepository;
    private final EventRootLockService eventRootLockService;
    private final OrganizerWorkItemNotificationService organizerNotifications;
    private final Clock clock;

    public PartnerApplicationService(
            PartnerOrganizationRepository organizationRepository,
            PartnerOrganizationGuard organizationGuard,
            PartnerEventApplicationRepository applicationRepository,
            EventRootLockService eventRootLockService,
            OrganizerWorkItemNotificationService organizerNotifications,
            Clock clock
    ) {
        this.organizationRepository = organizationRepository;
        this.organizationGuard = organizationGuard;
        this.applicationRepository = applicationRepository;
        this.eventRootLockService = eventRootLockService;
        this.organizerNotifications = organizerNotifications;
        this.clock = clock;
    }

    @Transactional
    public PartnerApplicationResponse submit(
            Long representativeUserId,
            Long eventId,
            SubmitPartnerApplicationRequest request
    ) {
        PartnerOrganization organization = organizationRepository
                .findByRepresentativeUserId(representativeUserId)
                .orElseThrow(() -> new PartnerApiException(
                        HttpStatus.CONFLICT,
                        "PARTNER_ORGANIZATION_REQUIRED",
                        "A Partner Organization is required to apply."
                ));
        organizationGuard.requireActive(organization);

        Event event = eventRootLockService.lock(eventId)
                .orElseThrow(() -> new PartnerApiException(
                        HttpStatus.NOT_FOUND,
                        "EVENT_NOT_FOUND",
                        "Event was not found."
                ));

        if (event.getStatus() != EventStatus.PUBLISHED) {
            throw new PartnerApiException(
                    HttpStatus.CONFLICT,
                    "EVENT_NOT_ACCEPTING_APPLICATIONS",
                    "The Event is not accepting Partner applications."
            );
        }

        Instant now = clock.instant();
        if (event.getPartnerApplicationDeadlineAt() != null
                && !now.isBefore(event.getPartnerApplicationDeadlineAt())) {
            throw new PartnerApiException(
                    HttpStatus.CONFLICT,
                    "APPLICATION_DEADLINE_PASSED",
                    "The Partner application deadline has passed."
            );
        }

        if (applicationRepository.existsByPartnerOrganization_IdAndEventId(
                organization.getId(), eventId
        )) {
            throw duplicateApplication();
        }

        PartnerEventApplication application = PartnerEventApplication.submit(
                organization,
                eventId,
                request.applicationNote(),
                now
        );
        try {
            application = applicationRepository.saveAndFlush(application);
        } catch (DataIntegrityViolationException exception) {
            throw duplicateApplication();
        }
        organizerNotifications.applicationSubmitted(event, application);
        return PartnerApplicationResponse.from(application);
    }

    @Transactional
    public PartnerApplicationResponse withdraw(Long representativeUserId, Long applicationId) {
        PartnerEventApplication application = applicationRepository
                .findWithLockByIdAndPartnerOrganization_RepresentativeUserId(
                        applicationId,
                        representativeUserId
                )
                .orElseThrow(() -> new PartnerApiException(
                        HttpStatus.NOT_FOUND,
                        "APPLICATION_NOT_FOUND",
                        "Application was not found."
                ));

        if (application.getStatus() != PartnerEventApplication.ApplicationStatus.PENDING) {
            throw new PartnerApiException(
                    HttpStatus.CONFLICT,
                    "APPLICATION_NOT_PENDING",
                    "Only a Pending application can be withdrawn."
            );
        }

        application.withdraw(Instant.now());
        return PartnerApplicationResponse.from(application);
    }

    private static PartnerApiException duplicateApplication() {
        return new PartnerApiException(
                HttpStatus.CONFLICT,
                "APPLICATION_ALREADY_EXISTS",
                "An application already exists for this Partner and Event."
        );
    }
}
