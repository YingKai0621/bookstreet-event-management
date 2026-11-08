package com.swp391.bookstreet.activity;

import com.swp391.bookstreet.activity.service.ActivityPartnerMailService;
import com.swp391.bookstreet.activity.service.ActivityPartnerMessageType;
import com.swp391.bookstreet.security.authentication.AuthenticatedPrincipal;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
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
import org.springframework.mail.MailSendException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.doThrow;
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
        "spring.datasource.hikari.maximum-pool-size=2",
        "spring.datasource.hikari.minimum-idle=0",
        "logging.level.org.springframework.security=ERROR"
})
@EnabledIfEnvironmentVariable(named = "EVENT_TEST_DATABASE_URL", matches = ".+")
@ContextConfiguration(initializers = OrganizerActivityProposalIntegrationTests.TestDatabaseGuard.class)
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class OrganizerActivityProposalIntegrationTests {
    static class TestDatabaseGuard
            implements ApplicationContextInitializer<ConfigurableApplicationContext> {
        @Override
        public void initialize(ConfigurableApplicationContext context) {
            String url = context.getEnvironment().getRequiredProperty("spring.datasource.url");
            if (!url.matches("jdbc:postgresql://[^/]+/[A-Za-z0-9_]+_event_test(?:\\?.*)?")) {
                throw new IllegalStateException("Organizer Proposal tests require *_event_test DB.");
            }
        }
    }

    private static final String PROPOSALS = "/api/v1/organizer/activity-proposals";

    @Autowired WebApplicationContext context;
    @Autowired JdbcTemplate jdbc;
    @Autowired ObjectMapper mapper;
    @MockitoBean ActivityPartnerMailService partnerMailService;

    MockMvc mvc;
    String prefix;
    long organizerId;
    long otherOrganizerId;
    long partnerUserId;
    long partnerOrganizationId;

    @BeforeEach
    void setup() {
        assertThat(jdbc.queryForObject("select current_database()", String.class))
                .endsWith("_event_test");
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        prefix = ("OAP" + UUID.randomUUID().toString().replace("-", "").substring(0, 9))
                .toUpperCase();
        organizerId = insertUser("Organizer");
        otherOrganizerId = insertUser("Other Organizer");
        partnerUserId = insertUser("Partner");
        partnerOrganizationId = insertOrganization(partnerUserId);
    }

    @AfterEach
    void cleanup() {
        jdbc.update("delete from notifications where recipient_role = 'PARTNER'");
        jdbc.update("delete from activities where event_id in "
                + "(select event_id from events where organizer_user_id in (?, ?))",
                organizerId, otherOrganizerId);
        jdbc.update("delete from activity_proposals where application_id in "
                + "(select application_id from partner_event_applications where event_id in "
                + "(select event_id from events where organizer_user_id in (?, ?)))",
                organizerId, otherOrganizerId);
        jdbc.update("delete from partner_event_applications where event_id in "
                + "(select event_id from events where organizer_user_id in (?, ?))",
                organizerId, otherOrganizerId);
        jdbc.update("delete from events where organizer_user_id in (?, ?)",
                organizerId, otherOrganizerId);
        jdbc.update("delete from booths where booth_id in "
                + "(select location_id from locations where code like ?)", prefix + "%");
        jdbc.update("delete from locations where code like ?", prefix + "%");
        jdbc.update("delete from partner_organizations where partner_organization_id = ?",
                partnerOrganizationId);
        jdbc.update("delete from users where user_id in (?, ?, ?)", organizerId,
                otherOrganizerId, partnerUserId);
    }

    @Test
    void organizerListsFiltersAndReadsOnlyOwnedProposals() throws Exception {
        Instant eventStart = future(4);
        long eventId = insertEvent(organizerId, eventStart, eventStart.plus(Duration.ofDays(1)));
        long foreignEventId = insertEvent(otherOrganizerId, eventStart,
                eventStart.plus(Duration.ofDays(1)));
        long applicationId = insertApplication(eventId);
        long foreignApplicationId = insertApplication(foreignEventId);
        long stageId = insertLocation("STAGE", "Central Hall");
        long areaId = insertLocation("AREA", "Garden Area");
        long firstId = insertProposal(applicationId, stageId, "Author Meeting", "PENDING",
                eventStart.plus(Duration.ofHours(1)), eventStart.plus(Duration.ofHours(2)), 2);
        insertProposal(applicationId, areaId, "Children Workshop", "NEED_CHANGES",
                eventStart.plus(Duration.ofHours(3)), eventStart.plus(Duration.ofHours(4)), 1);
        long foreignId = insertProposal(foreignApplicationId, stageId, "Foreign Proposal",
                "PENDING", eventStart.plus(Duration.ofHours(5)),
                eventStart.plus(Duration.ofHours(6)), 3);

        mvc.perform(get(PROPOSALS + "?eventId=" + eventId)
                        .with(actor(organizerId, "ORGANIZER")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(2));
        mvc.perform(get(PROPOSALS + "?size=1&status=PENDING&locationId=" + stageId
                        + "&search=author&sort=submittedAt,asc")
                        .with(actor(organizerId, "ORGANIZER")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.totalPages").value(1))
                .andExpect(jsonPath("$.content[0].activityProposalId").value(firstId))
                .andExpect(jsonPath("$.content[0].eventId").value(eventId))
                .andExpect(jsonPath("$.content[0].partnerOrganizationName")
                        .value(prefix + " Partner"))
                .andExpect(jsonPath("$.content[0].partnerOrganizationStatus").value("ACTIVE"))
                .andExpect(jsonPath("$.content[0].location.locationId").value(stageId));
        mvc.perform(get(PROPOSALS + "/" + firstId)
                        .with(actor(organizerId, "ORGANIZER")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Author Meeting"))
                .andExpect(jsonPath("$.partnerOrganizationStatus").value("ACTIVE"));
        mvc.perform(get(PROPOSALS + "/" + foreignId)
                        .with(actor(organizerId, "ORGANIZER")))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("ACTIVITY_PROPOSAL_NOT_FOUND"));
    }

    @Test
    void organizerProposalReadsEnforceRoleValidationAndLifecycle() throws Exception {
        Instant now = Instant.now().truncatedTo(ChronoUnit.MICROS);
        long eventId = insertEvent(organizerId, now.minus(Duration.ofHours(2)),
                now.plus(Duration.ofHours(2)));
        long applicationId = insertApplication(eventId);
        long stageId = insertLocation("LATE", "Late Stage");
        long proposalId = insertProposal(applicationId, stageId, "Late Proposal", "PENDING",
                now.minus(Duration.ofMinutes(5)), now.plus(Duration.ofMinutes(5)), 1);
        long commandGuardId = insertProposal(applicationId, stageId, "Late command", "PENDING",
                now.minus(Duration.ofMinutes(4)), now.plus(Duration.ofMinutes(6)), 2);

        mvc.perform(get(PROPOSALS)).andExpect(status().isUnauthorized());
        mvc.perform(get(PROPOSALS).with(actor(partnerUserId, "PARTNER")))
                .andExpect(status().isForbidden());
        mvc.perform(get(PROPOSALS + "?eventId=0").with(actor(organizerId, "ORGANIZER")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_FILTER"));
        mvc.perform(get(PROPOSALS + "?locationId=-1")
                        .with(actor(organizerId, "ORGANIZER")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_FILTER"));
        mvc.perform(get(PROPOSALS + "?status=UNKNOWN")
                        .with(actor(organizerId, "ORGANIZER")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_FILTER"));
        mvc.perform(get(PROPOSALS + "?sort=eventId,asc")
                        .with(actor(organizerId, "ORGANIZER")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_SORT"));
        mvc.perform(get(PROPOSALS + "/" + proposalId)
                        .with(actor(organizerId, "ORGANIZER")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CANCELLED"))
                .andExpect(jsonPath("$.cancelledAt").isNotEmpty());
        mvc.perform(post(PROPOSALS + "/" + commandGuardId + "/approve")
                        .with(actor(organizerId, "ORGANIZER")).with(csrf())
                        .contentType("application/json"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PROPOSAL_NOT_REVIEWABLE"));
        assertThat(proposalStatus(commandGuardId)).isEqualTo("CANCELLED");
        mvc.perform(get(PROPOSALS + "/" + proposalId)
                        .with(actor(organizerId, "ORGANIZER")))
                .andExpect(status().isOk());
        assertThat(jdbc.queryForObject("select count(*) from notifications where "
                + "activity_proposal_id = ? and recipient_user_id = ? and recipient_role = 'PARTNER' "
                + "and notification_type = 'PARTNER_ACTIVITY_PROPOSAL_STATUS_CHANGED'",
                Integer.class, proposalId, partnerUserId)).isOne();
    }

    @Test
    void organizerRequestsChangesAndRejectsWithoutRewritingProposalFacts() throws Exception {
        Instant eventStart = future(5);
        long eventId = insertEvent(organizerId, eventStart,
                eventStart.plus(Duration.ofDays(1)));
        long applicationId = insertApplication(eventId);
        long stageId = insertLocation("REVIEW", "Review Stage");
        long changesId = insertProposal(applicationId, stageId, "Original title", "PENDING",
                eventStart.plus(Duration.ofHours(1)), eventStart.plus(Duration.ofHours(2)), 2);
        long rejectId = insertProposal(applicationId, stageId, "Rejected title", "PENDING",
                eventStart.plus(Duration.ofHours(3)), eventStart.plus(Duration.ofHours(4)), 1);

        mvc.perform(post(PROPOSALS + "/" + changesId + "/request-changes")
                        .with(actor(organizerId, "ORGANIZER")).with(csrf())
                        .contentType("application/json")
                        .content("{\"reviewNote\":\"  Please clarify the session format.  \"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("NEED_CHANGES"))
                .andExpect(jsonPath("$.reviewNote")
                        .value("Please clarify the session format."))
                .andExpect(jsonPath("$.reviewedAt").isNotEmpty())
                .andExpect(jsonPath("$.title").value("Original title"));
        mvc.perform(post(PROPOSALS + "/" + changesId + "/request-changes")
                        .with(actor(organizerId, "ORGANIZER")).with(csrf())
                        .contentType("application/json")
                        .content("{\"reviewNote\":\"A second valid review note.\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PROPOSAL_NOT_REVIEWABLE"));

        mvc.perform(post(PROPOSALS + "/" + rejectId + "/reject")
                        .with(actor(organizerId, "ORGANIZER")).with(csrf())
                        .contentType("application/json")
                        .content("{\"reviewNote\":\"  The proposed format is not suitable.  \"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("REJECTED"))
                .andExpect(jsonPath("$.reviewNote")
                        .value("The proposed format is not suitable."));
        assertThat(jdbc.queryForObject(
                "select title from activity_proposals where activity_proposal_id = ?",
                String.class, changesId)).isEqualTo("Original title");
        assertThat(jdbc.queryForObject(
                "select count(*) from activities where source_proposal_id in (?, ?)",
                Integer.class, changesId, rejectId)).isZero();
        assertThat(jdbc.queryForObject("select count(*) from notifications where "
                + "activity_proposal_id in (?, ?) and recipient_role = 'PARTNER'",
                Integer.class, changesId, rejectId)).isEqualTo(2);
        verify(partnerMailService, timeout(5000).times(1)).sendMessage(anyString(), argThat(event ->
                event.messageType() == ActivityPartnerMessageType.PROPOSAL_NEEDS_CHANGES));
        verify(partnerMailService, timeout(5000).times(1)).sendMessage(anyString(), argThat(event ->
                event.messageType() == ActivityPartnerMessageType.PROPOSAL_REJECTED));
    }

    @Test
    void inactiveOrganizationBlocksPositiveProposalReviewsButStillAllowsRejection()
            throws Exception {
        Instant eventStart = future(5);
        long eventId = insertEvent(organizerId, eventStart,
                eventStart.plus(Duration.ofDays(1)));
        long applicationId = insertApplication(eventId);
        long stageId = insertLocation("INACTIVE-REVIEW", "Inactive Review Stage");
        long approveId = insertProposal(applicationId, stageId, "Blocked approval", "PENDING",
                eventStart.plus(Duration.ofHours(1)), eventStart.plus(Duration.ofHours(2)), 1);
        long changesId = insertProposal(applicationId, stageId, "Blocked changes", "PENDING",
                eventStart.plus(Duration.ofHours(3)), eventStart.plus(Duration.ofHours(4)), 2);
        long rejectId = insertProposal(applicationId, stageId, "Allowed rejection", "PENDING",
                eventStart.plus(Duration.ofHours(5)), eventStart.plus(Duration.ofHours(6)), 3);
        jdbc.update("update partner_organizations set status = 'INACTIVE' where partner_organization_id = ?",
                partnerOrganizationId);

        mvc.perform(post(PROPOSALS + "/" + approveId + "/approve")
                        .with(actor(organizerId, "ORGANIZER")).with(csrf()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PARTNER_ORGANIZATION_INACTIVE"));
        mvc.perform(post(PROPOSALS + "/" + changesId + "/request-changes")
                        .with(actor(organizerId, "ORGANIZER")).with(csrf())
                        .contentType("application/json")
                        .content("{\"reviewNote\":\"Please provide sufficient clarification.\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PARTNER_ORGANIZATION_INACTIVE"));
        mvc.perform(post(PROPOSALS + "/" + rejectId + "/reject")
                        .with(actor(organizerId, "ORGANIZER")).with(csrf())
                        .contentType("application/json")
                        .content("{\"reviewNote\":\"The proposal cannot be accepted now.\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("REJECTED"));

        assertThat(proposalStatus(approveId)).isEqualTo("PENDING");
        assertThat(proposalStatus(changesId)).isEqualTo("PENDING");
        assertThat(proposalStatus(rejectId)).isEqualTo("REJECTED");
    }

    @Test
    void reviewCommandsValidateNotesAndConcealForeignProposal() throws Exception {
        Instant eventStart = future(5);
        long eventId = insertEvent(organizerId, eventStart,
                eventStart.plus(Duration.ofDays(1)));
        long foreignEventId = insertEvent(otherOrganizerId, eventStart,
                eventStart.plus(Duration.ofDays(1)));
        long stageId = insertLocation("PRIVATE", "Private Stage");
        long proposalId = insertProposal(insertApplication(eventId), stageId,
                "Validation proposal", "PENDING", eventStart.plus(Duration.ofHours(1)),
                eventStart.plus(Duration.ofHours(2)), 1);
        long foreignId = insertProposal(insertApplication(foreignEventId), stageId,
                "Foreign proposal", "PENDING", eventStart.plus(Duration.ofHours(3)),
                eventStart.plus(Duration.ofHours(4)), 1);

        mvc.perform(post(PROPOSALS + "/" + proposalId + "/reject")
                        .with(actor(organizerId, "ORGANIZER")).with(csrf())
                        .contentType("application/json").content("{}"))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
        mvc.perform(post(PROPOSALS + "/" + proposalId + "/request-changes")
                        .with(actor(organizerId, "ORGANIZER")).with(csrf())
                        .contentType("application/json")
                        .content("{\"reviewNote\":\"too short\"}"))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.fieldErrors[0].field").value("reviewNote"));
        mvc.perform(post(PROPOSALS + "/" + foreignId + "/reject")
                        .with(actor(organizerId, "ORGANIZER")).with(csrf())
                        .contentType("application/json")
                        .content("{\"reviewNote\":\"A valid foreign review note.\"}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("ACTIVITY_PROPOSAL_NOT_FOUND"));
        assertThat(proposalStatus(proposalId)).isEqualTo("PENDING");
        assertThat(proposalStatus(foreignId)).isEqualTo("PENDING");
    }

    @Test
    void approvalAtomicallyCreatesOneExactDraftAndRetryIsIdempotent() throws Exception {
        Instant eventStart = future(5);
        long eventId = insertEvent(organizerId, eventStart,
                eventStart.plus(Duration.ofDays(1)));
        long applicationId = insertApplication(eventId);
        long stageId = insertLocation("APPROVE", "Approval Stage");
        Instant start = eventStart.plus(Duration.ofHours(1));
        Instant end = start.plus(Duration.ofMinutes(90));
        long proposalId = insertProposal(applicationId, stageId, "Exact proposal", "PENDING",
                start, end, 1);

        mvc.perform(post(PROPOSALS + "/" + proposalId + "/approve")
                        .with(actor(organizerId, "ORGANIZER")).with(csrf())
                        .contentType("application/json"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.proposal.status").value("APPROVED"))
                .andExpect(jsonPath("$.proposal.reviewedAt").isNotEmpty())
                .andExpect(jsonPath("$.activity.status").value("DRAFT"))
                .andExpect(jsonPath("$.activity.sourceProposalId").value(proposalId))
                .andExpect(jsonPath("$.activity.partnerOrganizationId")
                        .value(partnerOrganizationId))
                .andExpect(jsonPath("$.activity.location.locationId").value(stageId))
                .andExpect(jsonPath("$.activity.title").value("Exact proposal"))
                .andExpect(jsonPath("$.activity.registrationRequired").value(false))
                .andExpect(jsonPath("$.activity.certificateEnabled").value(false))
                .andExpect(jsonPath("$.activity.attendanceQrAvailable").value(false));
        long activityId = jdbc.queryForObject(
                "select activity_id from activities where source_proposal_id = ?",
                Long.class, proposalId);

        mvc.perform(post(PROPOSALS + "/" + proposalId + "/approve")
                        .with(actor(organizerId, "ORGANIZER")).with(csrf())
                        .contentType("application/json"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.activity.activityId").value(activityId))
                .andExpect(jsonPath("$.proposal.status").value("APPROVED"));
        assertThat(jdbc.queryForObject(
                "select count(*) from activities where source_proposal_id = ?",
                Integer.class, proposalId)).isOne();
        assertThat(jdbc.queryForObject("""
                select count(*) from activities
                where activity_id = ? and event_id = ? and location_id = ?
                  and title = 'Exact proposal'
                  and description = 'Proposal integration test'
                  and activity_type = 'TALKSHOW'
                  and start_at = ? and end_at = ? and capacity = 20
                  and image_url is null and registration_required = false
                  and registration_deadline_at is null
                  and is_certificate_enabled = false and attendance_qr_token is null
                  and status = 'DRAFT'
                """, Integer.class, activityId, eventId, stageId,
                Timestamp.from(start), Timestamp.from(end))).isOne();
        verify(partnerMailService, timeout(5000).times(1)).sendMessage(anyString(), argThat(event ->
                event.messageType() == ActivityPartnerMessageType.PROPOSAL_APPROVED));
    }

    @Test
    void approvalRevalidatesLocationBoothQuotaAndScheduleWithoutPartialWrites()
            throws Exception {
        Instant eventStart = future(6);
        long eventId = insertEvent(organizerId, eventStart,
                eventStart.plus(Duration.ofDays(1)));
        long applicationId = insertApplication(eventId);
        Instant start = eventStart.plus(Duration.ofHours(1));
        Instant end = start.plus(Duration.ofHours(1));

        long inactiveId = insertLocation("INACTIVE", "Inactive Stage", "STAGE", false);
        long inactiveProposal = insertProposal(applicationId, inactiveId, "Inactive location",
                "PENDING", start, end, 4);
        approveExpecting(inactiveProposal, "LOCATION_NOT_ACTIVE");

        long boothId = insertLocation("BOOTH", "Unassigned Booth", "BOOTH", true);
        jdbc.update("insert into booths(booth_id, category_code) values (?, 'PUBLISHER')",
                boothId);
        long boothProposal = insertProposal(applicationId, boothId, "Unassigned booth",
                "PENDING", start.plus(Duration.ofHours(2)), end.plus(Duration.ofHours(2)), 3);
        approveExpecting(boothProposal, "BOOTH_ASSIGNMENT_REQUIRED");

        long conflictId = insertLocation("CONFLICT", "Conflict Stage");
        insertDirectActivity(eventId, conflictId, start, end);
        long conflictProposal = insertProposal(applicationId, conflictId, "Conflicting slot",
                "PENDING", start, end, 2);
        approveExpecting(conflictProposal, "ACTIVITY_LOCATION_TIME_CONFLICT");

        long quotaLocation = insertLocation("QUOTA", "Quota Stage");
        long approvedSource = insertProposal(applicationId, quotaLocation, "Existing source",
                "APPROVED", start.plus(Duration.ofHours(4)), end.plus(Duration.ofHours(4)), 6);
        insertPartnerActivity(eventId, quotaLocation, approvedSource,
                start.plus(Duration.ofHours(4)), end.plus(Duration.ofHours(4)));
        jdbc.update("update events set max_activities_per_partner = 1 where event_id = ?",
                eventId);
        long quotaProposal = insertProposal(applicationId, quotaLocation, "Quota proposal",
                "PENDING", start.plus(Duration.ofHours(6)), end.plus(Duration.ofHours(6)), 1);
        approveExpecting(quotaProposal, "ACTIVITY_QUOTA_REACHED");

        long applicationProposal = insertProposal(applicationId, quotaLocation,
                "Application no longer approved", "PENDING",
                start.plus(Duration.ofHours(8)), end.plus(Duration.ofHours(8)), 1);
        jdbc.update("update partner_event_applications set status = 'REJECTED' "
                + "where application_id = ?", applicationId);
        approveExpecting(applicationProposal, "PARTNER_APPLICATION_NOT_APPROVED");

        assertThat(jdbc.queryForObject("""
                select count(*) from activities
                where source_proposal_id in (?, ?, ?, ?, ?)
                """, Integer.class, inactiveProposal, boothProposal, conflictProposal,
                quotaProposal, applicationProposal)).isZero();
    }

    @Test
    void concurrentApprovalReturnsTheSameSingleActivity() throws Exception {
        Instant eventStart = future(5);
        long eventId = insertEvent(organizerId, eventStart,
                eventStart.plus(Duration.ofDays(1)));
        long stageId = insertLocation("RACE", "Concurrent Stage");
        long proposalId = insertProposal(insertApplication(eventId), stageId,
                "Concurrent approval", "PENDING", eventStart.plus(Duration.ofHours(1)),
                eventStart.plus(Duration.ofHours(2)), 1);
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);
        var executor = Executors.newFixedThreadPool(2);
        try {
            var approveCall = (java.util.concurrent.Callable<JsonNode>) () -> {
                ready.countDown();
                if (!start.await(10, TimeUnit.SECONDS)) {
                    throw new IllegalStateException("Concurrent approval start timed out.");
                }
                String body = mvc.perform(post(PROPOSALS + "/" + proposalId + "/approve")
                                .with(actor(organizerId, "ORGANIZER")).with(csrf())
                                .contentType("application/json"))
                        .andExpect(status().isOk())
                        .andReturn().getResponse().getContentAsString();
                return mapper.readTree(body);
            };
            var first = executor.submit(approveCall);
            var second = executor.submit(approveCall);
            assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
            start.countDown();
            long firstActivityId = first.get(15, TimeUnit.SECONDS)
                    .get("activity").get("activityId").asLong();
            long secondActivityId = second.get(15, TimeUnit.SECONDS)
                    .get("activity").get("activityId").asLong();

            assertThat(secondActivityId).isEqualTo(firstActivityId);
            assertThat(jdbc.queryForObject(
                    "select count(*) from activities where source_proposal_id = ?",
                    Integer.class, proposalId)).isOne();
            verify(partnerMailService, timeout(5000).times(1)).sendMessage(anyString(), argThat(event ->
                    event.messageType() == ActivityPartnerMessageType.PROPOSAL_APPROVED));
        } finally {
            start.countDown();
            executor.shutdownNow();
        }
    }

    @Test
    void notificationFailureDoesNotRollbackCommittedReview() throws Exception {
        Instant eventStart = future(5);
        long eventId = insertEvent(organizerId, eventStart,
                eventStart.plus(Duration.ofDays(1)));
        long stageId = insertLocation("MAIL", "Mail Stage");
        long proposalId = insertProposal(insertApplication(eventId), stageId,
                "Mail failure proposal", "PENDING", eventStart.plus(Duration.ofHours(1)),
                eventStart.plus(Duration.ofHours(2)), 1);
        doThrow(new MailSendException("simulated mail failure"))
                .when(partnerMailService).sendMessage(anyString(), argThat(event ->
                        event.messageType() == ActivityPartnerMessageType.PROPOSAL_REJECTED));

        mvc.perform(post(PROPOSALS + "/" + proposalId + "/reject")
                        .with(actor(organizerId, "ORGANIZER")).with(csrf())
                        .contentType("application/json")
                        .content("{\"reviewNote\":\"A valid rejection explanation.\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("REJECTED"));
        assertThat(proposalStatus(proposalId)).isEqualTo("REJECTED");
    }

    private long insertEvent(long ownerId, Instant start, Instant end) {
        return jdbc.queryForObject("""
                insert into events(
                    organizer_user_id, name, start_at, end_at,
                    activity_proposal_deadline_at, booth_payment_window_minutes,
                    max_booths_per_partner, max_activities_per_partner,
                    status, created_at, updated_at)
                values (?, ?, ?, ?, ?, 60, 2, 3, 'PUBLISHED',
                    current_timestamp, current_timestamp)
                returning event_id
                """, Long.class, ownerId, prefix + " Event", Timestamp.from(start),
                Timestamp.from(end), Timestamp.from(start.minus(Duration.ofDays(1))));
    }

    private long insertApplication(long eventId) {
        return jdbc.queryForObject("""
                insert into partner_event_applications(
                    partner_organization_id, event_id, status, submitted_at, reviewed_at)
                values (?, ?, 'APPROVED', current_timestamp, current_timestamp)
                returning application_id
                """, Long.class, partnerOrganizationId, eventId);
    }

    private long insertLocation(String suffix, String name) {
        return insertLocation(suffix, name, "STAGE", true);
    }

    private long insertLocation(String suffix, String name, String type, boolean active) {
        return jdbc.queryForObject("""
                insert into locations(code, name, location_type, max_capacity, is_active,
                    created_at, updated_at)
                values (?, ?, ?, 100, ?, current_timestamp, current_timestamp)
                returning location_id
                """, Long.class, prefix + suffix, prefix + " " + name, type, active);
    }

    private long insertProposal(long applicationId, long locationId, String title,
            String status, Instant start, Instant end, int submittedOffsetMinutes) {
        return jdbc.queryForObject("""
                insert into activity_proposals(
                    application_id, location_id, title, description, activity_type,
                    proposed_start_at, proposed_end_at, capacity, status,
                    submitted_at, updated_at, review_note, reviewed_at)
                values (?, ?, ?, 'Proposal integration test', 'TALKSHOW', ?, ?, 20, ?,
                    current_timestamp - (? * interval '1 minute'), current_timestamp,
                    case when ? in ('NEED_CHANGES', 'REJECTED')
                         then 'Please revise this proposal.' else null end,
                    case when ? in ('NEED_CHANGES', 'APPROVED', 'REJECTED')
                         then current_timestamp else null end)
                returning activity_proposal_id
                """, Long.class, applicationId, locationId, title, Timestamp.from(start),
                Timestamp.from(end), status, submittedOffsetMinutes, status, status);
    }

    private long insertDirectActivity(long eventId, long locationId, Instant start,
            Instant end) {
        return jdbc.queryForObject("""
                insert into activities(
                    event_id, location_id, title, description, activity_type,
                    start_at, end_at, registration_required, capacity,
                    is_certificate_enabled, status, created_at, updated_at)
                values (?, ?, 'Blocking Activity', 'Schedule blocker', 'TALKSHOW',
                    ?, ?, false, 20, false, 'DRAFT', current_timestamp, current_timestamp)
                returning activity_id
                """, Long.class, eventId, locationId, Timestamp.from(start),
                Timestamp.from(end));
    }

    private long insertPartnerActivity(long eventId, long locationId, long sourceProposalId,
            Instant start, Instant end) {
        return jdbc.queryForObject("""
                insert into activities(
                    event_id, location_id, source_proposal_id, title, description,
                    activity_type, start_at, end_at, registration_required, capacity,
                    is_certificate_enabled, status, created_at, updated_at)
                values (?, ?, ?, 'Existing Partner Activity', 'Quota consumer', 'TALKSHOW',
                    ?, ?, false, 20, false, 'DRAFT', current_timestamp, current_timestamp)
                returning activity_id
                """, Long.class, eventId, locationId, sourceProposalId,
                Timestamp.from(start), Timestamp.from(end));
    }

    private void approveExpecting(long proposalId, String code) throws Exception {
        mvc.perform(post(PROPOSALS + "/" + proposalId + "/approve")
                        .with(actor(organizerId, "ORGANIZER")).with(csrf())
                        .contentType("application/json"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value(code));
        assertThat(proposalStatus(proposalId)).isEqualTo("PENDING");
        assertThat(jdbc.queryForObject(
                "select count(*) from activities where source_proposal_id = ?",
                Integer.class, proposalId)).isZero();
    }

    private String proposalStatus(long proposalId) {
        return jdbc.queryForObject(
                "select status from activity_proposals where activity_proposal_id = ?",
                String.class, proposalId);
    }

    private long insertOrganization(long representativeId) {
        return jdbc.queryForObject("""
                insert into partner_organizations(
                    representative_user_id, name, category_code, status,
                    created_at, updated_at)
                values (?, ?, 'PUBLISHER', 'ACTIVE', current_timestamp, current_timestamp)
                returning partner_organization_id
                """, Long.class, representativeId, prefix + " Partner");
    }

    private long insertUser(String name) {
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 10);
        return jdbc.queryForObject("""
                insert into users(username, password_hash, full_name, email,
                    email_verified_at, status)
                values (?, '{noop}unused', ?, ?, current_timestamp, 'ACTIVE')
                returning user_id
                """, Long.class, "organizer-proposal-" + suffix, prefix + " " + name,
                "organizer-proposal-" + suffix + "@example.test");
    }

    private Instant future(int days) {
        return Instant.now().truncatedTo(ChronoUnit.MICROS).plus(Duration.ofDays(days));
    }

    private RequestPostProcessor actor(long userId, String role) {
        var principal = new Identity(userId, true);
        var token = new UsernamePasswordAuthenticationToken(principal, null,
                List.of(new SimpleGrantedAuthority("ROLE_" + role)));
        return authentication(token);
    }

    record Identity(Long userId, boolean emailVerified) implements AuthenticatedPrincipal {
    }
}
