package com.swp391.bookstreet.booth;

import com.swp391.bookstreet.booth.service.BoothHoldExpiryService;
import com.swp391.bookstreet.booth.service.BoothSelectionMailService;
import com.swp391.bookstreet.security.authentication.AuthenticatedPrincipal;
import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
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
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.timeout;
import static org.mockito.Mockito.verify;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
        "spring.datasource.url=${EVENT_TEST_DATABASE_URL}",
        "logging.level.root=ERROR",
        "logging.level.org.springframework.security=ERROR",
        "bookstreet.booth.hold-expiry-initial-delay-ms=3600000",
        "bookstreet.booth.hold-expiry-delay-ms=3600000"
})
@EnabledIfEnvironmentVariable(named = "EVENT_TEST_DATABASE_URL", matches = ".+")
@ContextConfiguration(initializers = OrganizerBoothSelectionIntegrationTests.TestDatabaseGuard.class)
class OrganizerBoothSelectionIntegrationTests {
    static class TestDatabaseGuard
            implements ApplicationContextInitializer<ConfigurableApplicationContext> {
        @Override
        public void initialize(ConfigurableApplicationContext applicationContext) {
            String url = applicationContext.getEnvironment()
                    .getRequiredProperty("spring.datasource.url");
            if (!url.matches("jdbc:postgresql://[^/]+/[A-Za-z0-9_]+_event_test(?:\\?.*)?")) {
                throw new IllegalStateException(
                        "Organizer selection tests require a dedicated *_event_test database.");
            }
        }
    }

    @Autowired WebApplicationContext context;
    @Autowired JdbcTemplate jdbc;
    @Autowired ObjectMapper mapper;
    @Autowired BoothHoldExpiryService expiryService;
    @MockitoBean BoothSelectionMailService mailService;

    MockMvc mvc;
    Long organizer;
    Long otherOrganizer;
    Long partnerOne;
    Long partnerTwo;
    String codePrefix;

    @BeforeEach
    void setup() {
        assertThat(jdbc.queryForObject("select current_database()", String.class))
                .endsWith("_event_test");
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        organizer = insertUser("Organizer");
        otherOrganizer = insertUser("Other Organizer");
        partnerOne = insertUser("Partner One");
        partnerTwo = insertUser("Partner Two");
        codePrefix = "S" + UUID.randomUUID().toString().substring(0, 7).toUpperCase();
        reset(mailService);
    }

    @AfterEach
    void cleanup() {
        jdbc.update("delete from notifications where recipient_user_id in (?, ?, ?, ?)",
                organizer, otherOrganizer, partnerOne, partnerTwo);
        jdbc.update("""
                delete from booth_assignments where booth_hold_id in (
                    select hold.booth_hold_id from booth_holds hold
                    join booth_requests request on request.booth_request_id = hold.booth_request_id
                    join partner_event_applications application
                      on application.application_id = request.application_id
                    where application.event_id in (
                        select event_id from events where organizer_user_id in (?, ?)))
                """, organizer, otherOrganizer);
        jdbc.update("""
                delete from booth_payments where booth_hold_id in (
                    select hold.booth_hold_id from booth_holds hold
                    join event_booth_configs config
                      on config.event_booth_config_id = hold.event_booth_config_id
                    where config.event_id in (
                        select event_id from events where organizer_user_id in (?, ?)))
                """, organizer, otherOrganizer);
        jdbc.update("""
                delete from booth_holds
                where booth_request_id in (
                    select request.booth_request_id
                    from booth_requests request
                    join partner_event_applications application
                      on application.application_id = request.application_id
                    where application.event_id in (
                        select event_id from events where organizer_user_id in (?, ?)
                    )
                )
                """, organizer, otherOrganizer);
        jdbc.update("""
                delete from booth_requests
                where application_id in (
                    select application_id from partner_event_applications
                    where event_id in (
                        select event_id from events where organizer_user_id in (?, ?)
                    )
                )
                """, organizer, otherOrganizer);
        jdbc.update("delete from event_booth_configs where event_id in "
                + "(select event_id from events where organizer_user_id in (?, ?))",
                organizer, otherOrganizer);
        jdbc.update("delete from partner_event_applications where event_id in "
                + "(select event_id from events where organizer_user_id in (?, ?))",
                organizer, otherOrganizer);
        jdbc.update("delete from events where organizer_user_id in (?, ?)",
                organizer, otherOrganizer);
        jdbc.update("delete from booths where booth_id in "
                + "(select location_id from locations where code like ?)", codePrefix + "%");
        jdbc.update("delete from locations where code like ?", codePrefix + "%");
        jdbc.update("delete from partner_organizations where representative_user_id in (?, ?)",
                partnerOne, partnerTwo);
        jdbc.update("delete from users where user_id in (?, ?, ?, ?)",
                organizer, otherOrganizer, partnerOne, partnerTwo);
    }

