package com.swp391.bookstreet.partner.service;

import com.swp391.bookstreet.partner.dto.OrganizerApplicationResponse;
import com.swp391.bookstreet.partner.dto.ReviewPartnerApplicationRequest;
import com.swp391.bookstreet.partner.entity.PartnerEventApplication;
import com.swp391.bookstreet.partner.repository.PartnerEventApplicationRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

@Service
public class OrganizerApplicationReviewService {

    private final PartnerEventApplicationRepository applicationRepository;

    public OrganizerApplicationReviewService(
            PartnerEventApplicationRepository applicationRepository
    ) {
        this.applicationRepository = applicationRepository;
    }

    @Transactional
    public OrganizerApplicationResponse approve(
            Long applicationId,
            Long organizerUserId,
            ReviewPartnerApplicationRequest request
    ) {
        PartnerEventApplication application = applicationRepository
                .findWithLockById(applicationId)
                .orElseThrow(() -> new PartnerApiException(
                        HttpStatus.NOT_FOUND,
                        "APPLICATION_NOT_FOUND",
                        "Application was not found."
                ));

        if (!applicationRepository.existsByIdAndEventOrganizerUserId(
                applicationId,
                organizerUserId
        )) {
            throw new PartnerApiException(
                    HttpStatus.FORBIDDEN,
                    "EVENT_ACCESS_DENIED",
                    "You do not have access to this Event."
            );
        }

        if (application.getStatus() != PartnerEventApplication.ApplicationStatus.PENDING) {
            throw new PartnerApiException(
                    HttpStatus.CONFLICT,
                    "APPLICATION_NOT_PENDING",
                    "Only a Pending application can be approved."
            );
        }

        String reviewNote = request == null ? null : request.reviewNote();
        application.approve(reviewNote, Instant.now());

        return new OrganizerApplicationResponse(
                application.getId(),
                application.getEventId(),
                application.getPartnerOrganization().getId(),
                application.getPartnerOrganization().getName(),
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
