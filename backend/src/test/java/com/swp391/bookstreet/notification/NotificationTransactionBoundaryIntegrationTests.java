package com.swp391.bookstreet.notification;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.swp391.bookstreet.booth.service.BoothHoldExpiryTransactions;
import com.swp391.bookstreet.notification.service.NotificationWriter;
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
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest(properties = {
        "spring.datasource.url=${EVENT_TEST_DATABASE_URL}",
        "bookstreet.feedback.throttle-hmac-secret=test-only-secret",
        "logging.level.org.springframework.security=ERROR"
})
@EnabledIfEnvironmentVariable(named = "EVENT_TEST_DATABASE_URL", matches = ".+")
@ContextConfiguration(initializers = RoleScopedNotificationIntegrationTests.TestDatabaseGuard.class)
class NotificationTransactionBoundaryIntegrationTests {

    private static final String WRITE_FAILURE = "notification write failure";

    @Autowired WebApplicationContext context;
    @Autowired JdbcTemplate jdbc;
    @Autowired BoothHoldExpiryTransactions holdExpiry;
    @Autowired PaymentSettlementService settlement;
    @MockitoSpyBean NotificationWriter writer;

    private MockMvc mvc;
    private String prefix;
    private long organizer;
    private long partner;
    private long eventId;
    private long organizationId;

    @BeforeEach
    void setUp() {
        assertThat(jdbc.queryForObject("select current_database()", String.class))
                .endsWith("_event_test");
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        prefix = "N" + UUID.randomUUID().toString().replace("-", "").substring(0, 8).toUpperCase();
        organizer = insertUser("Organizer");
        partner = insertUser("Partner");
        eventId = insertEvent();
        organizationId = jdbc.queryForObject("""
                insert into partner_organizations(representative_user_id, name, category_code,
                    status, created_at, updated_at)
                values (?, ?, 'PUBLISHER', 'ACTIVE', current_timestamp, current_timestamp)
                returning partner_organization_id
                """, Long.class, partner, prefix + " Partner");
    }

    @AfterEach
    void cleanUp() {
        jdbc.update("delete from notifications where recipient_user_id in (?, ?)", organizer, partner);
        jdbc.update("delete from general_feedbacks where event_id = ?", eventId);
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
        jdbc.update("delete from events where event_id = ?", eventId);
        jdbc.update("delete from booths where booth_id in "
                + "(select location_id from locations where code like ?)", prefix + "%");
        jdbc.update("delete from locations where code like ?", prefix + "%");
        jdbc.update("delete from partner_organizations where partner_organization_id = ?", organizationId);
        jdbc.update("delete from users where user_id in (?, ?)", organizer, partner);
    }

    @Test
    void organizerWorkItemFailureRollsBackApplicationSubmission() throws Exception {
        failNotificationWrites();

        assertThatThrownBy(() -> mvc.perform(post("/api/v1/events/{eventId}/applications", eventId)
                        .with(identity(partner, "PARTNER")).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content("{}")))
                .hasRootCauseMessage(WRITE_FAILURE);

        assertThat(jdbc.queryForObject(
                "select count(*) from partner_event_applications where event_id = ?",
                Integer.class, eventId)).isZero();
        assertThat(notificationCount(organizer, "ORGANIZER")).isZero();

        reset(writer);
        mvc.perform(post("/api/v1/events/{eventId}/applications", eventId)
                        .with(identity(partner, "PARTNER")).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isCreated());
        assertThat(notificationCount(organizer, "ORGANIZER")).isOne();
    }

    @Test
    void partnerOutcomeFailureRollsBackApplicationReviewAndRetryCreatesOneRow() throws Exception {
        long applicationId = insertApplication("PENDING");
        failNotificationWrites();

        assertThatThrownBy(() -> mvc.perform(post("/api/v1/organizer/applications/{id}/approve", applicationId)
                        .with(identity(organizer, "ORGANIZER")).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"reviewNote\":\"Accepted\"}")))
                .hasRootCauseMessage(WRITE_FAILURE);

