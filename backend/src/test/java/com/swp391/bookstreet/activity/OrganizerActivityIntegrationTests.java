package com.swp391.bookstreet.activity;

import com.swp391.bookstreet.activity.service.ActivityLifecycleService;
import com.swp391.bookstreet.activity.service.ActivityPartnerMailService;
import com.swp391.bookstreet.security.authentication.AuthenticatedPrincipal;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
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
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
        "spring.datasource.url=${EVENT_TEST_DATABASE_URL}",
        "spring.datasource.hikari.maximum-pool-size=2",
        "spring.datasource.hikari.minimum-idle=0",
        "logging.level.org.springframework.security=ERROR"
})
@EnabledIfEnvironmentVariable(named = "EVENT_TEST_DATABASE_URL", matches = ".+")
@ContextConfiguration(initializers = OrganizerActivityIntegrationTests.TestDatabaseGuard.class)
class OrganizerActivityIntegrationTests {
    static class TestDatabaseGuard
            implements ApplicationContextInitializer<ConfigurableApplicationContext> {
        @Override
        public void initialize(ConfigurableApplicationContext applicationContext) {
            String url = applicationContext.getEnvironment()
                    .getRequiredProperty("spring.datasource.url");
            if (!url.matches("jdbc:postgresql://[^/]+/[A-Za-z0-9_]+_event_test(?:\\?.*)?")) {
                throw new IllegalStateException(
                        "Activity tests require a dedicated *_event_test database.");
            }
        }
    }

    private static final String ACTIVITIES = "/api/v1/organizer/activities";

    @Autowired WebApplicationContext context;
    @Autowired JdbcTemplate jdbc;
    @Autowired ObjectMapper mapper;
    @Autowired ActivityLifecycleService lifecycleService;
    @MockitoBean ActivityPartnerMailService partnerMailService;

    MockMvc mvc;
    Long organizerUser;
    Long otherOrganizerUser;
    String prefix;

    @BeforeEach
    void setup() {
        assertThat(jdbc.queryForObject("select current_database()", String.class))
                .endsWith("_event_test");
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        organizerUser = insertUser("Activity Owner");
        otherOrganizerUser = insertUser("Other Activity Owner");
        prefix = "A" + UUID.randomUUID().toString().replace("-", "")
                .substring(0, 8).toUpperCase();
    }

    @AfterEach
    void cleanup() {
        jdbc.update("delete from notifications where recipient_role = 'PARTNER'");
        jdbc.update("delete from activity_revisions where activity_id in "
                + "(select activity_id from activities where event_id in "
                + "(select event_id from events where organizer_user_id in (?, ?)))",
                organizerUser, otherOrganizerUser);
        jdbc.update("delete from activity_requests where activity_id in "
                + "(select activity_id from activities where event_id in "
                + "(select event_id from events where organizer_user_id in (?, ?)))",
                organizerUser, otherOrganizerUser);
        jdbc.update("delete from activities where event_id in "
                + "(select event_id from events where organizer_user_id in (?, ?))",
                organizerUser, otherOrganizerUser);
        jdbc.update("delete from activity_proposals where application_id in "
                + "(select application_id from partner_event_applications where event_id in "
                + "(select event_id from events where organizer_user_id in (?, ?)))",
                organizerUser, otherOrganizerUser);
        jdbc.update("delete from partner_event_applications where event_id in "
                + "(select event_id from events where organizer_user_id in (?, ?))",
                organizerUser, otherOrganizerUser);
        jdbc.update("delete from events where organizer_user_id in (?, ?)",
                organizerUser, otherOrganizerUser);
        jdbc.update("delete from booths where booth_id in "
                + "(select location_id from locations where code like ?)", prefix + "%");
        jdbc.update("delete from locations where code like ?", prefix + "%");
        jdbc.update("delete from users where user_id in (?, ?)",
                organizerUser, otherOrganizerUser);
    }

