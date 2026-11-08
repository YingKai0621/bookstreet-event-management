package com.swp391.bookstreet.partner.service;

import com.swp391.bookstreet.partner.dto.OrganizerApplicationResponse;
import com.swp391.bookstreet.partner.repository.OrganizerApplicationRow;
import com.swp391.bookstreet.partner.repository.PartnerEventApplicationRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

@Service
@Transactional(readOnly = true)
public class OrganizerApplicationQueryService {

    private final PartnerEventApplicationRepository applicationRepository;

    public OrganizerApplicationQueryService(
            PartnerEventApplicationRepository applicationRepository
    ) {
        this.applicationRepository = applicationRepository;
    }

    public Page<OrganizerApplicationResponse> findEventApplications(
            Long eventId,
            Long organizerUserId,
            String status,
            Pageable pageable
    ) {
        PartnerPagination.validateSort(pageable);

        if (status != null && !java.util.Set.of(
                "PENDING", "APPROVED", "REJECTED", "WITHDRAWN"
        ).contains(status)) {
            throw new PartnerApiException(
                    HttpStatus.BAD_REQUEST,
                    "INVALID_APPLICATION_STATUS",
                    "Status must be PENDING, APPROVED, REJECTED or WITHDRAWN."
            );
        }

        if (!applicationRepository.existsEventById(eventId)) {
            throw new PartnerApiException(
                    HttpStatus.NOT_FOUND,
                    "EVENT_NOT_FOUND",
                    "Event was not found."
            );
        }

        if (!applicationRepository.existsEventByIdAndOrganizerUserId(eventId, organizerUserId)) {
            throw new PartnerApiException(
                    HttpStatus.FORBIDDEN,
                    "EVENT_ACCESS_DENIED",
                    "You do not have access to this Event."
            );
        }

        return applicationRepository
                .findOrganizerApplications(eventId, organizerUserId, status, pageable)
                .map(OrganizerApplicationQueryService::toResponse);
    }

    public OrganizerApplicationResponse findApplication(
            Long applicationId,
            Long organizerUserId
    ) {
        if (!applicationRepository.existsById(applicationId)) {
            throw new PartnerApiException(
                    HttpStatus.NOT_FOUND,
                    "APPLICATION_NOT_FOUND",
                    "Application was not found."
            );
        }

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

        Optional<OrganizerApplicationRow> application =
                applicationRepository.findOrganizerApplicationById(
                        applicationId,
                        organizerUserId
                );

        return application.map(OrganizerApplicationQueryService::toResponse)
                .orElseThrow(() -> new PartnerApiException(
                        HttpStatus.NOT_FOUND,
                        "APPLICATION_NOT_FOUND",
                        "Application was not found."
                ));
    }

    private static OrganizerApplicationResponse toResponse(OrganizerApplicationRow row) {
        return new OrganizerApplicationResponse(
                row.getApplicationId(),
                row.getEventId(),
                row.getPartnerOrganizationId(),
                row.getPartnerOrganizationName(),
                row.getPartnerOrganizationStatus(),
                row.getPartnerCategoryCode(),
                row.getStatus(),
                row.getApplicationNote(),
                row.getReviewNote(),
                row.getSubmittedAt(),
                row.getReviewedAt(),
                row.getWithdrawnAt()
        );
    }
}
