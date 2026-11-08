package com.swp391.bookstreet.activity;

import com.swp391.bookstreet.security.authentication.AuthenticatedPrincipal;
import com.swp391.bookstreet.activity.service.ActivityPartnerMailService;
import com.swp391.bookstreet.activity.service.ActivityPartnerMessageType;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
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
import org.springframework.mail.MailSendException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

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
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.timeout;
import static org.mockito.Mockito.verify;

@SpringBootTest(properties = {
        "spring.datasource.url=${EVENT_TEST_DATABASE_URL}",
        "spring.datasource.hikari.maximum-pool-size=2",
        "spring.datasource.hikari.minimum-idle=0",
        "logging.level.org.springframework.security=ERROR"
})
@EnabledIfEnvironmentVariable(named = "EVENT_TEST_DATABASE_URL", matches = ".+")
@ContextConfiguration(initializers = PartnerActivityProposalIntegrationTests.TestDatabaseGuard.class)
class PartnerActivityProposalIntegrationTests {
    private static final String PROPOSALS = "/api/v1/partner/activity-proposals";

    static class TestDatabaseGuard
            implements ApplicationContextInitializer<ConfigurableApplicationContext> {
        @Override
        public void initialize(ConfigurableApplicationContext context) {
            String url = context.getEnvironment().getRequiredProperty("spring.datasource.url");
            if (!url.matches("jdbc:postgresql://[^/]+/[A-Za-z0-9_]+_event_test(?:\\?.*)?")) {
                throw new IllegalStateException("Partner Proposal tests require *_event_test DB.");
            }
        }
    }

    @Autowired WebApplicationContext context;
    @Autowired JdbcTemplate jdbc;
    @MockitoBean ActivityPartnerMailService partnerMailService;

    private MockMvc mvc;
    private String prefix;
    private long organizerId;
    private long partnerOneUserId;
    private long partnerTwoUserId;
    private long partnerOneOrganizationId;
    private long partnerTwoOrganizationId;

    @BeforeEach
    void setup() {
        assertThat(jdbc.queryForObject("select current_database()", String.class))
                .endsWith("_event_test");
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        prefix = ("PAP" + UUID.randomUUID().toString().replace("-", "").substring(0, 9))
                .toUpperCase();
        organizerId = insertUser("Organizer");
        partnerOneUserId = insertUser("Partner One");
        partnerTwoUserId = insertUser("Partner Two");
        partnerOneOrganizationId = insertOrganization(partnerOneUserId, "One");
        partnerTwoOrganizationId = insertOrganization(partnerTwoUserId, "Two");
    }

    @AfterEach
    void cleanup() {
        jdbc.update("delete from notifications where recipient_user_id in (?, ?, ?)",
                organizerId, partnerOneUserId, partnerTwoUserId);
        jdbc.update("delete from activity_revisions where activity_id in "
                + "(select activity_id from activities where event_id in "
                + "(select event_id from events where organizer_user_id = ?))", organizerId);
        jdbc.update("delete from activity_requests where activity_id in "
                + "(select activity_id from activities where event_id in "
                + "(select event_id from events where organizer_user_id = ?))", organizerId);
        jdbc.update("delete from activities where event_id in "
                + "(select event_id from events where organizer_user_id = ?)", organizerId);
        jdbc.update("delete from activity_proposals where application_id in "
                + "(select application_id from partner_event_applications where event_id in "
                + "(select event_id from events where organizer_user_id = ?))", organizerId);
        jdbc.update("delete from booth_assignments where booth_hold_id in "
                + "(select booth_hold_id from booth_holds where event_booth_config_id in "
                + "(select event_booth_config_id from event_booth_configs where event_id in "
                + "(select event_id from events where organizer_user_id = ?)))", organizerId);
        jdbc.update("delete from booth_payments where booth_hold_id in "
                + "(select booth_hold_id from booth_holds where event_booth_config_id in "
                + "(select event_booth_config_id from event_booth_configs where event_id in "
                + "(select event_id from events where organizer_user_id = ?)))", organizerId);
        jdbc.update("delete from booth_holds where event_booth_config_id in "
                + "(select event_booth_config_id from event_booth_configs where event_id in "
                + "(select event_id from events where organizer_user_id = ?))", organizerId);
        jdbc.update("delete from booth_requests where application_id in "
                + "(select application_id from partner_event_applications where event_id in "
                + "(select event_id from events where organizer_user_id = ?))", organizerId);
        jdbc.update("delete from event_booth_configs where event_id in "
                + "(select event_id from events where organizer_user_id = ?)", organizerId);
        jdbc.update("delete from partner_event_applications where event_id in "
                + "(select event_id from events where organizer_user_id = ?)", organizerId);
        jdbc.update("delete from events where organizer_user_id = ?", organizerId);
        jdbc.update("delete from booths where booth_id in "
                + "(select location_id from locations where code like ?)", prefix + "%");
        jdbc.update("delete from locations where code like ?", prefix + "%");
        jdbc.update("delete from partner_organizations where partner_organization_id in (?, ?)",
                partnerOneOrganizationId, partnerTwoOrganizationId);
        jdbc.update("delete from users where user_id in (?, ?, ?)", organizerId,
                partnerOneUserId, partnerTwoUserId);
    }

    @Test
    void partnerActivityEndpointsEnforceRoleMatrix() throws Exception {
        List<String> paths = List.of(
                "/api/v1/partner/activity-proposals",
                "/api/v1/partner/activities",
                "/api/v1/partner/activity-change-requests",
                "/api/v1/partner/activity-cancellation-requests");

        for (String path : paths) {
            mvc.perform(get(path))
                    .andExpect(status().isUnauthorized())
                    .andExpect(jsonPath("$.code").value("AUTHENTICATION_REQUIRED"));
            mvc.perform(get(path).with(actor(partnerOneUserId, "PARTICIPANT")))
                    .andExpect(status().isForbidden())
                    .andExpect(jsonPath("$.code").value("ACCESS_DENIED"));
            mvc.perform(get(path).with(actor(organizerId, "ORGANIZER")))
                    .andExpect(status().isForbidden())
                    .andExpect(jsonPath("$.code").value("ACCESS_DENIED"));
            mvc.perform(get(path).with(partner(partnerOneUserId)))
                    .andExpect(status().isOk());
        }
    }