    @Test
    void ownerCanListReadAndRejectPendingCandidateWhileOtherOrganizerGetsNotFound()
            throws Exception {
        TimeRange range = futureRange(30);
        long eventId = insertEvent(organizer, range, 1440, 2);
        long boothId = insertBooth("REVIEW");
        configure(eventId, boothId, 2_000_000);
        long requestId = insertRequest(approve(partnerOne, eventId), boothId, "PENDING");

        mvc.perform(get("/api/v1/organizer/events/{eventId}/booth-requests", eventId)
                        .param("boothId", Long.toString(boothId))
                        .param("status", "PENDING")
                        .param("sort", "partnerOrganizationName,asc")
                        .with(organizer(organizer)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].boothRequestId").value(requestId))
                .andExpect(jsonPath("$.content[0].partnerOrganizationStatus").value("ACTIVE"));
        mvc.perform(get("/api/v1/organizer/events/{eventId}/booth-requests/{requestId}",
                        eventId, requestId).with(organizer(otherOrganizer)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("EVENT_NOT_FOUND"));

        mvc.perform(post("/api/v1/organizer/events/{eventId}/booth-requests/{requestId}/reject",
                        eventId, requestId).with(organizer(organizer)).with(csrf())
                        .contentType("application/json")
                        .content("{\"reviewNote\":\"  Layout is not suitable.  \"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("REJECTED"))
                .andExpect(jsonPath("$.reviewNote").value("Layout is not suitable."))
                .andExpect(jsonPath("$.reviewedAt").exists());
        mvc.perform(post("/api/v1/organizer/events/{eventId}/booth-requests/{requestId}/reject",
                        eventId, requestId).with(organizer(organizer)).with(csrf())
                        .contentType("application/json")
                        .content("{\"reviewNote\":\"Again\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("BOOTH_REQUEST_NOT_PENDING"));
    }

    @Test
    void organizerRoleAndVerifiedEmailAreRequired() throws Exception {
        long eventId = insertEvent(organizer, futureRange(30), 1440, 2);
        String path = "/api/v1/organizer/events/" + eventId + "/booth-requests";

        mvc.perform(get(path)).andExpect(status().isUnauthorized());
        mvc.perform(get(path).with(identity(partnerOne, true, "PARTNER")))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ACCESS_DENIED"));
        mvc.perform(get(path).with(identity(organizer, false, "ORGANIZER")))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ACCESS_DENIED"));
    }

    @Test
    void selectionCreatesPriceAndWindowSnapshotAndLeavesCompetitorPending() throws Exception {
        TimeRange range = futureRange(30);
        long eventId = insertEvent(organizer, range, 90, 2);
        long boothId = insertBooth("SNAPSHOT");
        long configId = configure(eventId, boothId, 2_000_000);
        long selectedRequest = insertRequest(approve(partnerOne, eventId), boothId, "PENDING");
        long competingRequest = insertRequest(approve(partnerTwo, eventId), boothId, "PENDING");
        String partnerEmail = jdbc.queryForObject(
                "select email from users where user_id = ?", String.class, partnerOne);

        String body = mvc.perform(post(
                        "/api/v1/organizer/events/{eventId}/booth-requests/{requestId}/select",
                        eventId, selectedRequest).with(organizer(organizer)).with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("SELECTED"))
                .andExpect(jsonPath("$.hold.status").value("ACTIVE"))
                .andExpect(jsonPath("$.hold.lockedRentalPrice").value(2_000_000))
                .andReturn().getResponse().getContentAsString();

        JsonNode response = mapper.readTree(body);
        Instant selectedAt = Instant.parse(response.get("selectedAt").asText());
        Instant createdAt = Instant.parse(response.get("hold").get("createdAt").asText());
        Instant expiresAt = Instant.parse(response.get("hold").get("expiresAt").asText());
        assertThat(createdAt).isEqualTo(selectedAt);
        assertThat(Duration.between(selectedAt, expiresAt)).isEqualTo(Duration.ofMinutes(90));
        assertThat(jdbc.queryForObject(
                "select status from booth_requests where booth_request_id = ?",
                String.class, competingRequest)).isEqualTo("PENDING");
        assertThat(jdbc.queryForObject("select count(*) from notifications where "
                + "booth_request_id = ? and recipient_user_id = ? and recipient_role = 'PARTNER' "
                + "and notification_type = 'PARTNER_BOOTH_REQUEST_STATUS_CHANGED'",
                Integer.class, selectedRequest, partnerOne)).isOne();
        assertThat(jdbc.queryForObject("select count(*) from notifications where "
                + "booth_request_id = ?", Integer.class, competingRequest)).isZero();

        jdbc.update("update event_booth_configs set rental_price = 3500000 "
                + "where event_booth_config_id = ?", configId);
        jdbc.update("update events set booth_payment_window_minutes = 180 where event_id = ?",
                eventId);
        mvc.perform(get("/api/v1/organizer/events/{eventId}/booth-requests/{requestId}",
                        eventId, selectedRequest).with(organizer(organizer)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.hold.lockedRentalPrice").value(2_000_000))
                .andExpect(jsonPath("$.hold.expiresAt").value(expiresAt.toString()));
        mvc.perform(get("/api/v1/events/{eventId}/booths/{boothId}", eventId, boothId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.availability").value("ON_HOLD"));
        verify(mailService, timeout(2000)).sendSelectionMessage(
                eq(partnerEmail), eq(codePrefix + " Event"),
                eq(codePrefix + "SNAPSHOT"), eq(new BigDecimal("2000000.00")), eq(expiresAt));
    }

    @Test
    void selectionRechecksApprovalDeadlineQuotaAndAvailability() throws Exception {
        long approvalEvent = insertEvent(organizer, futureRange(30), 1440, 2);
        long approvalBooth = insertBooth("APPROVAL");
        configure(approvalEvent, approvalBooth, 1_000_000);
        long applicationId = approve(partnerOne, approvalEvent);
        long approvalRequest = insertRequest(applicationId, approvalBooth, "PENDING");
        jdbc.update("update partner_event_applications set status = 'REJECTED' "
                + "where application_id = ?", applicationId);
        selectExpecting(approvalEvent, approvalRequest,
                409, "PARTNER_APPLICATION_NOT_APPROVED");

        TimeRange expiredDeadlineRange = futureRange(40);
        long deadlineEvent = insertEvent(organizer, expiredDeadlineRange, 1440, 2);
        jdbc.update("update events set booth_request_deadline_at = current_timestamp "
                + "where event_id = ?", deadlineEvent);
        long deadlineBooth = insertBooth("DEADLINE");
        configure(deadlineEvent, deadlineBooth, 1_000_000);
        long deadlineRequest = insertRequest(approve(partnerOne, deadlineEvent),
                deadlineBooth, "PENDING");
        selectExpecting(deadlineEvent, deadlineRequest,
                409, "BOOTH_REQUEST_DEADLINE_PASSED");

        long disabledEvent = insertEvent(organizer, futureRange(50), 1440, 2);
        long disabledBooth = insertBooth("DISABLED");
        long disabledConfig = configure(disabledEvent, disabledBooth, 1_000_000);
        long disabledRequest = insertRequest(approve(partnerOne, disabledEvent),
                disabledBooth, "PENDING");
        jdbc.update("update event_booth_configs set is_enabled = false "
                + "where event_booth_config_id = ?", disabledConfig);
        selectExpecting(disabledEvent, disabledRequest, 409, "BOOTH_NOT_AVAILABLE");

        long quotaEvent = insertEvent(organizer, futureRange(60), 1440, 1);
        long firstQuotaBooth = insertBooth("QUOTA1");
        long secondQuotaBooth = insertBooth("QUOTA2");
        configure(quotaEvent, firstQuotaBooth, 1_000_000);
        configure(quotaEvent, secondQuotaBooth, 1_000_000);
        long quotaApplication = approve(partnerOne, quotaEvent);
        long firstQuotaRequest = insertRequest(quotaApplication, firstQuotaBooth, "PENDING");
        long secondQuotaRequest = insertRequest(quotaApplication, secondQuotaBooth, "PENDING");
        selectExpecting(quotaEvent, firstQuotaRequest, 200, null);
        selectExpecting(quotaEvent, secondQuotaRequest, 409, "BOOTH_QUOTA_EXCEEDED");
    }

    @Test
    void dueHoldExpiresIdempotentlyAndRestoresAvailability() throws Exception {
        long eventId = insertEvent(organizer, futureRange(30), 1440, 2);
        long boothId = insertBooth("EXPIRE");
        long configId = configure(eventId, boothId, 1_500_000);
        long requestId = insertRequest(approve(partnerOne, eventId), boothId, "SELECTED");
        jdbc.update("update booth_requests set selected_at = current_timestamp - interval '2 hours', "
                + "reviewed_at = current_timestamp - interval '2 hours' "
                + "where booth_request_id = ?", requestId);
        jdbc.update("""
                insert into booth_holds(event_booth_config_id, booth_request_id,
                    locked_rental_price, status, created_at, expires_at)
                values (?, ?, 1500000, 'ACTIVE', current_timestamp - interval '2 hours',
                    current_timestamp - interval '1 hour')
                """, configId, requestId);

        Instant processedAt = Instant.now().truncatedTo(ChronoUnit.MICROS);
        assertThat(expiryService.expireDueHolds(processedAt)).isOne();
        assertThat(expiryService.expireDueHolds(processedAt.plusSeconds(1))).isZero();
        assertThat(jdbc.queryForObject(
                "select status from booth_holds where booth_request_id = ?",
                String.class, requestId)).isEqualTo("EXPIRED");
        assertThat(jdbc.queryForObject(
                "select status from booth_requests where booth_request_id = ?",
                String.class, requestId)).isEqualTo("PAYMENT_EXPIRED");
        assertThat(jdbc.queryForObject("select count(*) from notifications where "
                + "booth_request_id = ? and recipient_user_id = ? and recipient_role = 'PARTNER'",
                Integer.class, requestId, partnerOne)).isOne();
        assertThat(jdbc.queryForObject(
                "select released_at from booth_holds where booth_request_id = ?",
                Timestamp.class, requestId).toInstant()).isEqualTo(processedAt);
        mvc.perform(get("/api/v1/events/{eventId}/booths/{boothId}", eventId, boothId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.availability").value("AVAILABLE"));
    }

    @Test
    void expiredHoldAlertsOwnerOnceWhileAnotherCandidateIsSelectable() {
        long eventId = insertEvent(organizer, futureRange(30), 1440, 2);
        long boothId = insertBooth("RESELECT");
        long configId = configure(eventId, boothId, 1_500_000);
        long released = insertSelectedRequest(approve(partnerOne, eventId), boothId);
        insertExpiredHold(configId, released);
        long candidate = insertRequest(approve(partnerTwo, eventId), boothId, "PENDING");

        Instant processedAt = Instant.now().truncatedTo(ChronoUnit.MICROS);
        assertThat(expiryService.expireDueHolds(processedAt)).isOne();
        assertThat(expiryService.expireDueHolds(processedAt.plusSeconds(1))).isZero();

        assertThat(reselectionRows(released)).isOne();
        assertThat(reselectionRows(candidate)).isZero();
    }

    @Test
    void expiredHoldDoesNotAlertOwnerWithoutASelectableCandidate() {
        long noCandidate = expiringRequestInNewEvent("NOCAND");

        long pastDeadlineEvent = insertEvent(organizer, futureRange(30), 1440, 2);
        long pastDeadlineBooth = insertBooth("DEADLINE");
        long pastDeadline = insertSelectedRequest(approve(partnerOne, pastDeadlineEvent), pastDeadlineBooth);
        insertExpiredHold(configure(pastDeadlineEvent, pastDeadlineBooth, 1_500_000), pastDeadline);
        insertRequest(approve(partnerTwo, pastDeadlineEvent), pastDeadlineBooth, "PENDING");
        jdbc.update("update events set booth_request_deadline_at = current_timestamp - interval '1 minute' "
                + "where event_id = ?", pastDeadlineEvent);

        long blockedEvent = insertEvent(organizer, futureRange(30), 1440, 2);
        long blockedBooth = insertBooth("BLOCKED");
        long blocked = insertSelectedRequest(approve(partnerOne, blockedEvent), blockedBooth);
        long blockedHold = insertExpiredHold(configure(blockedEvent, blockedBooth, 1_500_000), blocked);
        insertRequest(approve(partnerTwo, blockedEvent), blockedBooth, "PENDING");
        jdbc.update("""
                insert into booth_payments(booth_hold_id, transaction_type, purpose, amount, status,
                    idempotency_key, gateway_provider)
                values (?, 'PAYMENT', 'INITIAL_BOOTH_RENTAL', 1500000, 'PENDING', ?, 'VNPAY')
                """, blockedHold, UUID.randomUUID());

        expiryService.expireDueHolds(Instant.now().truncatedTo(ChronoUnit.MICROS));

        assertThat(jdbc.queryForObject("select status from booth_requests where booth_request_id = ?",
                String.class, blocked)).isEqualTo("SELECTED");
        assertThat(jdbc.queryForObject("select status from booth_requests where booth_request_id = ?",
                String.class, noCandidate)).isEqualTo("PAYMENT_EXPIRED");
        assertThat(jdbc.queryForObject("select status from booth_requests where booth_request_id = ?",
                String.class, pastDeadline)).isEqualTo("PAYMENT_EXPIRED");
        assertThat(reselectionRows(noCandidate)).isZero();
        assertThat(reselectionRows(pastDeadline)).isZero();
        assertThat(reselectionRows(blocked)).isZero();

        long inactiveEvent = insertEvent(organizer, futureRange(30), 1440, 2);
        long inactiveBooth = insertBooth("INACTIVE");
        long inactive = insertSelectedRequest(approve(partnerOne, inactiveEvent), inactiveBooth);
        insertExpiredHold(configure(inactiveEvent, inactiveBooth, 1_500_000), inactive);
        insertRequest(approve(partnerTwo, inactiveEvent), inactiveBooth, "PENDING");
        jdbc.update("update partner_organizations set status = 'INACTIVE' "
                + "where representative_user_id = ?", partnerTwo);

        expiryService.expireDueHolds(Instant.now().truncatedTo(ChronoUnit.MICROS));

        assertThat(jdbc.queryForObject("select status from booth_requests where booth_request_id = ?",
                String.class, inactive)).isEqualTo("PAYMENT_EXPIRED");
        assertThat(reselectionRows(inactive)).isZero();
    }

    @Test
    void withdrawingOnlyASelectedBoothWithACandidateAlertsTheOwner() throws Exception {
        long eventId = insertEvent(organizer, futureRange(30), 1440, 2);
        long contestedBooth = insertBooth("WITHDRAW");
        configure(eventId, contestedBooth, 1_500_000);
        long partnerOneApplication = approve(partnerOne, eventId);
        long released = insertRequest(partnerOneApplication, contestedBooth, "PENDING");
        long candidate = insertRequest(approve(partnerTwo, eventId), contestedBooth, "PENDING");
        selectExpecting(eventId, released, 200, null);
        withdraw(partnerOne, released);
        withdraw(partnerTwo, candidate);

        long soloBooth = insertBooth("WITHDRAWSOLO");
        configure(eventId, soloBooth, 1_500_000);
        long solo = insertRequest(partnerOneApplication, soloBooth, "PENDING");
        selectExpecting(eventId, solo, 200, null);
        withdraw(partnerOne, solo);

        assertThat(reselectionRows(released)).isOne();
        assertThat(reselectionRows(candidate)).isZero();
        assertThat(reselectionRows(solo)).isZero();
    }

    @Test
    void freeAssignmentNotifiesWinnerAndCompetingPartnerOnlyAfterCompletion() throws Exception {
        long eventId = insertEvent(organizer, futureRange(30), 90, 2);
        long boothId = insertBooth("FREE-NOTIFY");
        configure(eventId, boothId, 0);
        long winner = insertRequest(approve(partnerOne, eventId), boothId, "PENDING");
        long competitor = insertRequest(approve(partnerTwo, eventId), boothId, "PENDING");

        selectExpecting(eventId, winner, 200, null);

        assertThat(jdbc.queryForObject("select status from booth_requests where booth_request_id = ?",
                String.class, winner)).isEqualTo("COMPLETED");
        assertThat(jdbc.queryForObject("select status from booth_requests where booth_request_id = ?",
                String.class, competitor)).isEqualTo("NOT_SELECTED");
        assertThat(jdbc.queryForObject("select count(*) from notifications where "
                + "booth_request_id = ? and recipient_user_id = ? and recipient_role = 'PARTNER'",
                Integer.class, winner, partnerOne)).isOne();
        assertThat(jdbc.queryForObject("select count(*) from notifications where "
                + "booth_request_id = ? and recipient_user_id = ? and recipient_role = 'PARTNER'",
                Integer.class, competitor, partnerTwo)).isOne();
    }

    @Test
    void overlappingEventIsBlockedButNonOverlappingEventCanReusePhysicalBooth()
            throws Exception {
        Instant base = Instant.now().plus(Duration.ofDays(30));
        long boothId = insertBooth("OVERLAP");
        long firstEvent = insertEvent(organizer,
                new TimeRange(base, base.plus(Duration.ofDays(2))), 1440, 2);
        long overlappingEvent = insertEvent(organizer,
                new TimeRange(base.plus(Duration.ofDays(1)), base.plus(Duration.ofDays(3))),
                1440, 2);
        long laterEvent = insertEvent(organizer,
                new TimeRange(base.plus(Duration.ofDays(3)), base.plus(Duration.ofDays(4))),
                1440, 2);
        configure(firstEvent, boothId, 2_000_000);
        configure(overlappingEvent, boothId, 2_000_000);
        configure(laterEvent, boothId, 2_000_000);
        long firstRequest = insertRequest(approve(partnerOne, firstEvent), boothId, "PENDING");
        long overlapRequest = insertRequest(approve(partnerOne, overlappingEvent),
                boothId, "PENDING");
        long laterRequest = insertRequest(approve(partnerOne, laterEvent), boothId, "PENDING");

        selectExpecting(firstEvent, firstRequest, 200, null);
        selectExpecting(overlappingEvent, overlapRequest, 409, "BOOTH_NOT_AVAILABLE");
        selectExpecting(laterEvent, laterRequest, 200, null);
        assertThat(jdbc.queryForObject(
                "select count(*) from booth_holds where status = 'ACTIVE'",
                Integer.class)).isGreaterThanOrEqualTo(2);
    }

    @Test
    void concurrentSelectionsForSameBoothProduceExactlyOneWinner() throws Exception {
        long eventId = insertEvent(organizer, futureRange(30), 1440, 2);
        long boothId = insertBooth("RACE");
        configure(eventId, boothId, 2_000_000);
        long firstRequest = insertRequest(approve(partnerOne, eventId), boothId, "PENDING");
        long secondRequest = insertRequest(approve(partnerTwo, eventId), boothId, "PENDING");
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);

        try (ExecutorService executor = Executors.newFixedThreadPool(2)) {
            Future<Integer> first = executor.submit(() -> selectConcurrently(
                    eventId, firstRequest, ready, start));
            Future<Integer> second = executor.submit(() -> selectConcurrently(
                    eventId, secondRequest, ready, start));
            ready.await();
            start.countDown();
            List<Integer> statuses = new ArrayList<>(List.of(first.get(), second.get()));
            Collections.sort(statuses);
            assertThat(statuses).containsExactly(200, 409);
        }

        assertThat(jdbc.queryForObject("select count(*) from booth_holds hold "
                + "join event_booth_configs config "
                + "on config.event_booth_config_id = hold.event_booth_config_id "
                + "where config.event_id = ? and config.booth_id = ? and hold.status = 'ACTIVE'",
                Integer.class, eventId, boothId)).isOne();
        assertThat(jdbc.queryForObject("select count(*) from booth_requests request "
                + "join partner_event_applications application "
                + "on application.application_id = request.application_id "
                + "where application.event_id = ? and request.booth_id = ? "
                + "and request.status = 'PENDING'", Integer.class, eventId, boothId)).isOne();
    }

    @Test
    void emailFailureDoesNotRollBackCommittedSelection() throws Exception {
        long eventId = insertEvent(organizer, futureRange(30), 1440, 2);
        long boothId = insertBooth("MAILFAIL");
        configure(eventId, boothId, 2_000_000);
        long requestId = insertRequest(approve(partnerOne, eventId), boothId, "PENDING");
        doThrow(new IllegalStateException("SMTP unavailable")).when(mailService)
                .sendSelectionMessage(any(), any(), any(), any(), any());

        selectExpecting(eventId, requestId, 200, null);

        verify(mailService, timeout(2000))
                .sendSelectionMessage(any(), any(), any(), any(), any());

        assertThat(jdbc.queryForObject(
                "select status from booth_requests where booth_request_id = ?",
                String.class, requestId)).isEqualTo("SELECTED");
        assertThat(jdbc.queryForObject(
                "select count(*) from booth_holds where booth_request_id = ? and status = 'ACTIVE'",
                Integer.class, requestId)).isOne();
    }

    @Test
    void slowEmailDeliveryDoesNotDelaySelectionResponse() throws Exception {
        long eventId = insertEvent(organizer, futureRange(30), 1440, 2);
        long boothId = insertBooth("MAILASYNC");
        configure(eventId, boothId, 2_000_000);
        long requestId = insertRequest(approve(partnerOne, eventId), boothId, "PENDING");
        CountDownLatch mailStarted = new CountDownLatch(1);
        CountDownLatch releaseMail = new CountDownLatch(1);
        CountDownLatch mailFinished = new CountDownLatch(1);
        doAnswer(invocation -> {
            mailStarted.countDown();
            try {
                releaseMail.await();
            } finally {
                mailFinished.countDown();
            }
            return null;
        }).when(mailService).sendSelectionMessage(any(), any(), any(), any(), any());

        try (ExecutorService requestExecutor = Executors.newSingleThreadExecutor()) {
            Future<MvcResult> response = requestExecutor.submit(() -> mvc.perform(post(
                            "/api/v1/organizer/events/{eventId}/booth-requests/{requestId}/select",
                            eventId, requestId).with(organizer(organizer)).with(csrf()))
                    .andReturn());

            assertThat(mailStarted.await(5, TimeUnit.SECONDS)).isTrue();
            assertThat(response.get(1, TimeUnit.SECONDS).getResponse().getStatus()).isEqualTo(200);
        } finally {
            releaseMail.countDown();
        }
        assertThat(mailFinished.await(5, TimeUnit.SECONDS)).isTrue();
    }

    private long expiringRequestInNewEvent(String boothSuffix) {
        long eventId = insertEvent(organizer, futureRange(30), 1440, 2);
        long boothId = insertBooth(boothSuffix);
        long requestId = insertSelectedRequest(approve(partnerOne, eventId), boothId);
        insertExpiredHold(configure(eventId, boothId, 1_500_000), requestId);
        return requestId;
    }

    private long insertSelectedRequest(long applicationId, long boothId) {
        return jdbc.queryForObject("""
                insert into booth_requests(application_id, booth_id, status, submitted_at,
                    reviewed_at, selected_at)
                values (?, ?, 'SELECTED', current_timestamp - interval '3 hours',
                    current_timestamp - interval '2 hours', current_timestamp - interval '2 hours')
                returning booth_request_id
                """, Long.class, applicationId, boothId);
    }

    private long insertExpiredHold(long configId, long requestId) {
        return jdbc.queryForObject("""
                insert into booth_holds(event_booth_config_id, booth_request_id,
                    locked_rental_price, status, created_at, expires_at)
                values (?, ?, 1500000, 'ACTIVE', current_timestamp - interval '2 hours',
                    current_timestamp - interval '1 hour')
                returning booth_hold_id
                """, Long.class, configId, requestId);
    }

    private void withdraw(Long partnerUserId, long requestId) throws Exception {
        mvc.perform(post("/api/v1/partner/booth-requests/{id}/withdraw", requestId)
                        .with(identity(partnerUserId, true, "PARTNER")).with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("WITHDRAWN"));
    }

    private int reselectionRows(long requestId) {
        return jdbc.queryForObject("""
                select count(*) from notifications
                where booth_request_id = ? and recipient_user_id = ? and recipient_role = 'ORGANIZER'
                  and notification_type = 'ORGANIZER_BOOTH_RESELECTION_REQUIRED'
                """, Integer.class, requestId, organizer);
    }

    private int selectConcurrently(long eventId, long requestId, CountDownLatch ready,
            CountDownLatch start) throws Exception {
        ready.countDown();
        start.await();
        MvcResult result = mvc.perform(post(
                        "/api/v1/organizer/events/{eventId}/booth-requests/{requestId}/select",
                        eventId, requestId).with(organizer(organizer)).with(csrf()))
                .andReturn();
        return result.getResponse().getStatus();
    }

    private void selectExpecting(long eventId, long requestId, int expectedStatus,
            String expectedCode) throws Exception {
        var action = mvc.perform(post(
                        "/api/v1/organizer/events/{eventId}/booth-requests/{requestId}/select",
                        eventId, requestId).with(organizer(organizer)).with(csrf()))
                .andExpect(status().is(expectedStatus));
        if (expectedCode != null) {
            action.andExpect(jsonPath("$.code").value(expectedCode));
        }
    }

    private TimeRange futureRange(long daysFromNow) {
        Instant start = Instant.now().plus(Duration.ofDays(daysFromNow));
        return new TimeRange(start, start.plus(Duration.ofDays(2)));
    }

    private long insertEvent(Long ownerId, TimeRange range, int paymentWindow, int quota) {
        return jdbc.queryForObject("""
                insert into events(
                    organizer_user_id, name, start_at, end_at,
                    booth_request_deadline_at, booth_payment_window_minutes,
                    max_booths_per_partner, max_activities_per_partner,
                    status, created_at, updated_at
                ) values (?, ?, ?, ?, ?, ?, ?, 2, 'PUBLISHED',
                    current_timestamp, current_timestamp)
                returning event_id
                """, Long.class, ownerId, codePrefix + " Event",
                Timestamp.from(range.start()), Timestamp.from(range.end()),
                Timestamp.from(Instant.now().plus(Duration.ofDays(10))),
                paymentWindow, quota);
    }

    private long insertBooth(String suffix) {
        long locationId = jdbc.queryForObject("""
                insert into locations(code, name, max_capacity, map_x, map_y,
                    is_active, location_type, created_at, updated_at)
                values (?, 'Selection Booth', 8, 10, 20, true, 'BOOTH',
                    current_timestamp, current_timestamp)
                returning location_id
                """, Long.class, codePrefix + suffix);
        jdbc.update("insert into booths(booth_id, category_code) values (?, 'PUBLISHER')",
                locationId);
        return locationId;
    }

    private long configure(long eventId, long boothId, int price) {
        return jdbc.queryForObject("""
                insert into event_booth_configs(event_id, booth_id, rental_price, is_enabled)
                values (?, ?, ?, true) returning event_booth_config_id
                """, Long.class, eventId, boothId, price);
    }

    private long approve(Long partnerUserId, long eventId) {
        Long organizationId = jdbc.query("""
                select partner_organization_id from partner_organizations
                where representative_user_id = ?
                """, result -> result.next() ? result.getLong(1) : null, partnerUserId);
        if (organizationId == null) {
            organizationId = jdbc.queryForObject("""
                    insert into partner_organizations(
                        representative_user_id, name, category_code, status,
                        created_at, updated_at)
                    values (?, ?, 'PUBLISHER', 'ACTIVE', current_timestamp, current_timestamp)
                    returning partner_organization_id
                    """, Long.class, partnerUserId, codePrefix + " Partner");
        }
        return jdbc.queryForObject("""
                insert into partner_event_applications(
                    partner_organization_id, event_id, status, submitted_at, reviewed_at)
                values (?, ?, 'APPROVED', current_timestamp, current_timestamp)
                returning application_id
                """, Long.class, organizationId, eventId);
    }

    private long insertRequest(long applicationId, long boothId, String requestStatus) {
        return jdbc.queryForObject("""
                insert into booth_requests(application_id, booth_id, status, submitted_at)
                values (?, ?, ?, current_timestamp) returning booth_request_id
                """, Long.class, applicationId, boothId, requestStatus);
    }

    private Long insertUser(String label) {
        return jdbc.queryForObject("""
                insert into users(username, password_hash, full_name, email,
                    email_verified_at, status)
                values (?, ?, ?, ?, current_timestamp, 'ACTIVE') returning user_id
                """, Long.class,
                "selection" + UUID.randomUUID().toString().replace("-", "").substring(0, 10),
                new BCryptPasswordEncoder().encode(UUID.randomUUID().toString()),
                label + " Selection Test", UUID.randomUUID() + "@example.test");
    }

    private static RequestPostProcessor organizer(Long id) {
        return identity(id, true, "ORGANIZER");
    }

    private static RequestPostProcessor identity(Long id, boolean verified, String role) {
        return authentication(UsernamePasswordAuthenticationToken.authenticated(
                new Identity(id, verified), null,
                List.of(new SimpleGrantedAuthority("ROLE_" + role))));
    }

    record TimeRange(Instant start, Instant end) {
    }

    record Identity(Long userId, boolean emailVerified) implements AuthenticatedPrincipal {
    }
}
