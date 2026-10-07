package com.swp391.bookstreet.event;

import com.swp391.bookstreet.security.authentication.AuthenticatedPrincipal;
import com.swp391.bookstreet.event.service.EventService;
import com.swp391.bookstreet.event.exception.EventException;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContextInitializer;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import tools.jackson.databind.ObjectMapper;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Runs only against an explicitly selected, disposable PostgreSQL test database.
 * Test identities exercise Event authorization; they do not implement Auth login.
 */
@SpringBootTest(properties = {
        "spring.datasource.url=${EVENT_TEST_DATABASE_URL}",
        "logging.level.org.springframework.security=ERROR"
})
@EnabledIfEnvironmentVariable(named = "EVENT_TEST_DATABASE_URL", matches = ".+")
@ContextConfiguration(initializers = EventApiIntegrationTests.TestDatabaseGuard.class)
class EventApiIntegrationTests {
    static class TestDatabaseGuard implements ApplicationContextInitializer<ConfigurableApplicationContext> {
        @Override
        public void initialize(ConfigurableApplicationContext applicationContext) {
            String url = applicationContext.getEnvironment().getRequiredProperty("spring.datasource.url");
            if (!url.matches("jdbc:postgresql://[^/]+/[A-Za-z0-9_]+_event_test(?:\\?.*)?")) {
                throw new IllegalStateException("Event tests require a dedicated *_event_test database.");
            }
        }
    }

    private static final String ORGANIZER = "/api/v1/organizer/events";
    private static final String PUBLIC = "/api/v1/events";

    @Autowired WebApplicationContext context;
    @Autowired JdbcTemplate jdbc;
    @Autowired ObjectMapper mapper;
    @Autowired EventService service;
    MockMvc mvc;
    Long owner;
    Long other;
    Instant eventStartAt;
    Instant eventEndAt;
    String validEventRequestJson;

    @BeforeEach
    void setup() {
        String database = jdbc.queryForObject("select current_database()", String.class);
        assertThat(database).as("Integration tests require a dedicated *_event_test database")
                .endsWith("_event_test");
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        owner = insertUser();
        other = insertUser();
        validEventRequestJson = buildValidEventRequestJson();
    }

    @AfterEach
    void cleanup() {
        SecurityContextHolder.clearContext();
        if (owner != null && other != null) {
            jdbc.update("delete from events where organizer_user_id in (?, ?)", owner, other);
            jdbc.update("delete from users where user_id in (?, ?)", owner, other);
        }
    }

