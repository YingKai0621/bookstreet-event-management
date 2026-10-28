package com.swp391.bookstreet.reward.service;

import com.swp391.bookstreet.common.exception.ApiException;
import com.swp391.bookstreet.event.repository.EventRepository;
import com.swp391.bookstreet.reward.dto.*;
import com.swp391.bookstreet.reward.repository.OrganizerBoothVisitQueryRepository;
import com.swp391.bookstreet.reward.security.RewardManagementCurrentUser;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class OrganizerBoothVisitQueryService {
    private final RewardManagementCurrentUser currentUser;
    private final EventRepository events;
    private final OrganizerBoothVisitQueryRepository queries;

    public OrganizerBoothVisitQueryService(RewardManagementCurrentUser currentUser,
            EventRepository events, OrganizerBoothVisitQueryRepository queries) {
        this.currentUser = currentUser;
        this.events = events;
        this.queries = queries;
    }

    public OrganizerBoothVisitSummaryResponse summary(Long eventId) {
        requireOwnedEvent(eventId);
        return queries.summary(eventId);
    }

    public RewardPageResponse<OrganizerBoothVisitGroupResponse> groups(
            Long eventId, int page, int size, String sort, Long boothId, String search) {
        requireOwnedEvent(eventId);
        return queries.groups(eventId, RewardManagementQuery.positiveId(boothId, false),
                RewardManagementQuery.groups(page, size, sort, search));
    }

    public RewardPageResponse<OrganizerBoothVisitResponse> visits(
            Long eventId, int page, int size, String sort, Long boothId, String search) {
        requireOwnedEvent(eventId);
        return queries.visits(eventId, RewardManagementQuery.positiveId(boothId, false),
                RewardManagementQuery.visits(page, size, sort, search));
    }

    private void requireOwnedEvent(Long eventId) {
        Long organizerId = currentUser.requireOrganizerId();
        RewardManagementQuery.positiveId(eventId, true);
        events.findByEventIdAndOrganizerUserId(eventId, organizerId).orElseThrow(() ->
                new ApiException(HttpStatus.NOT_FOUND, "EVENT_NOT_FOUND", "Event was not found."));
    }
}