        assertThat(jdbc.queryForObject(
                "select status from partner_event_applications where application_id = ?",
                String.class, applicationId)).isEqualTo("PENDING");
        assertThat(notificationCount(partner, "PARTNER")).isZero();

        reset(writer);
        mvc.perform(post("/api/v1/organizer/applications/{id}/approve", applicationId)
                        .with(identity(organizer, "ORGANIZER")).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"reviewNote\":\"Accepted\"}"))
                .andExpect(status().isOk());
        assertThat(notificationCount(partner, "PARTNER")).isOne();
    }

    @Test
    void partnerOutcomeFailureRollsBackHoldExpiryAndRetryCreatesOneRow() {
        SelectedBooth booth = insertSelectedBooth();
        Instant now = Instant.now();
        jdbc.update("update booth_holds set created_at = ?, expires_at = ? where booth_hold_id = ?",
                Timestamp.from(now.minus(Duration.ofHours(2))),
                Timestamp.from(now.minus(Duration.ofHours(1))), booth.holdId());
        failNotificationWrites();

        assertThatThrownBy(() -> holdExpiry.expire(eventId, now))
                .isInstanceOf(IllegalStateException.class).hasMessage(WRITE_FAILURE);

        assertThat(statusOf("booth_requests", "booth_request_id", booth.requestId())).isEqualTo("SELECTED");
        assertThat(statusOf("booth_holds", "booth_hold_id", booth.holdId())).isEqualTo("ACTIVE");
        assertThat(notificationCount(partner, "PARTNER")).isZero();

        reset(writer);
        assertThat(holdExpiry.expire(eventId, now)).isOne();
        assertThat(statusOf("booth_requests", "booth_request_id", booth.requestId()))
                .isEqualTo("PAYMENT_EXPIRED");
        assertThat(notificationCount(partner, "PARTNER")).isOne();
    }

    @Test
    void partnerOutcomeFailureRollsBackSettlementAndAssignment() {
        SelectedBooth booth = insertSelectedBooth();
        long paymentId = jdbc.queryForObject("""
                insert into booth_payments(booth_hold_id, transaction_type, purpose, amount,
                    status, idempotency_key, gateway_provider, created_at, updated_at)
                values (?, 'PAYMENT', 'INITIAL_BOOTH_RENTAL', 10000, 'PENDING', ?, 'VNPAY',
                    current_timestamp, current_timestamp) returning booth_payment_id
                """, Long.class, booth.holdId(), UUID.randomUUID());
        VnPayResult success = new VnPayResult(true, "BSP" + paymentId, "1000000", "00", "00",
                "N10" + paymentId, "trusted success");
        failNotificationWrites();

        assertThatThrownBy(() -> settlement.acceptIpn(success, Instant.now()))
                .isInstanceOf(IllegalStateException.class).hasMessage(WRITE_FAILURE);

        assertThat(statusOf("booth_payments", "booth_payment_id", paymentId)).isEqualTo("PENDING");
        assertThat(statusOf("booth_requests", "booth_request_id", booth.requestId())).isEqualTo("SELECTED");
        assertThat(statusOf("booth_holds", "booth_hold_id", booth.holdId())).isEqualTo("ACTIVE");
        assertThat(jdbc.queryForObject(
                "select count(*) from booth_assignments where booth_hold_id = ?",
                Integer.class, booth.holdId())).isZero();
        assertThat(notificationCount(partner, "PARTNER")).isZero();

        reset(writer);
        assertThat(settlement.acceptIpn(success, Instant.now()).rspCode()).isEqualTo("00");
        assertThat(settlement.acceptIpn(success, Instant.now()).rspCode()).isEqualTo("02");
        assertThat(statusOf("booth_requests", "booth_request_id", booth.requestId())).isEqualTo("COMPLETED");
        assertThat(notificationCount(partner, "PARTNER")).isOne();
    }

    @Test
    void generalFeedbackSubmissionAndHandlingCreateNoNotification() throws Exception {
        int before = jdbc.queryForObject("select count(*) from notifications", Integer.class);

        mvc.perform(post("/api/v1/public/feedbacks").with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"targetType":"EVENT","eventId":%d,"guestName":"Bạn đọc",
                                 "contactEmail":"reader@example.test",
                                 "message":"Sự kiện được tổ chức rất tốt, cảm ơn ban tổ chức."}
                                """.formatted(eventId)))
                .andExpect(status().isCreated());
        long feedbackId = jdbc.queryForObject(
                "select general_feedback_id from general_feedbacks where event_id = ?",
                Long.class, eventId);
        mvc.perform(post("/api/v1/organizer/feedbacks/{id}/start-handling", feedbackId)
                        .with(identity(organizer, "ORGANIZER")).with(csrf()))
                .andExpect(status().isOk());
        mvc.perform(post("/api/v1/organizer/feedbacks/{id}/resolve", feedbackId)
                        .with(identity(organizer, "ORGANIZER")).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"internalNote\":\"Đã phản hồi nội bộ\"}"))
                .andExpect(status().isOk());

        verifyNoInteractions(writer);
        assertThat(jdbc.queryForObject("select count(*) from notifications", Integer.class))
                .isEqualTo(before);
    }

    private void failNotificationWrites() {
        doThrow(new IllegalStateException(WRITE_FAILURE)).when(writer).write(any());
    }

    private int notificationCount(long recipient, String role) {
        return jdbc.queryForObject(
                "select count(*) from notifications where recipient_user_id = ? and recipient_role = ?",
                Integer.class, recipient, role);
    }

    private String statusOf(String table, String idColumn, long id) {
        return jdbc.queryForObject("select status from " + table + " where " + idColumn + " = ?",
                String.class, id);
    }

    private long insertUser(String label) {
        String username = "ntx" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        return jdbc.queryForObject("""
                insert into users(username, password_hash, full_name, email,
                    email_verified_at, status)
                values (?, 'unused-hash', ?, ?, current_timestamp, 'ACTIVE') returning user_id
                """, Long.class, username, label + " Boundary Test", username + "@example.test");
    }

    private long insertEvent() {
        Instant start = Instant.now().plus(Duration.ofDays(30));
        return jdbc.queryForObject("""
                insert into events(organizer_user_id, name, start_at, end_at,
                    partner_application_deadline_at, booth_request_deadline_at,
                    booth_payment_window_minutes, max_booths_per_partner,
                    max_activities_per_partner, status, created_at, updated_at)
                values (?, ?, ?, ?, ?, ?, 60, 2, 2, 'PUBLISHED',
                    current_timestamp, current_timestamp) returning event_id
                """, Long.class, organizer, prefix + " Event", Timestamp.from(start),
                Timestamp.from(start.plus(Duration.ofDays(2))),
                Timestamp.from(Instant.now().plus(Duration.ofDays(10))),
                Timestamp.from(Instant.now().plus(Duration.ofDays(10))));
    }

    private long insertApplication(String status) {
        return jdbc.queryForObject("""
                insert into partner_event_applications(partner_organization_id, event_id,
                    status, submitted_at, reviewed_at)
                values (?, ?, ?, current_timestamp,
                    case when ? = 'APPROVED' then current_timestamp else null end)
                returning application_id
                """, Long.class, organizationId, eventId, status, status);
    }

    private SelectedBooth insertSelectedBooth() {
        long applicationId = insertApplication("APPROVED");
        long locationId = jdbc.queryForObject("""
                insert into locations(code, name, max_capacity, is_active, location_type,
                    created_at, updated_at)
                values (?, 'Boundary Booth', 8, true, 'BOOTH', current_timestamp, current_timestamp)
                returning location_id
                """, Long.class, prefix + "A1");
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

    private static RequestPostProcessor identity(long userId, String role) {
        return authentication(UsernamePasswordAuthenticationToken.authenticated(
                new Identity(userId), null, List.of(new SimpleGrantedAuthority("ROLE_" + role))));
    }

    private record SelectedBooth(long requestId, long holdId) { }

    private record Identity(Long userId) implements AuthenticatedPrincipal {
        @Override public boolean emailVerified() { return true; }
    }
}
