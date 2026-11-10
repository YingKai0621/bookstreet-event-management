package com.swp391.bookstreet.payment;

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
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** AC-ORG-PAY-S11-01 and 02: an Organizer reads only the Booth Payments of Events they own. */
@SpringBootTest(properties = {
        "spring.datasource.url=${EVENT_TEST_DATABASE_URL}",
        "logging.level.root=ERROR"
})
@EnabledIfEnvironmentVariable(named = "EVENT_TEST_DATABASE_URL", matches = ".+")
@ContextConfiguration(initializers = OrganizerPaymentHistoryIntegrationTests.TestDatabaseGuard.class)
class OrganizerPaymentHistoryIntegrationTests {
    static class TestDatabaseGuard
            implements ApplicationContextInitializer<ConfigurableApplicationContext> {
        @Override
        public void initialize(ConfigurableApplicationContext context) {
            String url = context.getEnvironment().getRequiredProperty("spring.datasource.url");
            if (!url.matches("jdbc:postgresql://[^/]+/[A-Za-z0-9_]+_event_test(?:\\?.*)?")) {
                throw new IllegalStateException("Organizer payment tests require a *_event_test database.");
            }
        }
    }

    private static final String PAYMENTS = "/api/v1/organizer/booth-payments";

    @Autowired WebApplicationContext context;
    @Autowired JdbcTemplate jdbc;

    private MockMvc mvc;
    private String prefix;
    private long organizerA;
    private long organizerB;
    private long partnerId;
    private long organizationId;
    private final List<Long> events = new ArrayList<>();
    private final List<Long> locations = new ArrayList<>();

    private long eventA;
    private long eventB;
    private long successA;
    private long failedA;
    private long pendingA;
    private long successB;

    @BeforeEach
    void setup() {
        assertThat(jdbc.queryForObject("select current_database()", String.class)).endsWith("_event_test");
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        prefix = "opay" + UUID.randomUUID().toString().replace("-", "").substring(0, 8);
        organizerA = user("orga");
        organizerB = user("orgb");
        partnerId = user("partner");
        organizationId = jdbc.queryForObject("""
                insert into partner_organizations(representative_user_id, name, category_code, status, created_at, updated_at)
                values (?, ?, 'PUBLISHER', 'ACTIVE', current_timestamp, current_timestamp)
                returning partner_organization_id
                """, Long.class, partnerId, prefix + " Nhà sách");

        eventA = event(organizerA, "Hội sách " + prefix);
        eventB = event(organizerB, "Đêm thơ " + prefix);
        long holdA = hold(eventA, "A1");
        long holdB = hold(eventB, "B1");
        Instant now = Instant.now().truncatedTo(ChronoUnit.SECONDS);
        failedA = payment(holdA, "FAILED", 1_500_000, now.minus(2, ChronoUnit.DAYS), "GATEWAY_DECLINED");
        successA = payment(holdA, "SUCCESS", 1_500_000, now.minus(1, ChronoUnit.DAYS), null);
        pendingA = payment(hold(eventA, "A2"), "PENDING", 900_000, now, null);
        successB = payment(holdB, "SUCCESS", 2_500_000, now, null);
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
        jdbc.update("delete from users where user_id in (?, ?, ?)", organizerA, organizerB, partnerId);
    }

    @Test
    void anOrganizerSeesOnlyPaymentsOfTheirOwnEvents() throws Exception {
        mvc.perform(get(PAYMENTS).with(organizer(organizerA)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(3))
                .andExpect(jsonPath("$.content[0].boothPaymentId").value(pendingA))
                .andExpect(jsonPath("$.content[1].boothPaymentId").value(successA))
                .andExpect(jsonPath("$.content[2].boothPaymentId").value(failedA))
                .andExpect(jsonPath("$.content[1].event.eventId").value(eventA))
                .andExpect(jsonPath("$.content[1].partnerOrganization.name").value(prefix + " Nhà sách"))
                .andExpect(jsonPath("$.collectedAmount").value(1_500_000.0));

        mvc.perform(get(PAYMENTS).with(organizer(organizerB)))
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].boothPaymentId").value(successB))
                .andExpect(jsonPath("$.collectedAmount").value(2_500_000.0));
    }

