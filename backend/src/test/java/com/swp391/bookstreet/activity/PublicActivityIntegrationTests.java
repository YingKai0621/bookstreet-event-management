package com.swp391.bookstreet.activity;

import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContextInitializer;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
        "spring.datasource.url=${EVENT_TEST_DATABASE_URL}",
        "logging.level.org.springframework.security=ERROR"
})
@EnabledIfEnvironmentVariable(named = "EVENT_TEST_DATABASE_URL", matches = ".+")
@ContextConfiguration(initializers = PublicActivityIntegrationTests.TestDatabaseGuard.class)
class PublicActivityIntegrationTests {
    static class TestDatabaseGuard
            implements ApplicationContextInitializer<ConfigurableApplicationContext> {
        @Override
        public void initialize(ConfigurableApplicationContext applicationContext) {
            String url = applicationContext.getEnvironment()
                    .getRequiredProperty("spring.datasource.url");
            if (!url.matches("jdbc:postgresql://[^/]+/[A-Za-z0-9_]+_event_test(?:\\?.*)?")) {
                throw new IllegalStateException(
                        "Public Activity tests require a dedicated *_event_test database.");
            }
        }
    }

    private static final String PUBLIC = "/api/v1/activities";

    @Autowired WebApplicationContext context;
    @Autowired JdbcTemplate jdbc;

    MockMvc mvc;
    final List<Long> userIds = new ArrayList<>();
    final List<Long> eventIds = new ArrayList<>();
    final List<Long> locationIds = new ArrayList<>();

    @BeforeEach
    void setup() {
        assertThat(jdbc.queryForObject("select current_database()", String.class))
                .endsWith("_event_test");
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
    }

    @AfterEach
    void cleanup() {
        for (Long eventId : eventIds) {
            jdbc.update("delete from activity_ratings where attendance_id in ("
                    + "select attendance_id from attendances where activity_registration_id in ("
                    + "select activity_registration_id from activity_registrations where activity_id in ("
                    + "select activity_id from activities where event_id = ?)))", eventId);
            jdbc.update("delete from attendances where activity_registration_id in ("
                    + "select activity_registration_id from activity_registrations where activity_id in ("
                    + "select activity_id from activities where event_id = ?))", eventId);
            jdbc.update("delete from activity_registrations where activity_id in ("
                    + "select activity_id from activities where event_id = ?)", eventId);
            jdbc.update("delete from event_registrations where event_id = ?", eventId);
            jdbc.update("delete from activities where event_id = ?", eventId);
            jdbc.update("delete from events where event_id = ?", eventId);
        }
        for (Long locationId : locationIds) {
            jdbc.update("delete from locations where location_id = ?", locationId);
        }
        for (Long userId : userIds) {
            jdbc.update("delete from users where user_id = ?", userId);
        }
    }

