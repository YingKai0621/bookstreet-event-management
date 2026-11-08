package com.swp391.bookstreet.payment;

import com.swp391.bookstreet.booth.service.BoothSelectionMailService;
import com.swp391.bookstreet.booth.service.BoothHoldExpiryService;
import com.swp391.bookstreet.event.service.EventCancellationMailService;
import com.swp391.bookstreet.payment.gateway.VnPayCheckout;
import com.swp391.bookstreet.payment.gateway.VnPayGateway;
import com.swp391.bookstreet.payment.gateway.VnPayGatewayException;
import com.swp391.bookstreet.payment.gateway.VnPayResult;
import com.swp391.bookstreet.payment.service.PaymentSettlementService;
import com.swp391.bookstreet.payment.service.VnPayReconciliationWorker;
import com.swp391.bookstreet.security.authentication.AuthenticatedPrincipal;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
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
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.context.WebApplicationContext;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;

@SpringBootTest(properties = {
        "spring.datasource.url=${EVENT_TEST_DATABASE_URL}",
        "logging.level.root=ERROR",
        "bookstreet.booth.hold-expiry-initial-delay-ms=3600000",
        "bookstreet.booth.hold-expiry-delay-ms=3600000",
        "VNPAY_RECONCILIATION_INITIAL_DELAY_MS=3600000",
        "VNPAY_RECONCILIATION_FIXED_DELAY_MS=3600000"
})
@EnabledIfEnvironmentVariable(named = "EVENT_TEST_DATABASE_URL", matches = ".+")
@ContextConfiguration(initializers = PaymentSprint03IntegrationTests.TestDatabaseGuard.class)
class PaymentSprint03IntegrationTests {
    static class TestDatabaseGuard
            implements ApplicationContextInitializer<ConfigurableApplicationContext> {
        @Override
        public void initialize(ConfigurableApplicationContext applicationContext) {
            String url = applicationContext.getEnvironment()
                    .getRequiredProperty("spring.datasource.url");
            if (!url.matches("jdbc:postgresql://[^/]+/[A-Za-z0-9_]+_event_test(?:\\?.*)?")) {
                throw new IllegalStateException(
                        "Sprint 3 payment tests require a dedicated *_event_test database.");
            }
        }
    }

    @Autowired WebApplicationContext context;
    @Autowired JdbcTemplate jdbc;
    @Autowired ObjectMapper mapper;
    @Autowired PaymentSettlementService settlementService;
    @Autowired VnPayReconciliationWorker reconciliationWorker;
    @Autowired BoothHoldExpiryService expiryService;
    @Autowired PlatformTransactionManager transactionManager;
    @MockitoBean VnPayGateway gateway;
    @MockitoBean BoothSelectionMailService mailService;
    @MockitoBean EventCancellationMailService eventCancellationMailService;

    private MockMvc mvc;
    private Long organizer;
    private Long partner;
    private String prefix;

    @BeforeEach
    void setUp() {
        assertThat(jdbc.queryForObject("select current_database()", String.class))
                .endsWith("_event_test");
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        organizer = insertUser("Organizer");
        partner = insertUser("Partner");
        prefix = "P" + UUID.randomUUID().toString().replace("-", "")
                .substring(0, 8).toUpperCase();
        reset(gateway, mailService, eventCancellationMailService);
    }

    @AfterEach
    void cleanUp() {
        jdbc.update("delete from notifications where recipient_user_id in (?, ?)",
                organizer, partner);
        jdbc.update("""
                delete from booth_assignments where booth_hold_id in (
                    select hold.booth_hold_id from booth_holds hold
                    join booth_requests request on request.booth_request_id = hold.booth_request_id
                    join partner_event_applications application
                      on application.application_id = request.application_id
                    where application.event_id in (
                        select event_id from events where organizer_user_id = ?))
                """, organizer);
        jdbc.update("""
                delete from booth_payments where booth_hold_id in (
                    select hold.booth_hold_id from booth_holds hold
                    join booth_requests request on request.booth_request_id = hold.booth_request_id
                    join partner_event_applications application
                      on application.application_id = request.application_id
                    where application.event_id in (
                        select event_id from events where organizer_user_id = ?))
                """, organizer);
        jdbc.update("""
                delete from booth_holds where booth_request_id in (
                    select request.booth_request_id from booth_requests request
                    join partner_event_applications application
                      on application.application_id = request.application_id
                    where application.event_id in (
                        select event_id from events where organizer_user_id = ?))
                """, organizer);
        jdbc.update("delete from booth_requests where application_id in "
                + "(select application_id from partner_event_applications where event_id in "
                + "(select event_id from events where organizer_user_id = ?))", organizer);
        jdbc.update("delete from event_booth_configs where event_id in "
                + "(select event_id from events where organizer_user_id = ?)", organizer);
        jdbc.update("delete from partner_event_applications where event_id in "
                + "(select event_id from events where organizer_user_id = ?)", organizer);
        jdbc.update("delete from events where organizer_user_id = ?", organizer);
        jdbc.update("delete from booths where booth_id in "
                + "(select location_id from locations where code like ?)", prefix + "%");
        jdbc.update("delete from locations where code like ?", prefix + "%");
        jdbc.update("delete from partner_organizations where representative_user_id = ?", partner);
        jdbc.update("delete from users where user_id in (?, ?)", organizer, partner);
    }

