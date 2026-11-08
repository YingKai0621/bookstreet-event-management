package com.swp391.bookstreet.notification;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.swp391.bookstreet.attendance.service.ActivityStartingSoonReminderService;
import com.swp391.bookstreet.booth.service.BoothHoldExpiryService;
import com.swp391.bookstreet.payment.gateway.VnPayResult;
import com.swp391.bookstreet.payment.service.PaymentSettlementService;
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
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest(properties = {
        "spring.datasource.url=${EVENT_TEST_DATABASE_URL}",
        "logging.level.org.springframework.security=ERROR"
})
@EnabledIfEnvironmentVariable(named = "EVENT_TEST_DATABASE_URL", matches = ".+")
@ContextConfiguration(initializers = RoleScopedNotificationIntegrationTests.TestDatabaseGuard.class)
class NotificationAmendmentIntegrationTests {

    @Autowired WebApplicationContext context;
    @Autowired JdbcTemplate jdbc;
    @Autowired BoothHoldExpiryService holds;
    @Autowired PaymentSettlementService settlement;
    @Autowired ActivityStartingSoonReminderService activityReminders;

    private MockMvc mvc;
    private String prefix;
    private long organizer;
    private long partner;
    private long participant;
    private long eventId;
    private long organizationId;

    @BeforeEach
    void setUp() {
        assertThat(jdbc.queryForObject("select current_database()", String.class))
                .endsWith("_event_test");
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        prefix = "A" + UUID.randomUUID().toString().replace("-", "").substring(0, 8).toUpperCase();
        organizer = insertUser("Organizer");
        partner = insertUser("Partner");
        participant = insertUser("Participant");
        eventId = insertEvent("PUBLISHED");
        organizationId = insertOrganization(partner, "ACTIVE");
    }

    @AfterEach
    void cleanUp() {
        jdbc.update("delete from notifications where recipient_user_id in (?, ?, ?)",
                organizer, partner, participant);
        jdbc.update("delete from notifications where event_id in "
                + "(select event_id from events where organizer_user_id = ?)", organizer);
        jdbc.update("delete from notifications where activity_id in "
                + "(select activity_id from activities where event_id in "
                + "(select event_id from events where organizer_user_id = ?))", organizer);
        jdbc.update("delete from activity_registrations where activity_id in "
                + "(select activity_id from activities where event_id in "
                + "(select event_id from events where organizer_user_id = ?))", organizer);
        jdbc.update("delete from event_registrations where event_id in "
                + "(select event_id from events where organizer_user_id = ?)", organizer);
        jdbc.update("delete from activities where event_id in "
                + "(select event_id from events where organizer_user_id = ?)", organizer);
        jdbc.update("""
                delete from booth_assignments where booth_hold_id in (
                    select hold.booth_hold_id from booth_holds hold
                    join event_booth_configs config
                      on config.event_booth_config_id = hold.event_booth_config_id
                    where config.event_id = ?)
                """, eventId);
        jdbc.update("""
                delete from booth_payments where booth_hold_id in (
                    select hold.booth_hold_id from booth_holds hold
                    join event_booth_configs config
                      on config.event_booth_config_id = hold.event_booth_config_id
                    where config.event_id = ?)
                """, eventId);
        jdbc.update("""
                delete from booth_holds where event_booth_config_id in (
                    select event_booth_config_id from event_booth_configs where event_id = ?)
                """, eventId);
        jdbc.update("""
                delete from booth_requests where application_id in (
                    select application_id from partner_event_applications where event_id = ?)
                """, eventId);
        jdbc.update("delete from event_booth_configs where event_id = ?", eventId);
        jdbc.update("delete from partner_event_applications where event_id = ?", eventId);
        jdbc.update("delete from events where organizer_user_id = ?", organizer);
        jdbc.update("delete from booths where booth_id in "
                + "(select location_id from locations where code like ?)", prefix + "%");
        jdbc.update("delete from locations where code like ?", prefix + "%");
        jdbc.update("delete from partner_organizations where representative_user_id in (?, ?)",
                partner, organizer);
        jdbc.update("delete from users where user_id in (?, ?, ?)", organizer, partner, participant);
    }

