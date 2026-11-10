package com.swp391.bookstreet.admin;

import com.swp391.bookstreet.security.authentication.AuthenticatedPrincipal;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
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
import org.springframework.security.test.context.TestSecurityContextHolder;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** AC-OPT-S11-01: Admin lists Booth Payments across Events, read-only, without gateway secrets. */
@SpringBootTest(properties = {
        "spring.datasource.url=${EVENT_TEST_DATABASE_URL}",
        "logging.level.root=ERROR"
})
@EnabledIfEnvironmentVariable(named = "EVENT_TEST_DATABASE_URL", matches = ".+")
@ContextConfiguration(initializers = AdminBoothPaymentIntegrationTests.TestDatabaseGuard.class)
class AdminBoothPaymentIntegrationTests {
    static class TestDatabaseGuard
            implements ApplicationContextInitializer<ConfigurableApplicationContext> {
        @Override
        public void initialize(ConfigurableApplicationContext context) {
            String url = context.getEnvironment().getRequiredProperty("spring.datasource.url");
            if (!url.matches("jdbc:postgresql://[^/]+/[A-Za-z0-9_]+_event_test(?:\\?.*)?")) {
                throw new IllegalStateException("Admin payment tests require a *_event_test database.");
            }
        }
    }

    private static final String PAYMENTS = "/api/v1/admin/booth-payments";

    @Autowired WebApplicationContext context;
    @Autowired JdbcTemplate jdbc;

    private MockMvc mvc;
    private String prefix;
    private long adminId;
    private long organizerId;
    private long partnerId;
    private final List<Long> events = new ArrayList<>();
    private final List<Long> locations = new ArrayList<>();
    private long organizationId;

    private long firstEvent;
    private long secondEvent;
    private long success;
    private long failed;
    private long timeout;
    private long pending;
    private long otherEventSuccess;

    @BeforeEach
    void setup() {
        assertThat(jdbc.queryForObject("select current_database()", String.class)).endsWith("_event_test");
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        prefix = "pay" + UUID.randomUUID().toString().replace("-", "").substring(0, 8);
        adminId = user("admin");
        organizerId = user("org");
        partnerId = user("partner");
        organizationId = jdbc.queryForObject("""
                insert into partner_organizations(representative_user_id, name, category_code, status, created_at, updated_at)
                values (?, ?, 'PUBLISHER', 'ACTIVE', current_timestamp, current_timestamp)
                returning partner_organization_id
                """, Long.class, partnerId, prefix + " Nhà sách");

        firstEvent = event("Hội sách " + prefix);
        secondEvent = event("Đêm thơ " + prefix);
        long firstHold = hold(firstEvent, "A1");
        long secondHold = hold(secondEvent, "B1");

        Instant now = Instant.now().truncatedTo(ChronoUnit.SECONDS);
        failed = payment(firstHold, "FAILED", 1_500_000, now.minus(3, ChronoUnit.DAYS), false, prefix + "F");
        timeout = payment(firstHold, "TIMEOUT", 1_500_000, now.minus(2, ChronoUnit.DAYS), false, null);
        success = payment(firstHold, "SUCCESS", 1_500_000, now.minus(1, ChronoUnit.DAYS), false, prefix + "S");
        pending = payment(secondHold, "PENDING", 2_000_000, now, true, prefix + "P");
        otherEventSuccess = payment(secondHold, "SUCCESS", 2_500_000, now.minus(5, ChronoUnit.DAYS), false, null);
    }

    @AfterEach
    void cleanup() {
        TestSecurityContextHolder.clearContext();
        jdbc.update("""
                delete from booth_payments where booth_hold_id in (
                    select h.booth_hold_id from booth_holds h join booth_requests r on r.booth_request_id = h.booth_request_id
                    join partner_event_applications a on a.application_id = r.application_id
                    where a.partner_organization_id = ?)
                """, organizationId);
        jdbc.update("""
                delete from booth_holds where booth_request_id in (
                    select r.booth_request_id from booth_requests r join partner_event_applications a
                    on a.application_id = r.application_id where a.partner_organization_id = ?)
                """, organizationId);
        jdbc.update("""
                delete from booth_requests where application_id in (
                    select application_id from partner_event_applications where partner_organization_id = ?)
                """, organizationId);
        jdbc.update("delete from partner_event_applications where partner_organization_id = ?", organizationId);
        for (Long event : events) jdbc.update("delete from event_booth_configs where event_id = ?", event);
        for (Long location : locations) {
            jdbc.update("delete from booths where booth_id = ?", location);
            jdbc.update("delete from locations where location_id = ?", location);
        }
        for (Long event : events) jdbc.update("delete from events where event_id = ?", event);
        jdbc.update("delete from partner_organizations where partner_organization_id = ?", organizationId);
        jdbc.update("delete from users where user_id in (?, ?, ?)", adminId, organizerId, partnerId);
    }

