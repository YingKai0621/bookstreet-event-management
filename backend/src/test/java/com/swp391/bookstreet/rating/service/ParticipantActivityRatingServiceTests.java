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
import com.swp391.bookstreet.rating.entity.ActivityRatingStatus;
import com.swp391.bookstreet.rating.repository.ActivityRatingRepository;
import com.swp391.bookstreet.rating.security.RatingCurrentUser;
import com.swp391.bookstreet.registration.entity.ActivityRegistration;
import com.swp391.bookstreet.registration.entity.EventRegistration;
import com.swp391.bookstreet.registration.repository.ActivityRegistrationRepository;
import com.swp391.bookstreet.registration.repository.EventRegistrationRepository;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.beans.BeanUtils;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ParticipantActivityRatingServiceTests {

    private static final Long PARTICIPANT_ID = 100L;
    private static final Long EVENT_ID = 7L;
    private static final Long ACTIVITY_ID = 91L;
    private static final Long EVENT_REG_ID = 301L;
    private static final Long ACT_REG_ID = 401L;
    private static final Long ATTENDANCE_ID = 501L;
    private static final Instant NOW = Instant.parse("2027-01-11T03:10:00Z");

    @Mock
    private ActivityRatingRepository activityRatingRepository;

    @Mock
    private EventRootLockService eventRootLockService;

    @Mock
    private ActivityRepository activityRepository;

    @Mock
    private EventRegistrationRepository eventRegistrationRepository;

    @Mock
    private ActivityRegistrationRepository activityRegistrationRepository;

    @Mock
    private AttendanceRepository attendanceRepository;

    @Mock
    private RatingCurrentUser currentUser;

    @Mock
    private com.swp391.bookstreet.activity.service.ActivityLifecycleCoordinator lifecycle;

    private Clock clock;
    private ParticipantActivityRatingService service;

    @BeforeEach
    void setUp() {
        clock = Clock.fixed(NOW, ZoneOffset.UTC);
        service = new ParticipantActivityRatingService(
                activityRatingRepository,
                eventRootLockService,
                activityRepository,
                eventRegistrationRepository,
                activityRegistrationRepository,
                attendanceRepository,
                currentUser,
                lifecycle,
                clock);

        when(lifecycle.advanceLocked(any(), any())).thenAnswer(invocation ->
                ((Activity) invocation.getArgument(0)).advanceTimedLifecycle(invocation.getArgument(1)));

        when(currentUser.requireParticipantId()).thenReturn(PARTICIPANT_ID);
    }

    @Test
    void getRatingReturnsOwnedRatingWhenPresent() {
        ActivityRating rating = ActivityRating.create(ATTENDANCE_ID, (short) 5, "Rất hay", NOW.minusSeconds(60));
        ReflectionTestUtils.setField(rating, "activityRatingId", 701L);

        when(activityRatingRepository.findOwnedRating(PARTICIPANT_ID, ACTIVITY_ID))
                .thenReturn(Optional.of(rating));

        ActivityRatingResponse response = service.getRating(ACTIVITY_ID);

        assertThat(response.activityRatingId()).isEqualTo(701L);
        assertThat(response.activityId()).isEqualTo(ACTIVITY_ID);
        assertThat(response.score()).isEqualTo((short) 5);
        assertThat(response.comment()).isEqualTo("Rất hay");
        assertThat(response.status()).isEqualTo("ACTIVE");
    }

    @Test
    void getRatingThrowsNotFoundWhenMissingOrForeign() {
        when(activityRatingRepository.findOwnedRating(PARTICIPANT_ID, ACTIVITY_ID))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.getRating(ACTIVITY_ID))
                .isInstanceOf(ApiException.class)
                .satisfies(e -> {
                    ApiException api = (ApiException) e;
                    assertThat(api.getStatus()).isEqualTo(HttpStatus.NOT_FOUND);
                    assertThat(api.getCode()).isEqualTo("ACTIVITY_RATING_NOT_FOUND");
                });
    }

    @Test
    void getRatingRejectsInvalidIdentifier() {
        assertThatThrownBy(() -> service.getRating(0L))
                .isInstanceOf(ApiException.class)
                .satisfies(e -> {
                    ApiException api = (ApiException) e;
                    assertThat(api.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST);
                    assertThat(api.getCode()).isEqualTo("INVALID_IDENTIFIER");
                });

        assertThatThrownBy(() -> service.getRating(-5L))
                .isInstanceOf(ApiException.class)
                .satisfies(e -> {
                    ApiException api = (ApiException) e;
                    assertThat(api.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST);
                    assertThat(api.getCode()).isEqualTo("INVALID_IDENTIFIER");
                });
    }

    @Test
    void rateRejectsInvalidScoreOrComment() {
        assertThatThrownBy(() -> service.rate(ACTIVITY_ID, new ActivityRatingRequest(null, "ok")))
                .isInstanceOf(ApiException.class)
                .satisfies(e -> {
                    ApiException api = (ApiException) e;
                    assertThat(api.getStatus()).isEqualTo(HttpStatus.UNPROCESSABLE_ENTITY);
                    assertThat(api.getCode()).isEqualTo("RATING_SCORE_INVALID");
                });

        assertThatThrownBy(() -> service.rate(ACTIVITY_ID, new ActivityRatingRequest(0, "ok")))
                .isInstanceOf(ApiException.class)
                .satisfies(e -> {
                    ApiException api = (ApiException) e;
                    assertThat(api.getStatus()).isEqualTo(HttpStatus.UNPROCESSABLE_ENTITY);
                    assertThat(api.getCode()).isEqualTo("RATING_SCORE_INVALID");
                });

        assertThatThrownBy(() -> service.rate(ACTIVITY_ID, new ActivityRatingRequest(6, "ok")))
                .isInstanceOf(ApiException.class)
                .satisfies(e -> {
                    ApiException api = (ApiException) e;
                    assertThat(api.getStatus()).isEqualTo(HttpStatus.UNPROCESSABLE_ENTITY);
                    assertThat(api.getCode()).isEqualTo("RATING_SCORE_INVALID");
                });

        String tooLongComment = "a".repeat(1001);
        assertThatThrownBy(() -> service.rate(ACTIVITY_ID, new ActivityRatingRequest(5, tooLongComment)))
                .isInstanceOf(ApiException.class)
                .satisfies(e -> {
                    ApiException api = (ApiException) e;
                    assertThat(api.getStatus()).isEqualTo(HttpStatus.UNPROCESSABLE_ENTITY);
                    assertThat(api.getCode()).isEqualTo("RATING_COMMENT_TOO_LONG");
                });
    }

    @Test
    void rateRejectsWhenActivityNotCompleted() {
        // AC-P04-01: Activity is Published or Ongoing -> rejected
        mockRouteAndLock();
        Activity publishedActivity = createActivity(ACTIVITY_ID, EVENT_ID, ActivityStatus.PUBLISHED);
        when(activityRepository.findByIdForUpdate(ACTIVITY_ID)).thenReturn(Optional.of(publishedActivity));

        assertThatThrownBy(() -> service.rate(ACTIVITY_ID, new ActivityRatingRequest(5, "Nội dung tốt")))
                .isInstanceOf(ApiException.class)
                .satisfies(e -> {
                    ApiException api = (ApiException) e;
                    assertThat(api.getStatus()).isEqualTo(HttpStatus.CONFLICT);
                    assertThat(api.getCode()).isEqualTo("RATING_ACTIVITY_NOT_COMPLETED");
                });
    }

    @Test
    void rateRejectsWhenNoAttendanceOrVoidedAttendance() {
        // AC-P04-02: Non-attendee or VOIDED attendance -> rejected
        mockRouteAndLock();
        Activity completedActivity = createActivity(ACTIVITY_ID, EVENT_ID, ActivityStatus.COMPLETED);
        when(activityRepository.findByIdForUpdate(ACTIVITY_ID)).thenReturn(Optional.of(completedActivity));

        // 1. Missing EventRegistration
        when(eventRegistrationRepository.findByUserIdAndEventIdForUpdate(PARTICIPANT_ID, EVENT_ID))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.rate(ACTIVITY_ID, new ActivityRatingRequest(5, "Nội dung tốt")))
                .isInstanceOf(ApiException.class)
                .satisfies(e -> {
                    ApiException api = (ApiException) e;
                    assertThat(api.getStatus()).isEqualTo(HttpStatus.CONFLICT);
                    assertThat(api.getCode()).isEqualTo("RATING_ATTENDANCE_REQUIRED");
                });

        // 2. Voided Attendance
        EventRegistration eventReg = createEventRegistration(EVENT_REG_ID, PARTICIPANT_ID, EVENT_ID);
        ActivityRegistration actReg = createActivityRegistration(ACT_REG_ID, EVENT_REG_ID, ACTIVITY_ID);
        Attendance voidedAttendance = createAttendance(ATTENDANCE_ID, ACT_REG_ID, AttendanceStatus.VOIDED);

        when(eventRegistrationRepository.findByUserIdAndEventIdForUpdate(PARTICIPANT_ID, EVENT_ID))
                .thenReturn(Optional.of(eventReg));
        when(activityRegistrationRepository.findByIdentityForUpdate(EVENT_REG_ID, ACTIVITY_ID))
                .thenReturn(Optional.of(actReg));
        when(attendanceRepository.findByActivityRegistrationIdForUpdate(ACT_REG_ID))
                .thenReturn(Optional.of(voidedAttendance));

        assertThatThrownBy(() -> service.rate(ACTIVITY_ID, new ActivityRatingRequest(5, "Nội dung tốt")))
                .isInstanceOf(ApiException.class)
                .satisfies(e -> {
                    ApiException api = (ApiException) e;
                    assertThat(api.getStatus()).isEqualTo(HttpStatus.CONFLICT);
                    assertThat(api.getCode()).isEqualTo("RATING_ATTENDANCE_VOIDED");
                });
    }

    @Test
    void rateCreatesFirstRatingSuccessfully() {
        // First submission creates one ACTIVE rating
        mockFullAttendanceContext(AttendanceStatus.VALID);
        when(activityRatingRepository.findByAttendanceIdForUpdate(ATTENDANCE_ID))
                .thenReturn(Optional.empty());

        when(activityRatingRepository.saveAndFlush(any(ActivityRating.class)))
                .thenAnswer(invocation -> {
                    ActivityRating saved = invocation.getArgument(0);
                    ReflectionTestUtils.setField(saved, "activityRatingId", 701L);
                    return saved;
                });

        ActivityRatingResponse response = service.rate(ACTIVITY_ID, new ActivityRatingRequest(5, " Rất tuyệt vời "));

        assertThat(response.activityRatingId()).isEqualTo(701L);
        assertThat(response.activityId()).isEqualTo(ACTIVITY_ID);
        assertThat(response.score()).isEqualTo((short) 5);
        assertThat(response.comment()).isEqualTo("Rất tuyệt vời");
        assertThat(response.status()).isEqualTo("ACTIVE");
        assertThat(response.createdAt()).isEqualTo(NOW);
        assertThat(response.updatedAt()).isEqualTo(NOW);
    }

    @Test
    void rateUpdatesExistingRatingPreservingIdentity() {
        // AC-P04-04: Later submission updates same row
        mockFullAttendanceContext(AttendanceStatus.VALID);

        Instant firstCreatedAt = NOW.minusSeconds(600);
        ActivityRating existing = ActivityRating.create(ATTENDANCE_ID, (short) 3, "Bình thường", firstCreatedAt);
        ReflectionTestUtils.setField(existing, "activityRatingId", 701L);

        when(activityRatingRepository.findByAttendanceIdForUpdate(ATTENDANCE_ID))
                .thenReturn(Optional.of(existing));
        when(activityRatingRepository.saveAndFlush(any(ActivityRating.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        ActivityRatingResponse response = service.rate(ACTIVITY_ID, new ActivityRatingRequest(4, "Đã cải thiện hơn"));

        assertThat(response.activityRatingId()).isEqualTo(701L);
        assertThat(response.activityId()).isEqualTo(ACTIVITY_ID);
        assertThat(response.score()).isEqualTo((short) 4);
        assertThat(response.comment()).isEqualTo("Đã cải thiện hơn");
        assertThat(response.status()).isEqualTo("ACTIVE");
        assertThat(response.createdAt()).isEqualTo(firstCreatedAt);
        assertThat(response.updatedAt()).isEqualTo(NOW);
    }

    @Test
    void rateConvergesOnConcurrentSubmission() {
        // AC-P04-05: Concurrent first submission races and converges
        mockFullAttendanceContext(AttendanceStatus.VALID);

        ActivityRating existing = ActivityRating.create(ATTENDANCE_ID, (short) 4, "Concurrent insert", NOW);
        ReflectionTestUtils.setField(existing, "activityRatingId", 701L);

        when(activityRatingRepository.findByAttendanceIdForUpdate(ATTENDANCE_ID))
                .thenReturn(Optional.empty()) // First check: not found
                .thenReturn(Optional.of(existing)); // Second check after catch: found

        when(activityRatingRepository.saveAndFlush(any(ActivityRating.class)))
                .thenThrow(new DataIntegrityViolationException("uk_activity_ratings_attendance"))
                .thenAnswer(invocation -> invocation.getArgument(0));

        ActivityRatingResponse response = service.rate(ACTIVITY_ID, new ActivityRatingRequest(5, "Cuối cùng hội tụ"));

        assertThat(response.activityRatingId()).isEqualTo(701L);
        assertThat(response.score()).isEqualTo((short) 5);
        assertThat(response.comment()).isEqualTo("Cuối cùng hội tụ");
    }

    private void mockRouteAndLock() {
        ActivityRepository.ActivityRoute route = new ActivityRepository.ActivityRoute() {
            @Override public Long getEventId() { return EVENT_ID; }
            @Override public Long getLocationId() { return 1L; }
        };
        when(activityRepository.findRouteById(ACTIVITY_ID)).thenReturn(Optional.of(route));

        Event event = BeanUtils.instantiateClass(Event.class);
        ReflectionTestUtils.setField(event, "eventId", EVENT_ID);
        when(eventRootLockService.lock(EVENT_ID)).thenReturn(Optional.of(event));
    }

    private void mockFullAttendanceContext(AttendanceStatus attendanceStatus) {
        mockRouteAndLock();
        Activity activity = createActivity(ACTIVITY_ID, EVENT_ID, ActivityStatus.COMPLETED);
        when(activityRepository.findByIdForUpdate(ACTIVITY_ID)).thenReturn(Optional.of(activity));

        EventRegistration eventReg = createEventRegistration(EVENT_REG_ID, PARTICIPANT_ID, EVENT_ID);
        ActivityRegistration actReg = createActivityRegistration(ACT_REG_ID, EVENT_REG_ID, ACTIVITY_ID);
        Attendance attendance = createAttendance(ATTENDANCE_ID, ACT_REG_ID, attendanceStatus);

        when(eventRegistrationRepository.findByUserIdAndEventIdForUpdate(PARTICIPANT_ID, EVENT_ID))
                .thenReturn(Optional.of(eventReg));
        when(activityRegistrationRepository.findByIdentityForUpdate(EVENT_REG_ID, ACTIVITY_ID))
                .thenReturn(Optional.of(actReg));
        when(attendanceRepository.findByActivityRegistrationIdForUpdate(ACT_REG_ID))
                .thenReturn(Optional.of(attendance));
    }

    private Activity createActivity(Long id, Long eventId, ActivityStatus status) {
        Activity activity = BeanUtils.instantiateClass(Activity.class);
        ReflectionTestUtils.setField(activity, "activityId", id);
        ReflectionTestUtils.setField(activity, "eventId", eventId);
        ReflectionTestUtils.setField(activity, "status", status);
        if (status == ActivityStatus.COMPLETED) {
            ReflectionTestUtils.setField(activity, "startAt", NOW.minusSeconds(7200));
            ReflectionTestUtils.setField(activity, "endAt", NOW.minusSeconds(3600));
            ReflectionTestUtils.setField(activity, "completedAt", NOW.minusSeconds(3600));
        } else {
            ReflectionTestUtils.setField(activity, "startAt", NOW.plusSeconds(3600));
            ReflectionTestUtils.setField(activity, "endAt", NOW.plusSeconds(7200));
        }
        return activity;
    }

    private EventRegistration createEventRegistration(Long id, Long userId, Long eventId) {
        EventRegistration er = BeanUtils.instantiateClass(EventRegistration.class);
        ReflectionTestUtils.setField(er, "eventRegistrationId", id);
        ReflectionTestUtils.setField(er, "userId", userId);
        ReflectionTestUtils.setField(er, "eventId", eventId);
        return er;
    }

    private ActivityRegistration createActivityRegistration(Long id, Long eventRegId, Long activityId) {
        ActivityRegistration ar = BeanUtils.instantiateClass(ActivityRegistration.class);
        ReflectionTestUtils.setField(ar, "activityRegistrationId", id);
        ReflectionTestUtils.setField(ar, "eventRegistrationId", eventRegId);
        ReflectionTestUtils.setField(ar, "activityId", activityId);
        return ar;
    }

    private Attendance createAttendance(Long id, Long actRegId, AttendanceStatus status) {
        Attendance att = BeanUtils.instantiateClass(Attendance.class);
        ReflectionTestUtils.setField(att, "attendanceId", id);
        ReflectionTestUtils.setField(att, "activityRegistrationId", actRegId);
        ReflectionTestUtils.setField(att, "status", status);
        return att;
    }
}