    @Test
    void anotherOrganizersEventMatchesNothing() throws Exception {
        mvc.perform(get(PAYMENTS).param("eventId", String.valueOf(eventB)).with(organizer(organizerA)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(0))
                .andExpect(jsonPath("$.collectedAmount").value(0));
        mvc.perform(get(PAYMENTS).param("search", "Đêm thơ " + prefix).with(organizer(organizerA)))
                .andExpect(jsonPath("$.totalElements").value(0));
    }

    @Test
    void theCollectedAmountKeepsCountingWhenTheListShowsOtherStatuses() throws Exception {
        mvc.perform(get(PAYMENTS).param("status", "FAILED").with(organizer(organizerA)))
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].boothPaymentId").value(failedA))
                .andExpect(jsonPath("$.collectedAmount").value(1_500_000.0));
        mvc.perform(get(PAYMENTS).param("search", (prefix + "A2").toUpperCase()).with(organizer(organizerA)))
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].boothPaymentId").value(pendingA))
                .andExpect(jsonPath("$.collectedAmount").value(0));
    }

    @Test
    void responsesLeaveGatewayDetailsToAdmin() throws Exception {
        String body = mvc.perform(get(PAYMENTS).with(organizer(organizerA)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        assertThat(body).doesNotContain("reconciliationRequired", "gatewayTransactionRef", "gatewayProvider",
                "failureCode", "GATEWAY_DECLINED", "checkoutUrl", "idempotencyKey", "failureMessage", "secret-checkout");
    }

    @Test
    void unsupportedValuesAndAdminOnlyFiltersAreRejected() throws Exception {
        for (String[] query : List.of(
                new String[] {"status", "PAID"},
                new String[] {"eventId", "x"},
                new String[] {"from", "08/11/2026"},
                new String[] {"size", "101"})) {
            mvc.perform(get(PAYMENTS).param(query[0], query[1]).with(organizer(organizerA)))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("INVALID_FILTER"));
        }
        mvc.perform(get(PAYMENTS).param("sort", "status,asc").with(organizer(organizerA)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_SORT"));
        // The reconciliation filter is Admin oversight and has no effect here.
        mvc.perform(get(PAYMENTS).param("reconciliationRequired", "true").with(organizer(organizerA)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(3));
    }

    @Test
    void onlyOrganizersReadAndNothingChangesAPayment() throws Exception {
        mvc.perform(get(PAYMENTS)).andExpect(status().isUnauthorized());
        mvc.perform(get(PAYMENTS).with(role(organizerA, "ADMIN"))).andExpect(status().isForbidden());
        mvc.perform(get(PAYMENTS).with(role(partnerId, "PARTNER"))).andExpect(status().isForbidden());
        for (MockHttpServletRequestBuilder change : List.of(
                post(PAYMENTS), patch(PAYMENTS + "/" + successA), delete(PAYMENTS + "/" + successA))) {
            mvc.perform(change.with(organizer(organizerA)).with(csrf()))
                    .andExpect(result -> assertThat(result.getResponse().getStatus()).isIn(404, 405));
        }
        assertThat(jdbc.queryForObject("select status from booth_payments where booth_payment_id = ?",
                String.class, successA)).isEqualTo("SUCCESS");
    }

    private long user(String suffix) {
        return jdbc.queryForObject("""
                insert into users(username, password_hash, full_name, email, email_verified_at, status)
                values (?, '{noop}unused', 'Payment Test User', ?, current_timestamp, 'ACTIVE')
                returning user_id
                """, Long.class, prefix + suffix, prefix + suffix + "@example.test");
    }

    private long event(long organizerId, String name) {
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
        // One application per organization and Event: a second Booth on the same Event reuses it.
        List<Long> existing = jdbc.queryForList("""
                select application_id from partner_event_applications
                where partner_organization_id = ? and event_id = ?
                """, Long.class, organizationId, eventId);
        long application = !existing.isEmpty() ? existing.getFirst() : jdbc.queryForObject("""
                insert into partner_event_applications(partner_organization_id, event_id, status, submitted_at, reviewed_at)
                values (?, ?, 'APPROVED', current_timestamp, current_timestamp)
                returning application_id
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

    private long payment(long hold, String paymentStatus, long amount, Instant createdAt, String failureCode) {
        Timestamp created = Timestamp.from(createdAt);
        return jdbc.queryForObject("""
                insert into booth_payments(booth_hold_id, transaction_type, purpose, amount, status, idempotency_key,
                    gateway_provider, gateway_transaction_ref, checkout_url, reconciliation_required, failure_code,
                    created_at, updated_at, completed_at)
                values (?, 'PAYMENT', 'INITIAL_BOOTH_RENTAL', ?, ?, ?, 'VNPAY', ?,
                    'https://sandbox.example/secret-checkout', ?, ?, ?, ?, ?)
                returning booth_payment_id
                """, Long.class, hold, amount, paymentStatus, UUID.randomUUID(), prefix + UUID.randomUUID(),
                "PENDING".equals(paymentStatus), failureCode, created, created,
                "PENDING".equals(paymentStatus) ? null : created);
    }

    private RequestPostProcessor organizer(long userId) {
        return role(userId, "ORGANIZER");
    }

    private RequestPostProcessor role(long userId, String role) {
        return authentication(UsernamePasswordAuthenticationToken.authenticated(new Identity(userId, true), null,
                List.of(new SimpleGrantedAuthority("ROLE_" + role))));
    }

    record Identity(Long userId, boolean emailVerified) implements AuthenticatedPrincipal {
    }
}
