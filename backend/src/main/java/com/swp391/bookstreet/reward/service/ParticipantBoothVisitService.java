package com.swp391.bookstreet.reward.service;

import com.swp391.bookstreet.booth.entity.Booth;
import com.swp391.bookstreet.booth.entity.BoothAssignment;
import com.swp391.bookstreet.booth.entity.BoothAssignmentStatus;
import com.swp391.bookstreet.booth.entity.EventBoothConfig;
import com.swp391.bookstreet.booth.entity.Location;
import com.swp391.bookstreet.booth.repository.BoothAssignmentRepository;
import com.swp391.bookstreet.common.exception.ApiException;
import com.swp391.bookstreet.event.entity.Event;
import com.swp391.bookstreet.event.entity.EventStatus;
import com.swp391.bookstreet.event.service.EventRootLockService;
import com.swp391.bookstreet.registration.entity.EventRegistration;
import com.swp391.bookstreet.registration.entity.EventRegistrationStatus;
import com.swp391.bookstreet.registration.repository.EventRegistrationRepository;
import com.swp391.bookstreet.reward.config.RewardProperties;
import com.swp391.bookstreet.reward.dto.BoothBriefResponse;
import com.swp391.bookstreet.reward.dto.BoothScanResponse;
import com.swp391.bookstreet.reward.dto.BoothVisitResponse;
import com.swp391.bookstreet.reward.dto.EventBriefResponse;
import com.swp391.bookstreet.reward.dto.EventRegistrationAction;
import com.swp391.bookstreet.reward.dto.ParticipantBadgeResponse;
import com.swp391.bookstreet.reward.entity.BoothVisit;
import com.swp391.bookstreet.reward.entity.PointTransaction;
import com.swp391.bookstreet.reward.repository.BoothVisitRepository;
import com.swp391.bookstreet.reward.repository.PointTransactionRepository;
import com.swp391.bookstreet.reward.security.RewardCurrentUser;
import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Objects;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ParticipantBoothVisitService {
    private static final int MAX_TOKEN_LENGTH = 200;

    private final BoothAssignmentRepository assignmentRepository;
    private final EventRegistrationRepository registrationRepository;
    private final BoothVisitRepository visitRepository;
    private final PointTransactionRepository pointRepository;
    private final EventRootLockService eventRootLockService;
    private final BadgeAwardService badgeAwardService;
    private final RewardCurrentUser currentUser;
    private final RewardProperties rewardProperties;
    private final Clock clock;

    public ParticipantBoothVisitService(
            BoothAssignmentRepository assignmentRepository,
            EventRegistrationRepository registrationRepository,
            BoothVisitRepository visitRepository,
            PointTransactionRepository pointRepository,
            EventRootLockService eventRootLockService,
            BadgeAwardService badgeAwardService,
            RewardCurrentUser currentUser,
            RewardProperties rewardProperties,
            Clock clock) {
        this.assignmentRepository = assignmentRepository;
        this.registrationRepository = registrationRepository;
        this.visitRepository = visitRepository;
        this.pointRepository = pointRepository;
        this.eventRootLockService = eventRootLockService;
        this.badgeAwardService = badgeAwardService;
        this.currentUser = currentUser;
        this.rewardProperties = rewardProperties;
        this.clock = clock;
    }

    @Transactional
    public BoothScanResponse scan(String token) {
        Long userId = currentUser.requireParticipantId();
        BoothAssignmentRepository.ScanTarget target = resolve(token);

        Event event = eventRootLockService.lock(target.getEventId())
                .orElseThrow(ParticipantBoothVisitService::relationshipInvalid);
        BoothAssignment assignment = assignmentRepository
                .findByIdForUpdate(target.getBoothAssignmentId())
                .orElseThrow(ParticipantBoothVisitService::relationshipInvalid);
        ScanContext context = relationshipContext(token, target, event, assignment);

        requireEligibleAssignment(assignment);
        Instant now = clock.instant().truncatedTo(ChronoUnit.MICROS);
        requireOpenWindow(event, now);

        RegistrationResult registrationResult = registration(userId, event.getEventId(), now);
        BoothVisit existing = visitRepository.findByIdentityForUpdate(
                registrationResult.registration().getEventRegistrationId(),
                assignment.getBoothAssignmentId()).orElse(null);
        if (existing != null) {
            PointTransaction transaction = pointRepository
                    .findByBoothVisitIdForUpdate(existing.getBoothVisitId())
                    .orElseThrow(ParticipantBoothVisitService::relationshipInvalid);
            return response(existing, transaction.getPoints(), 0,
                    pointRepository.sumPointsByUserId(userId), true,
                    registrationResult.action(), event, assignment, context, List.of());
        }

        BoothVisit visit = visitRepository.saveAndFlush(BoothVisit.record(
                registrationResult.registration().getEventRegistrationId(),
                assignment.getBoothAssignmentId(), now));
        int visitPoints = rewardProperties.getBoothVisitPoints();
        pointRepository.saveAndFlush(PointTransaction.award(
                visit.getBoothVisitId(), visitPoints, now));
        BadgeAwardResult badgeAward = badgeAwardService.awardEligibleBadges(userId, now);
        long totalPoints = badgeAward.totalPoints();
        List<ParticipantBadgeResponse> unlocked = badgeAward
                .awardedBadges().stream()
                .map(ParticipantBadgeResponse::newlyEarned)
                .toList();

        return response(visit, visitPoints, visitPoints, totalPoints, false,
                registrationResult.action(), event, assignment, context, unlocked);
    }

    private BoothAssignmentRepository.ScanTarget resolve(String token) {
        if (token == null || token.isBlank()) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_CONTENT, "VALIDATION_FAILED",
                    "Request validation failed.");
        }
        if (token.length() > MAX_TOKEN_LENGTH) throw qrNotFound();
        return assignmentRepository.resolveScanTarget(token)
                .orElseThrow(ParticipantBoothVisitService::qrNotFound);
    }

    private ScanContext relationshipContext(String token,
            BoothAssignmentRepository.ScanTarget target, Event event,
            BoothAssignment assignment) {
        try {
            EventBoothConfig config = assignment.getBoothHold().getEventBoothConfig();
            Booth booth = config.getBooth();
            Location location = booth.getLocation();
            if (!Objects.equals(target.getEventId(), event.getEventId())
                    || !Objects.equals(target.getBoothAssignmentId(),
                            assignment.getBoothAssignmentId())
                    || !Objects.equals(config.getEventId(), event.getEventId())
                    || assignment.getQrToken() == null
                    || !assignment.getQrToken().toString().equals(token)
                    || booth.getBoothId() == null || location.getLocationId() == null) {
                throw relationshipInvalid();
            }
            return new ScanContext(booth.getBoothId(), location.getCode(), location.getName());
        } catch (RuntimeException error) {
            if (error instanceof ApiException apiException) throw apiException;
            throw relationshipInvalid();
        }
    }

    private RegistrationResult registration(Long userId, Long eventId, Instant now) {
        EventRegistration registration = registrationRepository
                .findByUserIdAndEventIdForUpdate(userId, eventId).orElse(null);
        if (registration == null) {
            EventRegistration created = registrationRepository.saveAndFlush(
                    EventRegistration.join(userId, eventId, now));
            return new RegistrationResult(created, EventRegistrationAction.CREATED);
        }
        if (!Objects.equals(registration.getEventId(), eventId)
                || !Objects.equals(registration.getUserId(), userId)) {
            throw relationshipInvalid();
        }
        if (registration.getStatus() == EventRegistrationStatus.LEFT) {
            registration.reactivate(now);
            registrationRepository.flush();
            return new RegistrationResult(registration, EventRegistrationAction.REACTIVATED);
        }
        return new RegistrationResult(registration, EventRegistrationAction.REUSED);
    }

    private static void requireEligibleAssignment(BoothAssignment assignment) {
        if (assignment.getStatus() != BoothAssignmentStatus.ACTIVE) {
            throw new ApiException(HttpStatus.CONFLICT, "BOOTH_ASSIGNMENT_INELIGIBLE",
                    "Booth assignment is not eligible for visits.");
        }
    }

    private static void requireOpenWindow(Event event, Instant now) {
        if (now.isBefore(event.getStartAt())) {
            throw new ApiException(HttpStatus.CONFLICT, "BOOTH_VISIT_WINDOW_NOT_OPEN",
                    "Booth visit window is not open.");
        }
        if (!now.isBefore(event.getEndAt())
                || event.getStatus() == EventStatus.COMPLETED
                || event.getStatus() == EventStatus.CANCELLED) {
            throw new ApiException(HttpStatus.CONFLICT, "BOOTH_VISIT_WINDOW_CLOSED",
                    "Booth visit window is closed.");
        }
        if (event.getStatus() != EventStatus.ONGOING) {
            throw new ApiException(HttpStatus.CONFLICT, "BOOTH_VISIT_WINDOW_NOT_OPEN",
                    "Booth visit window is not open.");
        }
    }

    private static BoothScanResponse response(
            BoothVisit visit, int visitPoints, int newlyAwardedPoints, long totalPoints,
            boolean alreadyVisited, EventRegistrationAction action, Event event,
            BoothAssignment assignment, ScanContext context,
            List<ParticipantBadgeResponse> unlocked) {
        BoothVisitResponse visitResponse = new BoothVisitResponse(
                visit.getBoothVisitId(), visit.getEventRegistrationId(),
                assignment.getBoothAssignmentId(),
                new EventBriefResponse(event.getEventId(), event.getName()),
                new BoothBriefResponse(context.boothId(), context.code(), context.name()),
                visit.getVisitedAt());
        return new BoothScanResponse(visitResponse, action, visitPoints,
                newlyAwardedPoints, totalPoints, alreadyVisited, unlocked);
    }

    private static ApiException qrNotFound() {
        return new ApiException(HttpStatus.NOT_FOUND, "BOOTH_QR_NOT_FOUND",
                "Booth QR was not found.");
    }

    private static ApiException relationshipInvalid() {
        return new ApiException(HttpStatus.CONFLICT, "BOOTH_VISIT_RELATIONSHIP_INVALID",
                "Booth visit relationships are invalid.");
    }

    private record RegistrationResult(
            EventRegistration registration, EventRegistrationAction action) {
    }

    private record ScanContext(Long boothId, String code, String name) {
    }
}
