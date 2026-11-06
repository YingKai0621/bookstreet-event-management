package com.swp391.bookstreet.event;

import com.swp391.bookstreet.activity.service.ActivityPartnerMailService;
import com.swp391.bookstreet.activity.service.ActivityPartnerMessageType;
import com.swp391.bookstreet.event.service.EventCancellationMailService;
import com.swp391.bookstreet.event.service.EventLifecycleService;
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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
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
@ContextConfiguration(initializers = EventActivityCascadeIntegrationTests.TestDatabaseGuard.class)
class EventActivityCascadeIntegrationTests {
    private static final String EVENTS = "/api/v1/organizer/events";

    static class TestDatabaseGuard
            implements ApplicationContextInitializer<ConfigurableApplicationContext> {
        @Override
        public void initialize(ConfigurableApplicationContext context) {
            String url = context.getEnvironment().getRequiredProperty("spring.datasource.url");
            if (!url.matches("jdbc:postgresql://[^/]+/[A-Za-z0-9_]+_event_test(?:\\?.*)?")) {
                throw new IllegalStateException("Event cascade tests require *_event_test DB.");
            }
        }
    }

    @Autowired WebApplicationContext context;
    @Autowired JdbcTemplate jdbc;
    @Autowired EventLifecycleService lifecycleService;
    @MockitoBean EventCancellationMailService cancellationMailService;
    @MockitoBean ActivityPartnerMailService partnerMailService;

    private MockMvc mvc;
    private long organizerId;
    private long partnerUserId;
    private long partnerOrganizationId;
    private String prefix;

    @BeforeEach
    void setup() {
        assertThat(jdbc.queryForObject("select current_database()", String.class))
                .endsWith("_event_test");
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        prefix = ("EAC" + UUID.randomUUID().toString().replace("-", "").substring(0, 10))
                .toUpperCase();
        organizerId = insertUser("organizer");
        partnerUserId = insertUser("partner");
        partnerOrganizationId = jdbc.queryForObject("""
                insert into partner_organizations(
                    representative_user_id, name, category_code, status, created_at, updated_at)
                values (?, ?, 'PUBLISHER', 'ACTIVE', current_timestamp, current_timestamp)
                returning partner_organization_id
                """, Long.class, partnerUserId, prefix + " Partner");
    }

    @AfterEach
    void cleanup() {
        jdbc.update("delete from notifications where recipient_role = 'PARTNER'");
        jdbc.update("delete from notifications where event_id in "
                + "(select event_id from events where organizer_user_id = ?)", organizerId);
        jdbc.update("delete from attendances where activity_registration_id in "
                + "(select activity_registration_id from activity_registrations where "
                + "event_registration_id in (select event_registration_id from "
                + "event_registrations where event_id in (select event_id from events "
                + "where organizer_user_id = ?)))", organizerId);
        jdbc.update("delete from activity_registrations where event_registration_id in "
                + "(select event_registration_id from event_registrations where event_id in "
                + "(select event_id from events where organizer_user_id = ?))", organizerId);
        jdbc.update("delete from event_registrations where event_id in "
                + "(select event_id from events where organizer_user_id = ?)", organizerId);
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
        jdbc.update("delete from booths where booth_id in "
                + "(select location_id from locations where code like ?)", prefix + "%");
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
        jdbc.update("delete from partner_event_applications where event_id in "
                + "(select event_id from events where organizer_user_id = ?)", organizerId);
        jdbc.update("delete from events where organizer_user_id = ?", organizerId);
        jdbc.update("delete from locations where code like ?", prefix + "%");
        jdbc.update("delete from partner_organizations where partner_organization_id = ?",
                partnerOrganizationId);
        jdbc.update("delete from users where user_id in (?, ?)", organizerId, partnerUserId);
    }