    @Test
    void createsNormalizesListsAndProtectsOrganizerOwnership() throws Exception {
        Instant eventStart = Instant.now().plus(Duration.ofDays(5));
        long eventId = insertEvent(organizerUser, "DRAFT", eventStart,
                eventStart.plus(Duration.ofDays(2)));
        long foreignEventId = insertEvent(otherOrganizerUser, "DRAFT", eventStart,
                eventStart.plus(Duration.ofDays(2)));
        long stageId = insertLocation(prefix + "STAGE", "STAGE", 120, true);
        long boothId = insertLocation(prefix + "BOOTH", "BOOTH", 10, true);
        jdbc.update("insert into booths(booth_id, category_code) values (?, 'PUBLISHER')",
                boothId);
        Instant start = eventStart.plus(Duration.ofHours(1));
        long activityId = create(eventId, stageId, "  Opening   Ceremony  ", start,
                start.plus(Duration.ofHours(1)));

        mvc.perform(get(ACTIVITIES + "?eventId=" + eventId)
                        .with(organizer(organizerUser)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].activityId").value(activityId));
        mvc.perform(get(ACTIVITIES + "?search=opening&status=DRAFT")
                        .with(organizer(organizerUser)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].activityId").value(activityId))
                .andExpect(jsonPath("$.content[0].title").value("Opening Ceremony"));
        mvc.perform(get(ACTIVITIES + "/" + activityId).with(organizer(organizerUser)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.location.locationId").value(stageId));
        mvc.perform(get(ACTIVITIES + "/" + activityId).with(organizer(otherOrganizerUser)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("ACTIVITY_NOT_FOUND"));

        mvc.perform(post(ACTIVITIES).with(organizer(organizerUser)).with(csrf())
                        .contentType("application/json")
                        .content(createJson(eventId, boothId, "Booth shortcut", start,
                                start.plus(Duration.ofHours(1)))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("BOOTH_ASSIGNMENT_REQUIRED"));
        mvc.perform(post(ACTIVITIES).with(organizer(organizerUser)).with(csrf())
                        .contentType("application/json")
                        .content(createJson(foreignEventId, stageId, "Foreign", start,
                                start.plus(Duration.ofHours(1)))))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("EVENT_NOT_FOUND"));
    }

    @Test
    void scheduleConflictIsCrossEventHalfOpenAndDatabaseBacked() throws Exception {
        Instant eventStart = Instant.now().plus(Duration.ofDays(7));
        long firstEvent = insertEvent(organizerUser, "DRAFT", eventStart,
                eventStart.plus(Duration.ofDays(2)));
        long secondEvent = insertEvent(organizerUser, "DRAFT", eventStart,
                eventStart.plus(Duration.ofDays(2)));
        long locationId = insertLocation(prefix + "AREA", "AREA", 50, true);
        Instant start = eventStart.plus(Duration.ofHours(3));
        Instant end = start.plus(Duration.ofHours(1));
        create(firstEvent, locationId, "First", start, end);

        mvc.perform(post(ACTIVITIES).with(organizer(organizerUser)).with(csrf())
                        .contentType("application/json")
                        .content(createJson(secondEvent, locationId, "Overlap",
                                end.minusSeconds(1), end.plus(Duration.ofHours(1)))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("ACTIVITY_LOCATION_TIME_CONFLICT"));
        mvc.perform(post(ACTIVITIES).with(organizer(organizerUser)).with(csrf())
                        .contentType("application/json")
                        .content(createJson(secondEvent, locationId, "Adjacent", end,
                                end.plus(Duration.ofHours(1)))))
                .andExpect(status().isCreated());
    }

    @Test
    void patchWritesRevisionAndPublishedCoreChangeRequiresReason() throws Exception {
        Instant eventStart = Instant.now().plus(Duration.ofDays(8));
        long eventId = insertEvent(organizerUser, "PUBLISHED", eventStart,
                eventStart.plus(Duration.ofDays(1)));
        long locationId = insertLocation(prefix + "WORKSHOP", "WORKSHOP", 80, true);
        Instant start = eventStart.plus(Duration.ofHours(2));
        long activityId = create(eventId, locationId, "Original title", start,
                start.plus(Duration.ofHours(1)));

        mvc.perform(patch(ACTIVITIES + "/" + activityId)
                        .with(organizer(organizerUser)).with(csrf())
                        .contentType("application/json")
                        .content("{\"title\":\"  Revised   draft  \",\"imageUrl\":\"https://example.test/a.jpg\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Revised draft"));
        assertThat(jdbc.queryForObject(
                "select count(*) from activity_revisions where activity_id = ?",
                Integer.class, activityId)).isOne();
        assertThat(jdbc.queryForObject("select old_snapshot ->> 'title' "
                + "from activity_revisions where activity_id = ?", String.class, activityId))
                .isEqualTo("Original title");

        mvc.perform(post(ACTIVITIES + "/" + activityId + "/publish")
                        .with(organizer(organizerUser)).with(csrf())
                        .contentType("application/json"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PUBLISHED"));
        mvc.perform(patch(ACTIVITIES + "/" + activityId)
                        .with(organizer(organizerUser)).with(csrf())
                        .contentType("application/json")
                        .content("{\"title\":\"Published edit\"}"))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
        mvc.perform(patch(ACTIVITIES + "/" + activityId)
                        .with(organizer(organizerUser)).with(csrf())
                        .contentType("application/json")
                        .content("{\"title\":\"Published edit\","
                                + "\"changeReason\":\"Cập nhật nội dung chính thức.\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Published edit"))
                .andExpect(jsonPath("$.status").value("PUBLISHED"));
        assertThat(jdbc.queryForObject(
                "select count(*) from activity_revisions where activity_id = ?",
                Integer.class, activityId)).isEqualTo(2);
    }

    @Test
    void publishCreatesAttendanceQrExactlyOnceAndValidatesRegistration() throws Exception {
        Instant eventStart = Instant.now().plus(Duration.ofDays(6));
        long eventId = insertEvent(organizerUser, "PUBLISHED", eventStart,
                eventStart.plus(Duration.ofDays(1)));
        long locationId = insertLocation(prefix + "STAGEQR", "STAGE", 200, true);
        Instant start = eventStart.plus(Duration.ofHours(1));
        long activityId = create(eventId, locationId, "Registered talk", start,
                start.plus(Duration.ofHours(1)));
        Instant deadline = start.minus(Duration.ofHours(1));

        mvc.perform(patch(ACTIVITIES + "/" + activityId)
                        .with(organizer(organizerUser)).with(csrf())
                        .contentType("application/json")
                        .content("{\"registrationRequired\":true,"
                                + "\"registrationDeadlineAt\":\"" + deadline + "\","
                                + "\"certificateEnabled\":true}"))
                .andExpect(status().isOk());
        String first = mvc.perform(post(ACTIVITIES + "/" + activityId + "/publish")
                        .with(organizer(organizerUser)).with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.attendanceQrAvailable").value(true))
                .andReturn().getResponse().getContentAsString();
        String second = mvc.perform(post(ACTIVITIES + "/" + activityId + "/publish")
                        .with(organizer(organizerUser)).with(csrf()))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        JsonNode firstJson = mapper.readTree(first);
        JsonNode secondJson = mapper.readTree(second);
        assertThat(secondJson.get("attendanceQrToken").asText())
                .isEqualTo(firstJson.get("attendanceQrToken").asText());
        assertThat(secondJson.get("publishedAt").asText())
                .isEqualTo(firstJson.get("publishedAt").asText());
    }

    @Test
    void timedLifecycleIsMonotonicAndClosesOnlyObsoletePendingRequests() {
        Instant now = Instant.now();
        long eventId = insertEvent(organizerUser, "ONGOING", now.minus(Duration.ofHours(2)),
                now.plus(Duration.ofHours(2)));
        long locationId = insertLocation(prefix + "LIFECYCLE", "AREA", 40, true);
        long activityId = insertPublishedActivity(eventId, locationId,
                now.minus(Duration.ofMinutes(5)), now.plus(Duration.ofMinutes(30)));
        long changeRequest = insertPendingRequest(activityId, "CHANGE");

        assertThat(lifecycleService.advanceDueActivities()).isGreaterThanOrEqualTo(1);
        assertThat(dbStatus("activities", "activity_id", activityId)).isEqualTo("ONGOING");
        assertThat(dbStatus("activity_requests", "activity_request_id", changeRequest))
                .isEqualTo("CANCELLED");

        long cancellationRequest = insertPendingRequest(activityId, "CANCELLATION");
        assertThat(dbStatus("activity_requests", "activity_request_id", cancellationRequest))
                .isEqualTo("PENDING");

        jdbc.update("update activities set end_at = ? where activity_id = ?",
                Timestamp.from(now.minusSeconds(1)), activityId);
        assertThat(lifecycleService.advanceDueActivities()).isGreaterThanOrEqualTo(1);
        assertThat(dbStatus("activities", "activity_id", activityId)).isEqualTo("COMPLETED");
        assertThat(dbStatus("activity_requests", "activity_request_id", cancellationRequest))
                .isEqualTo("CANCELLED");
        assertThat(lifecycleService.advanceDueActivities()).isZero();
    }

    @Test
    void organizerCancellationIsIdempotentAndClosesPendingRequest() throws Exception {
        Instant now = Instant.now();
        long eventId = insertEvent(organizerUser, "PUBLISHED", now.plus(Duration.ofDays(1)),
                now.plus(Duration.ofDays(2)));
        long locationId = insertLocation(prefix + "CANCEL", "STAGE", 60, true);
        long activityId = insertPublishedActivity(eventId, locationId,
                now.plus(Duration.ofHours(26)), now.plus(Duration.ofHours(27)));
        long pendingRequest = insertPendingRequest(activityId, "CHANGE");

        String first = mvc.perform(post(ACTIVITIES + "/" + activityId + "/cancel")
                        .with(organizer(organizerUser)).with(csrf())
                        .contentType("application/json")
                        .content("{\"reason\":\"  Diễn giả không thể tiếp tục tham gia.  \"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CANCELLED"))
                .andExpect(jsonPath("$.cancellationSource").value("ORGANIZER"))
                .andExpect(jsonPath("$.cancellationReason")
                        .value("Diễn giả không thể tiếp tục tham gia."))
                .andReturn().getResponse().getContentAsString();
        assertThat(dbStatus("activity_requests", "activity_request_id", pendingRequest))
                .isEqualTo("CANCELLED");

        String retry = mvc.perform(post(ACTIVITIES + "/" + activityId + "/cancel")
                        .with(organizer(organizerUser)).with(csrf())
                        .contentType("application/json")
                        .content("{\"reason\":\"x\"}"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        assertThat(mapper.readTree(retry).get("cancelledAt").asText())
                .isEqualTo(mapper.readTree(first).get("cancelledAt").asText());
        assertThat(mapper.readTree(retry).get("cancellationReason").asText())
                .isEqualTo("Diễn giả không thể tiếp tục tham gia.");

        mvc.perform(post(ACTIVITIES + "/" + activityId + "/cancel")
                        .with(organizer(otherOrganizerUser)).with(csrf())
                        .contentType("application/json")
                        .content("{\"reason\":\"Một lý do hủy hợp lệ khác.\"}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("ACTIVITY_NOT_FOUND"));
    }

    @Test
    void completedActivityCannotBeCancelledAndRevisionHistoryIsOwnedAndPaged()
            throws Exception {
        Instant future = Instant.now().plus(Duration.ofDays(3));
        long draftEvent = insertEvent(organizerUser, "DRAFT", future,
                future.plus(Duration.ofDays(1)));
        long locationId = insertLocation(prefix + "REVISION", "WORKSHOP", 50, true);
        long activityId = create(draftEvent, locationId, "Revision source",
                future.plus(Duration.ofHours(1)), future.plus(Duration.ofHours(2)));
        mvc.perform(patch(ACTIVITIES + "/" + activityId)
                        .with(organizer(organizerUser)).with(csrf())
                        .contentType("application/json")
                        .content("{\"description\":\"First revision\"}"))
                .andExpect(status().isOk());
        mvc.perform(patch(ACTIVITIES + "/" + activityId)
                        .with(organizer(organizerUser)).with(csrf())
                        .contentType("application/json")
                        .content("{\"description\":\"Second revision\"}"))
                .andExpect(status().isOk());

        mvc.perform(get(ACTIVITIES + "/" + activityId
                        + "/revisions?size=1&sort=activityRevisionId,desc")
                        .with(organizer(organizerUser)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.totalPages").value(2))
                .andExpect(jsonPath("$.content[0].newSnapshot.description")
                        .value("Second revision"));
        mvc.perform(get(ACTIVITIES + "/" + activityId + "/revisions")
                        .with(organizer(otherOrganizerUser)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("ACTIVITY_NOT_FOUND"));
        mvc.perform(get(ACTIVITIES + "/" + activityId
                        + "/revisions?sort=activityId,asc")
                        .with(organizer(organizerUser)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_SORT"));

        Instant now = Instant.now();
        long ongoingEvent = insertEvent(organizerUser, "ONGOING",
                now.minus(Duration.ofHours(3)), now.plus(Duration.ofHours(2)));
        long completedId = insertPublishedActivity(ongoingEvent, locationId,
                now.minus(Duration.ofHours(2)), now.minus(Duration.ofHours(1)));
        mvc.perform(post(ACTIVITIES + "/" + completedId + "/cancel")
                        .with(organizer(organizerUser)).with(csrf())
                        .contentType("application/json")
                        .content("{\"reason\":\"Không thể hủy hoạt động đã hoàn tất.\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("ACTIVITY_NOT_CANCELLABLE"));
        assertThat(dbStatus("activities", "activity_id", completedId))
                .isNotEqualTo("CANCELLED");
    }

    private long create(long eventId, long locationId, String title, Instant start,
            Instant end) throws Exception {
        String response = mvc.perform(post(ACTIVITIES).with(organizer(organizerUser)).with(csrf())
                        .contentType("application/json")
                        .content(createJson(eventId, locationId, title, start, end)))
                .andExpect(status().isCreated())
                .andExpect(header().exists("Location"))
                .andReturn().getResponse().getContentAsString();
        return mapper.readTree(response).get("activityId").asLong();
    }

    private String createJson(long eventId, long locationId, String title, Instant start,
            Instant end) {
        return """
                {
                  "eventId": %d,
                  "locationId": %d,
                  "title": "%s",
                  "description": "Activity integration test",
                  "activityType": "TALKSHOW",
                  "startAt": "%s",
                  "endAt": "%s",
                  "capacity": 30,
                  "registrationRequired": false,
                  "registrationDeadlineAt": null,
                  "certificateEnabled": false
                }
                """.formatted(eventId, locationId, title, start, end);
    }

    private long insertEvent(long organizerId, String status, Instant start, Instant end) {
        return jdbc.queryForObject("""
                insert into events(
                    organizer_user_id, name, start_at, end_at,
                    booth_payment_window_minutes, max_booths_per_partner,
                    max_activities_per_partner, status, created_at, updated_at)
                values (?, ?, ?, ?, 60, 2, 3, ?, current_timestamp, current_timestamp)
                returning event_id
                """, Long.class, organizerId, prefix + " Event", Timestamp.from(start),
                Timestamp.from(end), status);
    }

    private long insertLocation(String code, String type, int capacity, boolean active) {
        return jdbc.queryForObject("""
                insert into locations(code, name, location_type, max_capacity, is_active,
                    created_at, updated_at)
                values (?, ?, ?, ?, ?, current_timestamp, current_timestamp)
                returning location_id
                """, Long.class, code, code + " Location", type, capacity, active);
    }

    private long insertPublishedActivity(long eventId, long locationId, Instant start,
            Instant end) {
        return jdbc.queryForObject("""
                insert into activities(
                    event_id, location_id, title, activity_type, start_at, end_at,
                    registration_required, capacity, is_certificate_enabled, status,
                    created_at, updated_at, published_at)
                values (?, ?, 'Lifecycle Activity', 'TALKSHOW', ?, ?, false, 20, false,
                    'PUBLISHED', current_timestamp, current_timestamp, current_timestamp)
                returning activity_id
                """, Long.class, eventId, locationId, Timestamp.from(start), Timestamp.from(end));
    }

    private long insertPendingRequest(long activityId, String type) {
        return jdbc.queryForObject("""
                insert into activity_requests(
                    activity_id, request_type, requested_title, reason, status, submitted_at)
                values (?, ?, case when ? = 'CHANGE' then 'Changed title' else null end,
                    'A sufficiently detailed request reason.', 'PENDING', current_timestamp)
                returning activity_request_id
                """, Long.class, activityId, type, type);
    }

    private String dbStatus(String table, String idColumn, long id) {
        return jdbc.queryForObject("select status from " + table + " where " + idColumn + " = ?",
                String.class, id);
    }

    private long insertUser(String fullName) {
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        return jdbc.queryForObject("""
                insert into users(username, password_hash, full_name, email,
                    email_verified_at, status)
                values (?, '{noop}unused', ?, ?, current_timestamp, 'ACTIVE')
                returning user_id
                """, Long.class, "activity-" + suffix, fullName,
                "activity-" + suffix + "@example.test");
    }

    private RequestPostProcessor organizer(Long userId) {
        return authentication(identity(userId));
    }

    private UsernamePasswordAuthenticationToken identity(Long userId) {
        var principal = new Identity(userId, true);
        return new UsernamePasswordAuthenticationToken(principal, null,
                List.of(new SimpleGrantedAuthority("ROLE_ORGANIZER")));
    }

    record Identity(Long userId, boolean emailVerified) implements AuthenticatedPrincipal {
    }
}
