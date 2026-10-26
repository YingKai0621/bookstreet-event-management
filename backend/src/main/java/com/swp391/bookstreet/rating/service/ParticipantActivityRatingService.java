package com.swp391.bookstreet.rating.service;

import com.swp391.bookstreet.activity.entity.Activity;
import com.swp391.bookstreet.activity.entity.ActivityStatus;
import com.swp391.bookstreet.activity.repository.ActivityRepository;
import com.swp391.bookstreet.attendance.entity.Attendance;
import com.swp391.bookstreet.attendance.entity.AttendanceStatus;
import com.swp391.bookstreet.attendance.repository.AttendanceRepository;
import com.swp391.bookstreet.common.exception.ApiException;
import com.swp391.bookstreet.event.entity.Event;
import com.swp391.bookstreet.event.service.EventRootLockService;
import com.swp391.bookstreet.rating.dto.ActivityRatingRequest;
import com.swp391.bookstreet.rating.dto.ActivityRatingResponse;
import com.swp391.bookstreet.rating.entity.ActivityRating;
import com.swp391.bookstreet.rating.repository.ActivityRatingRepository;
import com.swp391.bookstreet.rating.security.RatingCurrentUser;
import com.swp391.bookstreet.registration.entity.ActivityRegistration;
import com.swp391.bookstreet.registration.entity.EventRegistration;
import com.swp391.bookstreet.registration.repository.ActivityRegistrationRepository;
import com.swp391.bookstreet.registration.repository.EventRegistrationRepository;
import com.swp391.bookstreet.activity.service.ActivityLifecycleCoordinator;
import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ParticipantActivityRatingService {

    private final ActivityRatingRepository activityRatingRepository;
    private final EventRootLockService eventRootLockService;
    private final ActivityRepository activityRepository;
    private final EventRegistrationRepository eventRegistrationRepository;
    private final ActivityRegistrationRepository activityRegistrationRepository;
    private final AttendanceRepository attendanceRepository;
    private final RatingCurrentUser currentUser;
    private final ActivityLifecycleCoordinator lifecycleCoordinator;
    private final Clock clock;

    public ParticipantActivityRatingService(
            ActivityRatingRepository activityRatingRepository,
            EventRootLockService eventRootLockService,
            ActivityRepository activityRepository,
            EventRegistrationRepository eventRegistrationRepository,
            ActivityRegistrationRepository activityRegistrationRepository,
            AttendanceRepository attendanceRepository,
            RatingCurrentUser currentUser,
            ActivityLifecycleCoordinator lifecycleCoordinator, Clock clock) {
        this.activityRatingRepository = activityRatingRepository;
        this.eventRootLockService = eventRootLockService;
        this.activityRepository = activityRepository;
        this.eventRegistrationRepository = eventRegistrationRepository;
        this.activityRegistrationRepository = activityRegistrationRepository;
        this.attendanceRepository = attendanceRepository;
        this.currentUser = currentUser;
        this.clock = clock;
        this.lifecycleCoordinator = lifecycleCoordinator;
    }

    @Transactional(readOnly = true)
    public ActivityRatingResponse getRating(Long activityId) {
        if (activityId == null || activityId <= 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_IDENTIFIER",
                    "activityId must be positive.");
        }
        Long userId = currentUser.requireParticipantId();
        ActivityRating rating = activityRatingRepository.findOwnedRating(userId, activityId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "ACTIVITY_RATING_NOT_FOUND",
                        "Activity rating not found."));
        return ActivityRatingResponse.from(rating, activityId);
    }

    @Transactional
    public ActivityRatingResponse rate(Long activityId, ActivityRatingRequest request) {
        if (activityId == null || activityId <= 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_IDENTIFIER",
                    "activityId must be positive.");
        }
        if (request == null || request.score() == null || request.score() < 1 || request.score() > 5) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "RATING_SCORE_INVALID",
                    "Score must be an integer from 1 to 5.");
        }
        String normalizedComment = null;
        if (request.comment() != null) {
            String trimmed = request.comment().trim();
            if (!trimmed.isEmpty()) {
                if (trimmed.length() > 1000) {
                    throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "RATING_COMMENT_TOO_LONG",
                            "Comment must not exceed 1000 characters.");
                }
                normalizedComment = trimmed;
            }
        }

        Long userId = currentUser.requireParticipantId();

        // 1. Resolve route to get eventId
        ActivityRepository.ActivityRoute route = activityRepository.findRouteById(activityId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "ACTIVITY_NOT_FOUND",
                        "Activity not found."));

        // 2. Lock in BR-101 order: Event -> Activity -> EventRegistration -> ActivityRegistration -> Attendance -> ActivityRating
        Event event = eventRootLockService.lock(route.getEventId())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "ACTIVITY_NOT_FOUND",
                        "Activity not found."));

        Activity activity = activityRepository.findByIdForUpdate(activityId)
                .filter(a -> a.getEventId().equals(event.getEventId()))
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "ACTIVITY_NOT_FOUND",
                        "Activity not found."));

        Instant now = clock.instant().truncatedTo(ChronoUnit.MICROS);
        lifecycleCoordinator.advanceLocked(activity, now);

        // AC-P04-01: Activity must be COMPLETED
        if (activity.getStatus() != ActivityStatus.COMPLETED) {
            throw new ApiException(HttpStatus.CONFLICT, "RATING_ACTIVITY_NOT_COMPLETED",
                    "Rating requires completed Activity.");
        }

        EventRegistration eventRegistration = eventRegistrationRepository
                .findByUserIdAndEventIdForUpdate(userId, event.getEventId())
                .orElseThrow(() -> new ApiException(HttpStatus.CONFLICT, "RATING_ATTENDANCE_REQUIRED",
                        "Rating requires owned valid Attendance."));

        ActivityRegistration activityRegistration = activityRegistrationRepository
                .findByIdentityForUpdate(eventRegistration.getEventRegistrationId(), activityId)
                .orElseThrow(() -> new ApiException(HttpStatus.CONFLICT, "RATING_ATTENDANCE_REQUIRED",
                        "Rating requires owned valid Attendance."));

        Attendance attendance = attendanceRepository
                .findByActivityRegistrationIdForUpdate(activityRegistration.getActivityRegistrationId())
                .orElseThrow(() -> new ApiException(HttpStatus.CONFLICT, "RATING_ATTENDANCE_REQUIRED",
                        "Rating requires owned valid Attendance."));

        // AC-P04-02: Attendance must be VALID
        if (attendance.getStatus() == AttendanceStatus.VOIDED) {
            throw new ApiException(HttpStatus.CONFLICT, "RATING_ATTENDANCE_VOIDED",
                    "Cannot rate with voided Attendance.");
        }
        if (attendance.getStatus() != AttendanceStatus.VALID) {
            throw new ApiException(HttpStatus.CONFLICT, "RATING_ATTENDANCE_REQUIRED",
                    "Rating requires owned valid Attendance.");
        }

        ActivityRating rating = activityRatingRepository
                .findByAttendanceIdForUpdate(attendance.getAttendanceId())
                .orElse(null);

        if (rating == null) {
            // First submission
            try {
                rating = ActivityRating.create(
                        attendance.getAttendanceId(),
                        request.score().shortValue(),
                        normalizedComment,
                        now);
                rating = activityRatingRepository.saveAndFlush(rating);
            } catch (DataIntegrityViolationException ex) {
                // AC-P04-05: Concurrent first submission converges
                rating = activityRatingRepository
                        .findByAttendanceIdForUpdate(attendance.getAttendanceId())
                        .orElseThrow(() -> ex);
                rating.update(request.score().shortValue(), normalizedComment, now);
                rating = activityRatingRepository.saveAndFlush(rating);
            }
        } else {
            // AC-P04-04: Later submission updates one Rating
            rating.update(request.score().shortValue(), normalizedComment, now);
            rating = activityRatingRepository.saveAndFlush(rating);
        }

        return ActivityRatingResponse.from(rating, activityId);
    }
}
