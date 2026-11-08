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
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.timeout;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
        "spring.datasource.url=${EVENT_TEST_DATABASE_URL}",
        "spring.datasource.hikari.maximum-pool-size=2",
        "spring.datasource.hikari.minimum-idle=0",
        "logging.level.org.springframework.security=ERROR"
})
@EnabledIfEnvironmentVariable(named = "EVENT_TEST_DATABASE_URL", matches = ".+")
@ContextConfiguration(initializers = OrganizerActivityRequestIntegrationTests.TestDatabaseGuard.class)
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class OrganizerActivityRequestIntegrationTests {
    static class TestDatabaseGuard
            implements ApplicationContextInitializer<ConfigurableApplicationContext> {
        @Override
        public void initialize(ConfigurableApplicationContext context) {
            String url = context.getEnvironment().getRequiredProperty("spring.datasource.url");
            if (!url.matches("jdbc:postgresql://[^/]+/[A-Za-z0-9_]+_event_test(?:\\?.*)?")) {
                throw new IllegalStateException("Organizer Activity Request tests require "
                        + "*_event_test DB.");
            }
        }
    }

    private static final String CHANGES =
            "/api/v1/organizer/activity-change-requests";
    private static final String CANCELLATIONS =
            "/api/v1/organizer/activity-cancellation-requests";

    @Autowired WebApplicationContext context;
    @Autowired JdbcTemplate jdbc;
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
        prefix = ("OAR" + UUID.randomUUID().toString().replace("-", "").substring(0, 9))
                .toUpperCase();
        organizerId = insertUser("Organizer");
        otherOrganizerId = insertUser("Other Organizer");
        partnerUserId = insertUser("Partner");
        partnerOrganizationId = insertOrganization(partnerUserId);
    }

    @AfterEach
    void cleanup() {
        jdbc.update("delete from notifications where recipient_user_id in (?, ?, ?)",
                organizerId, otherOrganizerId, partnerUserId);
        jdbc.update("delete from attendances where activity_registration_id in (select activity_registration_id from activity_registrations where event_registration_id in (select event_registration_id from event_registrations where user_id=?))", partnerUserId);
        jdbc.update("delete from activity_registrations where event_registration_id in (select event_registration_id from event_registrations where user_id=?)", partnerUserId);
        jdbc.update("delete from event_registrations where user_id=?", partnerUserId);
        jdbc.update("delete from activity_revisions where activity_id in "
                + "(select activity_id from activities where event_id in "
                + "(select event_id from events where organizer_user_id in (?, ?)))",
                organizerId, otherOrganizerId);
        jdbc.update("delete from activity_requests where activity_id in "
                + "(select activity_id from activities where event_id in "
                + "(select event_id from events where organizer_user_id in (?, ?)))",
                organizerId, otherOrganizerId);
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
        jdbc.update("delete from locations where code like ?", prefix + "%");
        jdbc.update("delete from partner_organizations where partner_organization_id = ?",
                partnerOrganizationId);
        jdbc.update("delete from users where user_id in (?, ?, ?)", organizerId,
                otherOrganizerId, partnerUserId);
    }

    @Test
    void organizerListsFiltersAndReadsOnlyRequestsForOwnedEvents() throws Exception {
        Instant eventStart = future(4);
        long eventId = insertEvent(organizerId, eventStart,
                eventStart.plus(Duration.ofDays(1)), "PUBLISHED");
        long foreignEventId = insertEvent(otherOrganizerId, eventStart,
                eventStart.plus(Duration.ofDays(1)), "PUBLISHED");
        long applicationId = insertApplication(eventId);
        long foreignApplicationId = insertApplication(foreignEventId);
        long changeLocationId = insertLocation("CHANGE", "Change Stage");
        long requestedLocationId = insertLocation("CHANGEDEST", "Requested Stage");
        long changeActivityId = insertPartnerActivity(applicationId, eventId,
                changeLocationId, "Change target", eventStart, "DRAFT");
        long cancellationActivityId = insertPartnerActivity(applicationId, eventId,
                insertLocation("CANCEL", "Cancellation Stage"), "Cancellation target",
                eventStart.plus(Duration.ofHours(2)), "DRAFT");
        long foreignActivityId = insertPartnerActivity(foreignApplicationId, foreignEventId,
                insertLocation("FOREIGN", "Foreign Stage"), "Foreign target",
                eventStart.plus(Duration.ofHours(4)), "DRAFT");
        long changeId = insertChangeRequest(changeActivityId, "Requested headline", "PENDING");
        jdbc.update("update activity_requests set requested_location_id = ? "
                + "where activity_request_id = ?", requestedLocationId, changeId);
        long cancellationId = insertCancellationRequest(cancellationActivityId,
                "Partner requests cancellation for logistics.", true, "REJECTED");
        long foreignId = insertChangeRequest(foreignActivityId, "Foreign headline", "PENDING");

        mvc.perform(get(CHANGES + "?eventId=" + eventId)
                        .with(actor(organizerId, "ORGANIZER")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1));
        mvc.perform(get(CANCELLATIONS + "?eventId=" + eventId)
                        .with(actor(organizerId, "ORGANIZER")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1));
        mvc.perform(get(CHANGES + "?eventId=" + eventId
                        + "&status=PENDING&search=headline&size=1&sort=submittedAt,asc")
                        .with(actor(organizerId, "ORGANIZER")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].activityChangeRequestId").value(changeId))
                .andExpect(jsonPath("$.content[0].requestedTitle")
                        .value("Requested headline"))
                .andExpect(jsonPath("$.content[0].requestedLocation.locationId")
                        .value(requestedLocationId))
                .andExpect(jsonPath("$.content[0].requestedLocation.name")
                        .value(prefix + " Requested Stage"))
                .andExpect(jsonPath("$.content[0].activity.activityId")
                        .value(changeActivityId))
                .andExpect(jsonPath("$.content[0].activity.eventId").value(eventId))
                .andExpect(jsonPath("$.content[0].activity.eventName")
                        .value(prefix + " Event"))
                .andExpect(jsonPath("$.content[0].activity.partnerOrganizationId")
                        .value(partnerOrganizationId))
                .andExpect(jsonPath("$.content[0].activity.partnerOrganizationName")
                        .value(prefix + " Partner"))
                .andExpect(jsonPath("$.content[0].activity.partnerOrganizationStatus").value("ACTIVE"))
                .andExpect(jsonPath("$.content[0].activity.location.locationId")
                        .value(changeLocationId))
                .andExpect(jsonPath("$.content[0].activity.title").value("Change target"))
                .andExpect(jsonPath("$.content[0].activity.status").value("DRAFT"));
        mvc.perform(get(CHANGES + "/" + changeId)
                        .with(actor(organizerId, "ORGANIZER")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.activityId").value(changeActivityId))
                .andExpect(jsonPath("$.activity.eventName").value(prefix + " Event"))
                .andExpect(jsonPath("$.requestedLocation.code")
                        .value(prefix + "CHANGEDEST"));
        mvc.perform(get(CHANGES + "/" + foreignId)
                        .with(actor(organizerId, "ORGANIZER")))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("ACTIVITY_CHANGE_REQUEST_NOT_FOUND"));

        mvc.perform(get(CANCELLATIONS + "?eventId=" + eventId
                        + "&status=REJECTED&late=true&search=logistics"
                        + "&sort=activityCancellationRequestId,desc")
                        .with(actor(organizerId, "ORGANIZER")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].activityCancellationRequestId")
                        .value(cancellationId))
                .andExpect(jsonPath("$.content[0].late").value(true))
                .andExpect(jsonPath("$.content[0].activity.title")
                        .value("Cancellation target"))
                .andExpect(jsonPath("$.content[0].activity.partnerOrganizationName")
                        .value(prefix + " Partner"))
                .andExpect(jsonPath("$.content[0].activity.partnerOrganizationStatus").value("ACTIVE"));
        mvc.perform(get(CANCELLATIONS + "/" + changeId)
                        .with(actor(organizerId, "ORGANIZER")))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code")
                        .value("ACTIVITY_CANCELLATION_REQUEST_NOT_FOUND"));
    }

    @Test
    void organizerRequestReadsEnforceRoleAndQueryValidation() throws Exception {
        mvc.perform(get(CHANGES)).andExpect(status().isUnauthorized());
        mvc.perform(get(CHANGES).with(actor(partnerUserId, "PARTNER")))
                .andExpect(status().isForbidden());
        mvc.perform(get(CHANGES + "?eventId=0").with(actor(organizerId, "ORGANIZER")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_FILTER"));
        mvc.perform(get(CHANGES + "?status=UNKNOWN")
                        .with(actor(organizerId, "ORGANIZER")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_FILTER"));
        mvc.perform(get(CANCELLATIONS + "?sort=reason,asc")
                        .with(actor(organizerId, "ORGANIZER")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_SORT"));
        mvc.perform(get(CANCELLATIONS + "?page=-1")
                        .with(actor(organizerId, "ORGANIZER")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_PAGE"));
        mvc.perform(get(CANCELLATIONS + "/999999999")
                        .with(actor(organizerId, "ORGANIZER")))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code")
                        .value("ACTIVITY_CANCELLATION_REQUEST_NOT_FOUND"));
    }

    @Test
    void organizerReadsApplyActivityLifecycleBeforeReturningRequests() throws Exception {
        Instant now = Instant.now().truncatedTo(ChronoUnit.MICROS);
        long eventId = insertEvent(organizerId, now.minus(Duration.ofHours(2)),
                now.plus(Duration.ofHours(4)), "ONGOING");
        long applicationId = insertApplication(eventId);
        long changeActivityId = insertPartnerActivity(applicationId, eventId,
                insertLocation("DUECHANGE", "Due Change Stage"), "Started change target",
                now.minus(Duration.ofMinutes(15)), "PUBLISHED");
        long cancellationActivityId = insertPartnerActivity(applicationId, eventId,
                insertLocation("DUECANCEL", "Due Cancellation Stage"),
                "Started cancellation target", now.minus(Duration.ofMinutes(10)),
                "PUBLISHED");
        long changeId = insertChangeRequest(changeActivityId, "No longer applicable", "PENDING");
        long cancellationId = insertCancellationRequest(cancellationActivityId,
                "Please cancel this activity after it started.", false, "PENDING");

        mvc.perform(get(CHANGES + "/" + changeId)
                        .with(actor(organizerId, "ORGANIZER")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CANCELLED"))
                .andExpect(jsonPath("$.cancelledAt").isNotEmpty());
        mvc.perform(get(CANCELLATIONS + "/" + cancellationId)
                        .with(actor(organizerId, "ORGANIZER")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PENDING"));
        assertThat(activityStatus(changeActivityId)).isEqualTo("ONGOING");
        assertThat(activityStatus(cancellationActivityId)).isEqualTo("ONGOING");

        jdbc.update("update activities set end_at = ? where activity_id = ?",
                Timestamp.from(now.minusSeconds(1)), cancellationActivityId);
        mvc.perform(get(CANCELLATIONS + "/" + cancellationId)
                        .with(actor(organizerId, "ORGANIZER")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CANCELLED"));
        mvc.perform(get(CHANGES + "/" + changeId).with(actor(organizerId, "ORGANIZER")))
                .andExpect(status().isOk());
        assertThat(partnerRows("activity_request_id", changeId,
                "PARTNER_ACTIVITY_CHANGE_REQUEST_STATUS_CHANGED")).isOne();
        assertThat(partnerRows("activity_request_id", cancellationId,
                "PARTNER_ACTIVITY_CANCELLATION_REQUEST_STATUS_CHANGED")).isOne();
    }

    @Test
    void directOrganizerCancellationNotifiesPartnerOnceAndSuppressesItsPendingRequest()
            throws Exception {
        Instant start = future(4);
        long eventId = insertEvent(organizerId, start, start.plus(Duration.ofDays(1)), "PUBLISHED");
        long activityId = insertPartnerActivity(insertApplication(eventId), eventId,
                insertLocation("DIRECTCANCEL", "Direct Cancel Stage"), "Directly cancelled",
                start.plus(Duration.ofHours(1)), "PUBLISHED");
        long requestId = insertChangeRequest(activityId, "Requested before cancellation", "PENDING");

        for (int attempt = 0; attempt < 2; attempt++) {
            mvc.perform(post("/api/v1/organizer/activities/" + activityId + "/cancel")
                            .with(actor(organizerId, "ORGANIZER")).with(csrf())
                            .contentType(APPLICATION_JSON)
                            .content("{\"reason\":\"Diễn giả không thể tiếp tục tham gia.\"}"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.cancellationSource").value("ORGANIZER"));
        }

        assertThat(partnerRows("activity_id", activityId, "PARTNER_ACTIVITY_CANCELLED")).isOne();
        assertThat(jdbc.queryForObject("select count(*) from notifications where "
                + "activity_request_id = ? and recipient_role = 'PARTNER'",
                Integer.class, requestId)).isZero();
    }

    @Test
    void organizerApprovesChangeAtomicallyAndStoresPartnerRequestRevision()
            throws Exception {
        Instant eventStart = future(4);
        long eventId = insertEvent(organizerId, eventStart,
                eventStart.plus(Duration.ofDays(1)), "PUBLISHED");
        long applicationId = insertApplication(eventId);
        long originalLocation = insertLocation("ORIGINAL", "Original Stage");
        long requestedLocation = insertLocation("REQUESTED", "Requested Stage");
        long activityId = insertPartnerActivity(applicationId, eventId, originalLocation,
                "Original title", eventStart.plus(Duration.ofHours(1)), "PUBLISHED");
        long requestId = insertChangeRequest(activityId, "Approved requested title",
                "PENDING");
        jdbc.update("""
                update activity_requests
                set requested_location_id = ?, requested_start_at = ?, requested_end_at = ?,
                    requested_capacity = 35, requested_description_present = true,
                    requested_description = 'Approved requested description'
                where activity_request_id = ?
                """, requestedLocation,
                Timestamp.from(eventStart.plus(Duration.ofHours(3))),
                Timestamp.from(eventStart.plus(Duration.ofHours(4))), requestId);

        mvc.perform(post(CHANGES + "/" + requestId + "/approve")
                        .with(actor(organizerId, "ORGANIZER")).with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("APPROVED"))
                .andExpect(jsonPath("$.handledAt").isNotEmpty());

        var activity = jdbc.queryForMap("""
                select location_id, title, description, capacity, status
                from activities where activity_id = ?
                """, activityId);
        assertThat(((Number) activity.get("location_id")).longValue())
                .isEqualTo(requestedLocation);
        assertThat(activity.get("title")).isEqualTo("Approved requested title");
        assertThat(activity.get("description"))
                .isEqualTo("Approved requested description");
        assertThat(activity.get("capacity")).isEqualTo(35);
        assertThat(activity.get("status")).isEqualTo("PUBLISHED");
        var revision = jdbc.queryForMap("""
                select actor_user_id, source_request_id, revision_source, change_reason,
                       old_snapshot ->> 'title' old_title,
                       new_snapshot ->> 'title' new_title
                from activity_revisions where activity_id = ?
                """, activityId);
        assertThat(((Number) revision.get("actor_user_id")).longValue())
                .isEqualTo(organizerId);
        assertThat(((Number) revision.get("source_request_id")).longValue())
                .isEqualTo(requestId);
        assertThat(revision.get("revision_source")).isEqualTo("PARTNER_REQUEST");
        assertThat(revision.get("change_reason"))
                .isEqualTo("A valid request reason for review.");
        assertThat(revision.get("old_title")).isEqualTo("Original title");
        assertThat(revision.get("new_title")).isEqualTo("Approved requested title");
        assertThat(jdbc.queryForObject("select count(*) from notifications where "
                + "activity_request_id = ? and recipient_user_id = ? and recipient_role = 'PARTNER'",
                Integer.class, requestId, partnerUserId)).isOne();
        verify(partnerMailService, timeout(5000)).sendMessage(anyString(), argThat(event ->
                event.messageType() == ActivityPartnerMessageType.CHANGE_REQUEST_APPROVED
                        && event.referenceId().equals(requestId)));
    }

    @Test
    void changeApprovalRevalidatesConflictAndRollsBackEverything() throws Exception {
        Instant eventStart = future(4);
        long eventId = insertEvent(organizerId, eventStart,
                eventStart.plus(Duration.ofDays(1)), "PUBLISHED");
        long applicationId = insertApplication(eventId);
        long originalLocation = insertLocation("ROLLBACK", "Rollback Stage");
        long occupiedLocation = insertLocation("OCCUPIED", "Occupied Stage");
        long activityId = insertPartnerActivity(applicationId, eventId, originalLocation,
                "Unchanged title", eventStart.plus(Duration.ofHours(1)), "DRAFT");
        insertPartnerActivity(applicationId, eventId, occupiedLocation, "Occupier",
                eventStart.plus(Duration.ofHours(3)), "DRAFT");
        long requestId = insertChangeRequest(activityId, "Must not be applied", "PENDING");
        jdbc.update("""
                update activity_requests
                set requested_location_id = ?, requested_start_at = ?, requested_end_at = ?
                where activity_request_id = ?
                """, occupiedLocation,
                Timestamp.from(eventStart.plus(Duration.ofHours(3).plusMinutes(15))),
                Timestamp.from(eventStart.plus(Duration.ofHours(3).plusMinutes(45))),
                requestId);

        mvc.perform(post(CHANGES + "/" + requestId + "/approve")
                        .with(actor(organizerId, "ORGANIZER")).with(csrf()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code")
                        .value("ACTIVITY_LOCATION_TIME_CONFLICT"));

        assertThat(jdbc.queryForObject(
                "select status from activity_requests where activity_request_id = ?",
                String.class, requestId)).isEqualTo("PENDING");
        assertThat(jdbc.queryForObject(
                "select title from activities where activity_id = ?", String.class,
                activityId)).isEqualTo("Unchanged title");
        assertThat(jdbc.queryForObject(
                "select count(*) from activity_revisions where activity_id = ?",
                Integer.class, activityId)).isZero();
        verifyNoInteractions(partnerMailService);
    }

    @Test
    void organizerRejectsChangeAndReviewsCancellationWithoutChangingWrongState()
            throws Exception {
        Instant eventStart = future(4);
        long eventId = insertEvent(organizerId, eventStart,
                eventStart.plus(Duration.ofDays(1)), "PUBLISHED");
        long applicationId = insertApplication(eventId);
        long rejectedActivityId = insertPartnerActivity(applicationId, eventId,
                insertLocation("REJECT", "Reject Stage"), "Rejected change activity",
                eventStart.plus(Duration.ofHours(1)), "DRAFT");
        long rejectedRequestId = insertChangeRequest(rejectedActivityId,
                "Title that must not apply", "PENDING");

        mvc.perform(post(CHANGES + "/" + rejectedRequestId + "/reject")
                        .with(actor(organizerId, "ORGANIZER")).with(csrf())
                        .contentType(APPLICATION_JSON)
                        .content("{\"reviewNote\":\"  Change is not suitable now.  \"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("REJECTED"))
                .andExpect(jsonPath("$.reviewNote")
                        .value("Change is not suitable now."));
        assertThat(jdbc.queryForObject(
                "select title from activities where activity_id = ?", String.class,
                rejectedActivityId)).isEqualTo("Rejected change activity");

        long cancelledActivityId = insertPartnerActivity(applicationId, eventId,
                insertLocation("CANCELAPPROVE", "Cancellation Approval Stage"),
                "Cancellation approval activity", eventStart.plus(Duration.ofHours(4)),
                "PUBLISHED");
        String cancellationReason = "Partner speaker is no longer available.";
        long cancellationId = insertCancellationRequest(cancelledActivityId,
                cancellationReason, false, "PENDING");
        mvc.perform(post(CANCELLATIONS + "/" + cancellationId + "/approve")
                        .with(actor(organizerId, "ORGANIZER")).with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("APPROVED"));
        var cancelled = jdbc.queryForMap("""
                select status, cancellation_source, cancellation_reason
                from activities where activity_id = ?
                """, cancelledActivityId);
        assertThat(cancelled.get("status")).isEqualTo("CANCELLED");
        assertThat(cancelled.get("cancellation_source")).isEqualTo("PARTNER_REQUEST");
        assertThat(cancelled.get("cancellation_reason")).isEqualTo(cancellationReason);
        assertThat(partnerRows("activity_request_id", cancellationId,
                "PARTNER_ACTIVITY_CANCELLATION_REQUEST_STATUS_CHANGED")).isOne();
        assertThat(partnerRows("activity_id", cancelledActivityId,
                "PARTNER_ACTIVITY_CANCELLED")).isZero();

        mvc.perform(post(CANCELLATIONS + "/" + cancellationId + "/approve")
                        .with(actor(organizerId, "ORGANIZER")).with(csrf()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code")
                        .value("ACTIVITY_REQUEST_NOT_REVIEWABLE"));

        long cancellationRejectedActivityId = insertPartnerActivity(applicationId, eventId,
                insertLocation("CANCELREJECT", "Cancellation Rejection Stage"),
                "Cancellation rejection activity", eventStart.plus(Duration.ofHours(6)),
                "DRAFT");
        long cancellationRejectedId = insertCancellationRequest(
                cancellationRejectedActivityId,
                "Partner asks to cancel but Organizer will reject it.", false, "PENDING");
        mvc.perform(post(CANCELLATIONS + "/" + cancellationRejectedId + "/reject")
                        .with(actor(organizerId, "ORGANIZER")).with(csrf())
                        .contentType(APPLICATION_JSON)
                        .content("{\"reviewNote\":\"short\"}"))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
        mvc.perform(post(CANCELLATIONS + "/" + cancellationRejectedId + "/reject")
                        .with(actor(organizerId, "ORGANIZER")).with(csrf())
                        .contentType(APPLICATION_JSON)
                        .content("{\"reviewNote\":\"Activity should continue as planned.\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("REJECTED"));
        assertThat(activityStatus(cancellationRejectedActivityId)).isEqualTo("DRAFT");
        verify(partnerMailService, timeout(5000)).sendMessage(anyString(), argThat(event ->
                event.messageType()
                        == ActivityPartnerMessageType.CANCELLATION_REQUEST_APPROVED
                        && event.referenceId().equals(cancellationId)));
        verify(partnerMailService, timeout(5000)).sendMessage(anyString(), argThat(event ->
                event.messageType()
                        == ActivityPartnerMessageType.CANCELLATION_REQUEST_REJECTED
                        && event.referenceId().equals(cancellationRejectedId)));
    }

    @Test
    void inactiveOrganizationBlocksRequestApprovalsButStillAllowsRejections()
            throws Exception {
        Instant eventStart = future(4);
        long eventId = insertEvent(organizerId, eventStart,
                eventStart.plus(Duration.ofDays(1)), "PUBLISHED");
        long applicationId = insertApplication(eventId);
        long locationId = insertLocation("INACTIVE-REQUEST", "Inactive Request Stage");
        long changeApproveActivity = insertPartnerActivity(applicationId, eventId, locationId,
                "Blocked change", eventStart.plus(Duration.ofHours(1)), "DRAFT");
        long changeRejectActivity = insertPartnerActivity(applicationId, eventId, locationId,
                "Rejected change", eventStart.plus(Duration.ofHours(3)), "DRAFT");
        long cancellationApproveActivity = insertPartnerActivity(applicationId, eventId,
                locationId, "Blocked cancellation", eventStart.plus(Duration.ofHours(5)),
                "DRAFT");
        long cancellationRejectActivity = insertPartnerActivity(applicationId, eventId,
                locationId, "Rejected cancellation", eventStart.plus(Duration.ofHours(7)),
                "DRAFT");
        long changeApproveId = insertChangeRequest(changeApproveActivity,
                "Must remain pending", "PENDING");
        long changeRejectId = insertChangeRequest(changeRejectActivity,
                "Must be rejected", "PENDING");
        long cancellationApproveId = insertCancellationRequest(cancellationApproveActivity,
                "A valid cancellation reason for approval.", false, "PENDING");
        long cancellationRejectId = insertCancellationRequest(cancellationRejectActivity,
                "A valid cancellation reason for rejection.", false, "PENDING");
        jdbc.update("update partner_organizations set status = 'INACTIVE' where partner_organization_id = ?",
                partnerOrganizationId);

        mvc.perform(post(CHANGES + "/" + changeApproveId + "/approve")
                        .with(actor(organizerId, "ORGANIZER")).with(csrf()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PARTNER_ORGANIZATION_INACTIVE"));
        mvc.perform(post(CANCELLATIONS + "/" + cancellationApproveId + "/approve")
                        .with(actor(organizerId, "ORGANIZER")).with(csrf()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PARTNER_ORGANIZATION_INACTIVE"));
        mvc.perform(post(CHANGES + "/" + changeRejectId + "/reject")
                        .with(actor(organizerId, "ORGANIZER")).with(csrf())
                        .contentType(APPLICATION_JSON)
                        .content("{\"reviewNote\":\"The requested change cannot be accepted.\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("REJECTED"));
        mvc.perform(post(CANCELLATIONS + "/" + cancellationRejectId + "/reject")
                        .with(actor(organizerId, "ORGANIZER")).with(csrf())
                        .contentType(APPLICATION_JSON)
                        .content("{\"reviewNote\":\"The activity should continue as scheduled.\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("REJECTED"));

        assertThat(requestStatus(changeApproveId)).isEqualTo("PENDING");
        assertThat(requestStatus(cancellationApproveId)).isEqualTo("PENDING");
        assertThat(requestStatus(changeRejectId)).isEqualTo("REJECTED");
        assertThat(requestStatus(cancellationRejectId)).isEqualTo("REJECTED");
    }

    @Test
    void partnerChangeApprovalFreezesScheduleAfterValidAttendance() throws Exception {
        Instant start = future(4);
        long eventId = insertEvent(organizerId, start, start.plus(Duration.ofDays(1)), "PUBLISHED");
        long activityId = insertPartnerActivity(insertApplication(eventId), eventId,
                insertLocation("S6FREEZE", "Attendance Stage"), "Attended activity", start, "PUBLISHED");
        enableParticipation(eventId, activityId, start, true);
        long requestId = insertChangeRequest(activityId, "Reschedule request", "PENDING");
        jdbc.update("update activity_requests set requested_start_at=?, requested_end_at=? where activity_request_id=?",
                Timestamp.from(start.plusSeconds(3600)), Timestamp.from(start.plusSeconds(7200)), requestId);
        mvc.perform(post(CHANGES + "/" + requestId + "/approve").with(actor(organizerId, "ORGANIZER")).with(csrf()))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("ACTIVITY_ATTENDANCE_FREEZES_SCHEDULE_OR_LOCATION"));
        assertThat(jdbc.queryForObject("select status from activity_requests where activity_request_id=?", String.class, requestId)).isEqualTo("PENDING");
    }

    @Test
    void partnerScheduleApprovalRetainsRegistrationAndNotifiesParticipant() throws Exception {
        Instant start = future(4);
        long eventId = insertEvent(organizerId, start, start.plus(Duration.ofDays(1)), "PUBLISHED");
        long activityId = insertPartnerActivity(insertApplication(eventId), eventId,
                insertLocation("S6MOVE", "Schedule Stage"), "Registered activity", start, "PUBLISHED");
        long registrationId = enableParticipation(eventId, activityId, start, false);
        long requestId = insertChangeRequest(activityId, "Reschedule request", "PENDING");
        jdbc.update("update activity_requests set requested_start_at=?, requested_end_at=? where activity_request_id=?",
                Timestamp.from(start.plusSeconds(3600)), Timestamp.from(start.plusSeconds(7200)), requestId);
        mvc.perform(post(CHANGES + "/" + requestId + "/approve").with(actor(organizerId, "ORGANIZER")).with(csrf()))
                .andExpect(status().isOk());
        assertThat(jdbc.queryForObject("select status from activity_registrations where activity_registration_id=?", String.class, registrationId)).isEqualTo("ACTIVE");
        assertThat(jdbc.queryForObject("select count(*) from notifications where recipient_user_id=? and notification_type='ACTIVITY_SCHEDULE_OR_LOCATION_CHANGED'", Integer.class, partnerUserId)).isEqualTo(1);
    }

    @Test
    void partnerCancellationApprovalUsesSameRegistrationCascade() throws Exception {
        Instant start = future(4);
        long eventId = insertEvent(organizerId, start, start.plus(Duration.ofDays(1)), "PUBLISHED");
        long activityId = insertPartnerActivity(insertApplication(eventId), eventId,
                insertLocation("S6CANCEL", "Cancellation Stage"), "Registered activity", start, "PUBLISHED");
        long registrationId = enableParticipation(eventId, activityId, start, true);
        long requestId = insertCancellationRequest(activityId, "Partner unable to continue the activity", false, "PENDING");
        mvc.perform(post(CANCELLATIONS + "/" + requestId + "/approve").with(actor(organizerId, "ORGANIZER")).with(csrf()))
                .andExpect(status().isOk());
        assertThat(jdbc.queryForObject("select cancellation_source from activity_registrations where activity_registration_id=?", String.class, registrationId)).isEqualTo("ACTIVITY");
        assertThat(jdbc.queryForObject("select status from attendances where activity_registration_id=?", String.class, registrationId)).isEqualTo("VALID");
        assertThat(jdbc.queryForObject("select count(*) from notifications where recipient_user_id=? and notification_type='ACTIVITY_CANCELLED'", Integer.class, partnerUserId)).isEqualTo(1);
    }

    private int partnerRows(String referenceColumn, long referenceId, String type) {
        return jdbc.queryForObject("select count(*) from notifications where " + referenceColumn
                + " = ? and recipient_user_id = ? and recipient_role = 'PARTNER' "
                + "and notification_type = ?", Integer.class, referenceId, partnerUserId, type);
    }

    private long enableParticipation(long eventId, long activityId, Instant start, boolean attended) {
        jdbc.update("update activities set registration_required=true, registration_deadline_at=?, attendance_qr_token=? where activity_id=?",
                Timestamp.from(start.minusSeconds(1800)), UUID.randomUUID(), activityId);
        long eventRegistrationId = jdbc.queryForObject("insert into event_registrations(user_id,event_id,status,registered_at,activated_at,updated_at) values (?,?,'ACTIVE',current_timestamp,current_timestamp,current_timestamp) returning event_registration_id",
                Long.class, partnerUserId, eventId);
        long registrationId = jdbc.queryForObject("insert into activity_registrations(event_registration_id,activity_id,status,registered_at,activated_at,updated_at) values (?,?,'ACTIVE',current_timestamp,current_timestamp,current_timestamp) returning activity_registration_id",
                Long.class, eventRegistrationId, activityId);
        if (attended) jdbc.update("insert into attendances(activity_registration_id,status,recorded_source,attended_at,created_at,updated_at) values (?,'VALID','ORGANIZER_CORRECTION',?,current_timestamp,current_timestamp)", registrationId, Timestamp.from(start));
        return registrationId;
    }

    private long insertEvent(long ownerId, Instant start, Instant end, String status) {
        return jdbc.queryForObject("""
                insert into events(
                    organizer_user_id, name, start_at, end_at,
                    activity_proposal_deadline_at, activity_cancellation_cutoff_at,
                    booth_payment_window_minutes, max_booths_per_partner,
                    max_activities_per_partner, status, created_at, updated_at)
                values (?, ?, ?, ?, ?, ?, 60, 2, 3, ?, current_timestamp,
                    current_timestamp)
                returning event_id
                """, Long.class, ownerId, prefix + " Event", Timestamp.from(start),
                Timestamp.from(end), Timestamp.from(start.minus(Duration.ofDays(1))),
                Timestamp.from(start.minus(Duration.ofHours(12))), status);
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
        return jdbc.queryForObject("""
                insert into locations(code, name, location_type, max_capacity, is_active,
                    created_at, updated_at)
                values (?, ?, 'STAGE', 100, true, current_timestamp, current_timestamp)
                returning location_id
                """, Long.class, prefix + suffix, prefix + " " + name);
    }

    private long insertPartnerActivity(long applicationId, long eventId, long locationId,
            String title, Instant start, String status) {
        long proposalId = jdbc.queryForObject("""
                insert into activity_proposals(
                    application_id, location_id, title, description, activity_type,
                    proposed_start_at, proposed_end_at, capacity, status,
                    submitted_at, updated_at, reviewed_at)
                values (?, ?, ?, 'Request integration proposal', 'TALKSHOW', ?, ?, 20,
                    'APPROVED', current_timestamp, current_timestamp, current_timestamp)
                returning activity_proposal_id
                """, Long.class, applicationId, locationId, title, Timestamp.from(start),
                Timestamp.from(start.plus(Duration.ofHours(1))));
        return jdbc.queryForObject("""
                insert into activities(
                    event_id, location_id, source_proposal_id, title, description,
                    activity_type, start_at, end_at, registration_required, capacity,
                    is_certificate_enabled, status, created_at, updated_at, published_at)
                values (?, ?, ?, ?, 'Request integration activity', 'TALKSHOW', ?, ?, false,
                    20, false, ?, current_timestamp, current_timestamp,
                    case when ? = 'DRAFT' then null else current_timestamp end)
                returning activity_id
                """, Long.class, eventId, locationId, proposalId, title,
                Timestamp.from(start), Timestamp.from(start.plus(Duration.ofHours(1))), status,
                status);
    }

    private long insertChangeRequest(long activityId, String requestedTitle, String status) {
        return jdbc.queryForObject("""
                insert into activity_requests(
                    activity_id, request_type, requested_title, reason, status,
                    submitted_at, handled_at)
                values (?, 'CHANGE', ?, 'A valid request reason for review.', ?,
                    current_timestamp,
                    case when ? in ('APPROVED', 'REJECTED') then current_timestamp else null end)
                returning activity_request_id
                """, Long.class, activityId, requestedTitle, status, status);
    }

    private long insertCancellationRequest(long activityId, String reason, boolean late,
            String status) {
        return jdbc.queryForObject("""
                insert into activity_requests(
                    activity_id, request_type, reason, is_late, status,
                    review_note, submitted_at, handled_at)
                values (?, 'CANCELLATION', ?, ?, ?,
                    case when ? = 'REJECTED' then 'A valid rejection note.' else null end,
                    current_timestamp,
                    case when ? in ('APPROVED', 'REJECTED') then current_timestamp else null end)
                returning activity_request_id
                """, Long.class, activityId, reason, late, status, status, status);
    }

    private String activityStatus(long activityId) {
        return jdbc.queryForObject("select status from activities where activity_id = ?",
                String.class, activityId);
    }

    private String requestStatus(long requestId) {
        return jdbc.queryForObject(
                "select status from activity_requests where activity_request_id = ?",
                String.class, requestId);
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
                """, Long.class, "organizer-request-" + suffix, prefix + " " + name,
                "organizer-request-" + suffix + "@example.test");
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
