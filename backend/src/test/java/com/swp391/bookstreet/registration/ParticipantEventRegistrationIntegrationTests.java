package com.swp391.bookstreet.registration;

import com.swp391.bookstreet.event.service.EventCancellationMailService;
import com.swp391.bookstreet.security.authentication.AuthenticatedPrincipal;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.ApplicationContextInitializer;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
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
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
        "spring.datasource.url=${EVENT_TEST_DATABASE_URL}",
        "logging.level.org.springframework.security=ERROR"
})
@EnabledIfEnvironmentVariable(named = "EVENT_TEST_DATABASE_URL", matches = ".+")
@ContextConfiguration(initializers = ParticipantEventRegistrationIntegrationTests.TestDatabaseGuard.class)
@Import(ParticipantEventRegistrationIntegrationTests.FixedClockConfiguration.class)
class ParticipantEventRegistrationIntegrationTests {
    private static final Instant BASE = Instant.parse("2026-10-19T08:00:00Z");
    private static final String PARTICIPANT = "/api/v1/participant";

    static class TestDatabaseGuard implements ApplicationContextInitializer<ConfigurableApplicationContext> {
        @Override
        public void initialize(ConfigurableApplicationContext applicationContext) {
            String url = applicationContext.getEnvironment()
                    .getRequiredProperty("spring.datasource.url");
            if (!url.matches("jdbc:postgresql://[^/]+/[A-Za-z0-9_]+_event_test(?:\\?.*)?")) {
                throw new IllegalStateException(
                        "Registration tests require a dedicated *_event_test database.");
            }
        }
    }

    @TestConfiguration
    static class FixedClockConfiguration {
        @Bean
        @Primary
        MutableClock registrationTestClock() {
            return new MutableClock(BASE);
        }
    }

    static final class MutableClock extends Clock {
        private final AtomicReference<Instant> instant;

        MutableClock(Instant initial) {
            instant = new AtomicReference<>(initial);
        }

        void set(Instant value) {
            instant.set(value);
        }

        @Override public ZoneId getZone() { return ZoneOffset.UTC; }
        @Override public Clock withZone(ZoneId zone) { return this; }
        @Override public Instant instant() { return instant.get(); }
    }

    @Autowired WebApplicationContext context;
    @Autowired JdbcTemplate jdbc;
    @Autowired ObjectMapper mapper;
    @Autowired MutableClock clock;
    @MockitoBean EventCancellationMailService cancellationMailService;
    MockMvc mvc;
    Long organizerId;
    Long participantId;
    Long otherParticipantId;

    @BeforeEach
    void setup() {
        assertThat(jdbc.queryForObject("select current_database()", String.class))
                .endsWith("_event_test");
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        clock.set(BASE);
        organizerId = insertUser("organizer");
        participantId = insertUser("participant");
        otherParticipantId = insertUser("other");
    }

    @AfterEach
    void cleanup() {
        jdbc.update("delete from notifications where recipient_user_id in (?, ?)",
                participantId, otherParticipantId);
        jdbc.update("""
                delete from activity_ratings where attendance_id in (
                    select attendance_id from attendances where activity_registration_id in (
                        select activity_registration_id from activity_registrations
                        where event_registration_id in (
                            select event_registration_id from event_registrations
                            where user_id in (?, ?)
                        )
                    )
                )
                """, participantId, otherParticipantId);
        jdbc.update("""
                delete from certificates where attendance_id in (
                    select attendance_id from attendances where activity_registration_id in (
                        select activity_registration_id from activity_registrations
                        where event_registration_id in (
                            select event_registration_id from event_registrations
                            where user_id in (?, ?)
                        )
                    )
                )
                """, participantId, otherParticipantId);
        jdbc.update("""
                delete from attendances where activity_registration_id in (
                    select activity_registration_id from activity_registrations
                    where event_registration_id in (
                        select event_registration_id from event_registrations
                        where user_id in (?, ?)
                    )
                )
                """, participantId, otherParticipantId);
        jdbc.update("""
                delete from activity_registrations
                where event_registration_id in (
                    select event_registration_id from event_registrations
                    where user_id in (?, ?)
                )
                """, participantId, otherParticipantId);
        jdbc.update("delete from event_registrations where user_id in (?, ?)",
                participantId, otherParticipantId);
        jdbc.update("delete from activities where event_id in (select event_id from events where organizer_user_id = ?)",
                organizerId);
        jdbc.update("delete from locations where code like ?", "REG6-%");
        jdbc.update("delete from events where organizer_user_id = ?", organizerId);
        jdbc.update("delete from users where user_id in (?, ?, ?)", organizerId,
                participantId, otherParticipantId);
    }

