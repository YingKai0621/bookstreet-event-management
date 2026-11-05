package com.swp391.bookstreet.event;

import com.swp391.bookstreet.booth.exception.BoothApiException;
import com.swp391.bookstreet.event.dto.CancelEventRequest;
import com.swp391.bookstreet.event.dto.UpdateEventRequest;
import com.swp391.bookstreet.event.exception.EventException;
import com.swp391.bookstreet.event.service.EventCancellationMailService;
import com.swp391.bookstreet.event.service.EventLifecycleService;
import com.swp391.bookstreet.event.service.EventService;
import com.swp391.bookstreet.partner.dto.SubmitPartnerApplicationRequest;
import com.swp391.bookstreet.partner.service.PartnerApiException;
import com.swp391.bookstreet.partner.service.PartnerApplicationService;
import com.swp391.bookstreet.payment.service.PartnerPaymentService;
import com.swp391.bookstreet.security.authentication.AuthenticatedPrincipal;
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
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.context.WebApplicationContext;
import org.springframework.mail.MailSendException;
import tools.jackson.databind.ObjectMapper;

import static org.assertj.core.api.Assertions.*;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoMoreInteractions;
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
    @Autowired EventLifecycleService lifecycleService;
    @Autowired PartnerApplicationService partnerApplicationService;
    @Autowired PartnerPaymentService partnerPaymentService;
    @Autowired PlatformTransactionManager transactionManager;
    @MockitoBean EventCancellationMailService cancellationMailService;
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
        reset(cancellationMailService);
    }

    @AfterEach
    void cleanup() {
        SecurityContextHolder.clearContext();
        if (owner != null && other != null) {
            jdbc.update("delete from notifications where event_id in "
                    + "(select event_id from events where organizer_user_id in (?, ?)) "
                    + "or partner_event_application_id in (select application_id "
                    + "from partner_event_applications where event_id in "
                    + "(select event_id from events where organizer_user_id in (?, ?)))",
                    owner, other, owner, other);
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
    void paymentAndSetupWindowCanBeSavedInDraftButPreventsPublication() throws Exception {
        long id = createEvent();
        String boothRequestDeadline = eventStartAt.minus(Duration.ofMinutes(30)).toString();

        mvc.perform(patch(ORGANIZER + "/" + id).with(csrf())
                        .with(authentication(identity(owner, true, "ORGANIZER")))
                        .contentType("application/json")
                        .content("{\"boothRequestDeadlineAt\":\"" + boothRequestDeadline + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.boothRequestDeadlineAt").value(boothRequestDeadline));

        mvc.perform(post(ORGANIZER + "/" + id + "/publish").with(csrf())
                        .with(authentication(identity(owner, true, "ORGANIZER"))))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("EVENT_TIME_INVALID"))
                .andExpect(jsonPath("$.fieldErrors[0].field")
                        .value("boothPaymentWindowMinutes"));
    }

    @Test
    void unusedCancellationCutoffsDoNotBlockPublication() throws Exception {
        long id = createEvent();

        mvc.perform(patch(ORGANIZER + "/" + id).with(csrf())
                        .with(authentication(identity(owner, true, "ORGANIZER")))
                        .contentType("application/json")
                        .content("""
                                {
                                  "partnerWithdrawalCutoffAt": null,
                                  "boothCancellationCutoffAt": null,
                                  "activityCancellationCutoffAt": null
                                }
                                """))
                .andExpect(status().isOk());

        mvc.perform(post(ORGANIZER + "/" + id + "/publish").with(csrf())
                        .with(authentication(identity(owner, true, "ORGANIZER"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PUBLISHED"));
    }

    @Test
    void equalPartnerAndDownstreamDeadlinePreventsPublication() throws Exception {
        long id = createEvent();
        String partnerDeadline = jdbc.queryForObject(
                "select partner_application_deadline_at from events where event_id = ?",
                Instant.class, id).toString();

        mvc.perform(patch(ORGANIZER + "/" + id).with(csrf())
                        .with(authentication(identity(owner, true, "ORGANIZER")))
                        .contentType("application/json")
                        .content("{\"boothRequestDeadlineAt\":\"" + partnerDeadline + "\"}"))
                .andExpect(status().isOk());

        mvc.perform(post(ORGANIZER + "/" + id + "/publish").with(csrf())
                        .with(authentication(identity(owner, true, "ORGANIZER"))))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("EVENT_TIME_INVALID"))
                .andExpect(jsonPath("$.fieldErrors[0].field").value("boothRequestDeadlineAt"));

        assertThat(jdbc.queryForObject("select status from events where event_id = ?",
                String.class, id)).isEqualTo("DRAFT");
    }

    @Test
    void zeroPartnerQuotasDoNotRequireBoothOrActivityDeadlines() throws Exception {
        long id = createEvent();

        mvc.perform(patch(ORGANIZER + "/" + id).with(csrf())
                        .with(authentication(identity(owner, true, "ORGANIZER")))
                        .contentType("application/json")
                        .content("""
                                {
                                  "maxBoothsPerPartner": 0,
                                  "maxActivitiesPerPartner": 0,
                                  "boothRequestDeadlineAt": null,
                                  "activityProposalDeadlineAt": null
                                }
                                """))
                .andExpect(status().isOk());

        mvc.perform(post(ORGANIZER + "/" + id + "/publish").with(csrf())
                        .with(authentication(identity(owner, true, "ORGANIZER"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PUBLISHED"));
    }

    @Test
    void lifecycleWorkerAdvancesOnlyDueTimedStatusesAndIsIdempotent() throws Exception {
        long ongoingId = createEvent();
        long completedId = createEvent();
        long futureId = createEvent();
        jdbc.update("""
                update events
                set status = 'PUBLISHED',
                    start_at = CURRENT_TIMESTAMP - interval '1 hour',
                    end_at = CURRENT_TIMESTAMP + interval '1 hour'
                where event_id = ?
                """, ongoingId);
        jdbc.update("""
                update events
                set status = 'PUBLISHED',
                    start_at = CURRENT_TIMESTAMP - interval '2 hours',
                    end_at = CURRENT_TIMESTAMP - interval '1 hour'
                where event_id = ?
                """, completedId);
        jdbc.update("""
                update events
                set status = 'PUBLISHED',
                    start_at = CURRENT_TIMESTAMP + interval '1 hour',
                    end_at = CURRENT_TIMESTAMP + interval '2 hours'
                where event_id = ?
                """, futureId);

        lifecycleService.advanceDueEvents();

        assertThat(eventStatus(ongoingId)).isEqualTo("ONGOING");
        assertThat(eventStatus(completedId)).isEqualTo("COMPLETED");
        assertThat(eventStatus(futureId)).isEqualTo("PUBLISHED");

        lifecycleService.advanceDueEvents();
        assertThat(eventStatus(ongoingId)).isEqualTo("ONGOING");
        assertThat(eventStatus(completedId)).isEqualTo("COMPLETED");
        assertThat(eventStatus(futureId)).isEqualTo("PUBLISHED");
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
    void publicListUsesLifecycleDiscoveryStatusesAndSupportsHistoryFilter() throws Exception {
        long publishedId = createEvent();
        long ongoingId = createEvent();
        long completedId = createEvent();
        long cancelledId = createEvent();
        createEvent();

        jdbc.update("update events set status = 'PUBLISHED' where event_id = ?", publishedId);
        jdbc.update("update events set status = 'ONGOING' where event_id = ?", ongoingId);
        jdbc.update("update events set status = 'COMPLETED' where event_id = ?", completedId);
        jdbc.update("""
                update events
                set status = 'CANCELLED', cancelled_at = current_timestamp,
                    cancellation_reason = 'Cancelled for public discovery test.'
                where event_id = ?
                """, cancelledId);

        mvc.perform(get(PUBLIC).param("sort", "eventId,asc"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.content[*].eventId",
                        containsInAnyOrder((int) publishedId, (int) ongoingId)));

        mvc.perform(get(PUBLIC).param("status", "PUBLISHED"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].eventId").value(publishedId));
        mvc.perform(get(PUBLIC).param("status", "ONGOING"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].eventId").value(ongoingId));
        mvc.perform(get(PUBLIC).param("status", "COMPLETED"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].eventId").value(completedId));
    }

    @Test
    void publicListRejectsPrivateAndUnsupportedStatusFilters() throws Exception {
        for (String requestedStatus : List.of("DRAFT", "CANCELLED", "UNKNOWN", "")) {
            mvc.perform(get(PUBLIC).param("status", requestedStatus))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("INVALID_EVENT_STATUS_FILTER"));
        }
    }

    @Test
    void publicDetailExposesPublishedHistoryButKeepsDraftPrivate() throws Exception {
        long publishedId = createEvent();
        long ongoingId = createEvent();
        long completedId = createEvent();
        long cancelledId = createEvent();
        long draftId = createEvent();

        jdbc.update("update events set status = 'PUBLISHED' where event_id = ?", publishedId);
        jdbc.update("update events set status = 'ONGOING' where event_id = ?", ongoingId);
        jdbc.update("update events set status = 'COMPLETED' where event_id = ?", completedId);
        jdbc.update("""
                update events
                set status = 'CANCELLED', cancelled_at = current_timestamp,
                    cancellation_reason = 'Cancelled for public detail test.'
                where event_id = ?
                """, cancelledId);

        mvc.perform(get(PUBLIC + "/" + publishedId)).andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PUBLISHED"));
        mvc.perform(get(PUBLIC + "/" + ongoingId)).andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ONGOING"));
        mvc.perform(get(PUBLIC + "/" + completedId)).andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("COMPLETED"));
        mvc.perform(get(PUBLIC + "/" + cancelledId)).andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CANCELLED"))
                .andExpect(jsonPath("$.cancelledAt").isNotEmpty())
                .andExpect(jsonPath("$.cancellationReason")
                        .value("Cancelled for public detail test."));
        mvc.perform(get(PUBLIC + "/" + draftId)).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("EVENT_NOT_FOUND"));
    }

    @Test
    void deleteDraftRemovesEventConfigurationButPreservesPhysicalBooth() throws Exception {
        long eventId = createEvent();
        long boothId = jdbc.queryForObject("""
                insert into locations(code, name, location_type, max_capacity, is_active,
                    created_at, updated_at)
                values (?, 'Draft delete Booth', 'BOOTH', 4, true,
                    current_timestamp, current_timestamp)
                returning location_id
                """, Long.class,
                ("DELETE-" + UUID.randomUUID().toString().substring(0, 12)).toUpperCase());
        jdbc.update("insert into booths(booth_id, category_code) values (?, 'PUBLISHER')", boothId);
        jdbc.update("""
                insert into event_booth_configs(event_id, booth_id, rental_price, is_enabled)
                values (?, ?, 10000, true)
                """, eventId, boothId);

        try {
            mvc.perform(delete(ORGANIZER + "/" + eventId).with(csrf())
                            .with(authentication(identity(owner, true, "ORGANIZER"))))
                    .andExpect(status().isNoContent());

            assertThat(count("events", "event_id", eventId)).isZero();
            assertThat(count("event_booth_configs", "event_id", eventId)).isZero();
            assertThat(count("booths", "booth_id", boothId)).isOne();
            assertThat(count("locations", "location_id", boothId)).isOne();

            mvc.perform(delete(ORGANIZER + "/" + eventId).with(csrf())
                            .with(authentication(identity(owner, true, "ORGANIZER"))))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.code").value("EVENT_NOT_FOUND"));
        } finally {
            jdbc.update("delete from event_booth_configs where event_id = ?", eventId);
            jdbc.update("delete from booths where booth_id = ?", boothId);
            jdbc.update("delete from locations where location_id = ?", boothId);
        }
    }

    @Test
    void deleteDraftRejectsPublishedForeignAndDependentEvents() throws Exception {
        long publishedId = createEvent();
        publish(publishedId);
        mvc.perform(delete(ORGANIZER + "/" + publishedId).with(csrf())
                        .with(authentication(identity(owner, true, "ORGANIZER"))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("EVENT_NOT_DRAFT"));

        long foreignId = createEvent();
        mvc.perform(delete(ORGANIZER + "/" + foreignId).with(csrf())
                        .with(authentication(identity(other, true, "ORGANIZER"))))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("EVENT_NOT_FOUND"));

        long dependentId = createEvent();
        long organizationId = jdbc.queryForObject("""
                insert into partner_organizations(
                    representative_user_id, name, category_code, status, created_at, updated_at)
                values (?, ?, 'PUBLISHER', 'ACTIVE', current_timestamp, current_timestamp)
                returning partner_organization_id
                """, Long.class, other, "Delete dependency " + UUID.randomUUID());
        long applicationId = jdbc.queryForObject("""
                insert into partner_event_applications(
                    partner_organization_id, event_id, status, submitted_at)
                values (?, ?, 'PENDING', current_timestamp)
                returning application_id
                """, Long.class, organizationId, dependentId);

        try {
            mvc.perform(delete(ORGANIZER + "/" + dependentId).with(csrf())
                            .with(authentication(identity(owner, true, "ORGANIZER"))))
                    .andExpect(status().isConflict())
                    .andExpect(jsonPath("$.code").value("EVENT_HAS_DEPENDENCIES"));
            assertThat(count("events", "event_id", dependentId)).isOne();
        } finally {
            jdbc.update("delete from partner_event_applications where application_id = ?", applicationId);
            jdbc.update("delete from partner_organizations where partner_organization_id = ?",
                    organizationId);
        }
    }

    @Test
    void cancelPublishedEventIsAtomicNormalizedAndIdempotent() throws Exception {
        long eventId = createEvent();
        publish(eventId);
        CancellationFixture fixture = insertCancellationFixture(eventId);
        String recipientEmail = jdbc.queryForObject(
                "select email from users where user_id = ?", String.class, other);

        try {
            String response = mvc.perform(post(ORGANIZER + "/" + eventId + "/cancel")
                            .with(csrf())
                            .with(authentication(identity(owner, true, "ORGANIZER")))
                            .contentType("application/json")
                            .content("{\"reason\":\"  Venue   is no longer available.  \"}"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("CANCELLED"))
                    .andExpect(jsonPath("$.cancellationReason")
                            .value("Venue is no longer available."))
                    .andExpect(jsonPath("$.cancelledAt").isNotEmpty())
                    .andReturn().getResponse().getContentAsString();

            String cancelledAt = mapper.readTree(response).get("cancelledAt").asText();
            assertThat(eventStatus(eventId)).isEqualTo("CANCELLED");
            assertThat(jdbc.queryForObject(
                    "select status from booth_requests where booth_request_id = ?",
                    String.class, fixture.selectedRequestId())).isEqualTo("CANCELLED");
            assertThat(jdbc.queryForObject(
                    "select status from booth_requests where booth_request_id = ?",
                    String.class, fixture.pendingRequestId())).isEqualTo("CANCELLED");
            assertThat(jdbc.queryForObject(
                    "select status from booth_holds where booth_hold_id = ?",
                    String.class, fixture.holdId())).isEqualTo("RELEASED");

            mvc.perform(post(ORGANIZER + "/" + eventId + "/cancel")
                            .with(csrf())
                            .with(authentication(identity(owner, true, "ORGANIZER")))
                            .contentType("application/json")
                            .content("{\"reason\":\"short\"}"))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));

            mvc.perform(post(ORGANIZER + "/" + eventId + "/cancel")
                            .with(csrf())
                            .with(authentication(identity(owner, true, "ORGANIZER")))
                            .contentType("application/json")
                            .content("{\"reason\":\"A different valid retry reason.\"}"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.cancellationReason")
                            .value("Venue is no longer available."))
                    .andExpect(jsonPath("$.cancelledAt").value(cancelledAt));

            verify(cancellationMailService, times(1)).sendCancellationMessage(
                    eq(recipientEmail), eq("Book Street Festival"), any(Instant.class),
                    eq("Venue is no longer available."));
        } finally {
            deleteCancellationFixture(fixture);
        }
    }

    @Test
    void cancellationEmailTargetsOnlyVerifiedPendingAndApprovedRepresentatives()
            throws Exception {
        long eventId = createEvent();
        publish(eventId);
        var recipients = List.of(
                insertCancellationRecipient(eventId, "PENDING", true),
                insertCancellationRecipient(eventId, "APPROVED", true),
                insertCancellationRecipient(eventId, "REJECTED", true),
                insertCancellationRecipient(eventId, "WITHDRAWN", true),
                insertCancellationRecipient(eventId, "PENDING", false));

        try {
            mvc.perform(post(ORGANIZER + "/" + eventId + "/cancel")
                            .with(csrf())
                            .with(authentication(identity(owner, true, "ORGANIZER")))
                            .contentType("application/json")
                            .content("{\"reason\":\"Venue is unavailable for this Event.\"}"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("CANCELLED"));

            verify(cancellationMailService).sendCancellationMessage(
                    eq(recipients.get(0).email()), eq("Book Street Festival"),
                    any(Instant.class), eq("Venue is unavailable for this Event."));
            verify(cancellationMailService).sendCancellationMessage(
                    eq(recipients.get(1).email()), eq("Book Street Festival"),
                    any(Instant.class), eq("Venue is unavailable for this Event."));
            verifyNoMoreInteractions(cancellationMailService);
        } finally {
            deleteCancellationRecipients(recipients);
        }
    }

    @Test
    void cancellationEmailFailureDoesNotRollbackAndDoesNotSkipRemainingRecipients()
            throws Exception {
        long eventId = createEvent();
        publish(eventId);
        var recipients = List.of(
                insertCancellationRecipient(eventId, "PENDING", true),
                insertCancellationRecipient(eventId, "APPROVED", true));

        doThrow(new MailSendException("Simulated cancellation email failure"))
                .when(cancellationMailService).sendCancellationMessage(
                        eq(recipients.get(0).email()), eq("Book Street Festival"),
                        any(Instant.class), eq("Venue is unavailable for this Event."));

        try {
            mvc.perform(post(ORGANIZER + "/" + eventId + "/cancel")
                            .with(csrf())
                            .with(authentication(identity(owner, true, "ORGANIZER")))
                            .contentType("application/json")
                            .content("{\"reason\":\"Venue is unavailable for this Event.\"}"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("CANCELLED"));

            assertThat(eventStatus(eventId)).isEqualTo("CANCELLED");
            verify(cancellationMailService).sendCancellationMessage(
                    eq(recipients.get(0).email()), eq("Book Street Festival"),
                    any(Instant.class), eq("Venue is unavailable for this Event."));
            verify(cancellationMailService).sendCancellationMessage(
                    eq(recipients.get(1).email()), eq("Book Street Festival"),
                    any(Instant.class), eq("Venue is unavailable for this Event."));
        } finally {
            deleteCancellationRecipients(recipients);
        }
    }

    @Test
    void cancelRejectsInvalidReasonWrongLifecycleAndForeignOwner() throws Exception {
        long draftId = createEvent();
        mvc.perform(post(ORGANIZER + "/" + draftId + "/cancel")
                        .with(csrf())
                        .with(authentication(identity(owner, true, "ORGANIZER")))
                        .contentType("application/json").content("{\"reason\":\"Too short\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));

        mvc.perform(post(ORGANIZER + "/" + draftId + "/cancel")
                        .with(csrf())
                        .with(authentication(identity(owner, true, "ORGANIZER")))
                        .contentType("application/json")
                        .content("{\"reason\":\"A sufficiently long cancellation reason.\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("EVENT_NOT_CANCELLABLE"));

        publish(draftId);
        mvc.perform(post(ORGANIZER + "/" + draftId + "/cancel")
                        .with(csrf())
                        .with(authentication(identity(other, true, "ORGANIZER")))
                        .contentType("application/json")
                        .content("{\"reason\":\"A sufficiently long cancellation reason.\"}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("EVENT_NOT_FOUND"));

        jdbc.update("update events set status = 'ONGOING' where event_id = ?", draftId);
        mvc.perform(post(ORGANIZER + "/" + draftId + "/cancel")
                        .with(csrf())
                        .with(authentication(identity(owner, true, "ORGANIZER")))
                        .contentType("application/json")
                        .content("{\"reason\":\"A sufficiently long cancellation reason.\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("EVENT_NOT_CANCELLABLE"));
    }

    @Test
    void paymentAndAssignmentEvidenceBlockCancellationWithoutPartialMutation() throws Exception {
        assertCancellationBlocked("PENDING", false, false, "EVENT_PAYMENT_PENDING");
        assertCancellationBlocked("FAILED", true, false,
                "EVENT_PAYMENT_RECONCILIATION_REQUIRED");
        assertCancellationBlocked("SUCCESS", false, false,
                "EVENT_HAS_SUCCESSFUL_PAYMENT");
        assertCancellationBlocked(null, false, true, "EVENT_HAS_ASSIGNMENT");
    }

    @Test
    void concurrentCancellationAndPaymentInitiationHaveOneValidWinner() throws Exception {
        long eventId = createEvent();
        publish(eventId);
        CancellationFixture fixture = insertCancellationFixture(eventId);
        var ready = new CountDownLatch(2);
        var start = new CountDownLatch(1);

        try (var executor = Executors.newFixedThreadPool(2)) {
            Callable<String> cancellation = () -> {
                SecurityContextHolder.getContext().setAuthentication(
                        identity(owner, true, "ORGANIZER"));
                ready.countDown();
                try {
                    if (!start.await(10, TimeUnit.SECONDS)) {
                        throw new IllegalStateException("Start timeout");
                    }
                    service.cancel(eventId,
                            new CancelEventRequest("Venue is no longer available."));
                    return "CANCELLED";
                } catch (EventException error) {
                    return error.getCode();
                } finally {
                    SecurityContextHolder.clearContext();
                }
            };
            Callable<String> payment = () -> {
                SecurityContextHolder.getContext().setAuthentication(
                        identity(other, true, "PARTNER"));
                ready.countDown();
                try {
                    if (!start.await(10, TimeUnit.SECONDS)) {
                        throw new IllegalStateException("Start timeout");
                    }
                    partnerPaymentService.initiate(fixture.selectedRequestId(),
                            UUID.randomUUID(), "127.0.0.1");
                    return "PAYMENT_CREATED";
                } catch (BoothApiException error) {
                    return error.getCode();
                } finally {
                    SecurityContextHolder.clearContext();
                }
            };

            Future<String> cancellationResult = executor.submit(cancellation);
            Future<String> paymentResult = executor.submit(payment);
            assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
            start.countDown();

            var outcomes = List.of(cancellationResult.get(15, TimeUnit.SECONDS),
                    paymentResult.get(15, TimeUnit.SECONDS));
            assertThat(outcomes).isIn(
                    List.of("CANCELLED", "EVENT_NOT_ACCEPTING_PAYMENTS"),
                    List.of("EVENT_PAYMENT_PENDING", "PAYMENT_CREATED"));

            if (outcomes.getFirst().equals("CANCELLED")) {
                assertThat(eventStatus(eventId)).isEqualTo("CANCELLED");
                assertThat(count("booth_payments", "booth_hold_id", fixture.holdId())).isZero();
                assertThat(jdbc.queryForObject(
                        "select status from booth_holds where booth_hold_id = ?",
                        String.class, fixture.holdId())).isEqualTo("RELEASED");
            } else {
                assertThat(eventStatus(eventId)).isEqualTo("PUBLISHED");
                assertThat(count("booth_payments", "booth_hold_id", fixture.holdId())).isOne();
                assertThat(jdbc.queryForObject(
                        "select status from booth_holds where booth_hold_id = ?",
                        String.class, fixture.holdId())).isEqualTo("ACTIVE");
            }
        } finally {
            deleteCancellationFixture(fixture);
        }
    }

    @Test
    void concurrentCancellationAndPartnerApplicationSubmissionSerializeOnEventRoot() throws Exception {
        long eventId = createEvent();
        publish(eventId);
        long organizationId = jdbc.queryForObject("""
                insert into partner_organizations(
                    representative_user_id, name, category_code, status,
                    created_at, updated_at)
                values (?, ?, 'PUBLISHER', 'ACTIVE', current_timestamp, current_timestamp)
                returning partner_organization_id
                """, Long.class, other, "Race partner " + UUID.randomUUID());
        var ready = new CountDownLatch(2);
        var start = new CountDownLatch(1);

        try (var executor = Executors.newFixedThreadPool(2)) {
            Callable<String> cancellation = () -> {
                SecurityContextHolder.getContext().setAuthentication(
                        identity(owner, true, "ORGANIZER"));
                ready.countDown();
                try {
                    if (!start.await(10, TimeUnit.SECONDS)) {
                        throw new IllegalStateException("Start timeout");
                    }
                    service.cancel(eventId,
                            new CancelEventRequest("Venue is no longer available."));
                    return "CANCELLED";
                } catch (EventException error) {
                    return error.getCode();
                } finally {
                    SecurityContextHolder.clearContext();
                }
            };
            Callable<String> submission = () -> {
                ready.countDown();
                if (!start.await(10, TimeUnit.SECONDS)) {
                    throw new IllegalStateException("Start timeout");
                }
                try {
                    partnerApplicationService.submit(other, eventId,
                            new SubmitPartnerApplicationRequest("Concurrent application"));
                    return "APPLICATION_CREATED";
                } catch (PartnerApiException error) {
                    return error.getCode();
                }
            };

            Future<String> cancellationResult = executor.submit(cancellation);
            Future<String> submissionResult = executor.submit(submission);
            assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
            start.countDown();

            assertThat(cancellationResult.get(15, TimeUnit.SECONDS)).isEqualTo("CANCELLED");
            String submissionOutcome = submissionResult.get(15, TimeUnit.SECONDS);
            // Applications do not block cancellation, so submission may commit first; once
            // cancellation commits, the Event-root recheck must reject every later submission.
            assertThat(submissionOutcome)
                    .isIn("APPLICATION_CREATED", "EVENT_NOT_ACCEPTING_APPLICATIONS");
            assertThat(eventStatus(eventId)).isEqualTo("CANCELLED");
            assertThat(jdbc.queryForObject("""
                    select count(*) from partner_event_applications
                    where partner_organization_id = ? and event_id = ?
                    """, Long.class, organizationId, eventId))
                    .isEqualTo(submissionOutcome.equals("APPLICATION_CREATED") ? 1L : 0L);

            assertThatThrownBy(() -> partnerApplicationService.submit(other, eventId,
                    new SubmitPartnerApplicationRequest("After cancellation")))
                    .isInstanceOf(PartnerApiException.class)
                    .extracting(error -> ((PartnerApiException) error).getCode())
                    .isEqualTo("EVENT_NOT_ACCEPTING_APPLICATIONS");
        } finally {
            jdbc.update("delete from notifications where event_id = ? "
                    + "or partner_event_application_id in "
                    + "(select application_id from partner_event_applications where event_id = ?)",
                    eventId, eventId);
            jdbc.update("delete from partner_event_applications where event_id = ?", eventId);
            jdbc.update("delete from partner_organizations where partner_organization_id = ?",
                    organizationId);
        }
    }

    @Test
    void concurrentOperationalPatchAndFirstPartnerApplicationSerializeOnEventRoot()
            throws Exception {
        long eventId = createEvent();
        publish(eventId);
        long organizationId = jdbc.queryForObject("""
                insert into partner_organizations(
                    representative_user_id, name, category_code, status,
                    created_at, updated_at)
                values (?, ?, 'PUBLISHER', 'ACTIVE', current_timestamp, current_timestamp)
                returning partner_organization_id
                """, Long.class, other, "Operational patch race " + UUID.randomUUID());
        var applicationHoldingEventRoot = new CountDownLatch(1);
        var releaseApplication = new CountDownLatch(1);
        var patchStarted = new CountDownLatch(1);

        try (var executor = Executors.newFixedThreadPool(2)) {
            Future<String> applicationResult = executor.submit(() -> {
                new TransactionTemplate(transactionManager).executeWithoutResult(status -> {
                    partnerApplicationService.submit(other, eventId,
                            new SubmitPartnerApplicationRequest(
                                    "First concurrent application"));
                    applicationHoldingEventRoot.countDown();
                    try {
                        if (!releaseApplication.await(10, TimeUnit.SECONDS)) {
                            throw new IllegalStateException("Release timeout");
                        }
                    } catch (InterruptedException error) {
                        Thread.currentThread().interrupt();
                        throw new IllegalStateException("Interrupted while holding Event root",
                                error);
                    }
                });
                return "APPLICATION_CREATED";
            });
            assertThat(applicationHoldingEventRoot.await(10, TimeUnit.SECONDS)).isTrue();

            Callable<String> operationalPatch = () -> {
                SecurityContextHolder.getContext().setAuthentication(
                        identity(owner, true, "ORGANIZER"));
                patchStarted.countDown();
                try {
                    UpdateEventRequest request = new UpdateEventRequest();
                    request.setMaxBoothsPerPartner(2);
                    service.update(eventId, request);
                    return "PATCHED";
                } catch (EventException error) {
                    return error.getCode();
                } finally {
                    SecurityContextHolder.clearContext();
                }
            };
            Future<String> patchResult = executor.submit(operationalPatch);
            try {
                assertThat(patchStarted.await(10, TimeUnit.SECONDS)).isTrue();
                assertThatThrownBy(() -> patchResult.get(1, TimeUnit.SECONDS))
                        .isInstanceOf(TimeoutException.class);
            } finally {
                releaseApplication.countDown();
            }

            assertThat(applicationResult.get(15, TimeUnit.SECONDS))
                    .isEqualTo("APPLICATION_CREATED");
            assertThat(patchResult.get(15, TimeUnit.SECONDS))
                    .isEqualTo("EVENT_OPERATIONAL_FIELDS_LOCKED");
            assertThat(jdbc.queryForObject("""
                    select count(*) from partner_event_applications
                    where partner_organization_id = ? and event_id = ?
                    """, Long.class, organizationId, eventId)).isOne();
            assertThat(jdbc.queryForObject("""
                    select max_booths_per_partner from events where event_id = ?
                    """, Integer.class, eventId))
                    .isEqualTo(1);
        } finally {
            releaseApplication.countDown();
            jdbc.update("delete from notifications where event_id = ? "
                    + "or partner_event_application_id in "
                    + "(select application_id from partner_event_applications where event_id = ?)",
                    eventId, eventId);
            jdbc.update("delete from partner_event_applications where event_id = ?", eventId);
            jdbc.update("delete from partner_organizations where partner_organization_id = ?",
                    organizationId);
        }
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
    void publishedEventAllowsDescriptiveChangeButCannotBePublishedAgain() throws Exception {
        long id = createEvent();
        publish(id);
        mvc.perform(patch(ORGANIZER + "/" + id).with(authentication(identity(owner, true, "ORGANIZER")))
                        .with(csrf()).contentType("application/json").content("{\"name\":\"Changed\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.name").value("Changed"));
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

        long eventId = createEvent();
        mvc.perform(delete(ORGANIZER + "/" + eventId)
                        .with(authentication(identity(owner, true, "ORGANIZER"))))
                .andExpect(status().isForbidden());
        assertThat(count("events", "event_id", eventId)).isOne();

        publish(eventId);
        mvc.perform(post(ORGANIZER + "/" + eventId + "/cancel")
                        .with(authentication(identity(owner, true, "ORGANIZER")))
                        .contentType("application/json")
                        .content("{\"reason\":\"A sufficiently long cancellation reason.\"}"))
                .andExpect(status().isForbidden());
        assertThat(eventStatus(eventId)).isEqualTo("PUBLISHED");
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
    void concurrentPublishAndDeleteCannotBothSucceed() throws Exception {
        long id = createEvent();
        var ready = new CountDownLatch(2);
        var start = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(2)) {
            Callable<Integer> publishCommand = () -> {
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
            Callable<Integer> deleteCommand = () -> {
                SecurityContextHolder.getContext().setAuthentication(identity(owner, true, "ORGANIZER"));
                ready.countDown();
                try {
                    if (!start.await(10, TimeUnit.SECONDS)) throw new IllegalStateException("Start timeout");
                    service.deleteDraft(id);
                    return 204;
                } catch (EventException error) {
                    return error.getStatus().value();
                } finally {
                    SecurityContextHolder.clearContext();
                }
            };

            Future<Integer> publish = executor.submit(publishCommand);
            Future<Integer> delete = executor.submit(deleteCommand);
            assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
            start.countDown();

            assertThat(List.of(publish.get(15, TimeUnit.SECONDS),
                            delete.get(15, TimeUnit.SECONDS)))
                    .isIn(List.of(200, 409), List.of(404, 204));
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
    void publishedAndOngoingEventsAllowDescriptivePatch() throws Exception {
        long id = createEvent();
        publish(id);

        mvc.perform(patch(ORGANIZER + "/" + id).with(csrf())
                        .with(authentication(identity(owner, true, "ORGANIZER")))
                        .contentType("application/json")
                        .content("""
                                {
                                  "name": "Published Event Updated",
                                  "description": null,
                                  "bannerUrl": "https://example.test/banner.png"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Published Event Updated"))
                .andExpect(jsonPath("$.description").doesNotExist())
                .andExpect(jsonPath("$.bannerUrl")
                        .value("https://example.test/banner.png"));

        jdbc.update("update events set status = 'ONGOING' where event_id = ?", id);
        mvc.perform(patch(ORGANIZER + "/" + id).with(csrf())
                        .with(authentication(identity(owner, true, "ORGANIZER")))
                        .contentType("application/json")
                        .content("{\"name\":\"Ongoing Event Updated\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ONGOING"))
                .andExpect(jsonPath("$.name").value("Ongoing Event Updated"));
    }

    @Test
    void untouchedPublishedEventAllowsValidOperationalPatch() throws Exception {
        long id = createEvent();
        publish(id);
        Instant updatedStart = eventStartAt.plus(Duration.ofDays(1));
        Instant updatedEnd = eventEndAt.plus(Duration.ofDays(1));

        mvc.perform(patch(ORGANIZER + "/" + id).with(csrf())
                        .with(authentication(identity(owner, true, "ORGANIZER")))
                        .contentType("application/json")
                        .content("""
                                {
                                  "startAt": "%s",
                                  "endAt": "%s",
                                  "maxBoothsPerPartner": 2
                                }
                                """.formatted(updatedStart, updatedEnd)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.startAt").value(updatedStart.toString()))
                .andExpect(jsonPath("$.endAt").value(updatedEnd.toString()))
                .andExpect(jsonPath("$.maxBoothsPerPartner").value(2));
    }

    @Test
    void participationFreezesOperationalPatchButNotDescriptivePatch() throws Exception {
        long id = createEvent();
        publish(id);
        ExternalParticipationFixture fixture = insertExternalParticipation(id);
        try {
            mvc.perform(patch(ORGANIZER + "/" + id).with(csrf())
                            .with(authentication(identity(owner, true, "ORGANIZER")))
                            .contentType("application/json")
                            .content("""
                                    {
                                      "name": "Must roll back",
                                      "maxBoothsPerPartner": 2
                                    }
                                    """))
                    .andExpect(status().isConflict())
                    .andExpect(jsonPath("$.code").value("EVENT_OPERATIONAL_FIELDS_LOCKED"));
            assertThat(jdbc.queryForObject(
                    "select name from events where event_id = ?", String.class, id))
                    .isEqualTo("Book Street Festival");

            mvc.perform(patch(ORGANIZER + "/" + id).with(csrf())
                            .with(authentication(identity(owner, true, "ORGANIZER")))
                            .contentType("application/json")
                            .content("{\"name\":\"Descriptive change remains allowed\"}"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.name")
                            .value("Descriptive change remains allowed"));
        } finally {
            deleteExternalParticipation(fixture);
        }
    }

    @Test
    void invalidPublishedOperationalPatchRollsBackAllFields() throws Exception {
        long id = createEvent();
        publish(id);

        mvc.perform(patch(ORGANIZER + "/" + id).with(csrf())
                        .with(authentication(identity(owner, true, "ORGANIZER")))
                        .contentType("application/json")
                        .content("""
                                {
                                  "name": "Must roll back",
                                  "partnerApplicationDeadlineAt": "%s"
                                }
                                """.formatted(Instant.now().minus(Duration.ofHours(1)))))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("EVENT_TIME_INVALID"))
                .andExpect(jsonPath("$.fieldErrors[0].field")
                        .value("partnerApplicationDeadlineAt"));
        assertThat(jdbc.queryForObject(
                "select name from events where event_id = ?", String.class, id))
                .isEqualTo("Book Street Festival");

        mvc.perform(patch(ORGANIZER + "/" + id).with(csrf())
                        .with(authentication(identity(owner, true, "ORGANIZER")))
                        .contentType("application/json")
                        .content("{\"partnerApplicationDeadlineAt\":null}"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("EVENT_CONFIGURATION_INVALID"));

        mvc.perform(patch(ORGANIZER + "/" + id).with(csrf())
                        .with(authentication(identity(owner, true, "ORGANIZER")))
                        .contentType("application/json")
                        .content("{\"boothRequestDeadlineAt\":\""
                                + eventStartAt.minus(Duration.ofMinutes(30)) + "\"}"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("EVENT_TIME_INVALID"))
                .andExpect(jsonPath("$.fieldErrors[0].field")
                        .value("boothPaymentWindowMinutes"));

        mvc.perform(patch(ORGANIZER + "/" + id).with(csrf())
                        .with(authentication(identity(owner, true, "ORGANIZER")))
                        .contentType("application/json")
                        .content("{\"boothRequestDeadlineAt\":\""
                                + eventStartAt.minus(Duration.ofHours(25)) + "\"}"))
                .andExpect(status().isOk());
    }

    @Test
    void operationalFieldsAreRejectedOngoingAndAllFieldsAreRejectedTerminal() throws Exception {
        long id = createEvent();
        publish(id);
        jdbc.update("""
                update events
                set status = 'ONGOING', start_at = current_timestamp - interval '1 hour',
                    end_at = current_timestamp + interval '1 hour'
                where event_id = ?
                """, id);

        mvc.perform(patch(ORGANIZER + "/" + id).with(csrf())
                        .with(authentication(identity(owner, true, "ORGANIZER")))
                        .contentType("application/json")
                        .content("{\"maxBoothsPerPartner\":2}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("EVENT_NOT_EDITABLE"));

        jdbc.update("update events set status = 'COMPLETED' where event_id = ?", id);
        mvc.perform(patch(ORGANIZER + "/" + id).with(csrf())
                        .with(authentication(identity(owner, true, "ORGANIZER")))
                        .contentType("application/json")
                        .content("{\"name\":\"Not allowed after completion\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("EVENT_NOT_EDITABLE"));

        jdbc.update("""
                update events
                set status = 'CANCELLED', cancelled_at = current_timestamp,
                    cancellation_reason = 'Cancelled terminal update fixture.'
                where event_id = ?
                """, id);
        mvc.perform(patch(ORGANIZER + "/" + id).with(csrf())
                        .with(authentication(identity(owner, true, "ORGANIZER")))
                        .contentType("application/json")
                        .content("{\"name\":\"Not allowed after cancellation\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("EVENT_NOT_EDITABLE"));
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
    void postPublicationStatusesFollowPublicLifecycleAndCannotBeRepublished() throws Exception {
        long id = createEvent();
        for (String eventStatus : List.of("ONGOING", "COMPLETED", "CANCELLED")) {
            if (eventStatus.equals("CANCELLED")) {
                jdbc.update("""
                        update events
                        set status = ?, cancelled_at = current_timestamp,
                            cancellation_reason = 'Cancelled integration-test fixture.'
                        where event_id = ?
                        """, eventStatus, id);
            } else {
                jdbc.update("update events set status = ? where event_id = ?", eventStatus, id);
            }
            mvc.perform(get(PUBLIC + "/" + id)).andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value(eventStatus));
            mvc.perform(get(PUBLIC)).andExpect(status().isOk())
                    .andExpect(jsonPath("$.totalElements")
                            .value(eventStatus.equals("ONGOING") ? 1 : 0));
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

    private String eventStatus(long eventId) {
        return jdbc.queryForObject("select status from events where event_id = ?",
                String.class, eventId);
    }

    private Long count(String table, String idColumn, long id) {
        return jdbc.queryForObject("select count(*) from " + table + " where " + idColumn + " = ?",
                Long.class, id);
    }

    private void assertCancellationBlocked(String paymentStatus,
            boolean reconciliationRequired, boolean assignment, String expectedCode) throws Exception {
        long eventId = createEvent();
        publish(eventId);
        CancellationFixture fixture = insertCancellationFixture(eventId);
        try {
            if (paymentStatus != null) {
                jdbc.update("""
                        insert into booth_payments(
                            booth_hold_id, transaction_type, purpose, amount, status,
                            idempotency_key, gateway_provider, reconciliation_required,
                            created_at, updated_at, completed_at)
                        values (?, 'PAYMENT', 'INITIAL_BOOTH_RENTAL', 10000, ?, ?, 'VNPAY', ?,
                            current_timestamp, current_timestamp,
                            case when ? = 'PENDING' then null else current_timestamp end)
                        """, fixture.holdId(), paymentStatus, UUID.randomUUID(),
                        reconciliationRequired, paymentStatus);
            }
            if (assignment) {
                jdbc.update("update booth_holds set status = 'CONSUMED', consumed_at = current_timestamp "
                        + "where booth_hold_id = ?", fixture.holdId());
                jdbc.update("update booth_requests set status = 'COMPLETED', "
                        + "completed_at = current_timestamp where booth_request_id = ?",
                        fixture.selectedRequestId());
                jdbc.update("""
                        insert into booth_assignments(
                            booth_hold_id, qr_token, status, assigned_at)
                        values (?, ?, 'ACTIVE', current_timestamp)
                        """, fixture.holdId(), UUID.randomUUID());
            }

            mvc.perform(post(ORGANIZER + "/" + eventId + "/cancel")
                            .with(csrf())
                            .with(authentication(identity(owner, true, "ORGANIZER")))
                            .contentType("application/json")
                            .content("{\"reason\":\"A sufficiently long cancellation reason.\"}"))
                    .andExpect(status().isConflict())
                    .andExpect(jsonPath("$.code").value(expectedCode));

            assertThat(eventStatus(eventId)).isEqualTo("PUBLISHED");
            assertThat(jdbc.queryForObject(
                    "select status from booth_requests where booth_request_id = ?",
                    String.class, fixture.pendingRequestId())).isEqualTo("PENDING");
            assertThat(jdbc.queryForObject(
                    "select cancellation_reason from events where event_id = ?",
                    String.class, eventId)).isNull();
        } finally {
            deleteCancellationFixture(fixture);
        }
    }

    private CancellationFixture insertCancellationFixture(long eventId) {
        long organizationId = jdbc.queryForObject("""
                insert into partner_organizations(
                    representative_user_id, name, category_code, status,
                    created_at, updated_at)
                values (?, ?, 'PUBLISHER', 'ACTIVE', current_timestamp, current_timestamp)
                returning partner_organization_id
                """, Long.class, other, "Cancellation partner " + UUID.randomUUID());
        long applicationId = jdbc.queryForObject("""
                insert into partner_event_applications(
                    partner_organization_id, event_id, status, submitted_at, reviewed_at)
                values (?, ?, 'APPROVED', current_timestamp, current_timestamp)
                returning application_id
                """, Long.class, organizationId, eventId);
        long selectedBoothId = insertCancellationBooth("SELECTED");
        long pendingBoothId = insertCancellationBooth("PENDING");
        long selectedConfigId = insertCancellationConfig(eventId, selectedBoothId);
        long pendingConfigId = insertCancellationConfig(eventId, pendingBoothId);
        long selectedRequestId = jdbc.queryForObject("""
                insert into booth_requests(
                    application_id, booth_id, status, submitted_at, reviewed_at, selected_at)
                values (?, ?, 'SELECTED', current_timestamp, current_timestamp, current_timestamp)
                returning booth_request_id
                """, Long.class, applicationId, selectedBoothId);
        long pendingRequestId = jdbc.queryForObject("""
                insert into booth_requests(application_id, booth_id, status, submitted_at)
                values (?, ?, 'PENDING', current_timestamp)
                returning booth_request_id
                """, Long.class, applicationId, pendingBoothId);
        long holdId = jdbc.queryForObject("""
                insert into booth_holds(
                    event_booth_config_id, booth_request_id, locked_rental_price,
                    status, created_at, expires_at)
                values (?, ?, 10000, 'ACTIVE', current_timestamp,
                    current_timestamp + interval '1 hour')
                returning booth_hold_id
                """, Long.class, selectedConfigId, selectedRequestId);
        return new CancellationFixture(organizationId, applicationId,
                selectedBoothId, pendingBoothId, selectedConfigId, pendingConfigId,
                selectedRequestId, pendingRequestId, holdId);
    }

    private CancellationRecipientFixture insertCancellationRecipient(
            long eventId, String applicationStatus, boolean verified) {
        String suffix = UUID.randomUUID().toString().replace("-", "");
        String email = "cancel-" + suffix + "@example.test";
        long userId = jdbc.queryForObject("""
                insert into users(
                    username, password_hash, full_name, email, email_verified_at, status)
                values (?, ?, 'Cancellation Recipient', ?,
                    case when ? then current_timestamp else null end, 'ACTIVE')
                returning user_id
                """, Long.class, "cancel_" + suffix.substring(0, 20),
                new BCryptPasswordEncoder().encode(UUID.randomUUID().toString()),
                email, verified);
        long organizationId = jdbc.queryForObject("""
                insert into partner_organizations(
                    representative_user_id, name, category_code, status,
                    created_at, updated_at)
                values (?, ?, 'PUBLISHER', 'ACTIVE', current_timestamp, current_timestamp)
                returning partner_organization_id
                """, Long.class, userId, "Cancellation recipient " + suffix);
        long applicationId = jdbc.queryForObject("""
                insert into partner_event_applications(
                    partner_organization_id, event_id, status, submitted_at)
                values (?, ?, ?, current_timestamp)
                returning application_id
                """, Long.class, organizationId, eventId, applicationStatus);
        return new CancellationRecipientFixture(userId, organizationId, applicationId, email);
    }

    private void deleteCancellationRecipients(List<CancellationRecipientFixture> recipients) {
        for (CancellationRecipientFixture recipient : recipients.reversed()) {
            jdbc.update("delete from notifications where recipient_user_id = ? and recipient_role = 'PARTNER'",
                    recipient.userId());
            jdbc.update("delete from partner_event_applications where application_id = ?",
                    recipient.applicationId());
            jdbc.update("delete from partner_organizations where partner_organization_id = ?",
                    recipient.organizationId());
            jdbc.update("delete from users where user_id = ?", recipient.userId());
        }
    }

    private long insertCancellationBooth(String suffix) {
        long boothId = jdbc.queryForObject("""
                insert into locations(
                    code, name, location_type, max_capacity, is_active, created_at, updated_at)
                values (?, 'Cancellation Booth', 'BOOTH', 4, true,
                    current_timestamp, current_timestamp)
                returning location_id
                """, Long.class,
                (suffix + "-" + UUID.randomUUID().toString().substring(0, 12)).toUpperCase());
        jdbc.update("insert into booths(booth_id, category_code) values (?, 'PUBLISHER')", boothId);
        return boothId;
    }

    private ExternalParticipationFixture insertExternalParticipation(long eventId) {
        long organizationId = jdbc.queryForObject("""
                insert into partner_organizations(
                    representative_user_id, name, category_code, status,
                    created_at, updated_at)
                values (?, ?, 'PUBLISHER', 'ACTIVE', current_timestamp, current_timestamp)
                returning partner_organization_id
                """, Long.class, other, "Operational patch partner " + UUID.randomUUID());
        long applicationId = jdbc.queryForObject("""
                insert into partner_event_applications(
                    partner_organization_id, event_id, status, submitted_at)
                values (?, ?, 'PENDING', current_timestamp)
                returning application_id
                """, Long.class, organizationId, eventId);
        return new ExternalParticipationFixture(organizationId, applicationId);
    }

    private void deleteExternalParticipation(ExternalParticipationFixture fixture) {
        jdbc.update("delete from partner_event_applications where application_id = ?",
                fixture.applicationId());
        jdbc.update("delete from partner_organizations where partner_organization_id = ?",
                fixture.organizationId());
    }

    private long insertCancellationConfig(long eventId, long boothId) {
        return jdbc.queryForObject("""
                insert into event_booth_configs(event_id, booth_id, rental_price, is_enabled)
                values (?, ?, 10000, true)
                returning event_booth_config_id
                """, Long.class, eventId, boothId);
    }

    private void deleteCancellationFixture(CancellationFixture fixture) {
        jdbc.update("delete from booth_assignments where booth_hold_id = ?", fixture.holdId());
        jdbc.update("delete from booth_payments where booth_hold_id = ?", fixture.holdId());
        jdbc.update("delete from booth_holds where booth_hold_id = ?", fixture.holdId());
        jdbc.update("delete from booth_requests where application_id = ?", fixture.applicationId());
        jdbc.update("delete from event_booth_configs where event_booth_config_id in (?, ?)",
                fixture.selectedConfigId(), fixture.pendingConfigId());
        jdbc.update("delete from booths where booth_id in (?, ?)",
                fixture.selectedBoothId(), fixture.pendingBoothId());
        jdbc.update("delete from locations where location_id in (?, ?)",
                fixture.selectedBoothId(), fixture.pendingBoothId());
        jdbc.update("delete from partner_event_applications where application_id = ?",
                fixture.applicationId());
        jdbc.update("delete from partner_organizations where partner_organization_id = ?",
                fixture.organizationId());
    }

    private record CancellationFixture(
            long organizationId,
            long applicationId,
            long selectedBoothId,
            long pendingBoothId,
            long selectedConfigId,
            long pendingConfigId,
            long selectedRequestId,
            long pendingRequestId,
            long holdId) {
    }

    private record ExternalParticipationFixture(long organizationId, long applicationId) {
    }

    private record CancellationRecipientFixture(
            long userId, long organizationId, long applicationId, String email) {
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
        Instant boothCancellationCutoffAt = baseTime.plus(Duration.ofDays(25));
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