    @Test
    void publishingAnEventNotifiesActiveRepresentativesOnly() throws Exception {
        long inactivePartner = insertUser("Inactive Partner");
        long inactiveOrganization = insertOrganization(inactivePartner, "INACTIVE");
        insertOrganization(organizer, "ACTIVE");
        long draftId = insertEvent("DRAFT");
        try {
            mvc.perform(post("/api/v1/organizer/events/{id}/publish", draftId)
                            .with(identity(organizer, "ORGANIZER")).with(csrf()))
                    .andExpect(status().isOk());

            assertThat(partnerEventRows(partner, draftId)).isOne();
            assertThat(partnerEventRows(inactivePartner, draftId)).isZero();
            assertThat(partnerEventRows(organizer, draftId)).isZero();
            mvc.perform(get("/api/v1/partner/notifications")
                            .param("type", "PARTNER_EVENT_PUBLISHED")
                            .with(identity(partner, "PARTNER")))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.content[0].referenceType").value("EVENT"))
                    .andExpect(jsonPath("$.content[0].referenceId").value(draftId))
                    .andExpect(jsonPath("$.content[0].contextEventId").value(draftId));
        } finally {
            jdbc.update("delete from partner_organizations where partner_organization_id = ?",
                    inactiveOrganization);
            jdbc.update("delete from users where user_id = ?", inactivePartner);
        }
    }

    @Test
    void holdReminderIsSentOnceInsideTheWindow() {
        SelectedBooth booth = insertSelectedBooth("A1");
        Instant now = Instant.now();
        setHoldTimes(booth, now.minus(Duration.ofHours(10)), now.plus(Duration.ofHours(1)));

        holds.remindExpiringHolds(now);
        holds.remindExpiringHolds(now.plusSeconds(60));

        assertThat(rows(partner, "PARTNER", "PARTNER_BOOTH_HOLD_EXPIRING", "booth_request_id",
                booth.requestId())).isOne();
    }

    @Test
    void holdReminderSkipsAnInactivePartnerOrganization() {
        SelectedBooth booth = insertSelectedBooth("A2");
        Instant now = Instant.now();
        setHoldTimes(booth, now.minus(Duration.ofHours(10)), now.plus(Duration.ofHours(1)));
        jdbc.update("update partner_organizations set status = 'INACTIVE' where partner_organization_id = ?",
                organizationId);

        holds.remindExpiringHolds(now);

        assertThat(rows(partner, "PARTNER", "PARTNER_BOOTH_HOLD_EXPIRING", "booth_request_id",
                booth.requestId())).isZero();
    }

    @Test
    void holdReminderSkipsFarShortAndBlockedHolds() {
        Instant now = Instant.now();
        SelectedBooth far = insertSelectedBooth("B1");
        setHoldTimes(far, now.minus(Duration.ofHours(1)), now.plus(Duration.ofHours(20)));
        SelectedBooth shortLived = insertSelectedBooth("B2");
        setHoldTimes(shortLived, now.minus(Duration.ofMinutes(10)), now.plus(Duration.ofMinutes(50)));
        SelectedBooth paying = insertSelectedBooth("B3");
        setHoldTimes(paying, now.minus(Duration.ofHours(10)), now.plus(Duration.ofHours(1)));
        insertPayment(paying.holdId());

        holds.remindExpiringHolds(now);

        assertThat(jdbc.queryForObject("select count(*) from notifications where "
                + "recipient_user_id = ? and notification_type = 'PARTNER_BOOTH_HOLD_EXPIRING'",
                Integer.class, partner)).isZero();
    }

    @Test
    void trustedSettlementNotifiesTheEventOrganizerOnce() {
        SelectedBooth booth = insertSelectedBooth("C1");
        long paymentId = insertPayment(booth.holdId());
        VnPayResult success = new VnPayResult(true, "BSP" + paymentId, "1000000", "00", "00",
                "AMD" + paymentId, "trusted success");

        assertThat(settlement.acceptIpn(success, Instant.now()).rspCode()).isEqualTo("00");
        settlement.acceptIpn(success, Instant.now());

        assertThat(rows(organizer, "ORGANIZER", "ORGANIZER_BOOTH_PAYMENT_CONFIRMED",
                "booth_request_id", booth.requestId())).isOne();
    }

    @Test
    void activityReminderReachesActiveRegistrationsOncePerStartTime() {
        Instant start = Instant.now().plus(Duration.ofHours(6));
        long activityId = insertActivity(start);
        long eventRegistration = insertEventRegistration();
        insertActivityRegistration(eventRegistration, activityId, "ACTIVE");
        long cancelledUser = insertUser("Cancelled Participant");
        long cancelledRegistration = insertEventRegistration(cancelledUser);
        insertActivityRegistration(cancelledRegistration, activityId, "CANCELLED");
        try {
            Instant now = Instant.now();
            activityReminders.remindStartingSoon(now);
            activityReminders.remindStartingSoon(now.plusSeconds(60));

            assertThat(rows(participant, "PARTICIPANT", "ACTIVITY_STARTING_SOON", "activity_id", activityId))
                    .isOne();
            assertThat(rows(cancelledUser, "PARTICIPANT", "ACTIVITY_STARTING_SOON", "activity_id", activityId))
                    .isZero();

            Instant rescheduled = start.plus(Duration.ofHours(2));
            jdbc.update("update activities set start_at = ?, end_at = ? where activity_id = ?",
                    Timestamp.from(rescheduled), Timestamp.from(rescheduled.plus(Duration.ofHours(1))),
                    activityId);
            activityReminders.remindStartingSoon(now.plusSeconds(120));
            assertThat(rows(participant, "PARTICIPANT", "ACTIVITY_STARTING_SOON", "activity_id", activityId))
                    .isEqualTo(2);
        } finally {
            jdbc.update("delete from activity_registrations where event_registration_id = ?", cancelledRegistration);
            jdbc.update("delete from event_registrations where event_registration_id = ?", cancelledRegistration);
            jdbc.update("delete from users where user_id = ?", cancelledUser);
        }
    }