    @Test
    void freeBoothSelectionConsumesHoldAndCreatesAssignmentWithoutPayment() throws Exception {
        Fixture fixture = fixture(0, "PENDING");

        mvc.perform(post("/api/v1/organizer/events/{eventId}/booth-requests/{requestId}/select",
                        fixture.eventId(), fixture.requestId())
                        .with(identity(organizer, "ORGANIZER")).with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("COMPLETED"))
                .andExpect(jsonPath("$.hold.status").value("CONSUMED"));

        assertThat(jdbc.queryForObject("""
                select count(*) from booth_assignments assignment
                join booth_holds hold on hold.booth_hold_id = assignment.booth_hold_id
                where hold.booth_request_id = ?
                """, Integer.class, fixture.requestId())).isEqualTo(1);
        assertThat(jdbc.queryForObject("select count(*) from notifications where "
                + "booth_request_id = ? and recipient_user_id = ? and recipient_role = 'PARTNER'",
                Integer.class, fixture.requestId(), partner)).isOne();
        assertThat(jdbc.queryForObject("""
                select count(*) from booth_payments payment
                join booth_holds hold on hold.booth_hold_id = payment.booth_hold_id
                where hold.booth_request_id = ?
                """, Integer.class, fixture.requestId())).isZero();
        mvc.perform(get("/api/v1/partner/booth-requests/{requestId}/assignment",
                        fixture.requestId()).with(identity(partner, "PARTNER")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ACTIVE"))
                .andExpect(jsonPath("$.lockedRentalPrice").value(0));

        mvc.perform(put("/api/v1/organizer/events/{eventId}/booth-configs/{boothId}",
                        fixture.eventId(), fixture.boothId())
                        .with(identity(organizer, "ORGANIZER")).with(csrf())
                        .contentType("application/json")
                        .content("{\"rentalPrice\":0,\"enabled\":false}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("BOOTH_HAS_ACTIVE_ASSIGNMENT"));
        mvc.perform(patch("/api/v1/organizer/booths/{boothId}", fixture.boothId())
                        .with(identity(organizer, "ORGANIZER")).with(csrf())
                        .contentType("application/json").content("{\"active\":false}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("BOOTH_HAS_ACTIVE_ASSIGNMENT"));
    }

    @Test
    void paymentCreationIsIdempotentAndASecondKeyCannotCreateAnotherPendingAttempt()
            throws Exception {
        Fixture fixture = fixture(10_000, "SELECTED");
        insertHold(fixture.configId(), fixture.requestId(), 10_000);
        UUID key = UUID.randomUUID();
        when(gateway.buildCheckout(anyLong(), any(), any(), any(), any()))
                .thenAnswer(invocation -> new VnPayCheckout(
                        "https://sandbox.example/checkout/" + invocation.getArgument(0),
                        invocation.getArgument(4)));

        mvc.perform(post("/api/v1/partner/booth-requests/{requestId}/payments",
                        fixture.requestId()).with(identity(partner, "PARTNER")).with(csrf()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_IDEMPOTENCY_KEY"));

        String firstBody = mvc.perform(post(
                        "/api/v1/partner/booth-requests/{requestId}/payments",
                        fixture.requestId()).header("Idempotency-Key", key.toString())
                        .with(identity(partner, "PARTNER")).with(csrf()))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.payment.status").value("PENDING"))
                .andExpect(jsonPath("$.checkoutUrl").exists())
                .andReturn().getResponse().getContentAsString();
        long paymentId = mapper.readTree(firstBody).get("payment")
                .get("boothPaymentId").asLong();

        mvc.perform(post("/api/v1/partner/booth-requests/{requestId}/payments",
                        fixture.requestId()).header("Idempotency-Key", key.toString())
                        .with(identity(partner, "PARTNER")).with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.payment.boothPaymentId").value(paymentId));
        mvc.perform(post("/api/v1/partner/booth-requests/{requestId}/payments",
                        fixture.requestId()).header("Idempotency-Key", UUID.randomUUID().toString())
                        .with(identity(partner, "PARTNER")).with(csrf()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PAYMENT_ATTEMPT_ALREADY_PENDING"));

        jdbc.update("""
                update partner_organizations set status = 'INACTIVE'
                where partner_organization_id = (
                    select application.partner_organization_id
                    from booth_requests request
                    join partner_event_applications application on application.application_id = request.application_id
                    where request.booth_request_id = ?)
                """, fixture.requestId());
        mvc.perform(post("/api/v1/partner/booth-requests/{requestId}/payments",
                        fixture.requestId()).header("Idempotency-Key", key.toString())
                        .with(identity(partner, "PARTNER")).with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.payment.boothPaymentId").value(paymentId));
        mvc.perform(post("/api/v1/partner/booth-requests/{requestId}/payments",
                        fixture.requestId()).header("Idempotency-Key", UUID.randomUUID().toString())
                        .with(identity(partner, "PARTNER")).with(csrf()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PARTNER_ORGANIZATION_INACTIVE"));

        assertThat(jdbc.queryForObject("select count(*) from booth_payments where booth_hold_id = "
                + "(select booth_hold_id from booth_holds where booth_request_id = ?)",
                Integer.class, fixture.requestId())).isOne();
        verify(gateway).buildCheckout(eq(paymentId), any(), any(), any(), any());
    }

    @Test
    void paymentInitiationAfterEventEndIsRejectedBeforeCreatingAnAttempt()
            throws Exception {
        Fixture fixture = fixture(10_000, "SELECTED");
        insertHold(fixture.configId(), fixture.requestId(), 10_000);
        Instant now = Instant.now();
        jdbc.update("update events set start_at = ?, end_at = ?, status = 'PUBLISHED' "
                        + "where event_id = ?", Timestamp.from(now.minus(Duration.ofHours(2))),
                Timestamp.from(now.minus(Duration.ofHours(1))), fixture.eventId());

        mvc.perform(post("/api/v1/partner/booth-requests/{requestId}/payments",
                        fixture.requestId())
                        .header("Idempotency-Key", UUID.randomUUID().toString())
                        .with(identity(partner, "PARTNER")).with(csrf()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("EVENT_NOT_ACCEPTING_PAYMENTS"));

        assertThat(jdbc.queryForObject("select count(*) from booth_payments payment "
                + "join booth_holds hold on hold.booth_hold_id = payment.booth_hold_id "
                + "where hold.booth_request_id = ?", Integer.class, fixture.requestId()))
                .isZero();
        verify(gateway, times(0)).buildCheckout(anyLong(), any(), any(), any(), any());
    }

    @Test
    void concurrentSameKeyCreationReturnsOneCreatedOneReplayAndOnePayment() throws Exception {
        Fixture fixture = fixture(10_000, "SELECTED");
        insertHold(fixture.configId(), fixture.requestId(), 10_000);
        UUID key = UUID.randomUUID();
        CountDownLatch checkoutStarted = new CountDownLatch(1);
        CountDownLatch releaseCheckout = new CountDownLatch(1);
        when(gateway.buildCheckout(anyLong(), any(), any(), any(), any()))
                .thenAnswer(invocation -> {
                    checkoutStarted.countDown();
                    if (!releaseCheckout.await(5, TimeUnit.SECONDS)) {
                        throw new AssertionError("Concurrent replay did not start in time.");
                    }
                    return new VnPayCheckout(
                            "https://sandbox.example/checkout/" + invocation.getArgument(0),
                            invocation.getArgument(4));
                });

        ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            Future<MvcResult> first = executor.submit(() -> mvc.perform(post(
                            "/api/v1/partner/booth-requests/{requestId}/payments",
                            fixture.requestId()).header("Idempotency-Key", key.toString())
                            .with(identity(partner, "PARTNER")).with(csrf()))
                    .andReturn());
            assertThat(checkoutStarted.await(5, TimeUnit.SECONDS)).isTrue();
            Future<MvcResult> second = executor.submit(() -> mvc.perform(post(
                            "/api/v1/partner/booth-requests/{requestId}/payments",
                            fixture.requestId()).header("Idempotency-Key", key.toString())
                            .with(identity(partner, "PARTNER")).with(csrf()))
                    .andReturn());
            releaseCheckout.countDown();

            assertThat(List.of(first.get(10, TimeUnit.SECONDS).getResponse().getStatus(),
                    second.get(10, TimeUnit.SECONDS).getResponse().getStatus()))
                    .containsExactlyInAnyOrder(201, 200);
        } finally {
            releaseCheckout.countDown();
            executor.shutdownNow();
        }
        assertThat(jdbc.queryForObject("select count(*) from booth_payments payment "
                + "join booth_holds hold on hold.booth_hold_id = payment.booth_hold_id "
                + "where hold.booth_request_id = ?", Integer.class, fixture.requestId()))
                .isOne();
        verify(gateway, times(1)).buildCheckout(anyLong(), any(), any(), any(), any());
    }

    @Test
    void reusingIdempotencyKeyForAnotherRequestIsRejected() throws Exception {
        Fixture first = fixture(10_000, "SELECTED");
        insertHold(first.configId(), first.requestId(), 10_000);
        Fixture second = addSelectedRequest(first.eventId(), first.requestId(), 10_000);
        insertHold(second.configId(), second.requestId(), 10_000);
        UUID key = UUID.randomUUID();
        when(gateway.buildCheckout(anyLong(), any(), any(), any(), any()))
                .thenAnswer(invocation -> new VnPayCheckout(
                        "https://sandbox.example/checkout/" + invocation.getArgument(0),
                        invocation.getArgument(4)));

        mvc.perform(post("/api/v1/partner/booth-requests/{requestId}/payments",
                        first.requestId()).header("Idempotency-Key", key.toString())
                        .with(identity(partner, "PARTNER")).with(csrf()))
                .andExpect(status().isCreated());
        mvc.perform(post("/api/v1/partner/booth-requests/{requestId}/payments",
                        second.requestId()).header("Idempotency-Key", key.toString())
                        .with(identity(partner, "PARTNER")).with(csrf()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("IDEMPOTENCY_KEY_REUSED"));
    }

    @Test
    void verifiedSuccessIpnSettlesAtomicallyAndDuplicateReturnsAlreadyConfirmed()
            throws Exception {
        Fixture fixture = fixture(10_000, "SELECTED");
        insertHold(fixture.configId(), fixture.requestId(), 10_000);
        UUID key = UUID.randomUUID();
        when(gateway.buildCheckout(anyLong(), any(), any(), any(), any()))
                .thenAnswer(invocation -> new VnPayCheckout(
                        "https://sandbox.example/checkout/" + invocation.getArgument(0),
                        invocation.getArgument(4)));
        String body = mvc.perform(post(
                        "/api/v1/partner/booth-requests/{requestId}/payments",
                        fixture.requestId()).header("Idempotency-Key", key.toString())
                        .with(identity(partner, "PARTNER")).with(csrf()))
                .andReturn().getResponse().getContentAsString();
        long paymentId = mapper.readTree(body).get("payment").get("boothPaymentId").asLong();
        when(gateway.parseNotification(any())).thenReturn(new VnPayResult(true,
                "BSP" + paymentId, "1000000", "00", "00", "987654", "success"));

        mvc.perform(get("/api/v1/payments/vnpay/ipn").param("vnp_TxnRef",
                        "BSP" + paymentId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.RspCode").value("00"));

        assertThat(jdbc.queryForObject("select status from booth_payments "
                + "where booth_payment_id = ?", String.class, paymentId)).isEqualTo("SUCCESS");
        assertThat(jdbc.queryForObject("select status from booth_requests "
                + "where booth_request_id = ?", String.class, fixture.requestId()))
                .isEqualTo("COMPLETED");
        assertThat(jdbc.queryForObject("select status from booth_holds "
                + "where booth_request_id = ?", String.class, fixture.requestId()))
                .isEqualTo("CONSUMED");
        assertThat(jdbc.queryForObject("""
                select count(*) from booth_assignments assignment
                join booth_holds hold on hold.booth_hold_id = assignment.booth_hold_id
                where hold.booth_request_id = ?
                """, Integer.class, fixture.requestId())).isOne();
        assertThat(jdbc.queryForObject("select count(*) from notifications where "
                + "booth_request_id = ? and recipient_user_id = ? and recipient_role = 'PARTNER'",
                Integer.class, fixture.requestId(), partner)).isOne();

        mvc.perform(get("/api/v1/payments/vnpay/ipn").param("vnp_TxnRef",
                        "BSP" + paymentId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.RspCode").value("02"));
        assertThat(jdbc.queryForObject("select count(*) from notifications where "
                + "booth_request_id = ? and recipient_role = 'PARTNER'",
                Integer.class, fixture.requestId())).isOne();
        assertThat(jdbc.queryForObject("select count(*) from notifications where "
                + "booth_request_id = ? and recipient_user_id = ? and recipient_role = 'ORGANIZER' "
                + "and notification_type = 'ORGANIZER_BOOTH_PAYMENT_CONFIRMED'",
                Integer.class, fixture.requestId(), organizer)).isOne();
    }

    @Test
    void ipnRejectsInvalidSignatureUnknownOrderAndWrongAmountWithoutMutation()
            throws Exception {
        Fixture fixture = fixture(10_000, "SELECTED");
        insertHold(fixture.configId(), fixture.requestId(), 10_000);
        UUID key = UUID.randomUUID();
        when(gateway.buildCheckout(anyLong(), any(), any(), any(), any()))
                .thenAnswer(invocation -> new VnPayCheckout("https://sandbox.example/checkout",
                        invocation.getArgument(4)));
        String body = mvc.perform(post(
                        "/api/v1/partner/booth-requests/{requestId}/payments",
                        fixture.requestId()).header("Idempotency-Key", key.toString())
                        .with(identity(partner, "PARTNER")).with(csrf()))
                .andReturn().getResponse().getContentAsString();
        long paymentId = mapper.readTree(body).get("payment").get("boothPaymentId").asLong();

        when(gateway.parseNotification(any())).thenReturn(new VnPayResult(false,
                "BSP" + paymentId, "1000000", "00", "00", "1", null));
        mvc.perform(get("/api/v1/payments/vnpay/ipn"))
                .andExpect(jsonPath("$.RspCode").value("97"));

        when(gateway.parseNotification(any())).thenReturn(new VnPayResult(true,
                "BSP999999999", "1000000", "00", "00", "1", null));
        mvc.perform(get("/api/v1/payments/vnpay/ipn"))
                .andExpect(jsonPath("$.RspCode").value("01"));

        when(gateway.parseNotification(any())).thenReturn(new VnPayResult(true,
                "BSP" + paymentId, "1000100", "00", "00", "1", null));
        mvc.perform(get("/api/v1/payments/vnpay/ipn"))
                .andExpect(jsonPath("$.RspCode").value("04"));
        assertThat(jdbc.queryForObject("select status from booth_payments "
                + "where booth_payment_id = ?", String.class, paymentId)).isEqualTo("PENDING");
    }

    @Test
    void gatewaySigningFailureIsDurablyFailedAndANewKeyCanRetry() throws Exception {
        Fixture fixture = fixture(10_000, "SELECTED");
        insertHold(fixture.configId(), fixture.requestId(), 10_000);
        when(gateway.buildCheckout(anyLong(), any(), any(), any(), any()))
                .thenThrow(new VnPayGatewayException("simulated signing failure"))
                .thenAnswer(invocation -> new VnPayCheckout(
                        "https://sandbox.example/checkout/" + invocation.getArgument(0),
                        invocation.getArgument(4)));

        mvc.perform(post("/api/v1/partner/booth-requests/{requestId}/payments",
                        fixture.requestId())
                        .header("Idempotency-Key", UUID.randomUUID().toString())
                        .with(identity(partner, "PARTNER")).with(csrf()))
                .andExpect(status().isBadGateway())
                .andExpect(jsonPath("$.code").value("PAYMENT_GATEWAY_UNAVAILABLE"));
        assertThat(jdbc.queryForObject("select payment.status from booth_payments payment "
                + "join booth_holds hold on hold.booth_hold_id = payment.booth_hold_id "
                + "where hold.booth_request_id = ?", String.class, fixture.requestId()))
                .isEqualTo("FAILED");

        PendingPayment retry = createPendingPayment(fixture.requestId());
        assertThat(retry.paymentId()).isPositive();
        assertThat(jdbc.queryForObject("select count(*) from booth_payments payment "
                + "join booth_holds hold on hold.booth_hold_id = payment.booth_hold_id "
                + "where hold.booth_request_id = ?", Integer.class, fixture.requestId()))
                .isEqualTo(2);
    }

    @Test
    void expiredCheckoutSameKeyReturnsAcceptedAndNewKeyCannotBypassReconciliation()
            throws Exception {
        Fixture fixture = fixture(10_000, "SELECTED");
        insertHold(fixture.configId(), fixture.requestId(), 10_000);
        PendingPayment pending = createPendingPayment(fixture.requestId());
        jdbc.update("update booth_payments set checkout_expires_at = current_timestamp "
                + "- interval '1 second' where booth_payment_id = ?", pending.paymentId());

        mvc.perform(post("/api/v1/partner/booth-requests/{requestId}/payments",
                        fixture.requestId()).header("Idempotency-Key", pending.key().toString())
                        .with(identity(partner, "PARTNER")).with(csrf()))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.payment.boothPaymentId").value(pending.paymentId()))
                .andExpect(jsonPath("$.checkoutUrl").doesNotExist())
                .andExpect(jsonPath("$.resolution").value("RECONCILING"));

        mvc.perform(post("/api/v1/partner/booth-requests/{requestId}/payments",
                        fixture.requestId()).header("Idempotency-Key", UUID.randomUUID().toString())
                        .with(identity(partner, "PARTNER")).with(csrf()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PAYMENT_RESULT_UNKNOWN"));
    }

    @Test
    void verifiedCancellationFailsOnlyTheAttemptAndAllowsRetryWhileHoldIsActive()
            throws Exception {
        Fixture fixture = fixture(10_000, "SELECTED");
        insertHold(fixture.configId(), fixture.requestId(), 10_000);
        PendingPayment pending = createPendingPayment(fixture.requestId());
        VnPayResult cancelled = new VnPayResult(true, "BSP" + pending.paymentId(),
                "1000000", "24", "02", "765432", "customer cancelled");

        assertThat(settlementService.acceptIpn(cancelled, Instant.now()).rspCode())
                .isEqualTo("00");
        assertThat(jdbc.queryForObject("select status from booth_payments "
                + "where booth_payment_id = ?", String.class, pending.paymentId()))
                .isEqualTo("FAILED");
        assertThat(jdbc.queryForObject("select status from booth_holds "
                + "where booth_request_id = ?", String.class, fixture.requestId()))
                .isEqualTo("ACTIVE");

        PendingPayment retry = createPendingPayment(fixture.requestId());
        assertThat(retry.paymentId()).isNotEqualTo(pending.paymentId());

        VnPayResult contradictorySuccess = new VnPayResult(true,
                "BSP" + pending.paymentId(), "1000000", "00", "00", "765435",
                "late contradictory success");
        assertThat(settlementService.acceptIpn(contradictorySuccess, Instant.now()).rspCode())
                .isEqualTo("00");
        assertThat(jdbc.queryForObject("select reconciliation_required from booth_payments "
                + "where booth_payment_id = ?", Boolean.class, pending.paymentId())).isTrue();

        VnPayResult retryCancelled = new VnPayResult(true, "BSP" + retry.paymentId(),
                "1000000", "24", "02", "765436", "customer cancelled retry");
        settlementService.acceptIpn(retryCancelled, Instant.now());
        mvc.perform(post("/api/v1/partner/booth-requests/{requestId}/payments",
                        fixture.requestId()).header("Idempotency-Key", UUID.randomUUID().toString())
                        .with(identity(partner, "PARTNER")).with(csrf()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PAYMENT_RESULT_UNKNOWN"));
    }

    @Test
    void failedPaymentAfterHoldDeadlineCreatesOnePartnerPaymentExpiredOutcome() throws Exception {
        Fixture fixture = fixture(10_000, "SELECTED");
        insertHold(fixture.configId(), fixture.requestId(), 10_000);
        PendingPayment pending = createPendingPayment(fixture.requestId());
        Instant now = Instant.now();
        jdbc.update("update booth_holds set created_at = ?, expires_at = ? "
                        + "where booth_request_id = ?", Timestamp.from(now.minusSeconds(7200)),
                Timestamp.from(now.minusSeconds(3600)), fixture.requestId());
        expiryService.expireDueHolds(now);
        assertRequestAndHold(fixture.requestId(), "SELECTED", "ACTIVE");
        VnPayResult cancelled = new VnPayResult(true, "BSP" + pending.paymentId(),
                "1000000", "24", "02", "765437", "customer cancelled after deadline");

        settlementService.acceptIpn(cancelled, now);
        settlementService.acceptIpn(cancelled, now);
        expiryService.expireDueHolds(now);

        assertRequestAndHold(fixture.requestId(), "PAYMENT_EXPIRED", "EXPIRED");
        assertThat(jdbc.queryForObject("select count(*) from notifications where "
                + "booth_request_id = ? and recipient_user_id = ? and recipient_role = 'PARTNER' "
                + "and notification_type = 'PARTNER_BOOTH_REQUEST_STATUS_CHANGED'",
                Integer.class, fixture.requestId(), partner)).isOne();
    }

    @Test
    void failedPaymentWhileHoldIsActiveCreatesNoPartnerOutcome() throws Exception {
        Fixture fixture = fixture(10_000, "SELECTED");
        insertHold(fixture.configId(), fixture.requestId(), 10_000);
        PendingPayment pending = createPendingPayment(fixture.requestId());
        VnPayResult cancelled = new VnPayResult(true, "BSP" + pending.paymentId(),
                "1000000", "24", "02", "765438", "customer cancelled");

        settlementService.acceptIpn(cancelled, Instant.now());

        assertRequestAndHold(fixture.requestId(), "SELECTED", "ACTIVE");
        assertThat(jdbc.queryForObject("select count(*) from notifications "
                + "where booth_request_id = ?", Integer.class, fixture.requestId())).isZero();
    }

    @Test
    void inconsistentCancellationCallbackRemainsPendingForReconciliation() throws Exception {
        Fixture fixture = fixture(10_000, "SELECTED");
        insertHold(fixture.configId(), fixture.requestId(), 10_000);
        PendingPayment pending = createPendingPayment(fixture.requestId());
        VnPayResult inconsistent = new VnPayResult(true, "BSP" + pending.paymentId(),
                "1000000", "24", "00", "765433", "inconsistent provider result");

        assertThat(settlementService.acceptIpn(inconsistent, Instant.now()).rspCode())
                .isEqualTo("00");
        assertPaymentState(pending.paymentId(), "PENDING", 0, true);
        assertThat(jdbc.queryForObject("select status from booth_holds "
                + "where booth_request_id = ?", String.class, fixture.requestId()))
                .isEqualTo("ACTIVE");

        VnPayResult reversed = new VnPayResult(true, "BSP" + pending.paymentId(),
                "1000000", "00", "04", "765434", "reversed after debit");
        assertThat(settlementService.acceptIpn(reversed, Instant.now()).rspCode())
                .isEqualTo("00");
        assertPaymentState(pending.paymentId(), "PENDING", 0, true);
    }

    @Test
    void orphanedPendingPaymentWithoutCheckoutIsFailedAndCanBeRetried() throws Exception {
        Fixture fixture = fixture(10_000, "SELECTED");
        insertHold(fixture.configId(), fixture.requestId(), 10_000);
        long holdId = jdbc.queryForObject("select booth_hold_id from booth_holds "
                + "where booth_request_id = ?", Long.class, fixture.requestId());
        Instant createdAt = Instant.now().minus(Duration.ofMinutes(10));
        long orphanId = jdbc.queryForObject("""
                insert into booth_payments(booth_hold_id, transaction_type, purpose, amount,
                    status, idempotency_key, gateway_provider, created_at, updated_at)
                values (?, 'PAYMENT', 'INITIAL_BOOTH_RENTAL', 10000, 'PENDING', ?, 'VNPAY',
                    ?, ?) returning booth_payment_id
                """, Long.class, holdId, UUID.randomUUID(), Timestamp.from(createdAt),
                Timestamp.from(createdAt));

        Instant now = Instant.now();
        settlementService.failCheckoutCreationOrphan(orphanId,
                now.minus(Duration.ofMinutes(5)), now);

        assertThat(jdbc.queryForObject("select status from booth_payments "
                + "where booth_payment_id = ?", String.class, orphanId)).isEqualTo("FAILED");
        PendingPayment retry = createPendingPayment(fixture.requestId());
        assertThat(retry.paymentId()).isNotEqualTo(orphanId);
    }

    @Test
    void incompleteCheckoutNeedsTwoTrustedQueriesThenAllowsRetryWhileHoldIsActive()
            throws Exception {
        Fixture fixture = fixture(10_000, "SELECTED");
        insertHold(fixture.configId(), fixture.requestId(), 10_000);
        PendingPayment pending = createPendingPayment(fixture.requestId());
        String txnRef = "BSP" + pending.paymentId();
        VnPayResult incomplete = new VnPayResult(true, txnRef, "1000000",
                "00", "01", "123456", "incomplete");

        assertThat(settlementService.acceptIpn(incomplete, pending.checkoutExpiresAt()))
                .extracting(ack -> ack.rspCode()).isEqualTo("00");
        assertPaymentState(pending.paymentId(), "PENDING", 0, true);

        Instant firstQueryAt = pending.checkoutExpiresAt().plus(Duration.ofMinutes(5))
                .plusSeconds(1);
        settlementService.acceptQuery(pending.paymentId(), incomplete, firstQueryAt);
        assertPaymentState(pending.paymentId(), "PENDING", 1, true);

        settlementService.acceptQuery(pending.paymentId(), incomplete,
                firstQueryAt.plus(Duration.ofMinutes(5)).plusSeconds(1));
        assertPaymentState(pending.paymentId(), "TIMEOUT", 2, false);
        assertThat(jdbc.queryForObject("select status from booth_holds where booth_request_id = ?",
                String.class, fixture.requestId())).isEqualTo("ACTIVE");
        assertThat(jdbc.queryForObject("select status from booth_requests where booth_request_id = ?",
                String.class, fixture.requestId())).isEqualTo("SELECTED");

        createPendingPayment(fixture.requestId());
        assertThat(jdbc.queryForObject("select count(*) from booth_payments payment "
                + "join booth_holds hold on hold.booth_hold_id = payment.booth_hold_id "
                + "where hold.booth_request_id = ?", Integer.class, fixture.requestId()))
                .isEqualTo(2);
    }

    @Test
    void untrustedQueriesKeepPaymentPendingAndPreventDueHoldExpiry() throws Exception {
        Fixture fixture = fixture(10_000, "SELECTED");
        insertHold(fixture.configId(), fixture.requestId(), 10_000);
        PendingPayment pending = createPendingPayment(fixture.requestId());
        VnPayResult mismatched = new VnPayResult(true, "BSP" + pending.paymentId(),
                "1000100", "00", "01", "123456", "mismatched amount");

        Instant firstQueryAt = pending.checkoutExpiresAt().plus(Duration.ofMinutes(5))
                .plusSeconds(1);
        settlementService.acceptQuery(pending.paymentId(), mismatched, firstQueryAt);
        settlementService.acceptQuery(pending.paymentId(), mismatched,
                firstQueryAt.plus(Duration.ofMinutes(5)).plusSeconds(1));

        VnPayResult reversed = new VnPayResult(true, "BSP" + pending.paymentId(),
                "1000000", "00", "04", "123457", "reversed after debit");
        settlementService.acceptQuery(pending.paymentId(), reversed,
                firstQueryAt.plus(Duration.ofMinutes(10)).plusSeconds(2));

        assertPaymentState(pending.paymentId(), "PENDING", 0, true);
        assertThat(jdbc.queryForObject("select provider_transaction_status from booth_payments "
                + "where booth_payment_id = ?", String.class, pending.paymentId()))
                .isEqualTo("04");
        Timestamp holdExpiry = jdbc.queryForObject(
                "select expires_at from booth_holds where booth_request_id = ?",
                Timestamp.class, fixture.requestId());
        assertThat(expiryService.expireDueHolds(holdExpiry.toInstant().plusSeconds(1))).isZero();
        assertThat(jdbc.queryForObject("select status from booth_holds where booth_request_id = ?",
                String.class, fixture.requestId())).isEqualTo("ACTIVE");
    }

    @Test
    void concurrentQueryClaimsAllowOnlyOneProviderCallWindow() throws Exception {
        Fixture fixture = fixture(10_000, "SELECTED");
        insertHold(fixture.configId(), fixture.requestId(), 10_000);
        PendingPayment pending = createPendingPayment(fixture.requestId());
        jdbc.update("update booth_payments set checkout_expires_at = current_timestamp "
                + "- interval '10 minutes' where booth_payment_id = ?", pending.paymentId());
        Instant queryAt = Instant.now();
        CountDownLatch start = new CountDownLatch(1);
        ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            Future<?> first = executor.submit(() -> {
                await(start);
                return settlementService.claimQuery(pending.paymentId(), queryAt);
            });
            Future<?> second = executor.submit(() -> {
                await(start);
                return settlementService.claimQuery(pending.paymentId(), queryAt);
            });
            start.countDown();
            Object firstClaim = first.get(10, TimeUnit.SECONDS);
            Object secondClaim = second.get(10, TimeUnit.SECONDS);
            int successfulClaims = (firstClaim == null ? 0 : 1)
                    + (secondClaim == null ? 0 : 1);
            assertThat(successfulClaims).isOne();
        } finally {
            start.countDown();
            executor.shutdownNow();
        }
    }

    @Test
    void reconciliationWorkerSettlesSuccessWhileEventIsOngoingWithoutNetworkTransaction()
            throws Exception {
        Fixture fixture = fixture(10_000, "SELECTED");
        insertHold(fixture.configId(), fixture.requestId(), 10_000);
        PendingPayment pending = createPendingPayment(fixture.requestId());
        Instant now = Instant.now();
        jdbc.update("update booth_payments set checkout_expires_at = ? "
                        + "where booth_payment_id = ?",
                Timestamp.from(now.minus(Duration.ofMinutes(10))), pending.paymentId());
        jdbc.update("update events set start_at = ?, end_at = ?, status = 'PUBLISHED' "
                        + "where event_id = ?", Timestamp.from(now.minus(Duration.ofHours(1))),
                Timestamp.from(now.plus(Duration.ofHours(1))), fixture.eventId());
        VnPayResult success = new VnPayResult(true, "BSP" + pending.paymentId(),
                "1000000", "00", "00", "999996", "query success during event");
        when(gateway.query(eq(pending.paymentId()), any(), any(), any(), any()))
                .thenAnswer(invocation -> {
                    assertThat(TransactionSynchronizationManager.isActualTransactionActive())
                            .isFalse();
                    return success;
                });

        reconciliationWorker.reconcilePendingPayments();

        assertThat(jdbc.queryForObject("select status from events where event_id = ?",
                String.class, fixture.eventId())).isEqualTo("ONGOING");
        assertThat(jdbc.queryForObject("select status from booth_payments "
                + "where booth_payment_id = ?", String.class, pending.paymentId()))
                .isEqualTo("SUCCESS");
        assertThat(jdbc.queryForObject("select status from booth_holds "
                + "where booth_request_id = ?", String.class, fixture.requestId()))
                .isEqualTo("CONSUMED");
        assertThat(jdbc.queryForObject("select count(*) from booth_assignments assignment "
                + "join booth_holds hold on hold.booth_hold_id = assignment.booth_hold_id "
                + "where hold.booth_request_id = ?", Integer.class, fixture.requestId()))
                .isOne();
    }

    @Test
    void reconciliationWorkerRechecksEventAfterNetworkAndRetainsLateSuccess()
            throws Exception {
        Fixture fixture = fixture(10_000, "SELECTED");
        insertHold(fixture.configId(), fixture.requestId(), 10_000);
        PendingPayment pending = createPendingPayment(fixture.requestId());
        Instant now = Instant.now();
        jdbc.update("update booth_payments set checkout_expires_at = ? "
                        + "where booth_payment_id = ?",
                Timestamp.from(now.minus(Duration.ofMinutes(10))), pending.paymentId());
        VnPayResult success = new VnPayResult(true, "BSP" + pending.paymentId(),
                "1000000", "00", "00", "999995", "success after event completed");
        when(gateway.query(eq(pending.paymentId()), any(), any(), any(), any()))
                .thenAnswer(invocation -> {
                    assertThat(TransactionSynchronizationManager.isActualTransactionActive())
                            .isFalse();
                    Instant providerReturnedAt = Instant.now();
                    jdbc.update("update events set start_at = ?, end_at = ?, "
                                    + "status = 'PUBLISHED' where event_id = ?",
                            Timestamp.from(providerReturnedAt.minus(Duration.ofHours(2))),
                            Timestamp.from(providerReturnedAt.minus(Duration.ofHours(1))),
                            fixture.eventId());
                    return success;
                });

        reconciliationWorker.reconcilePendingPayments();

        assertThat(jdbc.queryForObject("select status from events where event_id = ?",
                String.class, fixture.eventId())).isEqualTo("COMPLETED");
        assertThat(jdbc.queryForObject("select status from booth_payments "
                + "where booth_payment_id = ?", String.class, pending.paymentId()))
                .isEqualTo("PENDING");
        assertThat(jdbc.queryForObject("select reconciliation_required from booth_payments "
                + "where booth_payment_id = ?", Boolean.class, pending.paymentId())).isTrue();
        assertThat(jdbc.queryForObject("select reconciliation_detail from booth_payments "
                + "where booth_payment_id = ?", String.class, pending.paymentId()))
                .isEqualTo("VERIFIED_LATE_SUCCESS_REQUIRES_MANUAL_REFUND");
        assertThat(jdbc.queryForObject("select count(*) from booth_assignments assignment "
                + "join booth_holds hold on hold.booth_hold_id = assignment.booth_hold_id "
                + "where hold.booth_request_id = ?", Integer.class, fixture.requestId()))
                .isZero();
    }

    @Test
    void lateSuccessAndHoldExpiryRaceNeverCreatesAnExpiredAssignedState() throws Exception {
        Fixture fixture = fixture(10_000, "SELECTED");
        insertHold(fixture.configId(), fixture.requestId(), 10_000);
        PendingPayment pending = createPendingPayment(fixture.requestId());
        Instant now = Instant.now();
        jdbc.update("update booth_payments set status = 'TIMEOUT', completed_at = ?, "
                        + "trusted_incomplete_query_count = 2, reconciliation_required = false "
                        + "where booth_payment_id = ?", Timestamp.from(now), pending.paymentId());
        jdbc.update("update booth_holds set created_at = ?, expires_at = ? "
                        + "where booth_request_id = ?", Timestamp.from(now.minusSeconds(7200)),
                Timestamp.from(now.minusSeconds(3600)), fixture.requestId());
        VnPayResult lateSuccess = new VnPayResult(true, "BSP" + pending.paymentId(),
                "1000000", "00", "00", "999998", "late success");
        CountDownLatch start = new CountDownLatch(1);
        ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            Future<?> settlement = executor.submit(() -> {
                await(start);
                return settlementService.acceptIpn(lateSuccess, now);
            });
            Future<?> expiry = executor.submit(() -> {
                await(start);
                return expiryService.expireDueHolds(now);
            });
            start.countDown();
            settlement.get(10, TimeUnit.SECONDS);
            expiry.get(10, TimeUnit.SECONDS);
        } finally {
            start.countDown();
            executor.shutdownNow();
        }

        String holdStatus = jdbc.queryForObject("select status from booth_holds "
                + "where booth_request_id = ?", String.class, fixture.requestId());
        int assignmentCount = jdbc.queryForObject("select count(*) from booth_assignments a "
                + "join booth_holds h on h.booth_hold_id = a.booth_hold_id "
                + "where h.booth_request_id = ?", Integer.class, fixture.requestId());
        assertThat(holdStatus.equals("EXPIRED") && assignmentCount > 0).isFalse();
    }

    @Test
    void paymentAndAssignmentQueriesHideResourcesFromAnotherPartner() throws Exception {
        Fixture fixture = fixture(10_000, "SELECTED");
        insertHold(fixture.configId(), fixture.requestId(), 10_000);
        PendingPayment pending = createPendingPayment(fixture.requestId());
        Long stranger = insertUser("Other Partner");
        try {
            mvc.perform(get("/api/v1/partner/booth-payments/{paymentId}", pending.paymentId())
                            .with(identity(stranger, "PARTNER")))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.code").value("BOOTH_PAYMENT_NOT_FOUND"));
            mvc.perform(get("/api/v1/partner/booth-requests/{requestId}/assignment",
                            fixture.requestId()).with(identity(stranger, "PARTNER")))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.code").value("BOOTH_REQUEST_NOT_FOUND"));
        } finally {
            jdbc.update("delete from users where user_id = ?", stranger);
        }
    }

    @Test
    void verifiedLateSuccessAfterReleasedHoldRequiresManualRefundAndNoAssignment()
            throws Exception {
        Fixture fixture = fixture(10_000, "SELECTED");
        insertHold(fixture.configId(), fixture.requestId(), 10_000);
        PendingPayment pending = createPendingPayment(fixture.requestId());
        String txnRef = "BSP" + pending.paymentId();
        VnPayResult incomplete = new VnPayResult(true, txnRef, "1000000",
                "00", "01", "123456", "incomplete");
        Instant firstQueryAt = pending.checkoutExpiresAt().plus(Duration.ofMinutes(5))
                .plusSeconds(1);
        settlementService.acceptQuery(pending.paymentId(), incomplete, firstQueryAt);
        settlementService.acceptQuery(pending.paymentId(), incomplete,
                firstQueryAt.plus(Duration.ofMinutes(5)).plusSeconds(1));

        Timestamp holdExpiry = jdbc.queryForObject(
                "select expires_at from booth_holds where booth_request_id = ?",
                Timestamp.class, fixture.requestId());
        Instant afterHoldExpiry = holdExpiry.toInstant().plusSeconds(1);
        assertThat(expiryService.expireDueHolds(afterHoldExpiry)).isOne();

        VnPayResult lateSuccess = new VnPayResult(true, txnRef, "1000000",
                "00", "00", "999999", "late success");
        assertThat(settlementService.acceptIpn(lateSuccess, afterHoldExpiry.plusSeconds(1)))
                .extracting(ack -> ack.rspCode()).isEqualTo("00");

        assertThat(jdbc.queryForObject("select status from booth_payments "
                + "where booth_payment_id = ?", String.class, pending.paymentId()))
                .isEqualTo("TIMEOUT");
        assertThat(jdbc.queryForObject("select reconciliation_required from booth_payments "
                + "where booth_payment_id = ?", Boolean.class, pending.paymentId())).isTrue();
        assertThat(jdbc.queryForObject("select reconciliation_detail from booth_payments "
                + "where booth_payment_id = ?", String.class, pending.paymentId()))
                .isEqualTo("VERIFIED_LATE_SUCCESS_REQUIRES_MANUAL_REFUND");
        assertThat(jdbc.queryForObject("select count(*) from booth_assignments assignment "
                + "join booth_holds hold on hold.booth_hold_id = assignment.booth_hold_id "
                + "where hold.booth_request_id = ?", Integer.class, fixture.requestId()))
                .isZero();
    }

    @Test
    void verifiedSuccessAfterEventEndIsRetainedWithoutCreatingAssignment()
            throws Exception {
        Fixture fixture = fixture(10_000, "SELECTED");
        insertHold(fixture.configId(), fixture.requestId(), 10_000);
        PendingPayment pending = createPendingPayment(fixture.requestId());
        Instant now = Instant.now();
        jdbc.update("update events set start_at = ?, end_at = ?, status = 'PUBLISHED' "
                        + "where event_id = ?", Timestamp.from(now.minus(Duration.ofHours(2))),
                Timestamp.from(now.minus(Duration.ofHours(1))), fixture.eventId());

        VnPayResult success = new VnPayResult(true, "BSP" + pending.paymentId(),
                "1000000", "00", "00", "999997", "success after event end");

        assertThat(settlementService.acceptIpn(success, now).rspCode()).isEqualTo("00");
        assertThat(jdbc.queryForObject("select status from events where event_id = ?",
                String.class, fixture.eventId())).isEqualTo("COMPLETED");
        assertThat(jdbc.queryForObject("select status from booth_payments "
                + "where booth_payment_id = ?", String.class, pending.paymentId()))
                .isEqualTo("PENDING");
        assertThat(jdbc.queryForObject("select reconciliation_required from booth_payments "
                + "where booth_payment_id = ?", Boolean.class, pending.paymentId())).isTrue();
        assertThat(jdbc.queryForObject("select status from booth_holds "
                + "where booth_request_id = ?", String.class, fixture.requestId()))
                .isEqualTo("ACTIVE");
        assertThat(jdbc.queryForObject("select status from booth_requests "
                + "where booth_request_id = ?", String.class, fixture.requestId()))
                .isEqualTo("SELECTED");
        assertThat(jdbc.queryForObject("select count(*) from booth_assignments assignment "
                + "join booth_holds hold on hold.booth_hold_id = assignment.booth_hold_id "
                + "where hold.booth_request_id = ?", Integer.class, fixture.requestId()))
                .isZero();
    }

    @Test
    void selectedWithdrawalReleasesImmediatelyAndAllowsAnotherSelection() throws Exception {
        Fixture fixture = fixture(10_000, "SELECTED");
        insertHold(fixture.configId(), fixture.requestId(), 10_000);
        String originalResponse = withdraw(fixture.requestId(), 200, null);
        var before = jdbc.queryForMap("select withdrawn_at from booth_requests where booth_request_id = ?",
                fixture.requestId());
        assertThat(withdraw(fixture.requestId(), 200, null)).isEqualTo(originalResponse);
        assertThat(jdbc.queryForMap("select withdrawn_at from booth_requests where booth_request_id = ?",
                fixture.requestId())).isEqualTo(before);
        assertRequestAndHold(fixture.requestId(), "WITHDRAWN", "RELEASED");
        assertThat(jdbc.queryForObject("select released_at = (select withdrawn_at from booth_requests "
                        + "where booth_request_id = ?) from booth_holds where booth_request_id = ?",
                Boolean.class, fixture.requestId(), fixture.requestId())).isTrue();
        mvc.perform(get("/api/v1/events/{eventId}/booths/{boothId}", fixture.eventId(), fixture.boothId()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.availability").value("AVAILABLE"));
        long nextId = submitAgain(fixture);
        mvc.perform(post("/api/v1/organizer/events/{eventId}/booth-requests/{id}/select",
                        fixture.eventId(), nextId).with(identity(organizer, "ORGANIZER")).with(csrf()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("SELECTED"));
        assertRequestAndHold(nextId, "SELECTED", "ACTIVE");
    }

    @Test
    void pendingWithdrawalIsIdempotentAndDoesNotCreateHold() throws Exception {
        Fixture fixture = fixture(10_000, "PENDING");
        withdraw(fixture.requestId(), 200, null);
        Timestamp first = jdbc.queryForObject("select withdrawn_at from booth_requests where booth_request_id = ?",
                Timestamp.class, fixture.requestId());
        withdraw(fixture.requestId(), 200, null);
        assertThat(jdbc.queryForObject("select withdrawn_at from booth_requests where booth_request_id = ?",
                Timestamp.class, fixture.requestId())).isEqualTo(first);
        assertThat(jdbc.queryForObject("select count(*) from booth_holds where booth_request_id = ?",
                Integer.class, fixture.requestId())).isZero();
    }

    @Test
    void pendingCheckoutAndUnknownPaymentPreventWithdrawalAndExpiry() throws Exception {
        Fixture fixture = fixture(10_000, "SELECTED");
        insertHold(fixture.configId(), fixture.requestId(), 10_000);
        PendingPayment pending = createPendingPayment(fixture.requestId());
        withdraw(fixture.requestId(), 409, "PAYMENT_ATTEMPT_ALREADY_PENDING");
        jdbc.update("update booth_payments set checkout_expires_at = current_timestamp - interval '1 minute' "
                + "where booth_payment_id = ?", pending.paymentId());
        withdraw(fixture.requestId(), 409, "PAYMENT_RESULT_UNKNOWN");
        expiryService.expireDueHolds(Instant.now().plus(Duration.ofHours(1)));
        assertRequestAndHold(fixture.requestId(), "SELECTED", "ACTIVE");
    }

    @Test
    void terminalPaymentWithReconciliationEvidenceBlocksBothReleaseAndExpiry() throws Exception {
        Fixture fixture = fixture(10_000, "SELECTED");
        insertHold(fixture.configId(), fixture.requestId(), 10_000);
        PendingPayment pending = createPendingPayment(fixture.requestId());
        settlementService.acceptIpn(result(pending, "02"), Instant.now());
        settlementService.acceptIpn(result(pending, "00"), Instant.now());
        withdraw(fixture.requestId(), 409, "PAYMENT_RESULT_UNKNOWN");
        expiryService.expireDueHolds(Instant.now().plus(Duration.ofHours(1)));
        assertRequestAndHold(fixture.requestId(), "SELECTED", "ACTIVE");
        assertThat(jdbc.queryForObject("select reconciliation_required from booth_payments "
                + "where booth_payment_id = ?", Boolean.class, pending.paymentId())).isTrue();
    }

    @Test
    void verifiedFailureAllowsReleaseAndLateSuccessDoesNotAffectNewHold() throws Exception {
        Fixture fixture = fixture(10_000, "SELECTED");
        insertHold(fixture.configId(), fixture.requestId(), 10_000);
        PendingPayment pending = createPendingPayment(fixture.requestId());
        settlementService.acceptIpn(result(pending, "02"), Instant.now());
        withdraw(fixture.requestId(), 200, null);
        long nextId = submitAgain(fixture);
        mvc.perform(post("/api/v1/organizer/events/{eventId}/booth-requests/{id}/select",
                        fixture.eventId(), nextId).with(identity(organizer, "ORGANIZER")).with(csrf()))
                .andExpect(status().isOk());
        settlementService.acceptIpn(result(pending, "00"), Instant.now());
        assertRequestAndHold(fixture.requestId(), "WITHDRAWN", "RELEASED");
        assertRequestAndHold(nextId, "SELECTED", "ACTIVE");
        assertThat(jdbc.queryForObject("select reconciliation_required from booth_payments "
                + "where booth_payment_id = ?", Boolean.class, pending.paymentId())).isTrue();
        assertNoAssignment(fixture.requestId());
        assertNoAssignment(nextId);
    }

    @Test
    void verifiedTimeoutAllowsSelectedWithdrawal() throws Exception {
        Fixture fixture = fixture(10_000, "SELECTED");
        insertHold(fixture.configId(), fixture.requestId(), 10_000);
        PendingPayment pending = createPendingPayment(fixture.requestId());
        Instant first = pending.checkoutExpiresAt().plus(Duration.ofMinutes(6));
        settlementService.acceptQuery(pending.paymentId(), result(pending, "01"), first);
        settlementService.acceptQuery(pending.paymentId(), result(pending, "01"),
                first.plus(Duration.ofMinutes(6)));
        assertPaymentState(pending.paymentId(), "TIMEOUT", 2, false);
        withdraw(fixture.requestId(), 200, null);
        assertRequestAndHold(fixture.requestId(), "WITHDRAWN", "RELEASED");
    }

    @Test
    void settlementRacingWithdrawalConsumesHoldAndRejectsWithdrawal() throws Exception {
        Fixture fixture = fixture(10_000, "SELECTED");
        insertHold(fixture.configId(), fixture.requestId(), 10_000);
        PendingPayment pending = createPendingPayment(fixture.requestId());
        CountDownLatch start = new CountDownLatch(1);
        try (ExecutorService pool = Executors.newFixedThreadPool(2)) {
            Future<Integer> withdrawal = pool.submit(() -> {
                await(start);
                return mvc.perform(post("/api/v1/partner/booth-requests/{id}/withdraw", fixture.requestId())
                                .with(identity(partner, "PARTNER")).with(csrf()))
                        .andReturn().getResponse().getStatus();
            });
            Future<?> settlement = pool.submit(() -> {
                await(start);
                settlementService.acceptIpn(result(pending, "00"), Instant.now());
            });
            start.countDown();
            assertThat(withdrawal.get(10, TimeUnit.SECONDS)).isEqualTo(409);
            settlement.get(10, TimeUnit.SECONDS);
        }
        assertRequestAndHold(fixture.requestId(), "COMPLETED", "CONSUMED");
        assertThat(jdbc.queryForObject("select count(*) from booth_assignments a join booth_holds h "
                + "on a.booth_hold_id = h.booth_hold_id where h.booth_request_id = ?",
                Integer.class, fixture.requestId())).isOne();
    }

    @Test
    void lateContradictorySettlementRacingWithdrawalNeverSilentlyAssigns() throws Exception {
        Fixture fixture = fixture(10_000, "SELECTED");
        insertHold(fixture.configId(), fixture.requestId(), 10_000);
        PendingPayment pending = createPendingPayment(fixture.requestId());
        settlementService.acceptIpn(result(pending, "02"), Instant.now());
        CountDownLatch start = new CountDownLatch(1);
        try (ExecutorService pool = Executors.newFixedThreadPool(2)) {
            Future<Integer> withdrawal = pool.submit(() -> {
                await(start);
                return mvc.perform(post("/api/v1/partner/booth-requests/{id}/withdraw", fixture.requestId())
                                .with(identity(partner, "PARTNER")).with(csrf()))
                        .andReturn().getResponse().getStatus();
            });
            Future<?> settlement = pool.submit(() -> {
                await(start);
                settlementService.acceptIpn(result(pending, "00"), Instant.now());
            });
            start.countDown();
            int response = withdrawal.get(10, TimeUnit.SECONDS);
            settlement.get(10, TimeUnit.SECONDS);
            assertThat(response).isIn(200, 409);
            assertRequestAndHold(fixture.requestId(), response == 200 ? "WITHDRAWN" : "SELECTED",
                    response == 200 ? "RELEASED" : "ACTIVE");
        }
        assertNoAssignment(fixture.requestId());
        assertThat(jdbc.queryForObject("select reconciliation_required from booth_payments "
                + "where booth_payment_id = ?", Boolean.class, pending.paymentId())).isTrue();
    }

    @Test
    void cancellationRacingSubmissionLeavesNoOpenRequestInCancelledEvent() throws Exception {
        Fixture fixture = fixture(10_000, "PENDING");
        withdraw(fixture.requestId(), 200, null);
        CountDownLatch start = new CountDownLatch(1);
        try (ExecutorService pool = Executors.newFixedThreadPool(2)) {
            Future<Integer> submission = pool.submit(() -> {
                await(start);
                return mvc.perform(post("/api/v1/events/{id}/booth-requests", fixture.eventId())
                                .with(identity(partner, "PARTNER")).with(csrf())
                                .contentType("application/json").content("{\"boothId\":" + fixture.boothId() + "}"))
                        .andReturn().getResponse().getStatus();
            });
            Future<?> cancellation = pool.submit(() -> {
                await(start);
                mvc.perform(post("/api/v1/organizer/events/{id}/cancel", fixture.eventId())
                                .with(identity(organizer, "ORGANIZER")).with(csrf())
                                .contentType("application/json").content("{\"reason\":\"Venue is unavailable for this event\"}"))
                        .andExpect(status().isOk());
                return null;
            });
            start.countDown();
            assertThat(submission.get(10, TimeUnit.SECONDS)).isIn(201, 404);
            cancellation.get(10, TimeUnit.SECONDS);
        }
        mvc.perform(post("/api/v1/events/{id}/booth-requests", fixture.eventId())
                        .with(identity(partner, "PARTNER")).with(csrf()).contentType("application/json")
                        .content("{\"boothId\":" + fixture.boothId() + "}"))
                .andExpect(status().isNotFound());
        assertThat(jdbc.queryForObject("select count(*) from booth_requests r join partner_event_applications a "
                        + "on r.application_id = a.application_id where a.event_id = ? and r.status in ('PENDING','SELECTED')",
                Integer.class, fixture.eventId())).isZero();
    }

    @Test
    void cancellationRacingSelectionLeavesNoSelectedRequestOrActiveHold() throws Exception {
        Fixture fixture = fixture(10_000, "PENDING");
        CountDownLatch start = new CountDownLatch(1);
        try (ExecutorService pool = Executors.newFixedThreadPool(2)) {
            Future<Integer> selection = pool.submit(() -> {
                await(start);
                return mvc.perform(post("/api/v1/organizer/events/{eventId}/booth-requests/{id}/select",
                                fixture.eventId(), fixture.requestId())
                                .with(identity(organizer, "ORGANIZER")).with(csrf()))
                        .andReturn().getResponse().getStatus();
            });
            Future<Integer> cancellation = pool.submit(() -> {
                await(start);
                return mvc.perform(post("/api/v1/organizer/events/{id}/cancel", fixture.eventId())
                                .with(identity(organizer, "ORGANIZER")).with(csrf())
                                .contentType("application/json")
                                .content("{\"reason\":\"Venue is unavailable for this event\"}"))
                        .andReturn().getResponse().getStatus();
            });
            start.countDown();
            assertThat(selection.get(10, TimeUnit.SECONDS)).isIn(200, 404);
            assertThat(cancellation.get(10, TimeUnit.SECONDS)).isEqualTo(200);
        }

        assertThat(jdbc.queryForObject("select status from events where event_id = ?",
                String.class, fixture.eventId())).isEqualTo("CANCELLED");
        assertThat(jdbc.queryForObject("select status from booth_requests where booth_request_id = ?",
                String.class, fixture.requestId())).isEqualTo("CANCELLED");
        assertThat(jdbc.queryForObject("select count(*) from booth_holds where booth_request_id = ? "
                        + "and status = 'ACTIVE'", Integer.class, fixture.requestId())).isZero();
    }

    @Test
    void submissionWaitsForEventRootAndRechecksCancellationAfterCommit() throws Exception {
        Fixture fixture = fixture(10_000, "PENDING");
        withdraw(fixture.requestId(), 200, null);
        CountDownLatch locked = new CountDownLatch(1);
        CountDownLatch commit = new CountDownLatch(1);
        try (ExecutorService pool = Executors.newFixedThreadPool(2)) {
            Future<?> cancellation = pool.submit(() -> new TransactionTemplate(transactionManager)
                    .executeWithoutResult(transaction -> {
                        jdbc.queryForObject("select event_id from events where event_id = ? for update",
                                Long.class, fixture.eventId());
                        jdbc.update("update events set status = 'CANCELLED', cancelled_at = current_timestamp, "
                                + "cancellation_reason = 'Venue unavailable' where event_id = ?", fixture.eventId());
                        locked.countDown();
                        await(commit);
                    }));
            await(locked);
            Future<Integer> submission = pool.submit(() -> mvc.perform(
                            post("/api/v1/events/{id}/booth-requests", fixture.eventId())
                                    .with(identity(partner, "PARTNER")).with(csrf())
                                    .contentType("application/json")
                                    .content("{\"boothId\":" + fixture.boothId() + "}"))
                    .andReturn().getResponse().getStatus());
            try {
                assertThatThrownBy(() -> submission.get(300, TimeUnit.MILLISECONDS))
                        .isInstanceOf(java.util.concurrent.TimeoutException.class);
            } finally {
                commit.countDown();
            }
            cancellation.get(10, TimeUnit.SECONDS);
            assertThat(submission.get(10, TimeUnit.SECONDS)).isEqualTo(404);
        }
    }

    @Test
    void expiryRacingWithdrawalConvergesOnOneTerminalHoldTransition() throws Exception {
        Fixture fixture = fixture(10_000, "SELECTED");
        insertHold(fixture.configId(), fixture.requestId(), 10_000);
        CountDownLatch start = new CountDownLatch(1);
        try (ExecutorService pool = Executors.newFixedThreadPool(2)) {
            Future<Integer> withdrawal = pool.submit(() -> {
                await(start);
                return mvc.perform(post("/api/v1/partner/booth-requests/{id}/withdraw", fixture.requestId())
                                .with(identity(partner, "PARTNER")).with(csrf()))
                        .andReturn().getResponse().getStatus();
            });
            Future<Integer> expiry = pool.submit(() -> {
                await(start);
                return expiryService.expireDueHolds(Instant.now().plus(Duration.ofHours(1)));
            });
            start.countDown();
            int response = withdrawal.get(10, TimeUnit.SECONDS);
            expiry.get(10, TimeUnit.SECONDS);
            assertThat(response).isIn(200, 409);
            assertRequestAndHold(fixture.requestId(), response == 200 ? "WITHDRAWN" : "PAYMENT_EXPIRED",
                    response == 200 ? "RELEASED" : "EXPIRED");
        }
        assertNoAssignment(fixture.requestId());
    }

    @Test
    void missingOrExpiredHoldAndTerminalRequestCannotBeWithdrawn() throws Exception {
        Fixture fixture = fixture(10_000, "SELECTED");
        withdraw(fixture.requestId(), 409, "BOOTH_HOLD_NOT_ACTIVE");
        insertHold(fixture.configId(), fixture.requestId(), 10_000);
        expiryService.expireDueHolds(Instant.now().plus(Duration.ofHours(1)));
        withdraw(fixture.requestId(), 409, "BOOTH_REQUEST_NOT_WITHDRAWABLE");
        assertRequestAndHold(fixture.requestId(), "PAYMENT_EXPIRED", "EXPIRED");
    }

    @Test
    void reviewAndConfigurationRecheckEventLifecycle() throws Exception {
        Fixture fixture = fixture(10_000, "PENDING");
        jdbc.update("update events set start_at = current_timestamp - interval '1 minute' where event_id = ?",
                fixture.eventId());
        mvc.perform(post("/api/v1/organizer/events/{eventId}/booth-requests/{id}/select",
                        fixture.eventId(), fixture.requestId()).with(identity(organizer, "ORGANIZER")).with(csrf()))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("EVENT_NOT_FOUND"));
        mvc.perform(post("/api/v1/organizer/events/{eventId}/booth-requests/{id}/reject",
                        fixture.eventId(), fixture.requestId()).with(identity(organizer, "ORGANIZER")).with(csrf())
                        .contentType("application/json").content("{\"reviewNote\":\"Not eligible for selection\"}"))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("EVENT_NOT_FOUND"));
        mvc.perform(put("/api/v1/organizer/events/{eventId}/booth-configs/{boothId}",
                        fixture.eventId(), fixture.boothId()).with(identity(organizer, "ORGANIZER")).with(csrf())
                        .contentType("application/json").content("{\"rentalPrice\":20000,\"enabled\":true}"))
                .andExpect(status().isConflict());
        assertThat(jdbc.queryForObject("select status from booth_requests where booth_request_id = ?",
                String.class, fixture.requestId())).isEqualTo("PENDING");
    }

    private String withdraw(long requestId, int expectedStatus, String code) throws Exception {
        var response = mvc.perform(post("/api/v1/partner/booth-requests/{id}/withdraw", requestId)
                .with(identity(partner, "PARTNER")).with(csrf())).andExpect(status().is(expectedStatus));
        if (code != null) {
            response.andExpect(jsonPath("$.code").value(code));
        } else {
            response.andExpect(jsonPath("$.status").value("WITHDRAWN"));
        }
        return response.andReturn().getResponse().getContentAsString();
    }

    private long submitAgain(Fixture fixture) throws Exception {
        String body = mvc.perform(post("/api/v1/events/{id}/booth-requests", fixture.eventId())
                        .with(identity(partner, "PARTNER")).with(csrf()).contentType("application/json")
                        .content("{\"boothId\":" + fixture.boothId() + "}"))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return mapper.readTree(body).get("boothRequestId").asLong();
    }

    private void assertRequestAndHold(long requestId, String requestStatus, String holdStatus) {
        assertThat(jdbc.queryForObject("select status from booth_requests where booth_request_id = ?",
                String.class, requestId)).isEqualTo(requestStatus);
        assertThat(jdbc.queryForObject("select status from booth_holds where booth_request_id = ?",
                String.class, requestId)).isEqualTo(holdStatus);
    }

    private void assertNoAssignment(long requestId) {
        assertThat(jdbc.queryForObject("select count(*) from booth_assignments a join booth_holds h "
                        + "on a.booth_hold_id = h.booth_hold_id where h.booth_request_id = ?",
                Integer.class, requestId)).isZero();
    }

    private VnPayResult result(PendingPayment payment, String transactionStatus) {
        return new VnPayResult(true, "BSP" + payment.paymentId(), "1000000", "00",
                transactionStatus, "S4" + payment.paymentId(), "Sprint 4 release verification");
    }

    private PendingPayment createPendingPayment(long requestId) throws Exception {
        UUID key = UUID.randomUUID();
        when(gateway.buildCheckout(anyLong(), any(), any(), any(), any()))
                .thenAnswer(invocation -> new VnPayCheckout(
                        "https://sandbox.example/checkout/" + invocation.getArgument(0),
                        invocation.getArgument(4)));
        String body = mvc.perform(post("/api/v1/partner/booth-requests/{requestId}/payments",
                        requestId).header("Idempotency-Key", key.toString())
                        .with(identity(partner, "PARTNER")).with(csrf()))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        JsonNode payment = mapper.readTree(body).get("payment");
        return new PendingPayment(payment.get("boothPaymentId").asLong(), key,
                Instant.parse(mapper.readTree(body).get("sessionExpiresAt").asText()));
    }

    private void assertPaymentState(long paymentId, String status, int trustedQueryCount,
            boolean reconciliationRequired) {
        var state = jdbc.queryForMap("select status, trusted_incomplete_query_count, "
                        + "reconciliation_required from booth_payments where booth_payment_id = ?",
                paymentId);
        assertThat(state.get("status")).isEqualTo(status);
        assertThat(((Number) state.get("trusted_incomplete_query_count")).intValue())
                .isEqualTo(trustedQueryCount);
        assertThat(state.get("reconciliation_required")).isEqualTo(reconciliationRequired);
    }

    private Fixture fixture(int price, String requestStatus) {
        Instant start = Instant.now().plus(Duration.ofDays(30));
        long eventId = jdbc.queryForObject("""
                insert into events(organizer_user_id, name, start_at, end_at,
                    booth_request_deadline_at, booth_payment_window_minutes,
                    max_booths_per_partner, max_activities_per_partner,
                    status, created_at, updated_at)
                values (?, ?, ?, ?, ?, 60, 2, 2, 'PUBLISHED',
                    current_timestamp, current_timestamp) returning event_id
                """, Long.class, organizer, prefix + " Event", Timestamp.from(start),
                Timestamp.from(start.plus(Duration.ofDays(2))),
                Timestamp.from(Instant.now().plus(Duration.ofDays(10))));
        long locationId = jdbc.queryForObject("""
                insert into locations(code, name, max_capacity, is_active, location_type,
                    created_at, updated_at)
                values (?, 'Payment Booth', 8, true, 'BOOTH', current_timestamp,
                    current_timestamp) returning location_id
                """, Long.class, prefix + "A1");
        jdbc.update("insert into booths(booth_id, category_code) values (?, 'PUBLISHER')",
                locationId);
        long configId = jdbc.queryForObject("""
                insert into event_booth_configs(event_id, booth_id, rental_price, is_enabled)
                values (?, ?, ?, true) returning event_booth_config_id
                """, Long.class, eventId, locationId, price);
        long organizationId = jdbc.queryForObject("""
                insert into partner_organizations(representative_user_id, name, category_code,
                    status, created_at, updated_at)
                values (?, ?, 'PUBLISHER', 'ACTIVE', current_timestamp, current_timestamp)
                returning partner_organization_id
                """, Long.class, partner, prefix + " Partner");
        long applicationId = jdbc.queryForObject("""
                insert into partner_event_applications(partner_organization_id, event_id,
                    status, submitted_at, reviewed_at)
                values (?, ?, 'APPROVED', current_timestamp, current_timestamp)
                returning application_id
                """, Long.class, organizationId, eventId);
        long requestId = jdbc.queryForObject("""
                insert into booth_requests(application_id, booth_id, status, submitted_at,
                    reviewed_at, selected_at)
                values (?, ?, ?, current_timestamp,
                    case when ? = 'SELECTED' then current_timestamp else null end,
                    case when ? = 'SELECTED' then current_timestamp else null end)
                returning booth_request_id
                """, Long.class, applicationId, locationId, requestStatus,
                requestStatus, requestStatus);
        return new Fixture(eventId, locationId, configId, requestId);
    }

    private Fixture addSelectedRequest(long eventId, long existingRequestId, int price) {
        long applicationId = jdbc.queryForObject(
                "select application_id from booth_requests where booth_request_id = ?",
                Long.class, existingRequestId);
        String code = prefix + "B" + UUID.randomUUID().toString().substring(0, 4).toUpperCase();
        long locationId = jdbc.queryForObject("""
                insert into locations(code, name, max_capacity, is_active, location_type,
                    created_at, updated_at)
                values (?, 'Second Payment Booth', 8, true, 'BOOTH', current_timestamp,
                    current_timestamp) returning location_id
                """, Long.class, code);
        jdbc.update("insert into booths(booth_id, category_code) values (?, 'PUBLISHER')",
                locationId);
        long configId = jdbc.queryForObject("""
                insert into event_booth_configs(event_id, booth_id, rental_price, is_enabled)
                values (?, ?, ?, true) returning event_booth_config_id
                """, Long.class, eventId, locationId, price);
        long requestId = jdbc.queryForObject("""
                insert into booth_requests(application_id, booth_id, status, submitted_at,
                    reviewed_at, selected_at)
                values (?, ?, 'SELECTED', current_timestamp, current_timestamp,
                    current_timestamp) returning booth_request_id
                """, Long.class, applicationId, locationId);
        return new Fixture(eventId, locationId, configId, requestId);
    }

    private void insertHold(long configId, long requestId, int price) {
        jdbc.update("""
                insert into booth_holds(event_booth_config_id, booth_request_id,
                    locked_rental_price, status, created_at, expires_at)
                values (?, ?, ?, 'ACTIVE', current_timestamp, current_timestamp + interval '30 min')
                """, configId, requestId, price);
    }

    private Long insertUser(String label) {
        return jdbc.queryForObject("""
                insert into users(username, password_hash, full_name, email,
                    email_verified_at, status)
                values (?, ?, ?, ?, current_timestamp, 'ACTIVE') returning user_id
                """, Long.class, "pay" + UUID.randomUUID().toString().replace("-", "")
                        .substring(0, 12),
                new BCryptPasswordEncoder().encode(UUID.randomUUID().toString()),
                label + " Payment Test", UUID.randomUUID() + "@example.test");
    }

    private static void await(CountDownLatch latch) {
        try {
            if (!latch.await(5, TimeUnit.SECONDS)) {
                throw new AssertionError("Concurrent test did not start in time.");
            }
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt();
            throw new AssertionError(error);
        }
    }

    private static RequestPostProcessor identity(Long id, String role) {
        return authentication(UsernamePasswordAuthenticationToken.authenticated(
                new Identity(id, true), null,
                List.of(new SimpleGrantedAuthority("ROLE_" + role))));
    }

    record Fixture(long eventId, long boothId, long configId, long requestId) { }
    record PendingPayment(long paymentId, UUID key, Instant checkoutExpiresAt) { }
    record Identity(Long userId, boolean emailVerified) implements AuthenticatedPrincipal { }
}
