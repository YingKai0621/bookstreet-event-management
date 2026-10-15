package com.swp391.bookstreet.partner.service;

import com.swp391.bookstreet.event.entity.Event;
import com.swp391.bookstreet.event.entity.EventStatus;
import com.swp391.bookstreet.event.service.EventRootLockService;
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
    private final PartnerEventApplicationRepository applicationRepository;
    private final EventRootLockService eventRootLockService;
    private final Clock clock;

    public PartnerApplicationService(
            PartnerOrganizationRepository organizationRepository,
            PartnerEventApplicationRepository applicationRepository,
            EventRootLockService eventRootLockService,
            Clock clock
    ) {
        this.organizationRepository = organizationRepository;
        this.applicationRepository = applicationRepository;
        this.eventRootLockService = eventRootLockService;
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
                .filter(candidate -> candidate.getStatus()
                        == PartnerOrganization.OrganizationStatus.ACTIVE)
                .orElseThrow(() -> new PartnerApiException(
                        HttpStatus.CONFLICT,
                        "PARTNER_ORGANIZATION_REQUIRED",
                        "An active Partner Organization is required to apply."
                ));

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
            return PartnerApplicationResponse.from(applicationRepository.saveAndFlush(application));
        } catch (DataIntegrityViolationException exception) {
            throw duplicateApplication();
        }
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