    @Test
    void inactiveOrganizationBlocksNewActivityWorkButKeepsWithdrawalsAvailable()
            throws Exception {
        Instant eventStart = future(5);
        long eventId = insertEvent("PUBLISHED", eventStart,
                eventStart.plus(Duration.ofDays(1)), future(2), 5);
        long applicationId = insertApplication(eventId,
                partnerOneOrganizationId, "APPROVED");
        long stageId = insertLocation("INACTIVE-GUARD", "STAGE", 100, true);
        Instant start = eventStart.plus(Duration.ofHours(2));

        long resubmitId = submitProposal(eventId, stageId, "Proposal to revise", start,
                start.plusSeconds(1800), 20);
        jdbc.update("""
                update activity_proposals
                set status = 'NEED_CHANGES', review_note = 'Please revise this proposal.',
                    reviewed_at = current_timestamp
                where activity_proposal_id = ?
                """, resubmitId);
        long withdrawProposalId = submitProposal(eventId, stageId, "Proposal to withdraw",
                start.plus(Duration.ofHours(1)), start.plus(Duration.ofHours(1)).plusSeconds(1800),
                20);

        long changeActivityId = insertOfficialActivity(eventId, stageId, resubmitId,
                "Change target", "DRAFT", start, start.plusSeconds(1800), false);
        long cancellationProposalId = insertApprovedProposal(applicationId, stageId,
                "Cancellation proposal", start.plus(Duration.ofHours(2)),
                start.plus(Duration.ofHours(2)).plusSeconds(1800));
        long cancellationActivityId = insertOfficialActivity(eventId, stageId, cancellationProposalId,
                "Cancellation target", "DRAFT", start.plus(Duration.ofHours(2)),
                start.plus(Duration.ofHours(2)).plusSeconds(1800), false);
        long pendingChangeId = insertPendingChangeRequest(changeActivityId, "Pending title");
        long pendingCancellationId = insertPendingCancellationRequest(cancellationActivityId);

        jdbc.update("update partner_organizations set status = 'INACTIVE' where partner_organization_id = ?",
                partnerOneOrganizationId);

        submitExpecting(eventId, stageId, start.plus(Duration.ofHours(3)), 20,
                "PARTNER_ORGANIZATION_INACTIVE");
        mvc.perform(post(PROPOSALS + "/" + resubmitId + "/resubmit")
                        .with(partner(partnerOneUserId)).with(csrf()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PARTNER_ORGANIZATION_INACTIVE"));
        mvc.perform(post("/api/v1/partner/activities/" + changeActivityId
                        + "/change-requests").with(partner(partnerOneUserId)).with(csrf())
                        .contentType("application/json")
                        .content("{\"reason\":\"Một lý do thay đổi hợp lệ.\",\"requestedTitle\":\"Blocked title\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PARTNER_ORGANIZATION_INACTIVE"));
        mvc.perform(post("/api/v1/partner/activities/" + cancellationActivityId
                        + "/cancellation-requests").with(partner(partnerOneUserId)).with(csrf())
                        .contentType("application/json")
                        .content("{\"reason\":\"Một lý do hủy hợp lệ.\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PARTNER_ORGANIZATION_INACTIVE"));

        mvc.perform(post(PROPOSALS + "/" + withdrawProposalId + "/withdraw")
                        .with(partner(partnerOneUserId)).with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("WITHDRAWN"));
        mvc.perform(post("/api/v1/partner/activity-change-requests/" + pendingChangeId
                        + "/withdraw").with(partner(partnerOneUserId)).with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("WITHDRAWN"));
        mvc.perform(post("/api/v1/partner/activity-cancellation-requests/"
                        + pendingCancellationId + "/withdraw")
                        .with(partner(partnerOneUserId)).with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("WITHDRAWN"));
    }

    @Test
    void approvedPartnerSubmitsSharedLocationProposalAndReadsOnlyOwnedData() throws Exception {
        Instant eventStart = future(5);
        long eventId = insertEvent("PUBLISHED", eventStart,
                eventStart.plus(Duration.ofDays(2)), future(2), 3);
        insertApplication(eventId, partnerOneOrganizationId, "APPROVED");
        insertApplication(eventId, partnerTwoOrganizationId, "APPROVED");
        long stageId = insertLocation("STAGE", "STAGE", 120, true);
        Instant start = eventStart.plus(Duration.ofHours(2));

        String location = mvc.perform(post(PROPOSALS)
                        .with(partner(partnerOneUserId)).with(csrf())
                        .contentType("application/json")
                        .content(proposalJson(eventId, stageId, "  Giao lưu   tác giả  ",
                                start, start.plus(Duration.ofHours(1)), 100)))
                .andExpect(status().isCreated())
                .andExpect(header().string("Location",
                        org.hamcrest.Matchers.startsWith(PROPOSALS + "/")))
                .andExpect(jsonPath("$.eventId").value(eventId))
                .andExpect(jsonPath("$.partnerOrganizationId")
                        .value(partnerOneOrganizationId))
                .andExpect(jsonPath("$.location.locationId").value(stageId))
                .andExpect(jsonPath("$.title").value("Giao lưu tác giả"))
                .andExpect(jsonPath("$.status").value("PENDING"))
                .andExpect(jsonPath("$.activityId").doesNotExist())
                .andReturn().getResponse().getHeader("Location");
        long proposalId = Long.parseLong(location.substring(location.lastIndexOf('/') + 1));

        assertThat(jdbc.queryForObject("select count(*) from activities where event_id = ?",
                Long.class, eventId)).isZero();
        assertThat(jdbc.queryForObject("select submitted_at = updated_at "
                + "from activity_proposals where activity_proposal_id = ?",
                Boolean.class, proposalId)).isTrue();

        mvc.perform(get(PROPOSALS + "?eventId=" + eventId
                        + "&status=PENDING&search=giao&sort=title,asc")
                        .with(partner(partnerOneUserId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].activityProposalId").value(proposalId));
        mvc.perform(get(PROPOSALS + "/" + proposalId)
                        .with(partner(partnerOneUserId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.eventName").value(prefix + " Event"));
        mvc.perform(get(PROPOSALS + "/" + proposalId)
                        .with(partner(partnerTwoUserId)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("ACTIVITY_PROPOSAL_NOT_FOUND"));
    }

    @Test
    void submissionEnforcesApplicationEventDeadlineQuotaAndFieldValidation() throws Exception {
        Instant eventStart = future(5);
        long locationId = insertLocation("GUARD", "AREA", 40, true);
        Instant activityStart = eventStart.plus(Duration.ofHours(1));

        long pendingEvent = insertEvent("PUBLISHED", eventStart,
                eventStart.plus(Duration.ofDays(1)), future(2), 2);
        insertApplication(pendingEvent, partnerOneOrganizationId, "PENDING");
        submitExpecting(pendingEvent, locationId, activityStart, 20,
                "PARTNER_APPLICATION_NOT_APPROVED");

        long draftEvent = insertEvent("DRAFT", eventStart,
                eventStart.plus(Duration.ofDays(1)), future(2), 2);
        insertApplication(draftEvent, partnerOneOrganizationId, "APPROVED");
        submitExpecting(draftEvent, locationId, activityStart, 20,
                "EVENT_NOT_ACCEPTING_ACTIVITY_PROPOSALS");

        long expiredEvent = insertEvent("PUBLISHED", eventStart,
                eventStart.plus(Duration.ofDays(1)), Instant.now().minusSeconds(1), 2);
        insertApplication(expiredEvent, partnerOneOrganizationId, "APPROVED");
        submitExpecting(expiredEvent, locationId, activityStart, 20,
                "ACTIVITY_PROPOSAL_DEADLINE_PASSED");

        long quotaEvent = insertEvent("PUBLISHED", eventStart,
                eventStart.plus(Duration.ofDays(1)), future(2), 0);
        insertApplication(quotaEvent, partnerOneOrganizationId, "APPROVED");
        submitExpecting(quotaEvent, locationId, activityStart, 20,
                "ACTIVITY_QUOTA_REACHED");

        long validEvent = insertEvent("PUBLISHED", eventStart,
                eventStart.plus(Duration.ofDays(1)), future(2), 2);
        insertApplication(validEvent, partnerOneOrganizationId, "APPROVED");
        mvc.perform(post(PROPOSALS).with(partner(partnerOneUserId)).with(csrf())
                        .contentType("application/json")
                        .content(proposalJson(validEvent, locationId, "Invalid capacity",
                                activityStart, activityStart.plusSeconds(3600), 41)))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.code").value("ACTIVITY_CAPACITY_INVALID"));
        mvc.perform(post(PROPOSALS).with(partner(partnerOneUserId)).with(csrf())
                        .contentType("application/json")
                        .content(proposalJson(validEvent, locationId, "Unknown field",
                                activityStart, activityStart.plusSeconds(3600), 20)
                                .replace("\n}", ",\n  \"unexpected\": true\n}")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("UNKNOWN_FIELD"));
    }

    @Test
    void boothProposalRequiresActiveAssignmentOwnedInTheSameEvent() throws Exception {
        Instant eventStart = future(5);
        long eventId = insertEvent("PUBLISHED", eventStart,
                eventStart.plus(Duration.ofDays(1)), future(2), 3);
        long partnerOneApplication = insertApplication(eventId,
                partnerOneOrganizationId, "APPROVED");
        long partnerTwoApplication = insertApplication(eventId,
                partnerTwoOrganizationId, "APPROVED");
        long unassignedBooth = insertBooth("FREE");
        long foreignBooth = insertBooth("FOREIGN");
        long ownedBooth = insertBooth("OWNED");
        insertAssignment(eventId, foreignBooth, partnerTwoApplication);
        insertAssignment(eventId, ownedBooth, partnerOneApplication);
        Instant activityStart = eventStart.plus(Duration.ofHours(1));

        submitExpecting(eventId, unassignedBooth, activityStart, 4,
                "BOOTH_ASSIGNMENT_REQUIRED");
        submitExpecting(eventId, foreignBooth, activityStart, 4,
                "BOOTH_NOT_ASSIGNED_TO_PARTNER");
        mvc.perform(post(PROPOSALS).with(partner(partnerOneUserId)).with(csrf())
                        .contentType("application/json")
                        .content(proposalJson(eventId, ownedBooth, "Owned booth activity",
                                activityStart, activityStart.plusSeconds(1800), 4)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.location.locationType").value("BOOTH"))
                .andExpect(jsonPath("$.status").value("PENDING"));
    }

    @Test
    void pendingEditUsesMergedValidationAndStopsAfterGeneralDeadline() throws Exception {
        Instant eventStart = future(5);
        long eventId = insertEvent("PUBLISHED", eventStart,
                eventStart.plus(Duration.ofDays(1)), future(2), 3);
        insertApplication(eventId, partnerOneOrganizationId, "APPROVED");
        long stageId = insertLocation("EDIT-A", "STAGE", 100, true);
        long areaId = insertLocation("EDIT-B", "AREA", 60, true);
        Instant firstStart = eventStart.plus(Duration.ofHours(1));
        long proposalId = submitProposal(eventId, stageId, "Original title",
                firstStart, firstStart.plusSeconds(1800), 30);
        Instant revisedStart = firstStart.plus(Duration.ofHours(1));

        mvc.perform(patch(PROPOSALS + "/" + proposalId)
                        .with(partner(partnerOneUserId)).with(csrf())
                        .contentType("application/json")
                        .content("""
                                {
                                  "locationId": %d,
                                  "title": "  Revised   title  ",
                                  "description": null,
                                  "proposedStartAt": "%s",
                                  "proposedEndAt": "%s",
                                  "capacity": 50
                                }
                                """.formatted(areaId, revisedStart,
                                revisedStart.plusSeconds(1800))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.location.locationId").value(areaId))
                .andExpect(jsonPath("$.title").value("Revised title"))
                .andExpect(jsonPath("$.description").doesNotExist())
                .andExpect(jsonPath("$.capacity").value(50))
                .andExpect(jsonPath("$.status").value("PENDING"));

        jdbc.update("update events set activity_proposal_deadline_at = ? where event_id = ?",
                Timestamp.from(Instant.now().minusSeconds(1)), eventId);
        mvc.perform(patch(PROPOSALS + "/" + proposalId)
                        .with(partner(partnerOneUserId)).with(csrf())
                        .contentType("application/json")
                        .content("{\"title\":\"Too late\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code")
                        .value("ACTIVITY_PROPOSAL_DEADLINE_PASSED"));
        assertThat(jdbc.queryForObject("select title from activity_proposals "
                + "where activity_proposal_id = ?", String.class, proposalId))
                .isEqualTo("Revised title");
    }

    @Test
    void needChangesCanBeRevisedAndResubmittedAfterGeneralDeadline() throws Exception {
        Instant eventStart = future(5);
        long eventId = insertEvent("PUBLISHED", eventStart,
                eventStart.plus(Duration.ofDays(1)), future(2), 3);
        insertApplication(eventId, partnerOneOrganizationId, "APPROVED");
        long stageId = insertLocation("RESUBMIT", "WORKSHOP", 80, true);
        Instant start = eventStart.plus(Duration.ofHours(1));
        long proposalId = submitProposal(eventId, stageId, "Needs revision", start,
                start.plusSeconds(1800), 40);
        jdbc.update("""
                update activity_proposals
                set status = 'NEED_CHANGES',
                    review_note = 'Please clarify the session content.',
                    reviewed_at = current_timestamp,
                    updated_at = current_timestamp
                where activity_proposal_id = ?
                """, proposalId);
        jdbc.update("update events set activity_proposal_deadline_at = ? where event_id = ?",
                Timestamp.from(Instant.now().minusSeconds(1)), eventId);

        mvc.perform(patch(PROPOSALS + "/" + proposalId)
                        .with(partner(partnerOneUserId)).with(csrf())
                        .contentType("application/json")
                        .content("{\"title\":\"  Clarified   session  \"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Clarified session"))
                .andExpect(jsonPath("$.status").value("NEED_CHANGES"));
        mvc.perform(post(PROPOSALS + "/" + proposalId + "/resubmit")
                        .with(partner(partnerOneUserId)).with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PENDING"))
                .andExpect(jsonPath("$.reviewNote")
                        .value("Please clarify the session content."));
        mvc.perform(post(PROPOSALS + "/" + proposalId + "/resubmit")
                        .with(partner(partnerOneUserId)).with(csrf()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PROPOSAL_NOT_EDITABLE"));
    }

    @Test
    void resubmissionGivesTheOrganizerASecondWorkItemButEditingDoesNot() throws Exception {
        Instant eventStart = future(5);
        long eventId = insertEvent("PUBLISHED", eventStart,
                eventStart.plus(Duration.ofDays(1)), future(2), 3);
        insertApplication(eventId, partnerOneOrganizationId, "APPROVED");
        long stageId = insertLocation("WORKITEM", "WORKSHOP", 80, true);
        Instant start = eventStart.plus(Duration.ofHours(1));

        long proposalId = submitProposal(eventId, stageId, "First version", start,
                start.plusSeconds(1800), 40);
        assertThat(organizerProposalTitles(proposalId))
                .containsExactly("Có đề xuất hoạt động mới");

        mvc.perform(post("/api/v1/organizer/activity-proposals/" + proposalId + "/request-changes")
                        .with(organizer()).with(csrf())
                        .contentType("application/json")
                        .content("{\"reviewNote\":\"Please clarify the session format.\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("NEED_CHANGES"));
        mvc.perform(patch(PROPOSALS + "/" + proposalId)
                        .with(partner(partnerOneUserId)).with(csrf())
                        .contentType("application/json")
                        .content("{\"title\":\"Second version\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("NEED_CHANGES"));
        assertThat(organizerProposalTitles(proposalId)).hasSize(1);

        mvc.perform(post(PROPOSALS + "/" + proposalId + "/resubmit")
                        .with(partner(partnerOneUserId)).with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PENDING"));
        assertThat(organizerProposalTitles(proposalId)).containsExactly(
                "Có đề xuất hoạt động mới", "Đề xuất hoạt động đã được gửi lại");

        mvc.perform(post(PROPOSALS + "/" + proposalId + "/resubmit")
                        .with(partner(partnerOneUserId)).with(csrf()))
                .andExpect(status().isConflict());
        assertThat(organizerProposalTitles(proposalId)).hasSize(2);
    }

    private List<String> organizerProposalTitles(long proposalId) {
        return jdbc.queryForList("""
                select title from notifications
                where activity_proposal_id = ? and recipient_user_id = ?
                  and recipient_role = 'ORGANIZER'
                  and notification_type = 'ORGANIZER_ACTIVITY_PROPOSAL_SUBMITTED'
                order by notification_id
                """, String.class, proposalId, organizerId);
    }

    @Test
    void withdrawalIsIdempotentAndForeignMutationIsConcealed() throws Exception {
        Instant eventStart = future(5);
        long eventId = insertEvent("PUBLISHED", eventStart,
                eventStart.plus(Duration.ofDays(1)), future(2), 3);
        insertApplication(eventId, partnerOneOrganizationId, "APPROVED");
        insertApplication(eventId, partnerTwoOrganizationId, "APPROVED");
        long stageId = insertLocation("WITHDRAW", "STAGE", 100, true);
        Instant start = eventStart.plus(Duration.ofHours(1));
        long proposalId = submitProposal(eventId, stageId, "Withdraw proposal", start,
                start.plusSeconds(1800), 30);

        mvc.perform(post(PROPOSALS + "/" + proposalId + "/withdraw")
                        .with(partner(partnerOneUserId)).with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("WITHDRAWN"));
        Instant firstWithdrawnAt = jdbc.queryForObject("select withdrawn_at "
                + "from activity_proposals where activity_proposal_id = ?",
                Instant.class, proposalId);
        mvc.perform(post(PROPOSALS + "/" + proposalId + "/withdraw")
                        .with(partner(partnerOneUserId)).with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("WITHDRAWN"));
        assertThat(jdbc.queryForObject("select withdrawn_at from activity_proposals "
                + "where activity_proposal_id = ?", Instant.class, proposalId))
                .isEqualTo(firstWithdrawnAt);

        mvc.perform(patch(PROPOSALS + "/" + proposalId)
                        .with(partner(partnerOneUserId)).with(csrf())
                        .contentType("application/json")
                        .content("{\"title\":\"Cannot edit\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PROPOSAL_NOT_EDITABLE"));
        mvc.perform(post(PROPOSALS + "/" + proposalId + "/withdraw")
                        .with(partner(partnerTwoUserId)).with(csrf()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("ACTIVITY_PROPOSAL_NOT_FOUND"));
    }

    @Test
    void requestTimeLifecycleClosesStaleOpenProposalOnce() throws Exception {
        doThrow(new MailSendException("Simulated delivery failure"))
                .when(partnerMailService).sendMessage(anyString(), any());
        Instant now = Instant.now().truncatedTo(ChronoUnit.MICROS);
        long eventId = insertEvent("ONGOING", now.minus(Duration.ofHours(1)),
                now.plus(Duration.ofHours(1)), now.minus(Duration.ofHours(2)), 3);
        long applicationId = insertApplication(eventId,
                partnerOneOrganizationId, "APPROVED");
        long areaId = insertLocation("STALE", "AREA", 60, true);
        long proposalId = jdbc.queryForObject("""
                insert into activity_proposals(
                    application_id, location_id, title, activity_type,
                    proposed_start_at, proposed_end_at, capacity, status,
                    submitted_at, updated_at)
                values (?, ?, 'Stale proposal', 'TALKSHOW', ?, ?, 20, 'PENDING',
                    current_timestamp, current_timestamp)
                returning activity_proposal_id
                """, Long.class, applicationId, areaId,
                Timestamp.from(now.minusSeconds(1)), Timestamp.from(now.plusSeconds(1800)));

        mvc.perform(get(PROPOSALS + "/" + proposalId)
                        .with(partner(partnerOneUserId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CANCELLED"));
        Instant firstCancelledAt = jdbc.queryForObject("select cancelled_at "
                + "from activity_proposals where activity_proposal_id = ?",
                Instant.class, proposalId);
        mvc.perform(get(PROPOSALS + "/" + proposalId)
                        .with(partner(partnerOneUserId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CANCELLED"));
        assertThat(jdbc.queryForObject("select cancelled_at from activity_proposals "
                + "where activity_proposal_id = ?", Instant.class, proposalId))
                .isEqualTo(firstCancelledAt);
        verify(partnerMailService, timeout(5000).times(1)).sendMessage(anyString(), argThat(event ->
                event.referenceId().equals(proposalId)));
    }

    @Test
    void organizerCancellationOfPartnerActivityCommitsAndNotifiesExactlyOnce()
            throws Exception {
        doThrow(new MailSendException("Simulated delivery failure"))
                .when(partnerMailService).sendMessage(anyString(), any());
        Instant eventStart = future(5);
        long eventId = insertEvent("PUBLISHED", eventStart,
                eventStart.plus(Duration.ofDays(1)), future(2), 3);
        long applicationId = insertApplication(eventId,
                partnerOneOrganizationId, "APPROVED");
        long locationId = insertLocation("CANCELLED-BY-ORG", "STAGE", 80, true);
        Instant activityStart = eventStart.plus(Duration.ofHours(1));
        long proposalId = insertApprovedProposal(applicationId, locationId,
                "Partner activity to cancel", activityStart,
                activityStart.plusSeconds(1800));
        long activityId = insertOfficialActivity(eventId, locationId, proposalId,
                "Partner activity to cancel", "PUBLISHED", activityStart,
                activityStart.plusSeconds(1800), false);
        String reason = "Ban tổ chức buộc phải hủy hoạt động vì thay đổi vận hành.";

        mvc.perform(post("/api/v1/organizer/activities/" + activityId + "/cancel")
                        .with(organizer()).with(csrf())
                        .contentType("application/json")
                        .content("{\"reason\":\"" + reason + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CANCELLED"))
                .andExpect(jsonPath("$.cancellationSource").value("ORGANIZER"));
        Instant firstCancelledAt = jdbc.queryForObject("select cancelled_at "
                + "from activities where activity_id = ?", Instant.class, activityId);

        mvc.perform(post("/api/v1/organizer/activities/" + activityId + "/cancel")
                        .with(organizer()).with(csrf())
                        .contentType("application/json")
                        .content("{\"reason\":\"Lý do gọi lại không được ghi đè.\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CANCELLED"));

        assertThat(jdbc.queryForObject("select cancelled_at from activities "
                + "where activity_id = ?", Instant.class, activityId))
                .isEqualTo(firstCancelledAt);
        assertThat(jdbc.queryForObject("select cancellation_reason from activities "
                + "where activity_id = ?", String.class, activityId)).isEqualTo(reason);
        verify(partnerMailService, timeout(5000).times(1)).sendMessage(anyString(), argThat(event ->
                event.referenceId().equals(activityId)
                        && event.messageType()
                        == ActivityPartnerMessageType.ACTIVITY_CANCELLED_BY_ORGANIZER));
    }

    @Test
    void partnerListsOnlyOfficialActivitiesFromOwnedProposalsAndNeverReceivesQrToken()
            throws Exception {
        Instant eventStart = future(5);
        long eventId = insertEvent("PUBLISHED", eventStart,
                eventStart.plus(Duration.ofDays(1)), future(2), 5);
        long partnerOneApplication = insertApplication(eventId,
                partnerOneOrganizationId, "APPROVED");
        long partnerTwoApplication = insertApplication(eventId,
                partnerTwoOrganizationId, "APPROVED");
        long stageId = insertLocation("OFFICIAL", "STAGE", 120, true);
        Instant firstStart = eventStart.plus(Duration.ofHours(1));
        long firstProposal = insertApprovedProposal(partnerOneApplication, stageId,
                "Owned draft", firstStart, firstStart.plusSeconds(1800));
        long draftId = insertOfficialActivity(eventId, stageId, firstProposal,
                "Owned draft", "DRAFT", firstStart, firstStart.plusSeconds(1800), false);
        Instant publishedStart = firstStart.plus(Duration.ofHours(1));
        long secondProposal = insertApprovedProposal(partnerOneApplication, stageId,
                "Owned published", publishedStart, publishedStart.plusSeconds(1800));
        long publishedId = insertOfficialActivity(eventId, stageId, secondProposal,
                "Owned published", "PUBLISHED", publishedStart,
                publishedStart.plusSeconds(1800), true);
        long foreignProposal = insertApprovedProposal(partnerTwoApplication, stageId,
                "Foreign activity", publishedStart.plus(Duration.ofHours(1)),
                publishedStart.plus(Duration.ofHours(1)).plusSeconds(1800));
        long foreignId = insertOfficialActivity(eventId, stageId, foreignProposal,
                "Foreign activity", "DRAFT", publishedStart.plus(Duration.ofHours(1)),
                publishedStart.plus(Duration.ofHours(1)).plusSeconds(1800), false);
        long directId = insertOfficialActivity(eventId, stageId, null,
                "Organizer direct", "DRAFT", publishedStart.plus(Duration.ofHours(2)),
                publishedStart.plus(Duration.ofHours(2)).plusSeconds(1800), false);

        mvc.perform(get("/api/v1/partner/activities?eventId=" + eventId
                        + "&sort=startAt,asc").with(partner(partnerOneUserId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.content[0].activityId").value(draftId))
                .andExpect(jsonPath("$.content[1].activityId").value(publishedId));
        mvc.perform(get("/api/v1/partner/activities?status=PUBLISHED&search=published")
                        .with(partner(partnerOneUserId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].activityId").value(publishedId));
        mvc.perform(get("/api/v1/partner/activities/" + publishedId)
                        .with(partner(partnerOneUserId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.attendanceQrAvailable").value(true))
                .andExpect(jsonPath("$.attendanceQrToken")
                        .value(org.hamcrest.Matchers.nullValue()));
        mvc.perform(get("/api/v1/partner/activities/" + foreignId)
                        .with(partner(partnerOneUserId)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("ACTIVITY_NOT_FOUND"));
        mvc.perform(get("/api/v1/partner/activities/" + directId)
                        .with(partner(partnerOneUserId)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("ACTIVITY_NOT_FOUND"));
        mvc.perform(get("/api/v1/partner/activities?status=PRIVATE")
                        .with(partner(partnerOneUserId)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_FILTER"));
    }

    @Test
    void partnerRevisionHistoryHidesActorAndDetailCatchesUpLifecycle() throws Exception {
        Instant now = Instant.now().truncatedTo(ChronoUnit.MICROS);
        long eventId = insertEvent("ONGOING", now.minus(Duration.ofHours(2)),
                now.plus(Duration.ofHours(2)), now.minus(Duration.ofHours(3)), 5);
        long applicationId = insertApplication(eventId,
                partnerOneOrganizationId, "APPROVED");
        long otherApplicationId = insertApplication(eventId,
                partnerTwoOrganizationId, "APPROVED");
        long areaId = insertLocation("HISTORY", "AREA", 80, true);
        Instant start = now.minus(Duration.ofMinutes(10));
        Instant end = now.plus(Duration.ofMinutes(30));
        long proposalId = insertApprovedProposal(applicationId, areaId,
                "Lifecycle activity", start, end);
        long activityId = insertOfficialActivity(eventId, areaId, proposalId,
                "Lifecycle activity", "PUBLISHED", start, end, false);
        insertRevision(activityId);
        long otherProposal = insertApprovedProposal(otherApplicationId, areaId,
                "Other revision", now.plus(Duration.ofMinutes(40)),
                now.plus(Duration.ofMinutes(70)));
        long otherActivity = insertOfficialActivity(eventId, areaId, otherProposal,
                "Other revision", "DRAFT", now.plus(Duration.ofMinutes(40)),
                now.plus(Duration.ofMinutes(70)), false);

        mvc.perform(get("/api/v1/partner/activities/" + activityId)
                        .with(partner(partnerOneUserId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ONGOING"));
        mvc.perform(get("/api/v1/partner/activities/" + activityId + "/revisions")
                        .with(partner(partnerOneUserId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].revisionSource")
                        .value("ORGANIZER_DIRECT"))
                .andExpect(jsonPath("$.content[0].actorUserId").doesNotExist());
        mvc.perform(get("/api/v1/partner/activities/" + otherActivity + "/revisions")
                        .with(partner(partnerOneUserId)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("ACTIVITY_NOT_FOUND"));
    }

    @Test
    void partnerSubmitsListsAndReadsNormalizedChangeRequestWithoutMutatingActivity()
            throws Exception {
        Instant eventStart = future(5);
        long eventId = insertEvent("PUBLISHED", eventStart,
                eventStart.plus(Duration.ofDays(1)), future(2), 5);
        long applicationId = insertApplication(eventId,
                partnerOneOrganizationId, "APPROVED");
        long otherApplicationId = insertApplication(eventId,
                partnerTwoOrganizationId, "APPROVED");
        long stageId = insertLocation("CHANGE-STAGE", "STAGE", 100, true);
        long areaId = insertLocation("CHANGE-AREA", "AREA", 60, true);
        Instant start = eventStart.plus(Duration.ofHours(2));
        long proposalId = insertApprovedProposal(applicationId, stageId,
                "Original activity", start, start.plusSeconds(1800));
        long activityId = insertOfficialActivity(eventId, stageId, proposalId,
                "Original activity", "DRAFT", start, start.plusSeconds(1800), false);
        long foreignProposal = insertApprovedProposal(otherApplicationId, stageId,
                "Foreign activity", start.plus(Duration.ofHours(2)),
                start.plus(Duration.ofHours(2)).plusSeconds(1800));
        long foreignActivityId = insertOfficialActivity(eventId, stageId, foreignProposal,
                "Foreign activity", "DRAFT", start.plus(Duration.ofHours(2)),
                start.plus(Duration.ofHours(2)).plusSeconds(1800), false);

        Instant requestedStart = start.plus(Duration.ofHours(1));
        String location = mvc.perform(post("/api/v1/partner/activities/" + activityId
                        + "/change-requests")
                        .with(partner(partnerOneUserId)).with(csrf())
                        .contentType("application/json")
                        .content(changeJson(areaId, requestedStart,
                                requestedStart.plusSeconds(2400))))
                .andExpect(status().isCreated())
                .andExpect(header().string("Location",
                        org.hamcrest.Matchers.containsString("activity-change-requests/")))
                .andExpect(jsonPath("$.status").value("PENDING"))
                .andExpect(jsonPath("$.requestedTitle").value("Renamed activity"))
                .andExpect(jsonPath("$.requestedDescriptionIncluded").value(true))
                .andExpect(jsonPath("$.requestedDescription")
                        .value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.requestedImageUrlIncluded").value(true))
                .andExpect(jsonPath("$.requestedImageUrl")
                        .value("https://example.test/activity.jpg"))
                .andReturn().getResponse().getHeader("Location");
        long requestId = Long.parseLong(location.substring(location.lastIndexOf('/') + 1));

        mvc.perform(get("/api/v1/partner/activity-change-requests?eventId=" + eventId
                        + "&status=PENDING&search=Renamed")
                        .with(partner(partnerOneUserId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].activityChangeRequestId")
                        .value(requestId));
        mvc.perform(get("/api/v1/partner/activity-change-requests/" + requestId)
                        .with(partner(partnerOneUserId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.requestedLocationId").value(areaId));
        mvc.perform(get("/api/v1/partner/activity-change-requests/" + requestId)
                        .with(partner(partnerTwoUserId)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("ACTIVITY_CHANGE_REQUEST_NOT_FOUND"));
        mvc.perform(post("/api/v1/partner/activities/" + foreignActivityId
                        + "/change-requests")
                        .with(partner(partnerOneUserId)).with(csrf())
                        .contentType("application/json")
                        .content("""
                                {"reason":"Một lý do thay đổi hợp lệ.",
                                 "requestedTitle":"Cannot change"}
                                """))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("ACTIVITY_NOT_FOUND"));

        assertThat(jdbc.queryForObject("select title from activities where activity_id = ?",
                String.class, activityId)).isEqualTo("Original activity");
        assertThat(jdbc.queryForObject("select location_id from activities where activity_id = ?",
                Long.class, activityId)).isEqualTo(stageId);
    }

    @Test
    void changeRequestRejectsNoEffectInvalidPairConflictBoothAndSecondPending()
            throws Exception {
        Instant eventStart = future(5);
        long eventId = insertEvent("PUBLISHED", eventStart,
                eventStart.plus(Duration.ofDays(1)), future(2), 5);
        long applicationId = insertApplication(eventId,
                partnerOneOrganizationId, "APPROVED");
        long otherApplicationId = insertApplication(eventId,
                partnerTwoOrganizationId, "APPROVED");
        long stageId = insertLocation("GUARD-STAGE", "STAGE", 100, true);
        long areaId = insertLocation("GUARD-AREA", "AREA", 100, true);
        long foreignBoothId = insertBooth("GUARD-BOOTH");
        insertAssignment(eventId, foreignBoothId, otherApplicationId);
        Instant start = eventStart.plus(Duration.ofHours(2));
        long proposalId = insertApprovedProposal(applicationId, stageId,
                "Guard activity", start, start.plusSeconds(1800));
        long activityId = insertOfficialActivity(eventId, stageId, proposalId,
                "Guard activity", "DRAFT", start, start.plusSeconds(1800), false);
        Instant conflictStart = start.plus(Duration.ofHours(1));
        long blockerProposal = insertApprovedProposal(otherApplicationId, areaId,
                "Blocking activity", conflictStart, conflictStart.plusSeconds(1800));
        insertOfficialActivity(eventId, areaId, blockerProposal, "Blocking activity",
                "DRAFT", conflictStart, conflictStart.plusSeconds(1800), false);

        mvc.perform(post("/api/v1/partner/activities/" + activityId + "/change-requests")
                        .with(partner(partnerOneUserId)).with(csrf())
                        .contentType("application/json")
                        .content("""
                                {"reason":"Một lý do thay đổi hợp lệ.",
                                 "requestedTitle":"  Guard   activity  "}
                                """))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.code").value("ACTIVITY_CHANGE_HAS_NO_EFFECT"));
        mvc.perform(post("/api/v1/partner/activities/" + activityId + "/change-requests")
                        .with(partner(partnerOneUserId)).with(csrf())
                        .contentType("application/json")
                        .content("""
                                {"reason":"Một lý do thay đổi hợp lệ.",
                                 "requestedStartAt":"%s"}
                                """.formatted(conflictStart)))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
        mvc.perform(post("/api/v1/partner/activities/" + activityId + "/change-requests")
                        .with(partner(partnerOneUserId)).with(csrf())
                        .contentType("application/json")
                        .content("""
                                {"reason":"Một lý do thay đổi hợp lệ.",
                                 "requestedLocationId":%d,
                                 "requestedStartAt":"%s",
                                 "requestedEndAt":"%s"}
                                """.formatted(areaId, conflictStart,
                                conflictStart.plusSeconds(1800))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("ACTIVITY_LOCATION_TIME_CONFLICT"));
        mvc.perform(post("/api/v1/partner/activities/" + activityId + "/change-requests")
                        .with(partner(partnerOneUserId)).with(csrf())
                        .contentType("application/json")
                        .content("""
                                {"reason":"Một lý do thay đổi hợp lệ.",
                                 "requestedLocationId":%d,
                                 "requestedCapacity":4}
                                """.formatted(foreignBoothId)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("BOOTH_NOT_ASSIGNED_TO_PARTNER"));

        mvc.perform(post("/api/v1/partner/activities/" + activityId + "/change-requests")
                        .with(partner(partnerOneUserId)).with(csrf())
                        .contentType("application/json")
                        .content("""
                                {"reason":"Một lý do thay đổi hợp lệ.",
                                 "requestedTitle":"A real new title"}
                                """))
                .andExpect(status().isCreated());
        mvc.perform(post("/api/v1/partner/activities/" + activityId + "/change-requests")
                        .with(partner(partnerOneUserId)).with(csrf())
                        .contentType("application/json")
                        .content("""
                                {"reason":"Một lý do thay đổi khác.",
                                 "requestedTitle":"Another title"}
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("ACTIVITY_REQUEST_ALREADY_PENDING"));
    }

    @Test
    void changeRequestWithdrawalIsIdempotentAndDoesNotChangeActivity() throws Exception {
        Instant eventStart = future(5);
        long eventId = insertEvent("PUBLISHED", eventStart,
                eventStart.plus(Duration.ofDays(1)), future(2), 5);
        long applicationId = insertApplication(eventId,
                partnerOneOrganizationId, "APPROVED");
        long stageId = insertLocation("WITHDRAW-CHANGE", "STAGE", 100, true);
        Instant start = eventStart.plus(Duration.ofHours(2));
        long proposalId = insertApprovedProposal(applicationId, stageId,
                "Withdraw change", start, start.plusSeconds(1800));
        long activityId = insertOfficialActivity(eventId, stageId, proposalId,
                "Withdraw change", "DRAFT", start, start.plusSeconds(1800), false);

        String location = mvc.perform(post("/api/v1/partner/activities/" + activityId
                        + "/change-requests")
                        .with(partner(partnerOneUserId)).with(csrf())
                        .contentType("application/json")
                        .content("""
                                {"reason":"Một lý do thay đổi hợp lệ.",
                                 "requestedTitle":"Requested title"}
                                """))
                .andExpect(status().isCreated()).andReturn().getResponse()
                .getHeader("Location");
        long requestId = Long.parseLong(location.substring(location.lastIndexOf('/') + 1));

        mvc.perform(post("/api/v1/partner/activity-change-requests/" + requestId
                        + "/withdraw").with(partner(partnerOneUserId)).with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("WITHDRAWN"));
        Instant firstWithdrawnAt = jdbc.queryForObject(
                "select withdrawn_at from activity_requests where activity_request_id = ?",
                Instant.class, requestId);
        mvc.perform(post("/api/v1/partner/activity-change-requests/" + requestId
                        + "/withdraw").with(partner(partnerOneUserId)).with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("WITHDRAWN"));
        assertThat(jdbc.queryForObject(
                "select withdrawn_at from activity_requests where activity_request_id = ?",
                Instant.class, requestId)).isEqualTo(firstWithdrawnAt);
        assertThat(jdbc.queryForObject("select title from activities where activity_id = ?",
                String.class, activityId)).isEqualTo("Withdraw change");
    }

    @Test
    void activityStartAutomaticallyCancelsPendingChangeRequest() throws Exception {
        Instant now = Instant.now().truncatedTo(ChronoUnit.MICROS);
        long eventId = insertEvent("ONGOING", now.minus(Duration.ofHours(2)),
                now.plus(Duration.ofHours(2)), now.minus(Duration.ofHours(3)), 5);
        long applicationId = insertApplication(eventId,
                partnerOneOrganizationId, "APPROVED");
        long areaId = insertLocation("CHANGE-LIFECYCLE", "AREA", 100, true);
        Instant start = now.minus(Duration.ofMinutes(5));
        long proposalId = insertApprovedProposal(applicationId, areaId,
                "Starting activity", start, now.plus(Duration.ofMinutes(30)));
        long activityId = insertOfficialActivity(eventId, areaId, proposalId,
                "Starting activity", "PUBLISHED", start,
                now.plus(Duration.ofMinutes(30)), false);
        long requestId = insertPendingChangeRequest(activityId, "Later title");

        mvc.perform(get("/api/v1/partner/activity-change-requests/" + requestId)
                        .with(partner(partnerOneUserId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CANCELLED"))
                .andExpect(jsonPath("$.cancelledAt").isNotEmpty());
        assertThat(jdbc.queryForObject("select status from activities where activity_id = ?",
                String.class, activityId)).isEqualTo("ONGOING");
    }

    @Test
    void partnerSubmitsListsAndReadsCancellationWithoutCancellingActivity()
            throws Exception {
        Instant eventStart = future(5);
        long eventId = insertEvent("PUBLISHED", eventStart,
                eventStart.plus(Duration.ofDays(1)), future(2), 5);
        setActivityCancellationCutoff(eventId, future(3));
        long applicationId = insertApplication(eventId,
                partnerOneOrganizationId, "APPROVED");
        long stageId = insertLocation("CANCEL-STAGE", "STAGE", 100, true);
        Instant start = eventStart.plus(Duration.ofHours(2));
        long proposalId = insertApprovedProposal(applicationId, stageId,
                "Published activity", start, start.plusSeconds(1800));
        long activityId = insertOfficialActivity(eventId, stageId, proposalId,
                "Published activity", "PUBLISHED", start, start.plusSeconds(1800), false);
        long directId = insertOfficialActivity(eventId, stageId, null,
                "Organizer activity", "DRAFT", start.plus(Duration.ofHours(1)),
                start.plus(Duration.ofHours(1)).plusSeconds(1800), false);

        mvc.perform(post("/api/v1/partner/activities/" + activityId
                        + "/cancellation-requests")
                        .with(partner(partnerOneUserId)).with(csrf())
                        .contentType("application/json")
                        .content("{\"reason\":\"ngắn\"}"))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));

        String location = mvc.perform(post("/api/v1/partner/activities/" + activityId
                        + "/cancellation-requests")
                        .with(partner(partnerOneUserId)).with(csrf())
                        .contentType("application/json")
                        .content("""
                                {"reason":"  Diễn giả không thể tham dự chương trình.  "}
                                """))
                .andExpect(status().isCreated())
                .andExpect(header().string("Location", org.hamcrest.Matchers.containsString(
                        "activity-cancellation-requests/")))
                .andExpect(jsonPath("$.status").value("PENDING"))
                .andExpect(jsonPath("$.reason")
                        .value("Diễn giả không thể tham dự chương trình."))
                .andExpect(jsonPath("$.late").value(false))
                .andReturn().getResponse().getHeader("Location");
        long requestId = Long.parseLong(location.substring(location.lastIndexOf('/') + 1));

        mvc.perform(get("/api/v1/partner/activity-cancellation-requests?eventId="
                        + eventId + "&status=PENDING&late=false&search=tham")
                        .with(partner(partnerOneUserId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].activityCancellationRequestId")
                        .value(requestId));
        mvc.perform(get("/api/v1/partner/activity-cancellation-requests/" + requestId)
                        .with(partner(partnerTwoUserId)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code")
                        .value("ACTIVITY_CANCELLATION_REQUEST_NOT_FOUND"));
        mvc.perform(post("/api/v1/partner/activities/" + directId
                        + "/cancellation-requests")
                        .with(partner(partnerOneUserId)).with(csrf())
                        .contentType("application/json")
                        .content("{\"reason\":\"Một lý do hủy hợp lệ.\"}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("ACTIVITY_NOT_FOUND"));
        assertThat(jdbc.queryForObject("select status from activities where activity_id = ?",
                String.class, activityId)).isEqualTo("PUBLISHED");
    }

    @Test
    void cancellationSharesPendingGuardAndWithdrawalIsIdempotent() throws Exception {
        Instant eventStart = future(5);
        long eventId = insertEvent("PUBLISHED", eventStart,
                eventStart.plus(Duration.ofDays(1)), future(2), 5);
        setActivityCancellationCutoff(eventId, Instant.now().minus(Duration.ofHours(1)));
        long applicationId = insertApplication(eventId,
                partnerOneOrganizationId, "APPROVED");
        long areaId = insertLocation("CANCEL-GUARD", "AREA", 100, true);
        Instant start = eventStart.plus(Duration.ofHours(2));
        long proposalId = insertApprovedProposal(applicationId, areaId,
                "Cancellation guard", start, start.plusSeconds(1800));
        long activityId = insertOfficialActivity(eventId, areaId, proposalId,
                "Cancellation guard", "DRAFT", start, start.plusSeconds(1800), false);

        String changeLocation = mvc.perform(post("/api/v1/partner/activities/" + activityId
                        + "/change-requests")
                        .with(partner(partnerOneUserId)).with(csrf())
                        .contentType("application/json")
                        .content("""
                                {"reason":"Một lý do thay đổi hợp lệ.",
                                 "requestedTitle":"A guarded title"}
                                """))
                .andExpect(status().isCreated()).andReturn().getResponse()
                .getHeader("Location");
        long changeRequestId = Long.parseLong(
                changeLocation.substring(changeLocation.lastIndexOf('/') + 1));
        mvc.perform(post("/api/v1/partner/activities/" + activityId
                        + "/cancellation-requests")
                        .with(partner(partnerOneUserId)).with(csrf())
                        .contentType("application/json")
                        .content("{\"reason\":\"Một lý do hủy hợp lệ.\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("ACTIVITY_REQUEST_ALREADY_PENDING"));
        mvc.perform(post("/api/v1/partner/activity-change-requests/" + changeRequestId
                        + "/withdraw").with(partner(partnerOneUserId)).with(csrf()))
                .andExpect(status().isOk());

        String cancellationLocation = mvc.perform(post("/api/v1/partner/activities/"
                        + activityId + "/cancellation-requests")
                        .with(partner(partnerOneUserId)).with(csrf())
                        .contentType("application/json")
                        .content("{\"reason\":\"  Một lý do hủy hợp lệ.  \"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.late").value(true))
                .andReturn().getResponse().getHeader("Location");
        long cancellationRequestId = Long.parseLong(cancellationLocation.substring(
                cancellationLocation.lastIndexOf('/') + 1));
        mvc.perform(post("/api/v1/partner/activities/" + activityId + "/change-requests")
                        .with(partner(partnerOneUserId)).with(csrf())
                        .contentType("application/json")
                        .content("""
                                {"reason":"Một lý do thay đổi khác.",
                                 "requestedTitle":"Cannot be pending"}
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("ACTIVITY_REQUEST_ALREADY_PENDING"));

        mvc.perform(post("/api/v1/partner/activity-cancellation-requests/"
                        + cancellationRequestId + "/withdraw")
                        .with(partner(partnerOneUserId)).with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("WITHDRAWN"));
        Instant firstWithdrawnAt = jdbc.queryForObject(
                "select withdrawn_at from activity_requests where activity_request_id = ?",
                Instant.class, cancellationRequestId);
        mvc.perform(post("/api/v1/partner/activity-cancellation-requests/"
                        + cancellationRequestId + "/withdraw")
                        .with(partner(partnerOneUserId)).with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("WITHDRAWN"));
        assertThat(jdbc.queryForObject(
                "select withdrawn_at from activity_requests where activity_request_id = ?",
                Instant.class, cancellationRequestId)).isEqualTo(firstWithdrawnAt);
        assertThat(jdbc.queryForObject("select status from activities where activity_id = ?",
                String.class, activityId)).isEqualTo("DRAFT");
    }

    @Test
    void ongoingActivityAcceptsCancellationRequest() throws Exception {
        Instant now = Instant.now().truncatedTo(ChronoUnit.MICROS);
        long eventId = insertEvent("ONGOING", now.minus(Duration.ofHours(2)),
                now.plus(Duration.ofHours(2)), now.minus(Duration.ofHours(3)), 5);
        setActivityCancellationCutoff(eventId, now.minus(Duration.ofHours(1)));
        long applicationId = insertApplication(eventId,
                partnerOneOrganizationId, "APPROVED");
        long areaId = insertLocation("ONGOING-CANCEL", "AREA", 100, true);
        long proposalId = insertApprovedProposal(applicationId, areaId,
                "Ongoing activity", now.minus(Duration.ofMinutes(30)),
                now.plus(Duration.ofMinutes(30)));
        long activityId = insertOfficialActivity(eventId, areaId, proposalId,
                "Ongoing activity", "ONGOING", now.minus(Duration.ofMinutes(30)),
                now.plus(Duration.ofMinutes(30)), false);

        mvc.perform(post("/api/v1/partner/activities/" + activityId
                        + "/cancellation-requests")
                        .with(partner(partnerOneUserId)).with(csrf())
                        .contentType("application/json")
                        .content("{\"reason\":\"Một lý do hủy hợp lệ.\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("PENDING"))
                .andExpect(jsonPath("$.late").value(true));
        assertThat(jdbc.queryForObject("select status from activities where activity_id = ?",
                String.class, activityId)).isEqualTo("ONGOING");
    }

    @Test
    void activityCompletionAutomaticallyCancelsPendingCancellationRequest()
            throws Exception {
        Instant now = Instant.now().truncatedTo(ChronoUnit.MICROS);
        long eventId = insertEvent("ONGOING", now.minus(Duration.ofHours(2)),
                now.plus(Duration.ofHours(2)), now.minus(Duration.ofHours(3)), 5);
        setActivityCancellationCutoff(eventId, now.minus(Duration.ofHours(1)));
        long applicationId = insertApplication(eventId,
                partnerOneOrganizationId, "APPROVED");
        long areaId = insertLocation("CANCEL-COMPLETE", "AREA", 100, true);
        long proposalId = insertApprovedProposal(applicationId, areaId,
                "Completed activity", now.minus(Duration.ofHours(1)),
                now.minus(Duration.ofMinutes(1)));
        long activityId = insertOfficialActivity(eventId, areaId, proposalId,
                "Completed activity", "ONGOING", now.minus(Duration.ofHours(1)),
                now.minus(Duration.ofMinutes(1)), false);
        long requestId = insertPendingCancellationRequest(activityId);

        mvc.perform(get("/api/v1/partner/activity-cancellation-requests/" + requestId)
                        .with(partner(partnerOneUserId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CANCELLED"))
                .andExpect(jsonPath("$.cancelledAt").isNotEmpty());
        assertThat(jdbc.queryForObject("select status from activities where activity_id = ?",
                String.class, activityId)).isEqualTo("COMPLETED");
    }

    private long submitProposal(long eventId, long locationId, String title, Instant start,
            Instant end, int capacity) throws Exception {
        String location = mvc.perform(post(PROPOSALS)
                        .with(partner(partnerOneUserId)).with(csrf())
                        .contentType("application/json")
                        .content(proposalJson(eventId, locationId, title, start, end, capacity)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getHeader("Location");
        return Long.parseLong(location.substring(location.lastIndexOf('/') + 1));
    }

    private long insertApprovedProposal(long applicationId, long locationId, String title,
            Instant start, Instant end) {
        return jdbc.queryForObject("""
                insert into activity_proposals(
                    application_id, location_id, title, description, activity_type,
                    proposed_start_at, proposed_end_at, capacity, status,
                    submitted_at, updated_at, reviewed_at)
                values (?, ?, ?, 'Approved proposal', 'TALKSHOW', ?, ?, 20, 'APPROVED',
                    current_timestamp, current_timestamp, current_timestamp)
                returning activity_proposal_id
                """, Long.class, applicationId, locationId, title,
                Timestamp.from(start), Timestamp.from(end));
    }

    private long insertOfficialActivity(long eventId, long locationId, Long sourceProposalId,
            String title, String statusValue, Instant start, Instant end,
            boolean registrationRequired) {
        UUID qrToken = registrationRequired ? UUID.randomUUID() : null;
        Instant registrationDeadline = registrationRequired ? start.minusSeconds(3600) : null;
        Instant publishedAt = statusValue.equals("DRAFT") ? null : Instant.now();
        return jdbc.queryForObject("""
                insert into activities(
                    event_id, location_id, source_proposal_id, title, description,
                    activity_type, start_at, end_at, registration_required,
                    registration_deadline_at, capacity, attendance_qr_token,
                    is_certificate_enabled, status, created_at, updated_at, published_at)
                values (?, ?, ?, ?, 'Official activity', 'TALKSHOW', ?, ?, ?, ?, 20, ?,
                    false, ?, current_timestamp, current_timestamp, ?)
                returning activity_id
                """, Long.class, eventId, locationId, sourceProposalId, title,
                Timestamp.from(start), Timestamp.from(end), registrationRequired,
                registrationDeadline == null ? null : Timestamp.from(registrationDeadline),
                qrToken, statusValue,
                publishedAt == null ? null : Timestamp.from(publishedAt));
    }

    private long insertPendingChangeRequest(long activityId, String requestedTitle) {
        return jdbc.queryForObject("""
                insert into activity_requests(
                    activity_id, request_type, requested_title,
                    requested_description_present, requested_image_url_present,
                    reason, is_late, status, submitted_at)
                values (?, 'CHANGE', ?, false, false,
                    'Một lý do thay đổi hợp lệ.', false, 'PENDING', current_timestamp)
                returning activity_request_id
                """, Long.class, activityId, requestedTitle);
    }

    private long insertPendingCancellationRequest(long activityId) {
        return jdbc.queryForObject("""
                insert into activity_requests(
                    activity_id, request_type, requested_description_present,
                    requested_image_url_present, reason, is_late, status, submitted_at)
                values (?, 'CANCELLATION', false, false,
                    'Một lý do hủy hợp lệ.', true, 'PENDING', current_timestamp)
                returning activity_request_id
                """, Long.class, activityId);
    }

    private String changeJson(long locationId, Instant start, Instant end) {
        return """
                {
                  "reason": "  Cần dời lịch để tác giả kịp tham dự.  ",
                  "requestedLocationId": %d,
                  "requestedTitle": "  Renamed   activity  ",
                  "requestedDescription": null,
                  "requestedStartAt": "%s",
                  "requestedEndAt": "%s",
                  "requestedCapacity": 40,
                  "requestedImageUrl": " https://example.test/activity.jpg "
                }
                """.formatted(locationId, start, end);
    }

    private void insertRevision(long activityId) {
        jdbc.update("""
                insert into activity_revisions(
                    activity_id, actor_user_id, revision_source, change_reason,
                    old_snapshot, new_snapshot, changed_at)
                values (?, ?, 'ORGANIZER_DIRECT', 'A valid revision reason.',
                    cast(? as jsonb), cast(? as jsonb), current_timestamp)
                """, activityId, organizerId,
                "{\"title\":\"Before\"}", "{\"title\":\"After\"}");
    }

    private void submitExpecting(long eventId, long locationId, Instant start,
            int capacity, String errorCode) throws Exception {
        mvc.perform(post(PROPOSALS).with(partner(partnerOneUserId)).with(csrf())
                        .contentType("application/json")
                        .content(proposalJson(eventId, locationId, "Guarded proposal", start,
                                start.plusSeconds(1800), capacity)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value(errorCode));
    }

    private String proposalJson(long eventId, long locationId, String title, Instant start,
            Instant end, int capacity) {
        return """
                {
                  "eventId": %d,
                  "locationId": %d,
                  "title": "%s",
                  "description": "  Nội dung đề xuất hợp lệ.  ",
                  "activityType": " TALKSHOW ",
                  "proposedStartAt": "%s",
                  "proposedEndAt": "%s",
                  "capacity": %d
                }
                """.formatted(eventId, locationId, title, start, end, capacity);
    }

    private long insertEvent(String statusValue, Instant start, Instant end,
            Instant proposalDeadline, int maximumActivities) {
        return jdbc.queryForObject("""
                insert into events(
                    organizer_user_id, name, start_at, end_at,
                    activity_proposal_deadline_at, booth_payment_window_minutes,
                    max_booths_per_partner, max_activities_per_partner,
                    status, created_at, updated_at)
                values (?, ?, ?, ?, ?, 60, 2, ?, ?, current_timestamp, current_timestamp)
                returning event_id
                """, Long.class, organizerId, prefix + " Event", Timestamp.from(start),
                Timestamp.from(end), Timestamp.from(proposalDeadline), maximumActivities,
                statusValue);
    }

    private void setActivityCancellationCutoff(long eventId, Instant cutoff) {
        jdbc.update("update events set activity_cancellation_cutoff_at = ? where event_id = ?",
                Timestamp.from(cutoff), eventId);
    }

    private long insertApplication(long eventId, long organizationId, String statusValue) {
        return jdbc.queryForObject("""
                insert into partner_event_applications(
                    partner_organization_id, event_id, status, submitted_at, reviewed_at)
                values (?, ?, ?, current_timestamp,
                    case when ? = 'APPROVED' then current_timestamp else null end)
                returning application_id
                """, Long.class, organizationId, eventId, statusValue, statusValue);
    }

    private long insertLocation(String suffix, String type, int capacity, boolean active) {
        return jdbc.queryForObject("""
                insert into locations(code, name, location_type, max_capacity, is_active,
                    created_at, updated_at)
                values (?, ?, ?, ?, ?, current_timestamp, current_timestamp)
                returning location_id
                """, Long.class, prefix + suffix, prefix + " " + suffix, type, capacity, active);
    }

    private long insertBooth(String suffix) {
        long boothId = insertLocation(suffix, "BOOTH", 4, true);
        jdbc.update("insert into booths(booth_id, category_code) values (?, 'PUBLISHER')",
                boothId);
        return boothId;
    }

    private void insertAssignment(long eventId, long boothId, long applicationId) {
        long configId = jdbc.queryForObject("""
                insert into event_booth_configs(event_id, booth_id, rental_price, is_enabled)
                values (?, ?, 10000, true)
                returning event_booth_config_id
                """, Long.class, eventId, boothId);
        long requestId = jdbc.queryForObject("""
                insert into booth_requests(
                    application_id, booth_id, status, submitted_at,
                    reviewed_at, selected_at, completed_at)
                values (?, ?, 'COMPLETED', current_timestamp,
                    current_timestamp, current_timestamp, current_timestamp)
                returning booth_request_id
                """, Long.class, applicationId, boothId);
        long holdId = jdbc.queryForObject("""
                insert into booth_holds(
                    event_booth_config_id, booth_request_id, locked_rental_price,
                    status, created_at, expires_at, consumed_at)
                values (?, ?, 10000, 'CONSUMED', current_timestamp,
                    current_timestamp + interval '1 hour', current_timestamp)
                returning booth_hold_id
                """, Long.class, configId, requestId);
        jdbc.update("""
                insert into booth_assignments(
                    booth_hold_id, qr_token, status, assigned_at)
                values (?, ?, 'ACTIVE', current_timestamp)
                """, holdId, UUID.randomUUID());
    }

    private long insertOrganization(long representativeId, String suffix) {
        return jdbc.queryForObject("""
                insert into partner_organizations(
                    representative_user_id, name, category_code, status,
                    created_at, updated_at)
                values (?, ?, 'PUBLISHER', 'ACTIVE', current_timestamp, current_timestamp)
                returning partner_organization_id
                """, Long.class, representativeId, prefix + " Partner " + suffix);
    }

    private long insertUser(String name) {
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 10);
        return jdbc.queryForObject("""
                insert into users(username, password_hash, full_name, email,
                    email_verified_at, status)
                values (?, '{noop}unused', ?, ?, current_timestamp, 'ACTIVE')
                returning user_id
                """, Long.class, "proposal" + suffix, prefix + " " + name,
                "proposal" + suffix + "@example.test");
    }

    private Instant future(int days) {
        return Instant.now().truncatedTo(ChronoUnit.MICROS).plus(Duration.ofDays(days));
    }

    private RequestPostProcessor partner(long userId) {
        return actor(userId, "PARTNER");
    }

    private RequestPostProcessor organizer() {
        return actor(organizerId, "ORGANIZER");
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