    @Test
    void createDraftSetsOwnerAndPersistsAllConfiguration() throws Exception {
        long id = createEvent();
        mvc.perform(get(ORGANIZER + "/" + id).with(authentication(identity(owner, true, "ORGANIZER"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.organizerUserId").value(owner))
                .andExpect(jsonPath("$.status").value("DRAFT"))
                .andExpect(jsonPath("$.maxActivitiesPerPartner").value(5))
                .andExpect(jsonPath("$.createdAt").isNotEmpty())
                .andExpect(jsonPath("$.updatedAt").isNotEmpty());
        assertThat(jdbc.queryForObject("select organizer_user_id from events where event_id = ?",
                Long.class, id)).isEqualTo(owner);
        assertThat(jdbc.queryForObject("select booth_payment_window_minutes from events where event_id = ?",
                Integer.class, id)).isEqualTo(60);
    }

    @Test
    void invalidDeadlinePatchRollsBackOtherChanges() throws Exception {
        long id = createEvent();
        String invalidDeadline = eventStartAt.plus(Duration.ofHours(1)).toString();
        String requestBody = """
                {
                  "name": "Should roll back",
                  "partnerApplicationDeadlineAt": "%s"
                }
                """.formatted(invalidDeadline);

        mvc.perform(patch(ORGANIZER + "/" + id).with(csrf())
                        .with(authentication(identity(owner, true, "ORGANIZER")))
                        .contentType("application/json").content(requestBody))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("EVENT_TIME_INVALID"));
        assertThat(jdbc.queryForObject("select name from events where event_id = ?", String.class, id))
                .isEqualTo("Book Street Festival");
        publish(id);
    }

    @Test
    void incompleteDeadlineCannotBePublishedAndDraftRemainsPrivate() throws Exception {
        long id = createEvent();
        mvc.perform(patch(ORGANIZER + "/" + id).with(csrf())
                        .with(authentication(identity(owner, true, "ORGANIZER")))
                        .contentType("application/json").content("{\"partnerApplicationDeadlineAt\":null}"))
                .andExpect(status().isOk());
        mvc.perform(post(ORGANIZER + "/" + id + "/publish").with(csrf())
                        .with(authentication(identity(owner, true, "ORGANIZER"))))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("EVENT_INCOMPLETE_FOR_PUBLISH"));
        assertThat(jdbc.queryForObject("select status from events where event_id = ?", String.class, id))
                .isEqualTo("DRAFT");
        mvc.perform(get(PUBLIC + "/" + id)).andExpect(status().isNotFound());
    }

    @Test
    void expiredApplicationDeadlinePreventsPublication() throws Exception {
        long id = createEvent();
        jdbc.update("update events set partner_application_deadline_at = CURRENT_TIMESTAMP - interval '1 day' where event_id = ?", id);
        mvc.perform(post(ORGANIZER + "/" + id + "/publish").with(csrf())
                        .with(authentication(identity(owner, true, "ORGANIZER"))))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("EVENT_TIME_INVALID"));
        assertThat(jdbc.queryForObject("select status from events where event_id = ?", String.class, id))
                .isEqualTo("DRAFT");
    }

    @Test
    void updateThenPublishMakesEventPublic() throws Exception {
        long id = createEvent();
        mvc.perform(patch(ORGANIZER + "/" + id).with(csrf())
                        .with(authentication(identity(owner, true, "ORGANIZER")))
                        .contentType("application/json").content("{\"name\":\"Updated event\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.name").value("Updated event"))
                .andExpect(jsonPath("$.maxBoothsPerPartner").value(1));
        publish(id);
        mvc.perform(get(PUBLIC + "/" + id)).andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PUBLISHED"))
                .andExpect(jsonPath("$.name").value("Updated event"))
                .andExpect(jsonPath("$.organizerUserId").doesNotExist());
        mvc.perform(get(PUBLIC)).andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].eventId").value(id));
    }