    @Test
    void listsEveryStatusAcrossEventsNewestFirstWithItsContext() throws Exception {
        mvc.perform(get(PAYMENTS).param("search", prefix).param("size", "100").with(admin()))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", containsString("no-store")))
                .andExpect(jsonPath("$.totalElements").value(5))
                .andExpect(jsonPath("$.content[0].boothPaymentId").value(pending))
                .andExpect(jsonPath("$.content[0].status").value("PENDING"))
                .andExpect(jsonPath("$.content[0].reconciliationRequired").value(true))
                .andExpect(jsonPath("$.content[0].completedAt").doesNotExist())
                .andExpect(jsonPath("$.content[0].event.eventId").value(secondEvent))
                .andExpect(jsonPath("$.content[0].partnerOrganization.partnerOrganizationId").value(organizationId))
                .andExpect(jsonPath("$.content[0].booth.code").value((prefix + "B1").toUpperCase()))
                .andExpect(jsonPath("$.content[0].amount").value(2_000_000.0))
                .andExpect(jsonPath("$.content[1].boothPaymentId").value(success))
                .andExpect(jsonPath("$.content[2].boothPaymentId").value(timeout))
                .andExpect(jsonPath("$.content[3].boothPaymentId").value(failed))
                .andExpect(jsonPath("$.content[4].boothPaymentId").value(otherEventSuccess));
    }

    @Test
    void responsesCarryNoGatewaySecretOrRawCallbackData() throws Exception {
        String body = mvc.perform(get(PAYMENTS).param("search", prefix).with(admin()))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        assertThat(body).doesNotContain("checkoutUrl", "idempotencyKey", "providerResponseCode",
                "providerTransactionStatus", "reconciliationDetail", "failureMessage");
        assertThat(body).doesNotContain("secret-checkout", "raw-callback", "gateway said no");
    }

    @Test
    void filtersByStatusEventReconciliationSearchAndBusinessDate() throws Exception {
        expectOnly(List.of(success, otherEventSuccess), "status", "SUCCESS");
        expectOnly(List.of(pending, otherEventSuccess), "eventId", String.valueOf(secondEvent));
        expectOnly(List.of(pending), "reconciliationRequired", "true");
        expectOnly(List.of(success), "status", "SUCCESS", "eventId", String.valueOf(firstEvent));
        expectOnly(List.of(failed), "search", (prefix + "F").toUpperCase());

        String today = java.time.LocalDate.now(java.time.ZoneId.of("Asia/Ho_Chi_Minh")).toString();
        String yesterday = java.time.LocalDate.now(java.time.ZoneId.of("Asia/Ho_Chi_Minh")).minusDays(1).toString();
        expectOnly(List.of(pending), "from", today);
        expectOnly(List.of(success), "from", yesterday, "to", yesterday);
    }

    @Test
    void sortsByAmount() throws Exception {
        mvc.perform(get(PAYMENTS).param("search", prefix).param("sort", "amount,desc").with(admin()))
                .andExpect(jsonPath("$.content[0].boothPaymentId").value(otherEventSuccess))
                .andExpect(jsonPath("$.content[1].boothPaymentId").value(pending));
        mvc.perform(get(PAYMENTS).param("search", prefix).param("sort", "amount,asc").param("size", "1").with(admin()))
                .andExpect(jsonPath("$.content.length()").value(1))
                .andExpect(jsonPath("$.totalPages").value(5))
                .andExpect(jsonPath("$.content[0].amount").value(1_500_000.0));
    }