    @Test
    void organizerReadsRegistrationsCommittedByParticipantCommands() throws Exception {
        long eventId = insertEvent("Shared registration evidence", BASE.plus(Duration.ofHours(1)));
        long activityId = insertActivity(eventId, insertLocation(), "Shared activity",
                BASE.plus(Duration.ofHours(2)), BASE.plus(Duration.ofHours(3)),
                BASE.plus(Duration.ofHours(1)), 10, true, "PUBLISHED");
        JsonNode registered = body(mvc.perform(post(PARTICIPANT + "/activities/" + activityId + "/register")
                        .with(participant(participantId)).with(csrf()))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        long registrationId = registered.get("activityRegistrationId").asLong();

        mvc.perform(get("/api/v1/organizer/events/" + eventId + "/event-registrations")
                        .with(organizer(organizerId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].participant.userId").value(participantId))
                .andExpect(jsonPath("$.content[0].seatActiveActivityCount").value(1));
        mvc.perform(get("/api/v1/organizer/activities/" + activityId + "/registrations")
                        .with(organizer(organizerId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].activityRegistrationId").value(registrationId))
                .andExpect(jsonPath("$.content[0].registrationStatus").value("ACTIVE"));

        mvc.perform(post(PARTICIPANT + "/activities/" + activityId + "/cancel-registration")
                        .with(participant(participantId)).with(csrf())).andExpect(status().isOk());
        mvc.perform(get("/api/v1/organizer/activities/" + activityId + "/registrations")
                        .with(organizer(organizerId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].activityRegistrationId").value(registrationId))
                .andExpect(jsonPath("$.content[0].registrationStatus").value("CANCELLED"));
        mvc.perform(get("/api/v1/organizer/events/" + eventId + "/event-registrations")
                        .with(organizer(organizerId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].seatActiveActivityCount").value(0));
    }

    @Test
    void joinListDetailLeaveAndRejoinReuseOneDurableIdentity() throws Exception {
        long eventId = insertEvent("Alpha Event", BASE.plus(Duration.ofHours(1)));

        JsonNode joined = body(mvc.perform(post(PARTICIPANT + "/events/" + eventId + "/join")
                        .with(participant(participantId)).with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ACTIVE"))
                .andExpect(jsonPath("$.event.eventId").value(eventId))
                .andExpect(jsonPath("$.seatActiveActivityCount").value(0))
                .andReturn().getResponse().getContentAsString());
        long registrationId = joined.get("eventRegistrationId").asLong();
        String registeredAt = joined.get("registeredAt").asText();

        mvc.perform(post(PARTICIPANT + "/events/" + eventId + "/join")
                        .with(participant(participantId)).with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.eventRegistrationId").value(registrationId))
                .andExpect(jsonPath("$.registeredAt").value(registeredAt));

        mvc.perform(get(PARTICIPANT + "/event-registrations")
                        .with(participant(participantId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].eventRegistrationId")
                        .value(registrationId));

        mvc.perform(get(PARTICIPANT + "/event-registrations")
                        .queryParam("sort", "eventName,asc")
                        .queryParam("status", "ACTIVE")
                        .queryParam("eventStatus", "PUBLISHED")
                        .queryParam("search", " Alpha ")
                        .with(participant(participantId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].eventRegistrationId")
                        .value(registrationId));
        mvc.perform(get(PARTICIPANT + "/event-registrations/" + registrationId)
                        .with(participant(participantId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.event.name").value("Alpha Event"));

        clock.set(BASE.plusSeconds(10));
        JsonNode left = body(mvc.perform(post(PARTICIPANT + "/events/" + eventId + "/leave")
                        .with(participant(participantId)).with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("LEFT"))
                .andReturn().getResponse().getContentAsString());
        String leftAt = left.get("leftAt").asText();
        mvc.perform(post(PARTICIPANT + "/events/" + eventId + "/leave")
                        .with(participant(participantId)).with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.leftAt").value(leftAt));

        clock.set(BASE.plusSeconds(20));
        mvc.perform(post(PARTICIPANT + "/events/" + eventId + "/join")
                        .with(participant(participantId)).with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.eventRegistrationId").value(registrationId))
                .andExpect(jsonPath("$.registeredAt").value(registeredAt))
                .andExpect(jsonPath("$.leftAt").doesNotExist());
        assertThat(jdbc.queryForObject("""
                select count(*) from event_registrations where user_id = ? and event_id = ?
                """, Long.class, participantId, eventId)).isEqualTo(1L);
    }

    @Test
    void deadlineIsInclusiveAndLaterJoinIsRejected() throws Exception {
        long exactId = insertEvent("Exact deadline", BASE);
        mvc.perform(post(PARTICIPANT + "/events/" + exactId + "/join")
                        .with(participant(participantId)).with(csrf()))
                .andExpect(status().isOk());

        long expiredId = insertEvent("Expired deadline", BASE);
        clock.set(BASE.plusNanos(1_000));
        mvc.perform(post(PARTICIPANT + "/events/" + expiredId + "/join")
                        .with(participant(participantId)).with(csrf()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code")
                        .value("EVENT_REGISTRATION_DEADLINE_PASSED"));
    }

    @Test
    void ownershipRoleAndCsrfBoundariesAreEnforced() throws Exception {
        long eventId = insertEvent("Security Event", BASE.plusSeconds(60));
        long registrationId = join(eventId, participantId);

        mvc.perform(get(PARTICIPANT + "/event-registrations/" + registrationId)
                        .with(participant(otherParticipantId)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("EVENT_REGISTRATION_NOT_FOUND"));
        mvc.perform(post(PARTICIPANT + "/events/" + eventId + "/leave")
                        .with(participant(participantId)))
                .andExpect(status().isForbidden());
        mvc.perform(get(PARTICIPANT + "/event-registrations")
                        .with(role(participantId, "PARTNER")))
                .andExpect(status().isForbidden());
        mvc.perform(get(PARTICIPANT + "/event-registrations"))
                .andExpect(status().isUnauthorized());
        mvc.perform(get(PARTICIPANT + "/event-registrations")
                        .queryParam("sort", "unsupported,asc")
                        .with(participant(participantId)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_SORT"));
    }

    @Test
    void participantEvidenceFreezesOperationalEventPatchAndRollsBackMixedPatch()
            throws Exception {
        long eventId = insertEvent("Frozen Event", BASE.plus(Duration.ofHours(1)));
        join(eventId, participantId);

        mvc.perform(patch("/api/v1/organizer/events/" + eventId)
                        .with(organizer(organizerId)).with(csrf())
                        .contentType("application/json")
                        .content("""
                                {
                                  "name": "Must not be persisted",
                                  "maxActivitiesPerPartner": 9
                                }
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code")
                        .value("EVENT_OPERATIONAL_FIELDS_LOCKED"));
        assertThat(jdbc.queryForObject(
                "select name from events where event_id = ?", String.class, eventId))
                .isEqualTo("Frozen Event");

        mvc.perform(patch("/api/v1/organizer/events/" + eventId)
                        .with(organizer(organizerId)).with(csrf())
                        .contentType("application/json")
                        .content("{\"name\":\"Descriptive update\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Descriptive update"));
    }

    @Test
    void seatActiveActivityBlocksLeaveButCompletedHistoryDoesNot() throws Exception {
        long eventId = insertEvent("Activity Event", BASE.plusSeconds(60));
        long registrationId = join(eventId, participantId);
        long locationId = insertLocation();
        long activityId = insertActivity(eventId, locationId, "PUBLISHED");
        jdbc.update("""
                insert into activity_registrations(
                    event_registration_id, activity_id, status, registered_at,
                    activated_at, updated_at)
                values (?, ?, 'ACTIVE', ?, ?, ?)
                """, registrationId, activityId, Timestamp.from(BASE),
                Timestamp.from(BASE), Timestamp.from(BASE));

        mvc.perform(post(PARTICIPANT + "/events/" + eventId + "/leave")
                        .with(participant(participantId)).with(csrf()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code")
                        .value("EVENT_LEAVE_BLOCKED_BY_ACTIVE_ACTIVITY"));
        mvc.perform(get(PARTICIPANT + "/event-registrations/" + registrationId)
                        .with(participant(participantId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.seatActiveActivityCount").value(1));

        jdbc.update("update activities set status = 'COMPLETED', completed_at = ? where activity_id = ?",
                Timestamp.from(BASE), activityId);
        mvc.perform(post(PARTICIPANT + "/events/" + eventId + "/leave")
                        .with(participant(participantId)).with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("LEFT"))
                .andExpect(jsonPath("$.seatActiveActivityCount").value(0));
    }

    @Test
    void concurrentJoinConvergesOnOneRegistrationRow() throws Exception {
        long eventId = insertEvent("Concurrent Event", BASE.plusSeconds(60));
        var ready = new CountDownLatch(2);
        var start = new CountDownLatch(1);
        var executor = Executors.newFixedThreadPool(2);
        try {
            var first = executor.submit(() -> concurrentJoin(eventId, ready, start));
            var second = executor.submit(() -> concurrentJoin(eventId, ready, start));
            assertThat(ready.await(5, TimeUnit.SECONDS)).isTrue();
            start.countDown();

            JsonNode firstBody = body(first.get(10, TimeUnit.SECONDS));
            JsonNode secondBody = body(second.get(10, TimeUnit.SECONDS));
            assertThat(firstBody.get("eventRegistrationId").asLong())
                    .isEqualTo(secondBody.get("eventRegistrationId").asLong());
            assertThat(jdbc.queryForObject("""
                    select count(*) from event_registrations where user_id = ? and event_id = ?
                    """, Long.class, participantId, eventId)).isEqualTo(1L);
        } finally {
            executor.shutdownNow();
        }
    }

    @Test
    void invalidStateMissingResourcesAndInvalidFiltersUseContractErrors() throws Exception {
        long draftEventId = insertEvent("Draft Event", BASE.plusSeconds(60));
        jdbc.update("update events set status = 'DRAFT' where event_id = ?", draftEventId);
        long unjoinedEventId = insertEvent("Unjoined Event", BASE.plusSeconds(60));

        mvc.perform(post(PARTICIPANT + "/events/999999999/join")
                        .with(participant(participantId)).with(csrf()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("EVENT_NOT_FOUND"));
        mvc.perform(post(PARTICIPANT + "/events/" + draftEventId + "/join")
                        .with(participant(participantId)).with(csrf()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("EVENT_NOT_OPEN_FOR_PARTICIPATION"));
        mvc.perform(post(PARTICIPANT + "/events/" + unjoinedEventId + "/leave")
                        .with(participant(participantId)).with(csrf()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("EVENT_REGISTRATION_NOT_FOUND"));
        mvc.perform(get(PARTICIPANT + "/event-registrations")
                        .queryParam("status", "UNKNOWN")
                        .with(participant(participantId)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_FILTER"));
        mvc.perform(get(PARTICIPANT + "/event-registrations")
                        .queryParam("page", "-1")
                        .with(participant(participantId)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_PAGE"));
    }

    @Test
    void activityRegisterCancelAndReregisterReuseIdentityAndAutoJoinEvent() throws Exception {
        long eventId = insertEvent("Activity registration", BASE.plus(Duration.ofHours(1)));
        long locationId = insertLocation();
        long activityId = insertActivity(eventId, locationId, "Primary activity",
                BASE.plus(Duration.ofHours(2)), BASE.plus(Duration.ofHours(3)),
                BASE.plus(Duration.ofHours(1)), 10, true, "PUBLISHED");

        JsonNode registered = body(mvc.perform(post(PARTICIPANT + "/activities/" + activityId
                        + "/register").with(participant(participantId)).with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ACTIVE"))
                .andExpect(jsonPath("$.outcome").value("ACTIVE"))
                .andExpect(jsonPath("$.activity.activityId").value(activityId))
                .andExpect(jsonPath("$.warnings").isEmpty())
                .andReturn().getResponse().getContentAsString());
        long registrationId = registered.get("activityRegistrationId").asLong();
        String registeredAt = registered.get("registeredAt").asText();

        mvc.perform(post(PARTICIPANT + "/activities/" + activityId + "/register")
                        .with(participant(participantId)).with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.activityRegistrationId").value(registrationId))
                .andExpect(jsonPath("$.registeredAt").value(registeredAt));
        mvc.perform(get(PARTICIPANT + "/activity-registrations")
                        .queryParam("eventId", String.valueOf(eventId))
                        .queryParam("outcome", "ACTIVE")
                        .queryParam("activityStatus", "PUBLISHED")
                        .queryParam("search", "Primary")
                        .with(participant(participantId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].activityRegistrationId")
                        .value(registrationId));
        mvc.perform(get(PARTICIPANT + "/activity-registrations/" + registrationId)
                        .with(participant(participantId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.activity.title").value("Primary activity"));

        clock.set(BASE.plusSeconds(10));
        String cancelledAt = body(mvc.perform(post(PARTICIPANT + "/activities/" + activityId
                        + "/cancel-registration").with(participant(participantId)).with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CANCELLED"))
                .andExpect(jsonPath("$.cancellationSource").value("PARTICIPANT"))
                .andReturn().getResponse().getContentAsString()).get("cancelledAt").asText();
        mvc.perform(post(PARTICIPANT + "/activities/" + activityId + "/cancel-registration")
                        .with(participant(participantId)).with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.cancelledAt").value(cancelledAt));

        clock.set(BASE.plusSeconds(20));
        mvc.perform(post(PARTICIPANT + "/activities/" + activityId + "/register")
                        .with(participant(participantId)).with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.activityRegistrationId").value(registrationId))
                .andExpect(jsonPath("$.registeredAt").value(registeredAt))
                .andExpect(jsonPath("$.cancelledAt").doesNotExist());
        assertThat(jdbc.queryForObject("""
                select count(*) from event_registrations where user_id = ? and event_id = ?
                """, Long.class, participantId, eventId)).isEqualTo(1L);
        assertThat(jdbc.queryForObject("""
                select count(*) from activity_registrations where activity_id = ?
                """, Long.class, activityId)).isEqualTo(1L);
    }

    @Test
    void eventCancellationCascadesSeatActiveRegistrationsPreservesHistoryAndNotifiesOnce()
            throws Exception {
        long eventId = insertEvent("Participant cancellation cascade",
                BASE.plus(Duration.ofHours(1)));
        long activeActivityId = insertActivity(eventId, insertLocation(), "Active seat",
                BASE.plus(Duration.ofHours(2)), BASE.plus(Duration.ofHours(3)),
                BASE.plus(Duration.ofHours(1)), 10, true, "PUBLISHED");
        long participantCancelledActivityId = insertActivity(
                eventId, insertLocation(), "Returned seat",
                BASE.plus(Duration.ofHours(4)), BASE.plus(Duration.ofHours(5)),
                BASE.plus(Duration.ofHours(1)), 10, true, "PUBLISHED");

        long activeRegistrationId = register(activeActivityId, participantId);
        long participantCancelledRegistrationId = register(
                participantCancelledActivityId, participantId);
        clock.set(BASE.plusSeconds(10));
        mvc.perform(post(PARTICIPANT + "/activities/" + participantCancelledActivityId
                        + "/cancel-registration")
                        .with(participant(participantId)).with(csrf()))
                .andExpect(status().isOk());
        Instant originalParticipantCancelledAt = jdbc.queryForObject("""
                select cancelled_at from activity_registrations
                where activity_registration_id = ?
                """, Instant.class, participantCancelledRegistrationId);
        join(eventId, otherParticipantId);
        jdbc.update("""
                insert into attendances(activity_registration_id, status, recorded_source,
                    attended_at, created_at, updated_at)
                values (?, 'VALID', 'SELF_SCAN', ?, ?, ?)
                """, activeRegistrationId, Timestamp.from(BASE), Timestamp.from(BASE),
                Timestamp.from(BASE));

        String reason = "Sự kiện phải hủy vì điều kiện tổ chức không còn phù hợp.";
        mvc.perform(post("/api/v1/organizer/events/" + eventId + "/cancel")
                        .with(organizer(organizerId)).with(csrf())
                        .contentType("application/json")
                        .content("{\"reason\":\"" + reason + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CANCELLED"));

        assertThat(activityRegistrationState(activeRegistrationId))
                .containsExactly("CANCELLED", "EVENT");
        assertThat(activityRegistrationState(participantCancelledRegistrationId))
                .containsExactly("CANCELLED", "PARTICIPANT");
        assertThat(jdbc.queryForObject("""
                select cancelled_at from activity_registrations
                where activity_registration_id = ?
                """, Instant.class, participantCancelledRegistrationId))
                .isEqualTo(originalParticipantCancelledAt);
        assertThat(jdbc.queryForObject("""
                select count(*) from attendances where activity_registration_id = ?
                """, Long.class, activeRegistrationId)).isOne();
        assertThat(jdbc.queryForObject("""
                select count(*) from event_registrations
                where event_id = ? and status = 'ACTIVE'
                """, Long.class, eventId)).isEqualTo(2L);
        assertThat(jdbc.queryForList("""
                select recipient_user_id from notifications
                where event_id = ? and notification_type = 'EVENT_CANCELLED'
                order by recipient_user_id
                """, Long.class, eventId))
                .containsExactlyInAnyOrder(participantId, otherParticipantId);

        mvc.perform(post("/api/v1/organizer/events/" + eventId + "/cancel")
                        .with(organizer(organizerId)).with(csrf())
                        .contentType("application/json")
                        .content("{\"reason\":\"" + reason + "\"}"))
                .andExpect(status().isOk());
        assertThat(jdbc.queryForObject(
                "select count(*) from notifications where event_id = ?",
                Long.class, eventId)).isEqualTo(2L);
    }

    @Test
    void eventCancellationRacingRegistrationLeavesNoSeatActiveRegistration()
            throws Exception {
        long eventId = insertEvent("Cancellation race", BASE.plus(Duration.ofHours(1)));
        long activityId = insertActivity(eventId, insertLocation(), "Race activity",
                BASE.plus(Duration.ofHours(2)), BASE.plus(Duration.ofHours(3)),
                BASE.plus(Duration.ofHours(1)), 10, true, "PUBLISHED");
        var ready = new CountDownLatch(2);
        var start = new CountDownLatch(1);
        var executor = Executors.newFixedThreadPool(2);
        try {
            var cancellation = executor.submit(() -> concurrentEventCancellation(
                    eventId, ready, start));
            var registration = executor.submit(() -> concurrentActivityRegister(
                    activityId, participantId, ready, start));
            assertThat(ready.await(5, TimeUnit.SECONDS)).isTrue();
            start.countDown();

            assertThat(cancellation.get(10, TimeUnit.SECONDS)).isEqualTo(200);
            assertThat(registration.get(10, TimeUnit.SECONDS)).isIn(200, 409);
            assertThat(jdbc.queryForObject("""
                    select count(*) from activity_registrations
                    where activity_id = ? and status = 'ACTIVE'
                    """, Long.class, activityId)).isZero();
        } finally {
            executor.shutdownNow();
        }
    }

    @Test
    void overlapWarnsButDoesNotBlockSecondActivity() throws Exception {
        long eventId = insertEvent("Overlap event", BASE.plus(Duration.ofHours(1)));
        long locationId = insertLocation();
        long firstId = insertActivity(eventId, locationId, "First",
                BASE.plus(Duration.ofHours(2)), BASE.plus(Duration.ofHours(3)),
                BASE.plus(Duration.ofHours(1)), 10, true, "PUBLISHED");
        long secondLocationId = insertLocation();
        long secondId = insertActivity(eventId, secondLocationId, "Second",
                BASE.plus(Duration.ofHours(2)).plus(Duration.ofMinutes(30)),
                BASE.plus(Duration.ofHours(3)).plus(Duration.ofMinutes(30)),
                BASE.plus(Duration.ofHours(1)), 10, true, "PUBLISHED");
        register(firstId, participantId);

        mvc.perform(post(PARTICIPANT + "/activities/" + secondId + "/register")
                        .with(participant(participantId)).with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.warnings[0].code").value("SCHEDULE_OVERLAP"))
                .andExpect(jsonPath("$.warnings[0].conflictingActivityIds[0]")
                        .value(firstId));
    }

    @Test
    void fullCapacityRollsBackImplicitEventJoin() throws Exception {
        long eventId = insertEvent("Capacity event", BASE.plus(Duration.ofHours(1)));
        long locationId = insertLocation();
        long activityId = insertActivity(eventId, locationId, "One seat",
                BASE.plus(Duration.ofHours(2)), BASE.plus(Duration.ofHours(3)),
                BASE.plus(Duration.ofHours(1)), 1, true, "PUBLISHED");
        register(activityId, participantId);

        mvc.perform(post(PARTICIPANT + "/activities/" + activityId + "/register")
                        .with(participant(otherParticipantId)).with(csrf()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("ACTIVITY_CAPACITY_FULL"));
        assertThat(jdbc.queryForObject("""
                select count(*) from event_registrations where user_id = ? and event_id = ?
                """, Long.class, otherParticipantId, eventId)).isZero();
    }

    @Test
    void concurrentFinalSeatAllowsExactlyOneParticipant() throws Exception {
        long eventId = insertEvent("Concurrent capacity", BASE.plus(Duration.ofHours(1)));
        long activityId = insertActivity(eventId, insertLocation(), "Final seat",
                BASE.plus(Duration.ofHours(2)), BASE.plus(Duration.ofHours(3)),
                BASE.plus(Duration.ofHours(1)), 1, true, "PUBLISHED");
        var ready = new CountDownLatch(2);
        var start = new CountDownLatch(1);
        var executor = Executors.newFixedThreadPool(2);
        try {
            var first = executor.submit(() -> concurrentActivityRegister(
                    activityId, participantId, ready, start));
            var second = executor.submit(() -> concurrentActivityRegister(
                    activityId, otherParticipantId, ready, start));
            assertThat(ready.await(5, TimeUnit.SECONDS)).isTrue();
            start.countDown();

            List<Integer> statuses = List.of(first.get(10, TimeUnit.SECONDS),
                    second.get(10, TimeUnit.SECONDS));
            assertThat(statuses).containsExactlyInAnyOrder(200, 409);
            assertThat(jdbc.queryForObject("""
                    select count(*) from activity_registrations
                    where activity_id = ? and status = 'ACTIVE'
                    """, Long.class, activityId)).isEqualTo(1L);
            assertThat(jdbc.queryForObject("""
                    select count(*) from event_registrations where event_id = ?
                    """, Long.class, eventId)).isEqualTo(1L);
        } finally {
            executor.shutdownNow();
        }
    }

    @Test
    void failedReregistrationPreservesParticipantCancelledHistory() throws Exception {
        long eventId = insertEvent("Reregister capacity", BASE.plus(Duration.ofHours(1)));
        long activityId = insertActivity(eventId, insertLocation(), "Reusable seat",
                BASE.plus(Duration.ofHours(2)), BASE.plus(Duration.ofHours(3)),
                BASE.plus(Duration.ofHours(1)), 1, true, "PUBLISHED");
        long registrationId = register(activityId, participantId);
        mvc.perform(post(PARTICIPANT + "/activities/" + activityId
                        + "/cancel-registration")
                        .with(participant(participantId)).with(csrf()))
                .andExpect(status().isOk());
        register(activityId, otherParticipantId);

        mvc.perform(post(PARTICIPANT + "/activities/" + activityId + "/register")
                        .with(participant(participantId)).with(csrf()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("ACTIVITY_CAPACITY_FULL"));
        assertThat(jdbc.queryForObject("""
                select status from activity_registrations
                where activity_registration_id = ?
                """, String.class, registrationId)).isEqualTo("CANCELLED");
        assertThat(jdbc.queryForObject("""
                select cancellation_source from activity_registrations
                where activity_registration_id = ?
                """, String.class, registrationId)).isEqualTo("PARTICIPANT");
    }

    @Test
    void activityDeadlineIsInclusiveAndCancellationClosesAtStart() throws Exception {
        long eventId = insertEvent("Boundary event", BASE.plus(Duration.ofHours(1)));
        long locationId = insertLocation();
        long exactDeadlineId = insertActivity(eventId, locationId, "Exact deadline",
                BASE.plus(Duration.ofHours(2)), BASE.plus(Duration.ofHours(3)), BASE,
                10, true, "PUBLISHED");
        register(exactDeadlineId, participantId);

        long lateLocationId = insertLocation();
        long lateId = insertActivity(eventId, lateLocationId, "Late deadline",
                BASE.plus(Duration.ofHours(2)), BASE.plus(Duration.ofHours(3)), BASE,
                10, true, "PUBLISHED");
        clock.set(BASE.plusNanos(1_000));
        mvc.perform(post(PARTICIPANT + "/activities/" + lateId + "/register")
                        .with(participant(otherParticipantId)).with(csrf()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code")
                        .value("ACTIVITY_REGISTRATION_DEADLINE_PASSED"));

        clock.set(BASE.plus(Duration.ofHours(2)));
        mvc.perform(post(PARTICIPANT + "/activities/" + exactDeadlineId
                        + "/cancel-registration")
                        .with(participant(participantId)).with(csrf()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code")
                        .value("ACTIVITY_REGISTRATION_CANCELLATION_CLOSED"));
    }

    @Test
    void validAttendanceAndSystemTerminalStatesBlockParticipantTransitions() throws Exception {
        long eventId = insertEvent("Terminal event", BASE.plus(Duration.ofHours(1)));
        long locationId = insertLocation();
        long attendedId = insertActivity(eventId, locationId, "Attended",
                BASE.plus(Duration.ofHours(2)), BASE.plus(Duration.ofHours(3)),
                BASE.plus(Duration.ofHours(1)), 10, true, "PUBLISHED");
        long registrationId = register(attendedId, participantId);
        jdbc.update("""
                insert into attendances(activity_registration_id, status, recorded_source,
                    attended_at, created_at, updated_at)
                values (?, 'VALID', 'SELF_SCAN', ?, ?, ?)
                """, registrationId, Timestamp.from(BASE), Timestamp.from(BASE),
                Timestamp.from(BASE));
        mvc.perform(post(PARTICIPANT + "/activities/" + attendedId
                        + "/cancel-registration")
                        .with(participant(participantId)).with(csrf()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code")
                        .value("ACTIVITY_REGISTRATION_HAS_ATTENDANCE"));

        long systemId = insertActivity(eventId, locationId, "System cancelled",
                BASE.plus(Duration.ofHours(4)), BASE.plus(Duration.ofHours(5)),
                BASE.plus(Duration.ofHours(1)), 10, true, "PUBLISHED");
        long systemRegistrationId = register(systemId, participantId);
        jdbc.update("""
                update activity_registrations
                set status = 'CANCELLED', cancellation_source = 'ACTIVITY',
                    cancelled_at = ?, updated_at = ?
                where activity_registration_id = ?
                """, Timestamp.from(BASE), Timestamp.from(BASE), systemRegistrationId);
        mvc.perform(post(PARTICIPANT + "/activities/" + systemId + "/register")
                        .with(participant(participantId)).with(csrf()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code")
                        .value("ACTIVITY_REGISTRATION_SYSTEM_CANCELLED"));
    }

    @Test
    void activityRegistrationErrorsPreserveOwnershipAndContractCodes() throws Exception {
        long eventId = insertEvent("Activity errors", BASE.plus(Duration.ofHours(1)));
        long locationId = insertLocation();
        long draftId = insertActivity(eventId, locationId, "Draft",
                BASE.plus(Duration.ofHours(2)), BASE.plus(Duration.ofHours(3)),
                BASE.plus(Duration.ofHours(1)), 10, true, "DRAFT");
        long secondLocationId = insertLocation();
        long optionalId = insertActivity(eventId, secondLocationId, "Walk in",
                BASE.plus(Duration.ofHours(2)), BASE.plus(Duration.ofHours(3)),
                BASE.plus(Duration.ofHours(1)), 10, false, "PUBLISHED");

        mvc.perform(post(PARTICIPANT + "/activities/999999999/register")
                        .with(participant(participantId)).with(csrf()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("ACTIVITY_NOT_FOUND"));
        mvc.perform(post(PARTICIPANT + "/activities/" + draftId + "/register")
                        .with(participant(participantId)).with(csrf()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("ACTIVITY_NOT_PUBLISHED"));
        mvc.perform(post(PARTICIPANT + "/activities/" + optionalId + "/register")
                        .with(participant(participantId)).with(csrf()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code")
                        .value("ACTIVITY_REGISTRATION_NOT_REQUIRED"));

        long publishedId = insertActivity(eventId, insertLocation(), "Owned",
                BASE.plus(Duration.ofHours(4)), BASE.plus(Duration.ofHours(5)),
                BASE.plus(Duration.ofHours(1)), 10, true, "PUBLISHED");
        long registrationId = register(publishedId, participantId);
        mvc.perform(get(PARTICIPANT + "/activity-registrations/" + registrationId)
                        .with(participant(otherParticipantId)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code")
                        .value("ACTIVITY_REGISTRATION_NOT_FOUND"));
        mvc.perform(get(PARTICIPANT + "/activity-registrations")
                        .queryParam("outcome", "UNKNOWN")
                        .with(participant(participantId)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_FILTER"));
    }

    private String concurrentJoin(long eventId, CountDownLatch ready, CountDownLatch start)
            throws Exception {
        ready.countDown();
        if (!start.await(5, TimeUnit.SECONDS)) {
            throw new IllegalStateException("Concurrent Join start barrier timed out.");
        }
        return mvc.perform(post(PARTICIPANT + "/events/" + eventId + "/join")
                        .with(participant(participantId)).with(csrf()))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
    }

    private int concurrentActivityRegister(long activityId, long userId,
            CountDownLatch ready, CountDownLatch start) throws Exception {
        ready.countDown();
        if (!start.await(5, TimeUnit.SECONDS)) {
            throw new IllegalStateException("Concurrent Activity Register barrier timed out.");
        }
        return mvc.perform(post(PARTICIPANT + "/activities/" + activityId + "/register")
                        .with(participant(userId)).with(csrf()))
                .andReturn().getResponse().getStatus();
    }

    private int concurrentEventCancellation(long eventId,
            CountDownLatch ready, CountDownLatch start) throws Exception {
        ready.countDown();
        if (!start.await(5, TimeUnit.SECONDS)) {
            throw new IllegalStateException("Concurrent Event cancellation barrier timed out.");
        }
        return mvc.perform(post("/api/v1/organizer/events/" + eventId + "/cancel")
                        .with(organizer(organizerId)).with(csrf())
                        .contentType("application/json")
                        .content("""
                                {"reason":"Sự kiện phải hủy do điều kiện tổ chức thay đổi."}
                                """))
                .andReturn().getResponse().getStatus();
    }

    private List<String> activityRegistrationState(long registrationId) {
        return jdbc.queryForObject("""
                select status, cancellation_source from activity_registrations
                where activity_registration_id = ?
                """, (resultSet, rowNumber) -> List.of(
                        resultSet.getString("status"),
                        resultSet.getString("cancellation_source")), registrationId);
    }

    private long join(long eventId, long userId) throws Exception {
        return body(mvc.perform(post(PARTICIPANT + "/events/" + eventId + "/join")
                        .with(participant(userId)).with(csrf()))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString())
                .get("eventRegistrationId").asLong();
    }

    private long register(long activityId, long userId) throws Exception {
        return body(mvc.perform(post(PARTICIPANT + "/activities/" + activityId + "/register")
                        .with(participant(userId)).with(csrf()))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString())
                .get("activityRegistrationId").asLong();
    }

    private JsonNode body(String value) {
        return mapper.readTree(value);
    }

    private long insertUser(String kind) {
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        return jdbc.queryForObject("""
                insert into users(username, password_hash, full_name, email, status)
                values (?, '{noop}unused', ?, ?, 'ACTIVE') returning user_id
                """, Long.class, kind + suffix, "Registration " + kind,
                kind + suffix + "@example.test");
    }

    private long insertEvent(String name, Instant deadline) {
        return jdbc.queryForObject("""
                insert into events(
                    organizer_user_id, name, start_at, end_at,
                    participant_registration_deadline_at,
                    booth_payment_window_minutes, max_booths_per_partner,
                    max_activities_per_partner, status, created_at, updated_at)
                values (?, ?, ?, ?, ?, 60, 2, 3, 'PUBLISHED', ?, ?)
                returning event_id
                """, Long.class, organizerId, name,
                Timestamp.from(BASE.plus(Duration.ofDays(1))),
                Timestamp.from(BASE.plus(Duration.ofDays(2))), Timestamp.from(deadline),
                Timestamp.from(BASE), Timestamp.from(BASE));
    }

    private long insertLocation() {
        String code = "REG6-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        return jdbc.queryForObject("""
                insert into locations(code, name, location_type, max_capacity, is_active,
                    created_at, updated_at)
                values (?, 'Registration Stage', 'STAGE', 100, true, ?, ?)
                returning location_id
                """, Long.class, code, Timestamp.from(BASE), Timestamp.from(BASE));
    }

    private long insertActivity(long eventId, long locationId, String status) {
        return insertActivity(eventId, locationId, "Registration Activity",
                BASE.plus(Duration.ofHours(2)), BASE.plus(Duration.ofHours(3)),
                BASE.plus(Duration.ofHours(1)), 100, true, status);
    }

    private long insertActivity(long eventId, long locationId, String title,
            Instant startAt, Instant endAt, Instant deadline, int capacity,
            boolean registrationRequired, String status) {
        UUID attendanceToken = !"DRAFT".equals(status) && registrationRequired
                ? UUID.randomUUID() : null;
        Timestamp publishedAt = "DRAFT".equals(status) ? null : Timestamp.from(BASE);
        Timestamp registrationDeadline = registrationRequired ? Timestamp.from(deadline) : null;
        return jdbc.queryForObject("""
                insert into activities(
                    event_id, location_id, title, activity_type, start_at, end_at,
                    registration_required, registration_deadline_at, capacity,
                    attendance_qr_token, is_certificate_enabled, status,
                    created_at, updated_at, published_at)
                values (?, ?, ?, 'TALKSHOW', ?, ?, ?, ?, ?, ?,
                    false, ?, ?, ?, ?)
                returning activity_id
                """, Long.class, eventId, locationId, title, Timestamp.from(startAt),
                Timestamp.from(endAt), registrationRequired, registrationDeadline, capacity,
                attendanceToken, status,
                Timestamp.from(BASE), Timestamp.from(BASE), publishedAt);
    }

    private static org.springframework.test.web.servlet.request.RequestPostProcessor participant(
            long userId) {
        return role(userId, "PARTICIPANT");
    }

    private static org.springframework.test.web.servlet.request.RequestPostProcessor organizer(
            long userId) {
        var principal = new VerifiedIdentity(userId);
        return authentication(new UsernamePasswordAuthenticationToken(principal, null,
                java.util.List.of(new SimpleGrantedAuthority("ROLE_ORGANIZER"))));
    }

    private static org.springframework.test.web.servlet.request.RequestPostProcessor role(
            long userId, String role) {
        var principal = new Identity(userId);
        return authentication(new UsernamePasswordAuthenticationToken(principal, null,
                java.util.List.of(new SimpleGrantedAuthority("ROLE_" + role))));
    }

    private record Identity(Long userId) implements AuthenticatedPrincipal {
        @Override public boolean emailVerified() { return false; }
    }

    private record VerifiedIdentity(Long userId) implements AuthenticatedPrincipal {
        @Override public boolean emailVerified() { return true; }
    }
}