    @Test
    void publicCannotReadDraft() throws Exception {
        long id = createEvent();
        mvc.perform(get(PUBLIC + "/" + id)).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("EVENT_NOT_FOUND"));
        mvc.perform(get(PUBLIC)).andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(0));
    }

    @Test
    void anotherOrganizerCannotReadUpdateOrPublish() throws Exception {
        long id = createEvent();
        var stranger = identity(other, true, "ORGANIZER");
        mvc.perform(get(ORGANIZER + "/" + id).with(authentication(stranger)))
                .andExpect(status().isNotFound());
        mvc.perform(patch(ORGANIZER + "/" + id).with(authentication(stranger)).with(csrf())
                        .contentType("application/json").content("{\"name\":\"Stolen\"}"))
                .andExpect(status().isNotFound());
        mvc.perform(post(ORGANIZER + "/" + id + "/publish").with(authentication(stranger)).with(csrf()))
                .andExpect(status().isNotFound());
        assertThat(jdbc.queryForObject("select name from events where event_id = ?", String.class, id))
                .isEqualTo("Book Street Festival");
        mvc.perform(get(ORGANIZER).with(authentication(stranger)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(0));
    }

    @Test
    void invalidRangeIs422AndIsNotPersisted() throws Exception {
        String invalidRequest = validEventRequestJson.replace(
                eventEndAt.toString(),
                eventStartAt.toString()
        );

        mvc.perform(post(ORGANIZER).with(authentication(identity(owner, true, "ORGANIZER"))).with(csrf())
                        .contentType("application/json")
                        .content(invalidRequest))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.code").value("EVENT_TIME_INVALID"))
                .andExpect(jsonPath("$.fieldErrors[0].field").value("endAt"));
        assertThat(jdbc.queryForObject("select count(*) from events where organizer_user_id = ?",
                Long.class, owner)).isZero();
    }

    @Test
    void invalidPatchRollsBackAllFields() throws Exception {
        long id = createEvent();
        String invalidEndAt = eventStartAt.minus(Duration.ofHours(1)).toString();
        String requestBody = """
                {
                  "name": "Must rollback",
                  "endAt": "%s"
                }
                """.formatted(invalidEndAt);

        mvc.perform(patch(ORGANIZER + "/" + id).with(authentication(identity(owner, true, "ORGANIZER")))
                        .with(csrf()).contentType("application/json")
                        .content(requestBody))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.code").value("EVENT_TIME_INVALID"));
        assertThat(jdbc.queryForObject("select name from events where event_id = ?", String.class, id))
                .isEqualTo("Book Street Festival");
    }

    @Test
    void publishedEventCannotBeChangedOrPublishedAgain() throws Exception {
        long id = createEvent();
        publish(id);
        mvc.perform(patch(ORGANIZER + "/" + id).with(authentication(identity(owner, true, "ORGANIZER")))
                        .with(csrf()).contentType("application/json").content("{\"name\":\"Changed\"}"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("EVENT_NOT_DRAFT"));
        mvc.perform(post(ORGANIZER + "/" + id + "/publish")
                        .with(authentication(identity(owner, true, "ORGANIZER"))).with(csrf()))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("EVENT_NOT_DRAFT"));
    }

    @Test
    void negativeQuotaAndBlankNameAreRejected() throws Exception {
        for (String body : List.of(
                validEventRequestJson.replace("\"maxBoothsPerPartner\": 1", "\"maxBoothsPerPartner\": -1"),
                validEventRequestJson.replace("Book Street Festival", "   ")
        )) {
            mvc.perform(post(ORGANIZER).with(authentication(identity(owner, true, "ORGANIZER")))
                            .with(csrf()).contentType("application/json").content(body))
                    .andExpect(status().isUnprocessableContent())
                    .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
        }
    }

    @Test
    void missingSessionAndWrongRoleAndUnverifiedEmailAreRejected() throws Exception {
        mvc.perform(get(ORGANIZER)).andExpect(status().isUnauthorized());
        mvc.perform(post(ORGANIZER).with(csrf()).contentType("application/json")
                        .content(validEventRequestJson))
                .andExpect(status().isUnauthorized());
        mvc.perform(get(ORGANIZER).with(authentication(identity(owner, true, "PARTICIPANT"))))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("ACCESS_DENIED"));
        mvc.perform(get(ORGANIZER).with(authentication(identity(owner, false, "ORGANIZER"))))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("ACCESS_DENIED"));
    }

    @Test
    void csrfIsRequiredForMutation() throws Exception {
        mvc.perform(post(ORGANIZER).with(authentication(identity(owner, true, "ORGANIZER")))
                        .contentType("application/json").content(validEventRequestJson))
                .andExpect(status().isForbidden());
        assertThat(jdbc.queryForObject("select count(*) from events where organizer_user_id = ?",
                Long.class, owner)).isZero();
    }

    @Test
    void missingIdHasStandardErrorResponse() throws Exception {
        mvc.perform(get(ORGANIZER + "/9223372036854775807")
                        .with(authentication(identity(owner, true, "ORGANIZER"))))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("EVENT_NOT_FOUND"))
                .andExpect(jsonPath("$.fieldErrors").isArray())
                .andExpect(jsonPath("$.timestamp").isNotEmpty())
                .andExpect(jsonPath("$.path").value(ORGANIZER + "/9223372036854775807"));
    }

    @Test
    void malformedJsonAndIdentifierAre400() throws Exception {
        mvc.perform(post(ORGANIZER).with(authentication(identity(owner, true, "ORGANIZER")))
                        .with(csrf()).contentType("application/json").content("{"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("MALFORMED_REQUEST"));
        mvc.perform(get(PUBLIC + "/abc")).andExpect(status().isBadRequest());
    }

    @Test
    void paginationRejectsInvalidBoundsAndSort() throws Exception {
        for (String query : List.of("?page=-1", "?size=0", "?size=101", "?sort=organizerUserId,asc",
                "?sort=name,invalid", "?sort=name,asc,extra")) {
            mvc.perform(get(PUBLIC + query)).andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("INVALID_PAGINATION"));
        }
    }

    @Test
    void concurrentPublishAllowsExactlyOneTransition() throws Exception {
        long id = createEvent();
        var ready = new CountDownLatch(2);
        var start = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(2)) {
            Callable<Integer> command = () -> {
                SecurityContextHolder.getContext().setAuthentication(identity(owner, true, "ORGANIZER"));
                ready.countDown();
                try {
                    if (!start.await(10, TimeUnit.SECONDS)) throw new IllegalStateException("Start timeout");
                    service.publish(id);
                    return 200;
                } catch (EventException error) {
                    return error.getStatus().value();
                } finally {
                    SecurityContextHolder.clearContext();
                }
            };
            Future<Integer> first = executor.submit(command);
            Future<Integer> second = executor.submit(command);
            assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
            start.countDown();
            assertThat(List.of(first.get(15, TimeUnit.SECONDS), second.get(15, TimeUnit.SECONDS)))
                    .containsExactlyInAnyOrder(200, 409);
        }
    }


    @Test
    void requestCannotSetOwnerOrStatus() throws Exception {
        for (String field : List.of("\"organizerUserId\": " + other, "\"userId\": " + other,
                "\"status\": \"PUBLISHED\"")) {
            String body = validEventRequestJson.replaceFirst("\\{", "{" + field + ",");
            mvc.perform(post(ORGANIZER).with(authentication(identity(owner, true, "ORGANIZER")))
                            .with(csrf()).contentType("application/json").content(body))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("MALFORMED_REQUEST"));
        }
        long id = createEvent();
        mvc.perform(patch(ORGANIZER + "/" + id).with(authentication(identity(owner, true, "ORGANIZER")))
                        .with(csrf()).contentType("application/json").content("{\"status\":\"PUBLISHED\"}"))
                .andExpect(status().isBadRequest());
        assertThat(jdbc.queryForObject("select status from events where event_id = ?", String.class, id))
                .isEqualTo("DRAFT");
    }

    @Test
    void patchNullRequiredFieldsIsRejectedAndRolledBack() throws Exception {
        long id = createEvent();
        for (String field : List.of("name", "startAt", "endAt", "boothPaymentWindowMinutes",
                "maxBoothsPerPartner", "maxActivitiesPerPartner")) {
            mvc.perform(patch(ORGANIZER + "/" + id)
                            .with(authentication(identity(owner, true, "ORGANIZER"))).with(csrf())
                            .contentType("application/json").content("{\"" + field + "\":null}"))
                    .andExpect(status().isUnprocessableContent())
                    .andExpect(jsonPath("$.code").value("EVENT_CONFIGURATION_INVALID"))
                    .andExpect(jsonPath("$.fieldErrors[0].field").value(field));
        }
        assertThat(jdbc.queryForObject("select max_booths_per_partner from events where event_id = ?",
                Integer.class, id)).isEqualTo(1);
    }

    @Test
    void patchCanClearNullableDescriptionWhileRetainingOmittedValues() throws Exception {
        long id = createEvent();
        mvc.perform(patch(ORGANIZER + "/" + id)
                        .with(authentication(identity(owner, true, "ORGANIZER"))).with(csrf())
                        .contentType("application/json").content("{\"description\":null}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.name").value("Book Street Festival"));
        assertThat(jdbc.queryForObject("select description from events where event_id = ?", String.class, id))
                .isNull();
    }

    @Test
    void incompletePersistedDraftCannotBePublished() throws Exception {
        long id = createEvent();
        // An empty name is legal SQL but invalid business data, e.g. a legacy record.
        jdbc.update("update events set name = ' ' where event_id = ?", id);
        mvc.perform(post(ORGANIZER + "/" + id + "/publish")
                        .with(authentication(identity(owner, true, "ORGANIZER"))).with(csrf()))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.code").value("EVENT_INCOMPLETE_FOR_PUBLISH"));
        assertThat(jdbc.queryForObject("select status from events where event_id = ?", String.class, id))
                .isEqualTo("DRAFT");
    }

    @Test
    void nameLengthMissingFieldsAndInvalidTimestampAreRejected() throws Exception {
        mvc.perform(post(ORGANIZER).with(authentication(identity(owner, true, "ORGANIZER")))
                        .with(csrf()).contentType("application/json")
                        .content(validEventRequestJson.replace("Book Street Festival", "a".repeat(151))))
                .andExpect(status().isUnprocessableContent());
        mvc.perform(post(ORGANIZER).with(authentication(identity(owner, true, "ORGANIZER")))
                        .with(csrf()).contentType("application/json").content("{}"))
                .andExpect(status().isUnprocessableContent());
        mvc.perform(post(ORGANIZER).with(authentication(identity(owner, true, "ORGANIZER")))
                        .with(csrf()).contentType("application/json")
                        .content(validEventRequestJson.replace(eventStartAt.toString(), "not-a-time")))
                .andExpect(status().isBadRequest());
    }

    @Test
    void createDefaultsPaymentWindowAndRejectsValuesOutsideSprintTwoRange() throws Exception {
        String withoutPaymentWindow = validEventRequestJson
                .replace("\"boothPaymentWindowMinutes\": 60,", "");
        String response = mvc.perform(post(ORGANIZER)
                        .with(authentication(identity(owner, true, "ORGANIZER")))
                        .with(csrf()).contentType("application/json").content(withoutPaymentWindow))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.boothPaymentWindowMinutes").value(1440))
                .andReturn().getResponse().getContentAsString();
        long defaultedEventId = mapper.readTree(response).get("eventId").asLong();

        for (int invalidWindow : List.of(59, 10081)) {
            mvc.perform(post(ORGANIZER)
                            .with(authentication(identity(owner, true, "ORGANIZER")))
                            .with(csrf()).contentType("application/json")
                            .content(validEventRequestJson.replace(
                                    "\"boothPaymentWindowMinutes\": 60",
                                    "\"boothPaymentWindowMinutes\": " + invalidWindow)))
                    .andExpect(status().isUnprocessableContent())
                    .andExpect(jsonPath("$.code").value("EVENT_CONFIGURATION_INVALID"))
                    .andExpect(jsonPath("$.fieldErrors[0].field")
                            .value("boothPaymentWindowMinutes"));
        }

        jdbc.update("delete from events where event_id = ?", defaultedEventId);
    }

    @Test
    void allNonPublishedStatusesAreHiddenAndNotEditableInSprintOne() throws Exception {
        long id = createEvent();
        for (String eventStatus : List.of("ONGOING", "COMPLETED", "CANCELLED")) {
            jdbc.update("update events set status = ? where event_id = ?", eventStatus, id);
            mvc.perform(get(PUBLIC + "/" + id)).andExpect(status().isNotFound());
            mvc.perform(get(PUBLIC)).andExpect(status().isOk())
                    .andExpect(jsonPath("$.totalElements").value(0));
            mvc.perform(post(ORGANIZER + "/" + id + "/publish")
                            .with(authentication(identity(owner, true, "ORGANIZER"))).with(csrf()))
                    .andExpect(status().isConflict());
        }
    }

    @Test
    void ownedListIsPaginatedAndSorted() throws Exception {
        long first = createEvent();
        long second = createEvent();
        mvc.perform(get(ORGANIZER + "?page=0&size=1&sort=eventId,desc")
                        .with(authentication(identity(owner, true, "ORGANIZER"))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.content[0].eventId").value(second))
                .andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.totalPages").value(2));
        mvc.perform(get(ORGANIZER + "?page=1&size=1&sort=eventId,desc")
                        .with(authentication(identity(owner, true, "ORGANIZER"))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.content[0].eventId").value(first));
    }

    private long createEvent() throws Exception {
        String json = mvc.perform(post(ORGANIZER).with(authentication(identity(owner, true, "ORGANIZER")))
                        .with(csrf()).contentType("application/json").content(validEventRequestJson))
                .andExpect(status().isCreated()).andExpect(header().exists("Location"))
                .andReturn().getResponse().getContentAsString();
        return mapper.readTree(json).get("eventId").asLong();
    }

    private void publish(long id) throws Exception {
        mvc.perform(post(ORGANIZER + "/" + id + "/publish")
                        .with(authentication(identity(owner, true, "ORGANIZER"))).with(csrf()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("PUBLISHED"));
    }

    private Long insertUser() {
        return jdbc.queryForObject("""
                insert into users(username, password_hash, full_name, email, email_verified_at, status)
                values (?, ?, 'Event Test', ?, current_timestamp, 'ACTIVE') returning user_id
                """, Long.class, "event_" + UUID.randomUUID().toString().substring(0, 20),
                new BCryptPasswordEncoder().encode(UUID.randomUUID().toString()),
                UUID.randomUUID() + "@example.test");
    }

    private String buildValidEventRequestJson() {
        Instant baseTime = Instant.now().truncatedTo(ChronoUnit.SECONDS);
        Instant partnerApplicationDeadlineAt = baseTime.plus(Duration.ofDays(10));
        Instant boothRequestDeadlineAt = baseTime.plus(Duration.ofDays(20));
        Instant activityProposalDeadlineAt = baseTime.plus(Duration.ofDays(20));
        Instant partnerWithdrawalCutoffAt = baseTime.plus(Duration.ofDays(20));
        Instant boothCancellationCutoffAt = baseTime.plus(Duration.ofDays(20));
        Instant activityCancellationCutoffAt = baseTime.plus(Duration.ofDays(25));

        eventStartAt = baseTime.plus(Duration.ofDays(30));
        eventEndAt = eventStartAt.plus(Duration.ofDays(2));
        Instant participantRegistrationDeadlineAt = eventStartAt.minus(Duration.ofMinutes(30));

        return """
                {
                  "name": "Book Street Festival",
                  "description": "Annual event",
                  "startAt": "%s",
                  "endAt": "%s",
                  "partnerApplicationDeadlineAt": "%s",
                  "boothRequestDeadlineAt": "%s",
                  "activityProposalDeadlineAt": "%s",
                  "participantRegistrationDeadlineAt": "%s",
                  "partnerWithdrawalCutoffAt": "%s",
                  "boothCancellationCutoffAt": "%s",
                  "activityCancellationCutoffAt": "%s",
                  "boothPaymentWindowMinutes": 60,
                  "maxBoothsPerPartner": 1,
                  "maxActivitiesPerPartner": 5,
                  "bannerUrl": null
                }
                """.formatted(
                eventStartAt,
                eventEndAt,
                partnerApplicationDeadlineAt,
                boothRequestDeadlineAt,
                activityProposalDeadlineAt,
                participantRegistrationDeadlineAt,
                partnerWithdrawalCutoffAt,
                boothCancellationCutoffAt,
                activityCancellationCutoffAt
        );
    }

    private static UsernamePasswordAuthenticationToken identity(Long id, boolean verified, String role) {
        return UsernamePasswordAuthenticationToken.authenticated(new Identity(id, verified), null,
                List.of(new SimpleGrantedAuthority("ROLE_" + role)));
    }

    record Identity(Long userId, boolean emailVerified) implements AuthenticatedPrincipal {
    }
}