    @Test
    void unsupportedQueryValuesAreRejected() throws Exception {
        for (String[] query : List.of(
                new String[] {"status", "PAID"},
                new String[] {"status", "success"},
                new String[] {"eventId", "abc"},
                new String[] {"eventId", "0"},
                new String[] {"reconciliationRequired", "yes"},
                new String[] {"from", "08/11/2026"},
                new String[] {"page", "-1"},
                new String[] {"size", "101"},
                new String[] {"search", "x".repeat(101)})) {
            mvc.perform(get(PAYMENTS).param(query[0], query[1]).with(admin()))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("INVALID_FILTER"));
        }
        mvc.perform(get(PAYMENTS).param("from", "2026-11-09").param("to", "2026-11-08").with(admin()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_FILTER"));
        mvc.perform(get(PAYMENTS).param("sort", "status,asc").with(admin()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_SORT"));
    }

    @Test
    void onlyAdminReadsAndNoOperationChangesAPayment() throws Exception {
        mvc.perform(get(PAYMENTS)).andExpect(status().isUnauthorized());
        mvc.perform(get(PAYMENTS).with(identity("ORGANIZER"))).andExpect(status().isForbidden());
        mvc.perform(get(PAYMENTS).with(identity("PARTNER"))).andExpect(status().isForbidden());

        for (MockHttpServletRequestBuilder change : List.of(
                post(PAYMENTS), patch(PAYMENTS + "/" + success), delete(PAYMENTS + "/" + success))) {
            mvc.perform(change.with(admin()).with(csrf()))
                    .andExpect(result -> assertThat(result.getResponse().getStatus()).isIn(404, 405));
        }
        assertThat(jdbc.queryForObject("select status from booth_payments where booth_payment_id = ?",
                String.class, success)).isEqualTo("SUCCESS");
        assertThat(jdbc.queryForObject("select count(*) from admin_audit_logs where actor_user_id = ?",
                Integer.class, adminId)).isZero();
    }

    private void expectOnly(List<Long> expected, String... query) throws Exception {
        boolean searching = List.of(query).contains("search");
        // Every row of this test shares the prefix, which keeps rows from other tests out of the totals.
        var request = get(PAYMENTS).param("size", "100").with(admin());
        if (!searching) request = request.param("search", prefix);
        for (int i = 0; i < query.length; i += 2) {
            request = request.param(query[i], query[i + 1]);
        }
        String body = mvc.perform(request).andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(expected.size()))
                .andReturn().getResponse().getContentAsString();
        for (Long id : expected) {
            assertThat(body).contains("\"boothPaymentId\":" + id + ",");
        }
    }

    private long user(String suffix) {
        return jdbc.queryForObject("""
                insert into users(username, password_hash, full_name, email, email_verified_at, status)
                values (?, '{noop}unused', 'Payment Test User', ?, current_timestamp, 'ACTIVE')
                returning user_id
                """, Long.class, prefix + suffix, prefix + suffix + "@example.test");
    }

    private long event(String name) {
        Instant start = Instant.now().plus(30, ChronoUnit.DAYS);
        long id = jdbc.queryForObject("""
                insert into events(organizer_user_id, name, start_at, end_at, booth_payment_window_minutes,
                    max_booths_per_partner, max_activities_per_partner, status, created_at, updated_at)
                values (?, ?, ?, ?, 60, 2, 3, 'PUBLISHED', current_timestamp, current_timestamp)
                returning event_id
                """, Long.class, organizerId, name, Timestamp.from(start), Timestamp.from(start.plus(1, ChronoUnit.DAYS)));
        events.add(id);
        return id;
    }

    private long hold(long eventId, String boothCode) {
        long application = jdbc.queryForObject("""
                insert into partner_event_applications(partner_organization_id, event_id, status, submitted_at, reviewed_at)
                values (?, ?, 'APPROVED', current_timestamp, current_timestamp) returning application_id
                """, Long.class, organizationId, eventId);
        long booth = jdbc.queryForObject("""
                insert into locations(code, name, location_type, max_capacity, is_active, created_at, updated_at)
                values (?, ?, 'BOOTH', 10, true, current_timestamp, current_timestamp)
                returning location_id
                """, Long.class, (prefix + boothCode).toUpperCase(), "Gian " + boothCode);
        locations.add(booth);
        jdbc.update("insert into booths(booth_id, category_code) values (?, 'PUBLISHER')", booth);
        long config = jdbc.queryForObject("""
                insert into event_booth_configs(event_id, booth_id, rental_price, is_enabled)
                values (?, ?, 1500000, true) returning event_booth_config_id
                """, Long.class, eventId, booth);
        long request = jdbc.queryForObject("""
                insert into booth_requests(application_id, booth_id, status, submitted_at, reviewed_at, selected_at)
                values (?, ?, 'SELECTED', current_timestamp, current_timestamp, current_timestamp)
                returning booth_request_id
                """, Long.class, application, booth);
        return jdbc.queryForObject("""
                insert into booth_holds(event_booth_config_id, booth_request_id, locked_rental_price, status,
                    created_at, expires_at)
                values (?, ?, 1500000, 'ACTIVE', current_timestamp, current_timestamp + interval '1 day')
                returning booth_hold_id
                """, Long.class, config, request);
    }

    private long payment(long hold, String paymentStatus, long amount, Instant createdAt,
            boolean reconciliation, String gatewayRef) {
        Timestamp created = Timestamp.from(createdAt);
        return jdbc.queryForObject("""
                insert into booth_payments(booth_hold_id, transaction_type, purpose, amount, status, idempotency_key,
                    gateway_provider, gateway_transaction_ref, checkout_url, provider_response_code,
                    reconciliation_required, reconciliation_detail, failure_code, failure_message,
                    created_at, updated_at, completed_at)
                values (?, 'PAYMENT', 'INITIAL_BOOTH_RENTAL', ?, ?, ?, 'VNPAY', ?,
                    'https://sandbox.example/secret-checkout', '24', ?, ?, ?, ?, ?, ?, ?)
                returning booth_payment_id
                """, Long.class, hold, amount, paymentStatus, UUID.randomUUID(), gatewayRef, reconciliation,
                reconciliation ? "raw-callback payload" : null,
                "FAILED".equals(paymentStatus) ? "GATEWAY_DECLINED" : null,
                "FAILED".equals(paymentStatus) ? "gateway said no" : null,
                created, created, "PENDING".equals(paymentStatus) ? null : created);
    }

    private RequestPostProcessor admin() {
        return identity("ADMIN");
    }

    private RequestPostProcessor identity(String role) {
        return authentication(UsernamePasswordAuthenticationToken.authenticated(new Identity(adminId, true), null,
                List.of(new SimpleGrantedAuthority("ROLE_" + role))));
    }

    record Identity(Long userId, boolean emailVerified) implements AuthenticatedPrincipal {
    }
}
