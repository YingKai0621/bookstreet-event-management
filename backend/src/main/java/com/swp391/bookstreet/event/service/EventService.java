package com.swp391.bookstreet.event.service;

import com.swp391.bookstreet.event.dto.*;
import com.swp391.bookstreet.event.entity.Event;
import com.swp391.bookstreet.event.entity.EventStatus;
import com.swp391.bookstreet.event.exception.EventException;
import com.swp391.bookstreet.event.repository.EventRepository;
import com.swp391.bookstreet.event.security.EventCurrentUser;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class EventService {
    private final EventRepository repository;
    private final EventCurrentUser currentUser;
    private final EventValidation validation;

    public EventService(EventRepository repository, EventCurrentUser currentUser,
            EventValidation validation) {
        this.repository = repository;
        this.currentUser = currentUser;
        this.validation = validation;
    }

    @Transactional
    public EventResponse create(CreateEventRequest request) {
        Long owner = currentUser.requireOrganizerId();
        Event event = new Event();
        event.setOrganizerUserId(owner);
        event.setStatus(EventStatus.DRAFT);
        event.setName(request.name());
        event.setDescription(request.description());
        event.setStartAt(request.startAt());
        event.setEndAt(request.endAt());
        event.setPartnerApplicationDeadlineAt(request.partnerApplicationDeadlineAt());
        event.setBoothRequestDeadlineAt(request.boothRequestDeadlineAt());
        event.setActivityProposalDeadlineAt(request.activityProposalDeadlineAt());
        event.setParticipantRegistrationDeadlineAt(request.participantRegistrationDeadlineAt());
        event.setPartnerWithdrawalCutoffAt(request.partnerWithdrawalCutoffAt());
        event.setBoothCancellationCutoffAt(request.boothCancellationCutoffAt());
        event.setActivityCancellationCutoffAt(request.activityCancellationCutoffAt());
        event.setBoothPaymentWindowMinutes(request.boothPaymentWindowMinutes());
        event.setMaxBoothsPerPartner(request.maxBoothsPerPartner());
        event.setMaxActivitiesPerPartner(request.maxActivitiesPerPartner());
        event.setBannerUrl(request.bannerUrl());
        validation.validate(event);
        return EventResponse.from(repository.saveAndFlush(event));
    }

    public EventPageResponse<EventResponse> listOwned(int page, int size, String sort) {
        Long owner = currentUser.requireOrganizerId();
        return EventPageResponse.from(repository.findByOrganizerUserId(owner,
                EventPagination.of(page, size, sort)).map(EventResponse::from));
    }

    public EventResponse getOwned(Long id) {
        Long owner = currentUser.requireOrganizerId();
        return EventResponse.from(repository.findByEventIdAndOrganizerUserId(id, owner)
                .orElseThrow(EventService::notFound));
    }

    @Transactional
    public EventResponse update(Long id, UpdateEventRequest request) {
        Event event = ownedDraftForUpdate(id);
        if (request.contains("name")) event.setName(request.getName());
        if (request.contains("description")) event.setDescription(request.getDescription());
        if (request.contains("startAt")) event.setStartAt(request.getStartAt());
        if (request.contains("endAt")) event.setEndAt(request.getEndAt());
        if (request.contains("partnerApplicationDeadlineAt")) event.setPartnerApplicationDeadlineAt(request.getPartnerApplicationDeadlineAt());
        if (request.contains("boothRequestDeadlineAt")) event.setBoothRequestDeadlineAt(request.getBoothRequestDeadlineAt());
        if (request.contains("activityProposalDeadlineAt")) event.setActivityProposalDeadlineAt(request.getActivityProposalDeadlineAt());
        if (request.contains("participantRegistrationDeadlineAt")) event.setParticipantRegistrationDeadlineAt(request.getParticipantRegistrationDeadlineAt());
        if (request.contains("partnerWithdrawalCutoffAt")) event.setPartnerWithdrawalCutoffAt(request.getPartnerWithdrawalCutoffAt());
        if (request.contains("boothCancellationCutoffAt")) event.setBoothCancellationCutoffAt(request.getBoothCancellationCutoffAt());
        if (request.contains("activityCancellationCutoffAt")) event.setActivityCancellationCutoffAt(request.getActivityCancellationCutoffAt());
        if (request.contains("boothPaymentWindowMinutes")) event.setBoothPaymentWindowMinutes(request.getBoothPaymentWindowMinutes());
        if (request.contains("maxBoothsPerPartner")) event.setMaxBoothsPerPartner(request.getMaxBoothsPerPartner());
        if (request.contains("maxActivitiesPerPartner")) event.setMaxActivitiesPerPartner(request.getMaxActivitiesPerPartner());
        if (request.contains("bannerUrl")) event.setBannerUrl(request.getBannerUrl());
        validation.validate(event);
        repository.flush();
        return EventResponse.from(event);
    }

    @Transactional
    public EventResponse publish(Long id) {
        Event event = ownedDraftForUpdate(id);
        validation.validateForPublish(event);
        event.setStatus(EventStatus.PUBLISHED);
        repository.flush();
        return EventResponse.from(event);
    }

    public EventPageResponse<EventSummaryResponse> listPublic(int page, int size, String sort) {
        return EventPageResponse.from(repository.findByStatus(EventStatus.PUBLISHED,
                EventPagination.of(page, size, sort)).map(EventSummaryResponse::from));
    }

    public EventSummaryResponse getPublic(Long id) {
        return EventSummaryResponse.from(repository.findByEventIdAndStatus(id, EventStatus.PUBLISHED)
                .orElseThrow(EventService::notFound));
    }

    private Event ownedDraftForUpdate(Long id) {
        Long owner = currentUser.requireOrganizerId();
        Event event = repository.findOwnedForUpdate(id, owner).orElseThrow(EventService::notFound);
        if (event.getStatus() != EventStatus.DRAFT) {
            throw new EventException(HttpStatus.CONFLICT, "EVENT_NOT_DRAFT",
                    "Only a DRAFT event can be updated or published.");
        }
        return event;
    }

    private static EventException notFound() {
        // The same response hides both another Organizer's events and private drafts.
        return new EventException(HttpStatus.NOT_FOUND, "EVENT_NOT_FOUND", "Event not found.");
    }
}