    @Test
    void publicListUsesCanonicalSafeProjectionAndComputesAvailability() throws Exception {
        Instant now = Instant.now();
        long organizer = insertUser("public-organizer");
        long participant = insertUser("public-participant");
        long eventId = insertEvent(organizer, "Public discovery event", "PUBLISHED",
                now.plus(Duration.ofDays(4)), now.plus(Duration.ofDays(5)),
                now.plus(Duration.ofDays(3)));
        long locationId = insertLocation("PUBLIC-STAGE", "Public Stage", "STAGE", 50);
        long activityId = insertActivity(eventId, locationId, "Canonical public talk",
                "Talk description", "TALKSHOW", "PUBLISHED",
                now.plus(Duration.ofDays(4)).plus(Duration.ofHours(1)),
                now.plus(Duration.ofDays(4)).plus(Duration.ofHours(2)), true,
                now.plus(Duration.ofDays(2)), 2, true, now.minus(Duration.ofHours(1)),
                UUID.randomUUID(), null, null, null);
        long eventRegistrationId = insertEventRegistration(participant, eventId, now);
        insertActivityRegistration(eventRegistrationId, activityId, "ACTIVE", now);

        mvc.perform(get(PUBLIC))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(1))
                .andExpect(jsonPath("$.content[0].activityId").value(activityId))
                .andExpect(jsonPath("$.content[0].eventName").value("Public discovery event"))
                .andExpect(jsonPath("$.content[0].location.code").value("PUBLIC-STAGE"))
                .andExpect(jsonPath("$.content[0].location.locationType").value("STAGE"))
                .andExpect(jsonPath("$.content[0].registeredCount").value(1))
                .andExpect(jsonPath("$.content[0].availableSeats").value(1))
                .andExpect(jsonPath("$.content[0].registrationOpen").value(true))
                .andExpect(jsonPath("$.content[0].attendanceQrAvailable").value(true))
                .andExpect(jsonPath("$.content[0].ratingSummary.averageScore").isEmpty())
                .andExpect(jsonPath("$.content[0].ratingSummary.ratingCount").value(0))
                .andExpect(jsonPath("$.content[0].attendanceQrToken").doesNotExist())
                .andExpect(jsonPath("$.content[0].sourceProposalId").doesNotExist())
                .andExpect(jsonPath("$.content[0].partnerOrganizationId").doesNotExist())
                .andExpect(jsonPath("$.page").value(0))
                .andExpect(jsonPath("$.totalElements").value(1));
    }

    @Test
    void registrationAvailabilitySupportsOngoingEventAndClosesForCapacityOrDeadline()
            throws Exception {
        Instant now = Instant.now();
        long organizer = insertUser("avail-organizer");
        long participant = insertUser("avail-participant");
        long eventId = insertEvent(organizer, "Ongoing availability event", "ONGOING",
                now.minus(Duration.ofDays(1)), now.plus(Duration.ofDays(3)),
                now.plus(Duration.ofDays(2)));
        long locationId = insertLocation("AVAILABILITY-STAGE", "Availability Stage", "STAGE", 20);
        long openActivity = insertActivity(eventId, locationId, "Open ongoing activity", null,
                "TALK", "PUBLISHED", now.plus(Duration.ofHours(2)),
                now.plus(Duration.ofHours(3)), true, now.plus(Duration.ofHours(1)), 2,
                false, now.minus(Duration.ofDays(1)), UUID.randomUUID(), null, null, null);
        long fullActivity = insertActivity(eventId, locationId, "Full activity", null,
                "TALK", "PUBLISHED", now.plus(Duration.ofHours(4)),
                now.plus(Duration.ofHours(5)), true, now.plus(Duration.ofHours(3)), 1,
                false, now.minus(Duration.ofDays(1)), UUID.randomUUID(), null, null, null);
        long expiredActivity = insertActivity(eventId, locationId, "Expired registration", null,
                "TALK", "PUBLISHED", now.plus(Duration.ofHours(6)),
                now.plus(Duration.ofHours(7)), true, now.minusSeconds(1), 2,
                false, now.minus(Duration.ofDays(1)), UUID.randomUUID(), null, null, null);
        long eventRegistrationId = insertEventRegistration(participant, eventId, now);
        insertActivityRegistration(eventRegistrationId, fullActivity, "ACTIVE", now);

        mvc.perform(get(PUBLIC + "/" + openActivity))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.registrationOpen").value(true))
                .andExpect(jsonPath("$.availableSeats").value(2));
        mvc.perform(get(PUBLIC + "/" + fullActivity))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.registrationOpen").value(false))
                .andExpect(jsonPath("$.registeredCount").value(1))
                .andExpect(jsonPath("$.availableSeats").value(0));
        mvc.perform(get(PUBLIC + "/" + expiredActivity))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.registrationOpen").value(false))
                .andExpect(jsonPath("$.availableSeats").value(2));
    }

    @Test
    void listFiltersStatusesSearchTypeLocationAndReturnsValidEmptyPage() throws Exception {
        Instant now = Instant.now();
        long organizer = insertUser("filter-organizer");
        long eventId = insertEvent(organizer, "Filter event", "PUBLISHED",
                now.plus(Duration.ofDays(2)), now.plus(Duration.ofDays(4)),
                now.plus(Duration.ofDays(1)));
        long stage = insertLocation("FILTER-STAGE", "Filter Stage", "STAGE", 60);
        long workshop = insertLocation("FILTER-WORKSHOP", "Filter Workshop", "WORKSHOP", 30);
        long publishedId = insertSimpleActivity(eventId, stage, "Alpha talk", "TALK",
                "PUBLISHED", now.plus(Duration.ofDays(2)), now.plus(Duration.ofDays(2)).plusSeconds(3600),
                now.minusSeconds(60));
        long ongoingId = insertSimpleActivity(eventId, workshop, "Beta workshop", "WORKSHOP", "ONGOING",
                now.minusSeconds(600), now.plusSeconds(600), now.minusSeconds(3600));
        long completedId = insertSimpleActivity(eventId, stage, "Completed session", "TALK",
                "COMPLETED", now.minusSeconds(7200), now.minusSeconds(3600),
                now.minus(Duration.ofDays(1)));
        insertSimpleActivity(eventId, stage, "Private draft", "TALK", "DRAFT",
                now.plus(Duration.ofDays(3)), now.plus(Duration.ofDays(3)).plusSeconds(3600), null);
        insertCancelledActivity(eventId, stage, "Cancelled public", now, true);

        mvc.perform(get(PUBLIC))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.content[*].activityId")
                        .value(containsInAnyOrder((int) publishedId, (int) ongoingId)));
        mvc.perform(get(PUBLIC).param("status", "COMPLETED"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].activityId").value(completedId));
        mvc.perform(get(PUBLIC).param("activityType", " workshop ")
                        .param("locationId", String.valueOf(workshop))
                        .param("search", " beta "))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].title").value("Beta workshop"));
        mvc.perform(get(PUBLIC).param("search", "does-not-exist"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(0))
                .andExpect(jsonPath("$.totalElements").value(0))
                .andExpect(jsonPath("$.totalPages").value(0));
    }

    @Test
    void detailShowsEverPublishedCancellationButConcealsNeverPublishedActivities()
            throws Exception {
        Instant now = Instant.now();
        long organizer = insertUser("detail-organizer");
        long eventId = insertEvent(organizer, "Detail event", "PUBLISHED",
                now.plus(Duration.ofDays(2)), now.plus(Duration.ofDays(3)),
                now.plus(Duration.ofDays(1)));
        long locationId = insertLocation("DETAIL-AREA", "Detail Area", "AREA", 100);
        long publicCancelled = insertCancelledActivity(eventId, locationId,
                "Cancelled after publish", now, true);
        long privateCancelled = insertCancelledActivity(eventId, locationId,
                "Cancelled draft", now, false);
        long draft = insertSimpleActivity(eventId, locationId, "Still draft", "OTHER", "DRAFT",
                now.plus(Duration.ofDays(2)), now.plus(Duration.ofDays(2)).plusSeconds(3600), null);

        mvc.perform(get(PUBLIC + "/" + publicCancelled))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CANCELLED"))
                .andExpect(jsonPath("$.cancellationReason")
                        .value("Hoạt động đã được hủy hợp lệ."))
                .andExpect(jsonPath("$.cancellationSource").value("ORGANIZER"))
                .andExpect(jsonPath("$.attendanceQrToken").doesNotExist());
        mvc.perform(get(PUBLIC + "/" + privateCancelled))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("ACTIVITY_NOT_FOUND"));
        mvc.perform(get(PUBLIC + "/" + draft))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("ACTIVITY_NOT_FOUND"));
        mvc.perform(get(PUBLIC + "/999999999"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("ACTIVITY_NOT_FOUND"));
    }

    @Test
    void responseHandlesNoRegistrationAndEligibleRatingAggregate() throws Exception {
        Instant now = Instant.now();
        long organizer = insertUser("aggregate-organizer");
        long firstParticipant = insertUser("rating-one");
        long secondParticipant = insertUser("rating-two");
        long eventId = insertEvent(organizer, "Aggregate event", "COMPLETED",
                now.minus(Duration.ofDays(2)), now.minus(Duration.ofDays(1)),
                now.minus(Duration.ofDays(3)));
        long locationId = insertLocation("AGG-WORKSHOP", "Aggregate Workshop", "WORKSHOP", 40);
        long activityId = insertActivity(eventId, locationId, "Rated activity", null, "READING",
                "COMPLETED", now.minus(Duration.ofDays(2)),
                now.minus(Duration.ofDays(2)).plusSeconds(3600), true,
                now.minus(Duration.ofDays(3)), 20, true, now.minus(Duration.ofDays(4)),
                UUID.randomUUID(), now.minus(Duration.ofDays(2)).plusSeconds(3600), null, null);
        addRating(firstParticipant, eventId, activityId, 5, "ACTIVE", "VALID", now);
        addRating(secondParticipant, eventId, activityId, 1, "INVALIDATED", "VALID", now);

        long openEvent = insertEvent(organizer, "No registration event", "PUBLISHED",
                now.plus(Duration.ofDays(5)), now.plus(Duration.ofDays(6)),
                now.plus(Duration.ofDays(4)));
        long noRegistration = insertActivity(openEvent, locationId, "Open exhibition", null,
                "EXHIBITION", "PUBLISHED", now.plus(Duration.ofDays(5)),
                now.plus(Duration.ofDays(5)).plusSeconds(3600), false, null, 20, false,
                now.minusSeconds(30), null, null, null, null);

        mvc.perform(get(PUBLIC).param("status", "COMPLETED"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].activityId").value(activityId))
                .andExpect(jsonPath("$.content[0].ratingSummary.averageScore").value(5))
                .andExpect(jsonPath("$.content[0].ratingSummary.ratingCount").value(1))
                .andExpect(jsonPath("$.content[0].registeredCount").value(0))
                .andExpect(jsonPath("$.content[0].registrationOpen").value(false));
        mvc.perform(get(PUBLIC + "/" + noRegistration))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.registrationRequired").value(false))
                .andExpect(jsonPath("$.registrationOpen").value(false))
                .andExpect(jsonPath("$.registeredCount").isEmpty())
                .andExpect(jsonPath("$.availableSeats").isEmpty());
    }

    @Test
    void invalidFiltersPaginationAndSortUseCanonicalErrors() throws Exception {
        mvc.perform(get(PUBLIC).param("status", "CANCELLED"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_ACTIVITY_STATUS_FILTER"));
        mvc.perform(get(PUBLIC).param("page", "-1"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_PAGE"));
        mvc.perform(get(PUBLIC).param("size", "101"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_SIZE"));
        mvc.perform(get(PUBLIC).param("sort", "status,asc"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_SORT"));
        mvc.perform(get(PUBLIC).param("eventId", "0"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_FILTER"));
        mvc.perform(get(PUBLIC).param("activityType", "   "))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_FILTER"));
    }

    private long insertUser(String marker) {
        long id = jdbc.queryForObject("""
                insert into users (username, full_name, password_hash, status)
                values (?, ?, '{noop}unused', 'ACTIVE')
                returning user_id
                """, Long.class, marker + "-" + UUID.randomUUID().toString().substring(0, 6),
                "Public Test User");
        userIds.add(id);
        return id;
    }

    private long insertEvent(long organizer, String name, String status, Instant startAt,
            Instant endAt, Instant participantDeadline) {
        long id = jdbc.queryForObject("""
                insert into events (
                    organizer_user_id, name, description, start_at, end_at,
                    partner_application_deadline_at, booth_request_deadline_at,
                    activity_proposal_deadline_at, participant_registration_deadline_at,
                    partner_withdrawal_cutoff_at, booth_cancellation_cutoff_at,
                    activity_cancellation_cutoff_at, booth_payment_window_minutes,
                    max_booths_per_partner, max_activities_per_partner, status,
                    created_at, updated_at)
                values (?, ?, 'Public Activity integration test', ?, ?, ?, ?, ?, ?, ?, ?, ?,
                        1440, 2, 5, ?, current_timestamp, current_timestamp)
                returning event_id
                """, Long.class, organizer, name, timestamp(startAt), timestamp(endAt),
                timestamp(startAt.minus(Duration.ofDays(2))),
                timestamp(startAt.minus(Duration.ofDays(1))),
                timestamp(startAt.minus(Duration.ofHours(12))), timestamp(participantDeadline),
                timestamp(startAt.minus(Duration.ofHours(6))),
                timestamp(startAt.minus(Duration.ofHours(6))),
                timestamp(startAt.minus(Duration.ofHours(1))), status);
        eventIds.add(id);
        return id;
    }

    private long insertLocation(String code, String name, String type, int capacity) {
        long id = jdbc.queryForObject("""
                insert into locations (code, name, location_type, max_capacity, is_active,
                                       created_at, updated_at)
                values (?, ?, ?, ?, true, current_timestamp, current_timestamp)
                returning location_id
                """, Long.class, code, name, type, capacity);
        locationIds.add(id);
        return id;
    }

    private long insertSimpleActivity(long eventId, long locationId, String title, String type,
            String status, Instant startAt, Instant endAt, Instant publishedAt) {
        return insertActivity(eventId, locationId, title, null, type, status, startAt, endAt,
                false, null, 10, false, publishedAt, null,
                "COMPLETED".equals(status) ? endAt : null, null, null);
    }

    private long insertCancelledActivity(long eventId, long locationId, String title, Instant now,
            boolean everPublished) {
        return insertActivity(eventId, locationId, title, null, "OTHER", "CANCELLED",
                now.plus(Duration.ofDays(2)), now.plus(Duration.ofDays(2)).plusSeconds(3600),
                false, null, 10, false, everPublished ? now.minusSeconds(60) : null, null, null,
                now, "Hoạt động đã được hủy hợp lệ.");
    }

    private long insertActivity(long eventId, long locationId, String title, String description,
            String type, String status, Instant startAt, Instant endAt,
            boolean registrationRequired, Instant registrationDeadline, int capacity,
            boolean certificateEnabled, Instant publishedAt, UUID qrToken, Instant completedAt,
            Instant cancelledAt, String cancellationReason) {
        return jdbc.queryForObject("""
                insert into activities (
                    event_id, location_id, title, description, activity_type, start_at, end_at,
                    registration_required, registration_deadline_at, capacity, image_url,
                    attendance_qr_token, is_certificate_enabled, status, created_at, updated_at,
                    published_at, completed_at, cancelled_at, cancellation_reason,
                    cancellation_source)
                values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, null, ?, ?, ?, current_timestamp,
                        current_timestamp, ?, ?, ?, ?, ?)
                returning activity_id
                """, Long.class, eventId, locationId, title, description, type,
                timestamp(startAt), timestamp(endAt), registrationRequired,
                timestamp(registrationDeadline), capacity, qrToken,
                certificateEnabled, status, timestamp(publishedAt), timestamp(completedAt),
                timestamp(cancelledAt),
                cancellationReason, "CANCELLED".equals(status) ? "ORGANIZER" : null);
    }

    private long insertEventRegistration(long userId, long eventId, Instant now) {
        return jdbc.queryForObject("""
                insert into event_registrations (
                    user_id, event_id, status, registered_at, activated_at, updated_at)
                values (?, ?, 'ACTIVE', ?, ?, ?)
                returning event_registration_id
                """, Long.class, userId, eventId, timestamp(now), timestamp(now), timestamp(now));
    }

    private long insertActivityRegistration(long eventRegistrationId, long activityId,
            String status, Instant now) {
        return jdbc.queryForObject("""
                insert into activity_registrations (
                    event_registration_id, activity_id, status, registered_at, activated_at,
                    updated_at)
                values (?, ?, ?, ?, ?, ?)
                returning activity_registration_id
                """, Long.class, eventRegistrationId, activityId, status, timestamp(now),
                timestamp(now), timestamp(now));
    }

    private void addRating(long userId, long eventId, long activityId, int score,
            String ratingStatus, String attendanceStatus, Instant now) {
        long eventRegistrationId = insertEventRegistration(userId, eventId, now);
        long registrationId = insertActivityRegistration(eventRegistrationId, activityId,
                "ACTIVE", now);
        Long attendanceId = jdbc.queryForObject("""
                insert into attendances (
                    activity_registration_id, status, recorded_source, attended_at, created_at,
                    updated_at, voided_at)
                values (?, ?, 'SELF_SCAN', ?, ?, ?, ?)
                returning attendance_id
                """, Long.class, registrationId, attendanceStatus, timestamp(now),
                timestamp(now), timestamp(now),
                "VOIDED".equals(attendanceStatus) ? timestamp(now) : null);
        jdbc.update("""
                insert into activity_ratings (
                    attendance_id, rating_score, comment, status, created_at, updated_at,
                    invalidated_at)
                values (?, ?, 'Rating test', ?, ?, ?, ?)
                """, attendanceId, score, ratingStatus, timestamp(now), timestamp(now),
                "INVALIDATED".equals(ratingStatus) ? timestamp(now) : null);
    }

    private static Timestamp timestamp(Instant value) {
        return value == null ? null : Timestamp.from(value);
    }
}
