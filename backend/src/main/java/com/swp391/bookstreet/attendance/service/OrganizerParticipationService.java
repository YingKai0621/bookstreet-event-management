package com.swp391.bookstreet.attendance.service;

import com.swp391.bookstreet.activity.exception.ActivityApiException;
import com.swp391.bookstreet.activity.repository.ActivityRepository;
import com.swp391.bookstreet.activity.security.ActivityCurrentUser;
import com.swp391.bookstreet.activity.service.ActivityLifecycleService;
import com.swp391.bookstreet.activity.service.ActivityLifecycleTransactionService;
import com.swp391.bookstreet.attendance.dto.*;
import com.swp391.bookstreet.attendance.entity.AttendanceStatus;
import com.swp391.bookstreet.attendance.repository.AttendanceAdjustmentRepository;
import com.swp391.bookstreet.attendance.repository.OrganizerParticipationQueryRepository;
import com.swp391.bookstreet.auth.repository.UserRepository;
import com.swp391.bookstreet.event.repository.EventRepository;
import com.swp391.bookstreet.registration.dto.RegistrationPageResponse;
import com.swp391.bookstreet.registration.entity.ActivityRegistrationStatus;
import com.swp391.bookstreet.registration.entity.EventRegistrationStatus;
import com.swp391.bookstreet.registration.entity.ParticipationOutcome;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class OrganizerParticipationService {
    private final OrganizerParticipationQueryRepository queries;
    private final AttendanceAdjustmentRepository adjustments;
    private final ActivityRepository activities;
    private final EventRepository events;
    private final UserRepository users;
    private final ActivityCurrentUser currentUser;
    private final ActivityLifecycleService lifecycle;
    private final ActivityLifecycleTransactionService lifecycleTransactions;

    public OrganizerParticipationService(OrganizerParticipationQueryRepository queries,
            AttendanceAdjustmentRepository adjustments, ActivityRepository activities, EventRepository events,
            UserRepository users, ActivityCurrentUser currentUser, ActivityLifecycleService lifecycle,
            ActivityLifecycleTransactionService lifecycleTransactions) {
        this.queries = queries;
        this.adjustments = adjustments;
        this.activities = activities;
        this.events = events;
        this.users = users;
        this.currentUser = currentUser;
        this.lifecycle = lifecycle;
        this.lifecycleTransactions = lifecycleTransactions;
    }

    public RegistrationPageResponse<OrganizerParticipationResponse> activities(Long activityId, int page,
            int size, String sort, String status, String outcome, String attendanceStatus, String search) {
        Long actor = currentUser.requireOrganizerId();
        activities.findOwnedById(activityId, actor).orElseThrow(() -> missing("ACTIVITY_NOT_FOUND"));
        var paging = ParticipationPagination.of(page, size, sort, Map.of("registeredAt", "r.registered_at",
                "activatedAt", "r.activated_at", "updatedAt", "r.updated_at",
                "participantDisplayName", "u.full_name", "attendedAt", "att.attended_at"));
        String state = ParticipationPagination.filter(status, ActivityRegistrationStatus.class);
        String result = ParticipationPagination.filter(outcome, ParticipationOutcome.class);
        String attendance = ParticipationPagination.filter(attendanceStatus, AttendanceStatus.class);
        String name = ParticipationPagination.search(search);
        lifecycleTransactions.advance(activityId);
        return queries.activities(actor, activityId, state, result, attendance, name, paging);
    }

    public RegistrationPageResponse<OrganizerEventRegistrationResponse> events(Long eventId, int page,
            int size, String sort, String status, String search) {
        Long actor = currentUser.requireOrganizerId();
        events.findByEventIdAndOrganizerUserId(eventId, actor).orElseThrow(() -> missing("EVENT_NOT_FOUND"));
        var paging = ParticipationPagination.of(page, size, sort, Map.of("registeredAt", "er.registered_at",
                "activatedAt", "er.activated_at", "updatedAt", "er.updated_at"));
        String state = ParticipationPagination.filter(status, EventRegistrationStatus.class);
        String name = ParticipationPagination.search(search);
        lifecycle.advanceDueActivities();
        return queries.events(actor, eventId, state, name, paging);
    }

    public OrganizerParticipationResponse detail(Long registrationId) {
        Long actor = currentUser.requireOrganizerId();
        var row = owned(actor, registrationId);
        lifecycleTransactions.advance(row.activityId());
        return owned(actor, registrationId);
    }

    @Transactional(readOnly = true)
    public RegistrationPageResponse<AttendanceAdjustmentResponse> history(Long registrationId,
            int page, int size, String sort) {
        Long actor = currentUser.requireOrganizerId();
        owned(actor, registrationId);
        var paging = ParticipationPagination.of(page, size, sort, Map.of("adjustedAt", "adjustedAt",
                "attendanceAdjustmentId", "attendanceAdjustmentId"));
        var result = adjustments.findByActivityRegistrationId(registrationId,
                paging.pageable("attendanceAdjustmentId"));
        var names = new java.util.HashMap<Long, String>();
        users.findAllById(result.getContent().stream().map(a -> a.getActorUserId()).distinct().toList())
                .forEach(u -> names.put(u.getId(), u.getFullName()));
        return new RegistrationPageResponse<>(result.getContent().stream()
                .map(a -> AttendanceAdjustmentResponse.from(a, names.get(a.getActorUserId()))).toList(),
                page, size, result.getTotalElements(), result.getTotalPages());
    }

    private OrganizerParticipationResponse owned(Long actor, Long registrationId) {
        var row = queries.detail(actor, registrationId);
        if (row == null) throw missing("ACTIVITY_REGISTRATION_NOT_FOUND");
        return row;
    }

    static ActivityApiException missing(String code) {
        return new ActivityApiException(HttpStatus.NOT_FOUND, code, "Participation resource not found.");
    }
}