    @Test
    void directActivityProtectsDraftDeletionTimeBoundsAndPublishedOperations() throws Exception {
        Instant start = Instant.now().truncatedTo(ChronoUnit.MICROS)
                .plus(Duration.ofDays(4));
        Instant end = start.plus(Duration.ofDays(1));
        long eventId = insertEvent("DRAFT", start, end);
        long locationId = insertLocation("DRAFT", "STAGE", 80);
        insertActivity(eventId, locationId, "DRAFT", start.plusSeconds(3600),
                start.plusSeconds(7200));

        mvc.perform(delete(EVENTS + "/" + eventId)
                        .with(organizer()).with(csrf()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("EVENT_HAS_ACTIVITY_DEPENDENCIES"));
        mvc.perform(patch(EVENTS + "/" + eventId)
                        .with(organizer()).with(csrf())
                        .contentType("application/json")
                        .content("{\"startAt\":\"" + start.plusSeconds(5400) + "\"}"))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.code").value("ACTIVITY_TIME_OUTSIDE_EVENT"));
        assertThat(jdbc.queryForObject("select start_at from events where event_id = ?",
                Instant.class, eventId)).isEqualTo(start);

        mvc.perform(patch(EVENTS + "/" + eventId)
                        .with(organizer()).with(csrf())
                        .contentType("application/json")
                        .content("{\"startAt\":\"" + start.minusSeconds(60) + "\"}"))
                .andExpect(status().isOk());
        jdbc.update("update events set status = 'PUBLISHED' where event_id = ?", eventId);
        mvc.perform(patch(EVENTS + "/" + eventId)
                        .with(organizer()).with(csrf())
                        .contentType("application/json")
                        .content("{\"maxActivitiesPerPartner\":7}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("EVENT_OPERATIONAL_FIELDS_LOCKED"));
    }

    @Test
    void eventCancellationAtomicallyClosesOpenActivityRecordsAndIsIdempotent() throws Exception {
        Instant start = Instant.now().truncatedTo(ChronoUnit.MICROS)
                .plus(Duration.ofDays(2));
        long eventId = insertEvent("PUBLISHED", start, start.plus(Duration.ofDays(1)));
        long locationId = insertLocation("CANCEL", "AREA", 100);
        long applicationId = insertApplication(eventId);
        long proposalId = insertProposal(applicationId, locationId, start.plusSeconds(1800));
        long activityId = insertActivity(eventId, locationId, "PUBLISHED",
                start.plusSeconds(3600), start.plusSeconds(7200));
        long requestId = insertPendingChangeRequest(activityId);
        String reason = "Sự kiện phải hủy vì điều kiện tổ chức không phù hợp.";

        mvc.perform(post(EVENTS + "/" + eventId + "/cancel")
                        .with(organizer()).with(csrf())
                        .contentType("application/json")
                        .content("{\"reason\":\"" + reason + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CANCELLED"));
        assertThat(dbStatus("activity_proposals", "activity_proposal_id", proposalId))
                .isEqualTo("CANCELLED");
        assertThat(dbStatus("activities", "activity_id", activityId)).isEqualTo("CANCELLED");
        assertThat(jdbc.queryForObject("select cancellation_source from activities "
                + "where activity_id = ?", String.class, activityId))
                .isEqualTo("EVENT_CANCELLATION");
        assertThat(dbStatus("activity_requests", "activity_request_id", requestId))
                .isEqualTo("CANCELLED");
        assertThat(jdbc.queryForObject("select count(*) from notifications where "
                + "event_id = ? and recipient_role = 'PARTNER' and notification_type = 'PARTNER_EVENT_CANCELLED'",
                Integer.class, eventId)).isOne();
        assertThat(jdbc.queryForObject("select count(*) from notifications where "
                + "recipient_role = 'PARTNER' and (activity_proposal_id = ? or activity_request_id = ?)",
                Integer.class, proposalId, requestId)).isZero();
        Instant firstCancelledAt = jdbc.queryForObject(
                "select cancelled_at from activities where activity_id = ?",
                Instant.class, activityId);

        mvc.perform(post(EVENTS + "/" + eventId + "/cancel")
                        .with(organizer()).with(csrf())
                        .contentType("application/json")
                        .content("{\"reason\":\"Một lý do hợp lệ khác cho lần gọi lại.\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CANCELLED"));
        assertThat(jdbc.queryForObject("select cancelled_at from activities "
                + "where activity_id = ?", Instant.class, activityId))
                .isEqualTo(firstCancelledAt);
        verifyNoInteractions(partnerMailService);
    }

    @Test
    void paymentBlockerLeavesEventAndActivityRecordsUntouched() throws Exception {
        Instant start = Instant.now().truncatedTo(ChronoUnit.MICROS)
                .plus(Duration.ofDays(2));
        long eventId = insertEvent("PUBLISHED", start, start.plus(Duration.ofDays(1)));
        long activityLocationId = insertLocation("BLOCK-A", "AREA", 100);
        long boothId = insertLocation("BLOCK-B", "BOOTH", 4);
        jdbc.update("insert into booths(booth_id, category_code) values (?, 'PUBLISHER')",
                boothId);
        long applicationId = insertApplication(eventId);
        long proposalId = insertProposal(applicationId, activityLocationId,
                start.plusSeconds(1800));
        long activityId = insertActivity(eventId, activityLocationId, "PUBLISHED",
                start.plusSeconds(3600), start.plusSeconds(7200));
        long activityRequestId = insertPendingChangeRequest(activityId);
        long eventRegistrationId = jdbc.queryForObject("""
                insert into event_registrations(
                    user_id, event_id, status, registered_at, activated_at, updated_at)
                values (?, ?, 'ACTIVE', current_timestamp, current_timestamp, current_timestamp)
                returning event_registration_id
                """, Long.class, partnerUserId, eventId);
        long activityRegistrationId = jdbc.queryForObject("""
                insert into activity_registrations(
                    event_registration_id, activity_id, status,
                    registered_at, activated_at, updated_at)
                values (?, ?, 'ACTIVE', current_timestamp, current_timestamp, current_timestamp)
                returning activity_registration_id
                """, Long.class, eventRegistrationId, activityId);
        long configId = jdbc.queryForObject("""
                insert into event_booth_configs(event_id, booth_id, rental_price, is_enabled)
                values (?, ?, 10000, true)
                returning event_booth_config_id
                """, Long.class, eventId, boothId);
        long boothRequestId = jdbc.queryForObject("""
                insert into booth_requests(
                    application_id, booth_id, status, submitted_at, reviewed_at, selected_at)
                values (?, ?, 'SELECTED', current_timestamp, current_timestamp, current_timestamp)
                returning booth_request_id
                """, Long.class, applicationId, boothId);
        long holdId = jdbc.queryForObject("""
                insert into booth_holds(
                    event_booth_config_id, booth_request_id, locked_rental_price,
                    status, created_at, expires_at)
                values (?, ?, 10000, 'ACTIVE', current_timestamp,
                    current_timestamp + interval '1 hour')
                returning booth_hold_id
                """, Long.class, configId, boothRequestId);
        jdbc.update("""
                insert into booth_payments(
                    booth_hold_id, transaction_type, purpose, amount, status,
                    idempotency_key, gateway_provider)
                values (?, 'PAYMENT', 'INITIAL_BOOTH_RENTAL', 10000, 'PENDING', ?, 'VNPAY')
                """, holdId, UUID.randomUUID());

        mvc.perform(post(EVENTS + "/" + eventId + "/cancel")
                        .with(organizer()).with(csrf())
                        .contentType("application/json")
                        .content("{\"reason\":\"Sự kiện phải hủy vì điều kiện tổ chức không phù hợp.\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("EVENT_PAYMENT_PENDING"));

        assertThat(dbStatus("events", "event_id", eventId)).isEqualTo("PUBLISHED");
        assertThat(dbStatus("activity_proposals", "activity_proposal_id", proposalId))
                .isEqualTo("PENDING");
        assertThat(dbStatus("activities", "activity_id", activityId)).isEqualTo("PUBLISHED");
        assertThat(dbStatus("activity_requests", "activity_request_id", activityRequestId))
                .isEqualTo("PENDING");
        assertThat(dbStatus("booth_requests", "booth_request_id", boothRequestId))
                .isEqualTo("SELECTED");
        assertThat(dbStatus("activity_registrations", "activity_registration_id",
                activityRegistrationId)).isEqualTo("ACTIVE");
        assertThat(jdbc.queryForObject(
                "select count(*) from notifications where event_id = ?",
                Long.class, eventId)).isZero();
    }

    @Test
    void eventCompletionCancelsPrivateWorkAndCompletesPublishedActivityOnce() {
        Instant now = Instant.now().truncatedTo(ChronoUnit.MICROS);
        long eventId = insertEvent("ONGOING", now.minus(Duration.ofHours(3)),
                now.minusSeconds(1));
        long draftLocation = insertLocation("COMPLETE-D", "WORKSHOP", 40);
        long publicLocation = insertLocation("COMPLETE-P", "AREA", 60);
        long applicationId = insertApplication(eventId);
        long proposalId = insertProposal(applicationId, draftLocation,
                now.minus(Duration.ofHours(2)));
        long draftId = insertActivity(eventId, draftLocation, "DRAFT",
                now.minus(Duration.ofHours(2)), now.minus(Duration.ofHours(1)));
        long sourceProposalId = insertApprovedProposal(applicationId, publicLocation,
                now.minus(Duration.ofHours(2)));
        long publishedId = insertActivity(eventId, publicLocation, "PUBLISHED",
                now.minus(Duration.ofHours(2)), now.minus(Duration.ofHours(1)));
        jdbc.update("update activities set source_proposal_id = ? where activity_id = ?",
                sourceProposalId, publishedId);
        long requestId = insertPendingChangeRequest(publishedId);
        long partnerDraftLocation = insertLocation("COMPLETE-X", "STAGE", 30);
        long partnerDraftId = insertActivity(eventId, partnerDraftLocation, "DRAFT",
                now.minus(Duration.ofHours(2)), now.minus(Duration.ofHours(1)));
        jdbc.update("update activities set source_proposal_id = ? where activity_id = ?",
                insertApprovedProposal(applicationId, partnerDraftLocation,
                        now.minus(Duration.ofHours(2))), partnerDraftId);
        long suppressedRequestId = insertPendingChangeRequest(partnerDraftId);

        assertThat(lifecycleService.advanceDueEvents()).isGreaterThanOrEqualTo(1);
        assertThat(dbStatus("events", "event_id", eventId)).isEqualTo("COMPLETED");
        assertThat(dbStatus("activity_proposals", "activity_proposal_id", proposalId))
                .isEqualTo("CANCELLED");
        assertThat(dbStatus("activities", "activity_id", draftId)).isEqualTo("CANCELLED");
        assertThat(jdbc.queryForObject("select cancellation_source from activities "
                + "where activity_id = ?", String.class, draftId)).isEqualTo("SYSTEM");
        assertThat(jdbc.queryForObject("select cancellation_reason from activities "
                + "where activity_id = ?", String.class, draftId))
                .isEqualTo("Sự kiện đã kết thúc trước khi hoạt động được công bố.");
        assertThat(dbStatus("activities", "activity_id", publishedId)).isEqualTo("COMPLETED");
        assertThat(dbStatus("activity_requests", "activity_request_id", requestId))
                .isEqualTo("CANCELLED");
        assertThat(lifecycleService.advanceDueEvents()).isZero();
        assertThat(partnerRows("activity_proposal_id", proposalId,
                "PARTNER_ACTIVITY_PROPOSAL_STATUS_CHANGED")).isOne();
        assertThat(partnerRows("activity_request_id", requestId,
                "PARTNER_ACTIVITY_CHANGE_REQUEST_STATUS_CHANGED")).isOne();
        assertThat(partnerRows("activity_id", partnerDraftId,
                "PARTNER_ACTIVITY_CANCELLED")).isOne();
        assertThat(partnerRows("activity_request_id", suppressedRequestId,
                "PARTNER_ACTIVITY_CHANGE_REQUEST_STATUS_CHANGED")).isZero();
        assertThat(partnerRows("activity_id", draftId, "PARTNER_ACTIVITY_CANCELLED")).isZero();
        verify(partnerMailService, timeout(5000).times(1)).sendMessage(anyString(), argThat(event ->
                event.referenceId().equals(proposalId)
                        && event.messageType()
                        == ActivityPartnerMessageType.PROPOSAL_CLOSED_BY_SYSTEM));
        verify(partnerMailService, timeout(5000).times(1)).sendMessage(anyString(), argThat(event ->
                event.referenceId().equals(requestId)
                        && event.messageType()
                        == ActivityPartnerMessageType.REQUEST_CLOSED_BY_SYSTEM));
    }

    private int partnerRows(String referenceColumn, long referenceId, String type) {
        return jdbc.queryForObject("select count(*) from notifications where " + referenceColumn
                + " = ? and recipient_user_id = ? and recipient_role = 'PARTNER' "
                + "and notification_type = ?", Integer.class, referenceId, partnerUserId, type);
    }

    private long insertUser(String role) {
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 10);
        return jdbc.queryForObject("""
                insert into users(username, password_hash, full_name, email,
                    email_verified_at, status)
                values (?, '{noop}unused', ?, ?, current_timestamp, 'ACTIVE')
                returning user_id
                """, Long.class, role + suffix, prefix + " " + role,
                role + suffix + "@example.test");
    }

    private long insertEvent(String statusValue, Instant start, Instant end) {
        return jdbc.queryForObject("""
                insert into events(
                    organizer_user_id, name, start_at, end_at,
                    booth_payment_window_minutes, max_booths_per_partner,
                    max_activities_per_partner, status, created_at, updated_at)
                values (?, ?, ?, ?, 60, 2, 3, ?, current_timestamp, current_timestamp)
                returning event_id
                """, Long.class, organizerId, prefix + " Event",
                Timestamp.from(start), Timestamp.from(end), statusValue);
    }

    private long insertLocation(String suffix, String type, int capacity) {
        return jdbc.queryForObject("""
                insert into locations(code, name, location_type, max_capacity, is_active,
                    created_at, updated_at)
                values (?, ?, ?, ?, true, current_timestamp, current_timestamp)
                returning location_id
                """, Long.class, prefix + suffix, prefix + " " + suffix, type, capacity);
    }

    private long insertApplication(long eventId) {
        return jdbc.queryForObject("""
                insert into partner_event_applications(
                    partner_organization_id, event_id, status, submitted_at, reviewed_at)
                values (?, ?, 'APPROVED', current_timestamp, current_timestamp)
                returning application_id
                """, Long.class, partnerOrganizationId, eventId);
    }

    private long insertProposal(long applicationId, long locationId, Instant start) {
        return jdbc.queryForObject("""
                insert into activity_proposals(
                    application_id, location_id, title, activity_type,
                    proposed_start_at, proposed_end_at, capacity, status,
                    submitted_at, updated_at)
                values (?, ?, 'Open proposal', 'TALKSHOW', ?, ?, 20, 'PENDING',
                    current_timestamp, current_timestamp)
                returning activity_proposal_id
                """, Long.class, applicationId, locationId, Timestamp.from(start),
                Timestamp.from(start.plusSeconds(1800)));
    }

    private long insertApprovedProposal(long applicationId, long locationId, Instant start) {
        return jdbc.queryForObject("""
                insert into activity_proposals(
                    application_id, location_id, title, activity_type,
                    proposed_start_at, proposed_end_at, capacity, status,
                    submitted_at, updated_at, reviewed_at)
                values (?, ?, 'Approved source proposal', 'TALKSHOW', ?, ?, 20, 'APPROVED',
                    current_timestamp, current_timestamp, current_timestamp)
                returning activity_proposal_id
                """, Long.class, applicationId, locationId, Timestamp.from(start),
                Timestamp.from(start.plusSeconds(1800)));
    }

    private long insertActivity(long eventId, long locationId, String statusValue,
            Instant start, Instant end) {
        boolean published = !statusValue.equals("DRAFT");
        return jdbc.queryForObject("""
                insert into activities(
                    event_id, location_id, title, activity_type, start_at, end_at,
                    registration_required, capacity, is_certificate_enabled, status,
                    created_at, updated_at, published_at)
                values (?, ?, 'Cascade activity', 'TALKSHOW', ?, ?, false, 20, false, ?,
                    current_timestamp, current_timestamp,
                    case when ? then current_timestamp else null end)
                returning activity_id
                """, Long.class, eventId, locationId, Timestamp.from(start),
                Timestamp.from(end), statusValue, published);
    }

    private long insertPendingChangeRequest(long activityId) {
        return jdbc.queryForObject("""
                insert into activity_requests(
                    activity_id, request_type, requested_title, reason, status, submitted_at)
                values (?, 'CHANGE', 'Requested title',
                    'A sufficiently detailed change reason.', 'PENDING', current_timestamp)
                returning activity_request_id
                """, Long.class, activityId);
    }

    private String dbStatus(String table, String idColumn, long id) {
        return jdbc.queryForObject("select status from " + table + " where " + idColumn + " = ?",
                String.class, id);
    }

    private RequestPostProcessor organizer() {
        var principal = new Identity(organizerId, true);
        var token = new UsernamePasswordAuthenticationToken(principal, null,
                List.of(new SimpleGrantedAuthority("ROLE_ORGANIZER")));
        return authentication(token);
    }

    record Identity(Long userId, boolean emailVerified) implements AuthenticatedPrincipal {
    }
}