    @Test
    void activityReminderIgnoresActivitiesOutsideTheWindow() {
        long activityId = insertActivity(Instant.now().plus(Duration.ofDays(3)));
        insertActivityRegistration(insertEventRegistration(), activityId, "ACTIVE");

        activityReminders.remindStartingSoon(Instant.now());

        assertThat(rows(participant, "PARTICIPANT", "ACTIVITY_STARTING_SOON", "activity_id", activityId))
                .isZero();
    }

    @Test
    void databaseRejectsNewTypesWithTheWrongRoleOrReference() {
        SelectedBooth booth = insertSelectedBooth("D1");

        assertThatThrownBy(() -> insertNotification(partner, "PARTNER", "PARTNER_EVENT_PUBLISHED",
                "booth_request_id", booth.requestId()))
                .isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(() -> insertNotification(partner, "PARTICIPANT", "PARTNER_BOOTH_HOLD_EXPIRING",
                "booth_request_id", booth.requestId()))
                .isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(() -> insertNotification(organizer, "ORGANIZER", "ORGANIZER_BOOTH_PAYMENT_CONFIRMED",
                "event_id", eventId))
                .isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(() -> insertNotification(participant, "PARTICIPANT", "ACTIVITY_STARTING_SOON",
                "event_id", eventId))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    private int partnerEventRows(long recipient, long event) {
        return rows(recipient, "PARTNER", "PARTNER_EVENT_PUBLISHED", "event_id", event);
    }

    private int rows(long recipient, String role, String type, String column, long reference) {
        return jdbc.queryForObject("select count(*) from notifications where recipient_user_id = ? "
                + "and recipient_role = ? and notification_type = ? and " + column + " = ?",
                Integer.class, recipient, role, type, reference);
    }

    private void insertNotification(long recipient, String role, String type, String column, long reference) {
        jdbc.update("insert into notifications(recipient_user_id, recipient_role, notification_type, "
                + column + ", deduplication_key, title, message, created_at) "
                + "values (?, ?, ?, ?, ?, 'Title', 'Message', current_timestamp)",
                recipient, role, type, reference, UUID.randomUUID().toString());
    }

    private long insertUser(String label) {
        String username = "nam" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        return jdbc.queryForObject("""
                insert into users(username, password_hash, full_name, email,
                    email_verified_at, status)
                values (?, 'unused-hash', ?, ?, current_timestamp, 'ACTIVE') returning user_id
                """, Long.class, username, label + " Amendment Test", username + "@example.test");
    }

    private long insertOrganization(long representative, String status) {
        return jdbc.queryForObject("""
                insert into partner_organizations(representative_user_id, name, category_code,
                    status, created_at, updated_at)
                values (?, ?, 'PUBLISHER', ?, current_timestamp, current_timestamp)
                returning partner_organization_id
                """, Long.class, representative, prefix + UUID.randomUUID(), status);
    }

    private long insertEvent(String status) {
        Instant start = Instant.now().plus(Duration.ofDays(30));
        Instant partnerDeadline = Instant.now().plus(Duration.ofDays(5));
        Instant laterDeadline = Instant.now().plus(Duration.ofDays(15));
        return jdbc.queryForObject("""
                insert into events(organizer_user_id, name, description, start_at, end_at,
                    partner_application_deadline_at, participant_registration_deadline_at,
                    booth_request_deadline_at, activity_proposal_deadline_at,
                    booth_payment_window_minutes, max_booths_per_partner,
                    max_activities_per_partner, status, created_at, updated_at)
                values (?, ?, 'Amendment test', ?, ?, ?, ?, ?, ?, 60, 2, 2, ?,
                    current_timestamp, current_timestamp) returning event_id
                """, Long.class, organizer, prefix + " Event " + status, Timestamp.from(start),
                Timestamp.from(start.plus(Duration.ofDays(2))), Timestamp.from(partnerDeadline),
                Timestamp.from(laterDeadline), Timestamp.from(laterDeadline),
                Timestamp.from(laterDeadline), status);
    }

    private long insertLocation(String suffix, String type) {
        return jdbc.queryForObject("""
                insert into locations(code, name, max_capacity, is_active, location_type,
                    created_at, updated_at)
                values (?, 'Amendment Location', 100, true, ?, current_timestamp, current_timestamp)
                returning location_id
                """, Long.class, prefix + suffix, type);
    }

    private SelectedBooth insertSelectedBooth(String suffix) {
        long applicationId = jdbc.queryForObject("""
                insert into partner_event_applications(partner_organization_id, event_id,
                    status, submitted_at, reviewed_at)
                values (?, ?, 'APPROVED', current_timestamp, current_timestamp)
                on conflict (partner_organization_id, event_id) do update set status = excluded.status
                returning application_id
                """, Long.class, organizationId, eventId);
        long locationId = insertLocation(suffix, "BOOTH");
        jdbc.update("insert into booths(booth_id, category_code) values (?, 'PUBLISHER')", locationId);
        long configId = jdbc.queryForObject("""
                insert into event_booth_configs(event_id, booth_id, rental_price, is_enabled)
                values (?, ?, 10000, true) returning event_booth_config_id
                """, Long.class, eventId, locationId);
        long requestId = jdbc.queryForObject("""
                insert into booth_requests(application_id, booth_id, status, submitted_at,
                    reviewed_at, selected_at)
                values (?, ?, 'SELECTED', current_timestamp, current_timestamp, current_timestamp)
                returning booth_request_id
                """, Long.class, applicationId, locationId);
        long holdId = jdbc.queryForObject("""
                insert into booth_holds(event_booth_config_id, booth_request_id,
                    locked_rental_price, status, created_at, expires_at)
                values (?, ?, 10000, 'ACTIVE', current_timestamp, current_timestamp + interval '30 min')
                returning booth_hold_id
                """, Long.class, configId, requestId);
        return new SelectedBooth(requestId, holdId);
    }

    private void setHoldTimes(SelectedBooth booth, Instant createdAt, Instant expiresAt) {
        jdbc.update("update booth_holds set created_at = ?, expires_at = ? where booth_hold_id = ?",
                Timestamp.from(createdAt), Timestamp.from(expiresAt), booth.holdId());
    }

    private long insertPayment(long holdId) {
        return jdbc.queryForObject("""
                insert into booth_payments(booth_hold_id, transaction_type, purpose, amount,
                    status, idempotency_key, gateway_provider, created_at, updated_at)
                values (?, 'PAYMENT', 'INITIAL_BOOTH_RENTAL', 10000, 'PENDING', ?, 'VNPAY',
                    current_timestamp, current_timestamp) returning booth_payment_id
                """, Long.class, holdId, UUID.randomUUID());
    }

    private long insertActivity(Instant start) {
        Instant created = Instant.now().minus(Duration.ofDays(1));
        return jdbc.queryForObject("""
                insert into activities(event_id, location_id, title, activity_type, start_at, end_at,
                    registration_required, registration_deadline_at, capacity, attendance_qr_token,
                    is_certificate_enabled, status, created_at, updated_at, published_at)
                values (?, ?, 'Reminder Activity', 'TALKSHOW', ?, ?, true, ?, 50, ?, false,
                    'PUBLISHED', ?, ?, ?)
                returning activity_id
                """, Long.class, eventId, insertLocation("S1", "STAGE"),
                Timestamp.from(start), Timestamp.from(start.plus(Duration.ofHours(1))),
                Timestamp.from(start.minus(Duration.ofHours(1))), UUID.randomUUID(),
                Timestamp.from(created), Timestamp.from(created), Timestamp.from(created));
    }

    private long insertEventRegistration() {
        return insertEventRegistration(participant);
    }

    private long insertEventRegistration(long userId) {
        return jdbc.queryForObject("""
                insert into event_registrations(user_id, event_id, status, registered_at,
                    activated_at, updated_at)
                values (?, ?, 'ACTIVE', current_timestamp, current_timestamp, current_timestamp)
                returning event_registration_id
                """, Long.class, userId, eventId);
    }

    private void insertActivityRegistration(long eventRegistration, long activityId, String status) {
        jdbc.update("""
                insert into activity_registrations(event_registration_id, activity_id, status,
                    registered_at, activated_at, updated_at, cancelled_at, cancellation_source)
                values (?, ?, ?, current_timestamp, current_timestamp, current_timestamp,
                    case when ? = 'CANCELLED' then current_timestamp end,
                    case when ? = 'CANCELLED' then 'PARTICIPANT' end)
                """, eventRegistration, activityId, status, status, status);
    }

    private static RequestPostProcessor identity(long userId, String role) {
        return authentication(UsernamePasswordAuthenticationToken.authenticated(
                new Identity(userId), null, List.of(new SimpleGrantedAuthority("ROLE_" + role))));
    }

    private record SelectedBooth(long requestId, long holdId) { }

    private record Identity(Long userId) implements AuthenticatedPrincipal {
        @Override public boolean emailVerified() { return true; }
    }
}
